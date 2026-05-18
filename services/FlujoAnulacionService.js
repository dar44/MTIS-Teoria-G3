/* eslint-disable no-unused-vars */
/**
 * FlujoAnulacionService.js
 * Flujo de Anulación de Facturas — Sergio Mínguez Berja
 *
 * Orquesta el proceso completo de anulación:
 *   1. Validar WSKey
 *   2. Validar datos del solicitante (NIF, empresa registrada)
 *   3. Verificar existencia de la factura
 *   4. Consultar estado actual de la factura
 *   5. Comprobar que la factura es anulable (no anulada previamente)
 *   6. Enviar solicitud de anulación a la Agencia Tributaria
 *   7. Actualizar estado de la factura a "ANULADA"
 *   8. Notificar al emisor el resultado de la anulación
 */
const Service = require('./Service');
const db = require('../ConexionDB/Conexion');
const smtp = require('../ConexionFakeSMTP/ConexionFakeSMTP');
const { validarWSKey } = require('../utils/Utils');

const EMAIL_SISTEMA = 'facturacion@sistema-g3.com';
const EMAIL_AGENCIA_TRIBUTARIA = 'agencia@tributaria.es';

/**
 * Inicia el flujo completo de anulación de factura.
 *
 * @param {object} body - Cuerpo de la petición:
 *   - idFactura       {number}  ID único de la factura a anular
 *   - numeroFactura   {string}  Número de identificación de la factura
 *   - nif             {string}  NIF del solicitante
 *   - email           {string}  Email del solicitante para validación y notificación
 *   - motivoAnulacion {string}  (Opcional) Motivo de la anulación
 * @param {string} WSKey - Clave de autenticación REST
 */
