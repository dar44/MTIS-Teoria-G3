/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Formatear respuesta XML de factura
* Transforma la información de una factura al formato XML de salida.
*
* generarXmlFacturaRequest GenerarXmlFacturaRequest
* returns RespuestaXmlFactura
* */
const generarXmlRespuestaFactura = ({ generarXmlFacturaRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        generarXmlFacturaRequest,
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
* Generar mensaje de error controlado
* Construye un mensaje de error estandarizado para el flujo de consulta.
*
* errorConsultaRequest ErrorConsultaRequest
* returns ErrorResponse
* */
const notificarErrorConsulta = ({ errorConsultaRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        errorConsultaRequest,
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
  generarXmlRespuestaFactura,
  notificarErrorConsulta,
};