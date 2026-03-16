/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Iniciar flujo de subsanación de factura
* Inicia el proceso completo de subsanación de una factura con errores.
* Valida la WSKey, comprueba la existencia de la factura original,
* verifica que su estado permita subsanación, crea una factura rectificativa,
* genera los documentos XML y PDF, los almacena en el directorio de red,
* actualiza el estado de la factura original a SUBSANADA y notifica
* a la empresa y a la Agencia Tributaria.
*
* subsanacionRequest SubsanacionRequest
* returns ProcesoSubsanacionResponse
* */
const iniciarFlujoSubsanacion = ({ subsanacionRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        subsanacionRequest,
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
  iniciarFlujoSubsanacion,
};
