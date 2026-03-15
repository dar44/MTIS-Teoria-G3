/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Actualizar estado de factura
* Actualiza el estado de una factura existente.
*
* idFactura Long Identificador único de la factura
* actualizarEstadoFacturaRequest ActualizarEstadoFacturaRequest 
* returns MensajeResponse
* */
const actualizarEstadoFactura = ({ idFactura, actualizarEstadoFacturaRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        idFactura,
        actualizarEstadoFacturaRequest,
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
* Consultar estado de factura
* Devuelve el estado actual de una factura.
*
* idFactura Long Identificador único de la factura
* returns EstadoFacturaResponse
* */
const consultarEstadoFactura = ({ idFactura }) => new Promise(
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
* Consultar existencia de factura
* Verifica si una factura existe en el sistema.
*
* idFactura Long Identificador único de la factura
* returns ExistenciaFacturaResponse
* */
const consultarExistenciaFactura = ({ idFactura }) => new Promise(
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
* Recuperar datos detallados de factura
* Recupera los datos completos de una factura por su identificador.
*
* idFactura Long Identificador único de la factura
* returns FacturaResponse
* */
const consultarFacturaDetalle = ({ idFactura }) => new Promise(
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
* Crear factura
* Crea y persiste una factura en base de datos.
*
* facturaCreateRequest FacturaCreateRequest 
* returns FacturaResponse
* */
const crearFactura = ({ facturaCreateRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        facturaCreateRequest,
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
  actualizarEstadoFactura,
  consultarExistenciaFactura,
  consultarFacturaDetalle,
  consultarEstadoFactura,
  crearFactura,
};
