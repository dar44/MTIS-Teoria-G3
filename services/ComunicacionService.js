/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Enviar comunicación
* Envía una comunicación genérica. Puede usarse tanto para avisar a la empresa como para enviar documentación a la Agencia Tributaria. 
*
* comunicacionRequest ComunicacionRequest 
* returns MensajeResponse
* */
const enviarComunicacion = ({ comunicacionRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        comunicacionRequest,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);

/**
* Notificar subsanación a empresa y Agencia Tributaria
* Envía notificaciones del resultado del proceso de subsanación.
* Se comunica a la empresa el resultado de la rectificación y se envía
* el XML de la factura rectificativa a la Agencia Tributaria.
*
* notificacionRequest NotificacionRequest
* returns MensajeResponse
* */
const notificarSubsanacion = ({ notificacionRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        notificacionRequest,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);

module.exports = {
  enviarComunicacion,
  notificarSubsanacion,
};
