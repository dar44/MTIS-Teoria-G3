/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Iniciar flujo de anulación de factura
* Inicia el proceso completo de anulación de una factura emitida.
* Valida la WSKey, valida los datos del solicitante (NIF, empresa registrada),
* verifica la existencia de la factura, consulta su estado actual,
* comprueba que sea anulable (no anulada previamente),
* envía la solicitud de anulación a la Agencia Tributaria,
* actualiza el estado de la factura a ANULADA y
* notifica al emisor el resultado de la anulación.
*
* anulacionRequest AnulacionRequest
* returns ProcesoAnulacionResponse
* */
const iniciarFlujoAnulacion = ({ anulacionRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        anulacionRequest,
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
  iniciarFlujoAnulacion,
};
