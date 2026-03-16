/**
 * The FacturaController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic reoutes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

const Controller = require('./Controller');
const service = require('../services/FacturaService');
const actualizarEstadoFactura = async (request, response) => {
  await Controller.handleRequest(request, response, service.actualizarEstadoFactura);
};

const consultarEstadoFactura = async (request, response) => {
  await Controller.handleRequest(request, response, service.consultarEstadoFactura);
};

const consultarExistenciaFactura = async (request, response) => {
  await Controller.handleRequest(request, response, service.consultarExistenciaFactura);
};

const consultarFacturaDetalle = async (request, response) => {
  await Controller.handleRequest(request, response, service.consultarFacturaDetalle);
};

const crearFactura = async (request, response) => {
  await Controller.handleRequest(request, response, service.crearFactura);
};

const crearFacturaRectificativa = async (request, response) => {
  await Controller.handleRequest(request, response, service.crearFacturaRectificativa);
};


module.exports = {
  actualizarEstadoFactura,
  consultarExistenciaFactura,
  consultarFacturaDetalle,
  consultarEstadoFactura,
  crearFactura,
  crearFacturaRectificativa,
};
