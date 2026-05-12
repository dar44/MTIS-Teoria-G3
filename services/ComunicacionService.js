/* eslint-disable no-unused-vars */
const Service = require('./Service');
const smtp = require('../ConexionFakeSMTP/ConexionFakeSMTP');
const { validarWSKey } = require('../utils/Utils');

const EMAIL_SISTEMA = 'facturacion@sistema-g3.com';

/**
 * Enviar comunicación
 * Envía una comunicación genérica vía email.
 *
 * comunicacionRequest ComunicacionRequest
 * returns MensajeResponse
 */
const enviarComunicacion = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      await smtp.sendEmail(
        EMAIL_SISTEMA,
        body.destinatario,
        body.asunto,
        body.cuerpo,
      );

      resolve(Service.successResponse({
        mensaje: `Comunicación enviada correctamente a ${body.destinatario}`,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al enviar comunicación',
        e.status || 500,
      ));
    }
  },
);

/**
 * Notificar subsanación a empresa y Agencia Tributaria
 *
 * notificacionRequest NotificacionRequest
 * returns MensajeResponse
 */
const notificarSubsanacion = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      await smtp.sendEmail(
        EMAIL_SISTEMA,
        body.destinatario,
        body.asunto,
        body.cuerpo,
      );

      resolve(Service.successResponse({
        mensaje: 'Notificación de subsanación enviada correctamente',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al enviar notificación',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  enviarComunicacion,
  notificarSubsanacion,
};
