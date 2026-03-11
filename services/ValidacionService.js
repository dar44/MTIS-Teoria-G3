/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Validar datos de entrada de factura
* Valida la estructura y reglas de negocio de los datos de entrada.
*
* facturaInput FacturaInput 
* returns ValidacionResponse
* */
const validarDatosFactura = ({ facturaInput }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        facturaInput,
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
* Validar WSKey
* Valida la clave WSKey enviada por cabecera.
*
* returns ValidacionResponse
* */
const validarWsKey = () => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
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
  validarDatosFactura,
  validarWsKey,
};
