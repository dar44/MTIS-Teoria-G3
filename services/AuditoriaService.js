/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Registrar error técnico
* Registra un error técnico producido durante el proceso.
*
* auditoriaErrorRequest AuditoriaErrorRequest 
* returns MensajeResponse
* */
const registrarErrorAuditoria = ({ auditoriaErrorRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        auditoriaErrorRequest,
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
* Registrar evento de auditoría
* Registra un evento del sistema, por ejemplo un intento no autorizado.
*
* auditoriaEventoRequest AuditoriaEventoRequest 
* returns MensajeResponse
* */
const registrarEventoAuditoria = ({ auditoriaEventoRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        auditoriaEventoRequest,
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
  registrarErrorAuditoria,
  registrarEventoAuditoria,
};
