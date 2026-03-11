/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Generar PDF de la factura
* Genera el documento PDF asociado a una factura.
*
* idFactura Long Identificador único de la factura
* returns DocumentoGeneradoResponse
* */
const generarPdfFactura = ({ idFactura }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        idFactura,
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
* Generar XML de la factura
* Genera el documento XML asociado a una factura.
*
* idFactura Long Identificador único de la factura
* returns DocumentoGeneradoResponse
* */
const generarXmlFactura = ({ idFactura }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        idFactura,
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
  generarPdfFactura,
  generarXmlFactura,
};
