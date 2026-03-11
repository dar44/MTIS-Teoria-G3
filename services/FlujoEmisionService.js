/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Iniciar flujo de emisión de factura
* Inicia el proceso completo de emisión de factura: valida WSKey, valida datos de entrada, consulta empresa, verifica coincidencia de datos, crea factura, genera XML/PDF, envía documentación y notifica el resultado. 
*
* emisionFacturaRequest EmisionFacturaRequest 
* returns ProcesoEmisionResponse
* */
const iniciarFlujoEmision = ({ emisionFacturaRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        emisionFacturaRequest,
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
  iniciarFlujoEmision,
};
