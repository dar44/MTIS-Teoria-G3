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

      await db.registrarErrorAuditoria({
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

      await db.registrarEventoAuditoria({
        tipoEvento: body.tipoEvento,
        descripcion: body.descripcion,
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        origen: body.origen || null,
      });

      resolve(Service.successResponse({
        mensaje: 'Evento de auditoría registrado correctamente',
      }, 201));
    } catch (e) {
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
