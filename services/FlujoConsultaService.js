/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Iniciar flujo de consulta de factura
* Inicia el proceso de consulta de factura: valida formato de entrada, verifica existencia de la factura, recupera sus datos detallados, formatea la respuesta en XML y devuelve el resultado o un error controlado.
*
* consultaFacturaRequest ConsultaFacturaRequest
* returns ProcesoConsultaResponse
* */
const iniciarFlujoConsulta = ({ consultaFacturaRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        consultaFacturaRequest,
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
  iniciarFlujoConsulta,
};