/* eslint-disable no-unused-vars */
const Service = require('./Service');
const db = require('../ConexionDB/Conexion');
const smtp = require('../ConexionFakeSMTP/ConexionFakeSMTP');
const { validarWSKey } = require('../utils/Utils');
const fs = require('fs');
const path = require('path');

const EMAIL_SISTEMA = 'facturacion@sistema-g3.com';
const EMAIL_AGENCIA = 'agencia@tributaria.es';

/**
 * Convierte fecha ISO 8601 (2026-05-12T14:30:50Z) a formato MySQL DATETIME (2026-05-12 14:30:50)
 */
function toMySQLDatetime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Genera contenido XML de una factura electrónica
 */
function generarContenidoXML(idFactura, factura, empresa) {
  const total = (factura.baseImponible * (1 + factura.iva)).toFixed(2);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<factura xmlns="urn:facturacion-electronica:g3">',
    `  <id>${idFactura}</id>`,
    `  <numeroFactura>${factura.numeroFactura}</numeroFactura>`,
    '  <empresa>',
    `    <id>${empresa.id}</id>`,
    `    <nombre>${empresa.nombre}</nombre>`,
    `    <nif>${empresa.nif}</nif>`,
    `    <email>${empresa.email}</email>`,
    `    <iban>${empresa.iban}</iban>`,
    '  </empresa>',
    `  <baseImponible>${factura.baseImponible}</baseImponible>`,
    `  <iva>${factura.iva}</iva>`,
    `  <total>${total}</total>`,
    `  <moneda>${factura.moneda}</moneda>`,
    `  <tipo>${factura.tipo}</tipo>`,
    `  <fechaEmision>${factura.fechaEmision}</fechaEmision>`,
    factura.fechaDesdeFacturacion
      ? `  <fechaDesdeFacturacion>${factura.fechaDesdeFacturacion}</fechaDesdeFacturacion>` : null,
    factura.fechaHastaFacturacion
      ? `  <fechaHastaFacturacion>${factura.fechaHastaFacturacion}</fechaHastaFacturacion>` : null,
    '</factura>',
  ].filter(Boolean).join('\n');
}

/**
 * Genera contenido PDF simulado (texto plano) de una factura
 */
function generarContenidoPDF(idFactura, factura, empresa) {
  const total = (factura.baseImponible * (1 + factura.iva)).toFixed(2);
  return [
    '════════════════════════════════════════════════',
    '         FACTURA ELECTRÓNICA',
    '════════════════════════════════════════════════',
    '',
    `  Factura Nº:      ${factura.numeroFactura}`,
    `  ID Factura:      ${idFactura}`,
    `  Fecha emisión:   ${factura.fechaEmision}`,
    '',
    '  ── DATOS DE LA EMPRESA ──',
    `  Nombre:          ${empresa.nombre}`,
    `  NIF:             ${empresa.nif}`,
    `  Email:           ${empresa.email}`,
    `  IBAN:            ${empresa.iban}`,
    empresa.direccion ? `  Dirección:       ${empresa.direccion}` : null,
    '',
    '  ── DETALLE DE FACTURA ──',
    `  Base imponible:  ${factura.baseImponible} ${factura.moneda}`,
    `  IVA:             ${(factura.iva * 100)}%`,
    `  Total:           ${total} ${factura.moneda}`,
    `  Tipo:            ${factura.tipo}`,
    '',
    '════════════════════════════════════════════════',
  ].filter(l => l !== null).join('\n');
}

/**
 * Iniciar flujo de emisión de factura
 * Orquesta el proceso completo según el BPMN:
 * 1. Validar WSKey
 * 2. Validar datos de entrada
 * 3. Consultar empresa en BD
 * 4. Verificar si está registrada
 * 5. Verificar coincidencia de datos
 * 6. Crear y persistir factura
 * 7. Generar XML
 * 8. Generar PDF
 * 9. Enviar a Agencia Tributaria
 * 10. Notificar resultado a la empresa
 *
 * emisionFacturaRequest EmisionFacturaRequest
 * returns ProcesoEmisionResponse
 */