const iniciarFlujoAnulacion = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      // ── PASO 1: Validar WSKey ──────────────────────────────────────────────
      try {
        await validarWSKey(WSKey);
      } catch (e) {
        // Registrar intento no autorizado en auditoría
        await db.registrarEventoAuditoria({
          tipoEvento: 'INTENTO_NO_AUTORIZADO',
          descripcion: `WSKey invalida en flujo de anulacion. Email solicitante: ${body.email || 'desconocido'}`,
          origen: 'FlujoAnulacionService',
        }).catch(() => {}); // no bloquear si falla auditoría

        return reject(Service.rejectResponse(
          'WSKey no valida. Acceso no autorizado al sistema de anulacion de facturas.',
          401,
        ));
      }

      // ── PASO 2: Validar datos del solicitante (NIF + empresa registrada) ──
      const { idFactura, nifSolicitante, emailSolicitante, motivo } = body;

      if (!idFactura || !nifSolicitante || !emailSolicitante) {
        return reject(Service.rejectResponse(
          'Los campos idFactura, nifSolicitante y emailSolicitante son obligatorios',
          400,
        ));
      }

      // Verificar que la empresa está registrada por email
      const empresa = await db.buscarEmpresaPorEmail(emailSolicitante);
      if (!empresa) {
        return reject(Service.rejectResponse(
          `El solicitante con email ${emailSolicitante} no esta registrado en el sistema`,
          400,
        ));
      }

      // Verificar coincidencia de NIF con el registrado
      if (empresa.nif !== nifSolicitante) {
        await db.registrarErrorAuditoria({
          tipoError: 'DATOS_SOLICITANTE_INVALIDOS',
          descripcion: `NIF proporcionado (${nifSolicitante}) no coincide con el registrado para ${emailSolicitante}`,
          origen: 'FlujoAnulacionService',
          idFactura: idFactura || null,
        }).catch(() => {});

        return reject(Service.rejectResponse(
          `El NIF ${nifSolicitante} no corresponde a la empresa registrada con email ${emailSolicitante}`,
          400,
        ));
      }

      // ── PASO 3: Verificar existencia de la factura en el sistema ──────────
      const factura = await db.obtenerFacturaPorId(idFactura);
      if (!factura) {
        // Notificar al solicitante que la factura no existe
        await smtp.sendEmail(
          EMAIL_SISTEMA,
          emailSolicitante,
          `Solicitud de anulacion rechazada - Factura no encontrada`,
          `Su solicitud de anulacion de la factura con ID ${idFactura} ha sido rechazada`
          + ` porque no existe en el sistema.\n\nSistema de Facturacion G3`,
        ).catch(() => {});

        return reject(Service.rejectResponse(
          `No existe ninguna factura con id ${idFactura} en el sistema`,
          404,
        ));
      }

      // ── PASO 4: Consultar estado actual de la factura ─────────────────────
      const estadoActual = factura.estado;
      const numeroFacturaBD = factura.numero_factura;

      // ── PASO 5: Comprobar que la factura es anulable ──────────────────────
      if (estadoActual === 'ANULADA') {
        // Notificar al solicitante que ya está anulada
        await smtp.sendEmail(
          EMAIL_SISTEMA,
          emailSolicitante,
          `Solicitud de anulacion rechazada - Factura ya anulada`,
          `Su solicitud de anulacion de la factura ${numeroFacturaBD} no puede procesarse`
          + ` porque dicha factura ya se encuentra en estado ANULADA.\n\nSistema de Facturacion G3`,
        ).catch(() => {});

        return reject(Service.rejectResponse(
          `La factura ${numeroFacturaBD} ya se encuentra en estado ANULADA`,
          409,
        ));
      }

      // ── PASO 6: Enviar solicitud de anulación a la Agencia Tributaria ─────
      await smtp.sendEmail(
        EMAIL_SISTEMA,
        EMAIL_AGENCIA_TRIBUTARIA,
        `Solicitud de anulacion de factura ${numeroFacturaBD} - ${nifSolicitante}`,
        `Se comunica la anulacion de la factura con los siguientes datos:\n\n`
        + `- Numero de factura: ${numeroFacturaBD}\n`
        + `- ID en sistema: ${idFactura}\n`
        + `- NIF del emisor: ${nifSolicitante}\n`
        + `- Estado anterior: ${estadoActual}\n`
        + `- Motivo de anulacion: ${motivo || 'No especificado'}\n\n`
        + `Sistema de Facturacion Electronica G3`,
      );

      // ── PASO 7: Actualizar estado de la factura a "ANULADA" ───────────────
      await db.actualizarEstadoFactura(
        idFactura,
        'ANULADA',
        motivo || 'Anulacion solicitada por el emisor',
      );

      // Registrar evento de auditoría: anulación exitosa
      await db.registrarEventoAuditoria({
        tipoEvento: 'ANULACION_EXITOSA',
        descripcion: `Factura ${numeroFacturaBD} (ID: ${idFactura}) anulada correctamente por ${emailSolicitante}`,
        origen: 'FlujoAnulacionService',
      }).catch(() => {});

      // ── PASO 8: Notificar al emisor el resultado de la anulación ──────────
      await smtp.sendEmail(
        EMAIL_SISTEMA,
        emailSolicitante,
        `Anulacion de factura ${numeroFacturaBD} completada`,
        `Su factura ${numeroFacturaBD} ha sido anulada correctamente.\n\n`
        + `La solicitud de anulacion ha sido comunicada a la Agencia Tributaria.\n\n`
        + `Estado final: ANULADA\n\n`
        + `Sistema de Facturacion Electronica G3`,
      );

      // Respuesta de éxito
      resolve(Service.successResponse({
        idFactura: parseInt(idFactura, 10),
        numeroFactura: numeroFacturaBD,
        estadoAnterior: estadoActual,
        estadoFinal: 'ANULADA',
        mensaje: 'Proceso de anulacion completado correctamente. Notificacion enviada a la Agencia Tributaria y al emisor.',
      }));

    } catch (e) {
      // Registrar error técnico en auditoría
      await db.registrarErrorAuditoria({
        tipoError: 'ANULACION_ERROR',
        descripcion: e.message || 'Error no especificado en flujo de anulacion',
        origen: 'FlujoAnulacionService',
        idFactura: body.idFactura || null,
      }).catch(() => {});

      reject(Service.rejectResponse(
        e.salida || e.message || 'Error tecnico durante el flujo de anulacion de factura',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  iniciarFlujoAnulacion,
};
