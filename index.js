'use strict';

const path = require('path');
const http = require('http');
const oas3Tools = require('oas3-tools');

const serverPort = 7777;

// Configuración del swaggerRouter
const options = {
  routing: {
    controllers: path.join(__dirname, './controllers')
  },
};

const expressAppConfig = oas3Tools.expressAppConfig(
  path.join(__dirname, 'api/openapi.yaml'),
  options
);

const app = expressAppConfig.getApp();

http.createServer(app).listen(serverPort, function () {
  console.log('Servidor escuchando en http://localhost:%d', serverPort);
  console.log('Swagger UI disponible en http://localhost:%d/docs', serverPort);
});