const iniciarFlujoEmision = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    let idFactura = null;

    try {
      const { empresa, factura } = body;

      // ─── PASO 1: Validar WSKey ───
      try {
        await validarWSKey(WSKey);
      } catch (wsError) {
        // Registrar intento no autorizado en auditoría
        try {
          await db.registrarEventoAuditoria({
            tipoEvento: 'INTENTO_NO_AUTORIZADO',
            descripcion: `WSKey inválida en flujo de emisión. Solicitante: ${empresa?.email || 'desconocido'}`,
            fecha: new Date(),
            origen: 'flujo-emision',
          });
        } catch (_) { /* error de auditoría no bloquea el flujo */ }

        return reject(Service.rejectResponse(
          wsError.salida || 'Acceso no autorizado',
          wsError.status || 401,
        ));
      }

      // ─── PASO 2: Validar datos de entrada ───
      const faltantes = [];
      if (!empresa) {
        faltantes.push('empresa');
      } else {
        if (!empresa.email) faltantes.push('email');
        if (!empresa.nombre) faltantes.push('nombre');
        if (!empresa.nif) faltantes.push('nif');
        if (!empresa.iban) faltantes.push('iban');
      }
      if (!factura) {
        faltantes.push('factura');
      } else {
        if (!factura.numeroFactura) faltantes.push('numeroFactura');
        if (factura.baseImponible == null) faltantes.push('baseImponible');
        if (factura.iva == null) faltantes.push('iva');
        if (!factura.moneda) faltantes.push('moneda');
        if (!factura.tipo) faltantes.push('tipo');
        if (!factura.fechaEmision) faltantes.push('fechaEmision');
      }

      if (faltantes.length > 0) {
        return reject(Service.rejectResponse(
          `Datos de entrada inválidos. Campos faltantes: ${faltantes.join(', ')}`,
          400,
        ));
      }

      // ─── PASO 3: Consultar empresa en BD ───
      const empresaBD = await db.buscarEmpresaPorEmail(empresa.email);

      // ─── PASO 4: Verificar si la empresa está registrada ───
      if (!empresaBD) {
        // Notificar a la empresa que no está registrada
        try {
          await smtp.sendEmail(
            EMAIL_SISTEMA,
            empresa.email,
            'Empresa no registrada en el sistema de facturación',
            `Estimado/a ${empresa.nombre},\n\n`
            + `Su empresa con email ${empresa.email} no se encuentra registrada `
            + `en nuestro sistema de facturación electrónica.\n\n`
            + `Contacte con el administrador para completar el alta.\n\n`
            + `Un saludo,\nSistema de Facturación Electrónica G3`,
          );
        } catch (_) { /* error de email no bloquea */ }

        return reject(Service.rejectResponse(
          `La empresa con email ${empresa.email} no está registrada`,
          404,
        ));
      }

      // ─── PASO 5: Verificar coincidencia de datos ───
      const datosCoinciden = (
        empresaBD.nombre === empresa.nombre
        && empresaBD.nif === empresa.nif
        && empresaBD.iban === empresa.iban
      );
      const estadoFactura = datosCoinciden ? 'VALIDA' : 'INVALIDA';

      // ─── PASO 6: Crear y persistir la factura en BD ───
      const facturaCreada = await db.crearFactura({
        empresaId: empresaBD.id,
        numeroFactura: factura.numeroFactura,
        baseImponible: factura.baseImponible,
        iva: factura.iva,
        moneda: factura.moneda,
        tipo: factura.tipo,
        estado: estadoFactura,
        fechaEmision: toMySQLDatetime(factura.fechaEmision),
        fechaDesdeFacturacion: factura.fechaDesdeFacturacion || null,
        fechaHastaFacturacion: factura.fechaHastaFacturacion || null,
      });
      idFactura = facturaCreada.idFactura;

      // ─── PASO 7: Generar XML de la factura ───
      let rutaXml;
      try {
        const dirFacturas = path.join(__dirname, '..', 'uploaded_files', 'facturas');
        if (!fs.existsSync(dirFacturas)) {
          fs.mkdirSync(dirFacturas, { recursive: true });
        }
        const contenidoXml = generarContenidoXML(idFactura, factura, empresaBD);
        rutaXml = path.join(dirFacturas, `${factura.numeroFactura}.xml`);
        fs.writeFileSync(rutaXml, contenidoXml, 'utf8');
      } catch (xmlErr) {
        // Registrar error técnico de XML en auditoría
        try {
          await db.registrarErrorAuditoria({
            tipoError: 'ERROR_GENERACION_XML',
            descripcion: `Error generando XML: ${xmlErr.message}`,
            fecha: new Date(),
            origen: 'flujo-emision',
            idFactura,
          });
        } catch (_) { }
        // Notificar fallo técnico a la empresa
        try {
          await smtp.sendEmail(
            EMAIL_SISTEMA, empresa.email,
            `Error técnico - Factura ${factura.numeroFactura}`,
            `Estimado/a ${empresa.nombre},\n\n`
            + `Error técnico al generar el XML de su factura ${factura.numeroFactura}.\n`
            + `Nuestro equipo ha sido notificado.\n\nSistema de Facturación G3`,
          );
        } catch (_) { }
        return reject(Service.rejectResponse('Error técnico al generar el XML', 500));
      }

      // ─── PASO 8: Generar PDF de la factura ───
      let rutaPdf;
      try {
        const dirFacturas = path.join(__dirname, '..', 'uploaded_files', 'facturas');
        const contenidoPdf = generarContenidoPDF(idFactura, factura, empresaBD);
        rutaPdf = path.join(dirFacturas, `${factura.numeroFactura}.pdf`);
        fs.writeFileSync(rutaPdf, contenidoPdf, 'utf8');
      } catch (pdfErr) {
        // Registrar error técnico de PDF
        try {
          await db.registrarErrorAuditoria({
            tipoError: 'ERROR_GENERACION_PDF',
            descripcion: `Error generando PDF: ${pdfErr.message}`,
            fecha: new Date(),
            origen: 'flujo-emision',
            idFactura,
          });
        } catch (_) { }
        // Marcar factura como PENDIENTE
        try {
          await db.actualizarEstadoFactura(idFactura, 'PENDIENTE', 'Error en generación de PDF');
        } catch (_) { }
        // Notificar fallo técnico a la empresa
        try {
          await smtp.sendEmail(
            EMAIL_SISTEMA, empresa.email,
            `Error técnico - Factura ${factura.numeroFactura}`,
            `Estimado/a ${empresa.nombre},\n\n`
            + `Error técnico al generar el PDF de su factura ${factura.numeroFactura}.\n`
            + `La factura queda en estado PENDIENTE.\n\nSistema de Facturación G3`,
          );
        } catch (_) { }
        return reject(Service.rejectResponse('Error técnico al generar el PDF', 500));
      }

      // ─── PASO 9: Enviar XML y PDF a la Agencia Tributaria ───
      try {
        await smtp.sendEmail(
          EMAIL_SISTEMA,
          EMAIL_AGENCIA,
          `Factura electrónica ${factura.numeroFactura} - ${empresa.nombre}`,
          `Factura electrónica ${factura.numeroFactura} emitida por `
          + `${empresa.nombre} (NIF: ${empresa.nif}).\n\n`
          + `Documentos adjuntos:\n`
          + `- ${factura.numeroFactura}.xml\n`
          + `- ${factura.numeroFactura}.pdf`,
        );
      } catch (envioErr) {
        // Actualizar estado a PENDIENTE_REINTENTO
        try {
          await db.actualizarEstadoFactura(
            idFactura, 'PENDIENTE_REINTENTO', 'Error en envío a Agencia Tributaria',
          );
        } catch (_) { }
        // Notificar fallo a la empresa
        try {
          await smtp.sendEmail(
            EMAIL_SISTEMA, empresa.email,
            `Error en envío - Factura ${factura.numeroFactura}`,
            `Estimado/a ${empresa.nombre},\n\n`
            + `No se pudo enviar su factura ${factura.numeroFactura} a la Agencia Tributaria.\n`
            + `Estado: PENDIENTE DE REINTENTO.\n\nSistema de Facturación G3`,
          );
        } catch (_) { }
        return reject(Service.rejectResponse(
          'Error al enviar documentación a la Agencia Tributaria', 500,
        ));
      }

      // ─── PASO 10: Envío exitoso ───
      // Solo actualizar a ENVIADA si la factura era VALIDA
      // Si era INVALIDA (datos no coinciden), se mantiene ese estado
      const estadoFinal = estadoFactura === 'VALIDA' ? 'ENVIADA' : estadoFactura;
      await db.actualizarEstadoFactura(
        idFactura, estadoFinal,
        estadoFactura === 'VALIDA'
          ? 'Enviada correctamente a la Agencia Tributaria'
          : 'Datos de empresa no coinciden con los registrados',
      );

      // Notificar envío exitoso a la empresa
      try {
        const total = (factura.baseImponible * (1 + factura.iva)).toFixed(2);
        await smtp.sendEmail(
          EMAIL_SISTEMA, empresa.email,
          `Factura ${factura.numeroFactura} - Resultado del proceso`,
          `Estimado/a ${empresa.nombre},\n\n`
          + `Su factura ha sido procesada y enviada a la Agencia Tributaria.\n\n`
          + `Resumen:\n`
          + `- Nº Factura: ${factura.numeroFactura}\n`
          + `- Base imponible: ${factura.baseImponible} ${factura.moneda}\n`
          + `- IVA: ${(factura.iva * 100)}%\n`
          + `- Total: ${total} ${factura.moneda}\n`
          + `- Estado: ${estadoFinal}\n`
          + (estadoFinal === 'INVALIDA'
            ? `\nAVISO: Los datos proporcionados no coinciden con los registrados.\n` : '')
          + `\nUn saludo,\nSistema de Facturación Electrónica G3`,
        );
      } catch (_) { /* error de notificación final no bloquea */ }

      // ─── Respuesta final exitosa ───
      resolve(Service.successResponse({
        idFactura,
        numeroFactura: factura.numeroFactura,
        estadoFinal,
        mensaje: estadoFinal === 'ENVIADA'
          ? 'Proceso de emisión completado correctamente'
          : 'Factura procesada con datos no coincidentes',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Error interno del servidor',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  iniciarFlujoEmision,
};
