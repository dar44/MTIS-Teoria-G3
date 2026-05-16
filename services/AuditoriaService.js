/* eslint-disable no-unused-vars */
const Service = require('./Service');
const db = require('../ConexionDB/Conexion');
const { validarWSKey } = require('../utils/Utils');

/**
 * Registrar error técnico
 * Registra un error técnico producido durante el proceso.
 *
 * auditoriaErrorRequest AuditoriaErrorRequest
 * returns MensajeResponse
 */
const registrarErrorAuditoria = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const resultado = await db.registrarErrorAuditoria({
        tipoError: body.tipoError,
        descripcion: body.descripcion,
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        origen: body.origen || null,
        idFactura: body.idFactura || null,
      });

      resolve(Service.successResponse({
        mensaje: 'Error técnico registrado correctamente',
      }, 201));
    } catch (e) {
      console.error('[AUDITORIA] ERROR al registrar:', e.message);
      // Log de auditoría: Error al registrar error de auditoría
      try {
        await db.registrarErrorAuditoria({
          tipoError: 'AUDITORIA_FALLO_REGISTRAR_ERROR',
          descripcion: `Fallo al registrar error de auditoría: ${e.message}`,
          fecha: new Date(),
          origen: 'AuditoriaController',
          idFactura: body.idFactura || null,
        });
      } catch (logError) {
        console.error('[AUDITORIA] No se pudo registrar log de error de auditoría:', logError);
      }
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al registrar error de auditoría',
        e.status || 500,
      ));
    }
  },
);

/**
 * Registrar evento de auditoría
 * Registra un evento del sistema, por ejemplo un intento no autorizado.
 *
 * auditoriaEventoRequest AuditoriaEventoRequest
 * returns MensajeResponse
 */
const registrarEventoAuditoria = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const resultado = await db.registrarEventoAuditoria({
        tipoEvento: body.tipoEvento,
        descripcion: body.descripcion,
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        origen: body.origen || null,
      });

      resolve(Service.successResponse({
        mensaje: 'Evento de auditoría registrado correctamente',
      }, 201));
    } catch (e) {
      console.error('[AUDITORIA] ERROR al registrar evento:', e.message);
      // Log de auditoría: Error al registrar evento de auditoría
      try {
        await db.registrarErrorAuditoria({
          tipoError: 'AUDITORIA_FALLO_REGISTRAR_EVENTO',
          descripcion: `Fallo al registrar evento de auditoría: ${e.message}`,
          fecha: new Date(),
          origen: 'AuditoriaController',
          idFactura: null,
        });
      } catch (logError) {
        console.error('No se pudo registrar log de error de auditoría:', logError);
      }
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al registrar evento',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  registrarErrorAuditoria,
  registrarEventoAuditoria,
};
