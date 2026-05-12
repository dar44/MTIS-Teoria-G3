/* eslint-disable no-unused-vars */
const Service = require('./Service');
const db = require('../ConexionDB/Conexion');
const { validarWSKey } = require('../utils/Utils');
const fs = require('fs');
const path = require('path');

const DIR_FACTURAS = path.join(__dirname, '..', 'uploaded_files', 'facturas');

/**
 * Genera contenido XML de una factura
 */
function construirXML(factura, empresa) {
  const total = (parseFloat(factura.base_imponible) * (1 + parseFloat(factura.iva))).toFixed(2);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<factura xmlns="urn:facturacion-electronica:g3">',
    `  <id>${factura.id}</id>`,
    `  <numeroFactura>${factura.numero_factura}</numeroFactura>`,
    '  <empresa>',
    `    <id>${empresa.id}</id>`,
    `    <nombre>${empresa.nombre}</nombre>`,
    `    <nif>${empresa.nif}</nif>`,
    `    <email>${empresa.email}</email>`,
    '  </empresa>',
    `  <baseImponible>${factura.base_imponible}</baseImponible>`,
    `  <iva>${factura.iva}</iva>`,
    `  <total>${total}</total>`,
    `  <moneda>${factura.moneda}</moneda>`,
    `  <tipo>${factura.tipo}</tipo>`,
    `  <estado>${factura.estado}</estado>`,
    `  <fechaEmision>${factura.fecha_emision}</fechaEmision>`,
    '</factura>',
  ].join('\n');
}

/**
 * Genera contenido PDF simulado (texto plano)
 */
function construirPDF(factura, empresa) {
  const total = (parseFloat(factura.base_imponible) * (1 + parseFloat(factura.iva))).toFixed(2);
  return [
    '════════════════════════════════════════════════',
    '         FACTURA ELECTRÓNICA',
    '════════════════════════════════════════════════',
    `  Factura Nº:      ${factura.numero_factura}`,
    `  Fecha emisión:   ${factura.fecha_emision}`,
    `  Empresa:         ${empresa.nombre} (${empresa.nif})`,
    `  Base imponible:  ${factura.base_imponible} ${factura.moneda}`,
    `  IVA:             ${(parseFloat(factura.iva) * 100)}%`,
    `  Total:           ${total} ${factura.moneda}`,
    `  Tipo:            ${factura.tipo}`,
    `  Estado:          ${factura.estado}`,
    '════════════════════════════════════════════════',
  ].join('\n');
}

/**
 * Generar XML de la factura
 */
const generarXmlFactura = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerFacturaPorId(idFactura);
      if (!factura) {
        return reject(Service.rejectResponse(`Factura ${idFactura} no encontrada`, 404));
      }

      const empresa = await db.buscarEmpresaPorEmail(
        (await db.ejecutarQuery('SELECT email FROM empresas WHERE id = ?', [factura.empresa_id]))[0]?.email,
      );

      if (!fs.existsSync(DIR_FACTURAS)) fs.mkdirSync(DIR_FACTURAS, { recursive: true });

      const ruta = path.join(DIR_FACTURAS, `${factura.numero_factura}.xml`);
      const xml = construirXML(factura, empresa || { id: factura.empresa_id, nombre: '', nif: '', email: '' });
      fs.writeFileSync(ruta, xml, 'utf8');

      resolve(Service.successResponse({
        idFactura: factura.id,
        tipoDocumento: 'XML',
        generado: true,
        ruta,
        mensaje: 'Documento XML generado correctamente',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al generar XML',
        e.status || 500,
      ));
    }
  },
);

/**
 * Generar PDF de la factura
 */
const generarPdfFactura = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerFacturaPorId(idFactura);
      if (!factura) {
        return reject(Service.rejectResponse(`Factura ${idFactura} no encontrada`, 404));
      }

      const empresa = await db.buscarEmpresaPorEmail(
        (await db.ejecutarQuery('SELECT email FROM empresas WHERE id = ?', [factura.empresa_id]))[0]?.email,
      );

      if (!fs.existsSync(DIR_FACTURAS)) fs.mkdirSync(DIR_FACTURAS, { recursive: true });

      const ruta = path.join(DIR_FACTURAS, `${factura.numero_factura}.pdf`);
      const pdf = construirPDF(factura, empresa || { id: factura.empresa_id, nombre: '', nif: '', email: '' });
      fs.writeFileSync(ruta, pdf, 'utf8');

      resolve(Service.successResponse({
        idFactura: factura.id,
        tipoDocumento: 'PDF',
        generado: true,
        ruta,
        mensaje: 'Documento PDF generado correctamente',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al generar PDF',
        e.status || 500,
      ));
    }
  },
);

/**
 * Almacenar documentos en directorio de red
 */
const almacenarDocumentosRed = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerFacturaPorId(idFactura);
      if (!factura) {
        return reject(Service.rejectResponse(`Factura ${idFactura} no encontrada`, 404));
      }

      // Simulación de almacenamiento en red
      resolve(Service.successResponse({
        idFactura: factura.id,
        almacenado: true,
        mensaje: 'Documentos almacenados en directorio de red correctamente',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al almacenar documentos',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  almacenarDocumentosRed,
  generarPdfFactura,
  generarXmlFactura,
};
