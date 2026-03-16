const Controller = require('./Controller');
const service = require('../services/FlujoAnulacionService');
const iniciarFlujoAnulacion = async (request, response) => {
  await Controller.handleRequest(request, response, service.iniciarFlujoAnulacion);
};


module.exports = {
  iniciarFlujoAnulacion,
};
