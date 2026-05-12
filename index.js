'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const oas3Tools = require('oas3-tools');

const serverPort = 7777;

// --- App wrapper (se monta ANTES de oas3-tools) ---
const server = express();

// --- CORS ---
server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, WSKey');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// --- Servir cliente de pruebas (ANTES de oas3-tools) ---
server.use('/cliente', express.static(path.join(__dirname, 'cliente')));

// --- Proxy hacia MuleSoft (evita CORS) ---
server.use('/proxy/mule', express.json(), (req, res) => {
  const muleUrl = `http://localhost:9092/api${req.url}`;
  const headers = { 'Content-Type': 'application/json' };
  if (req.headers['wskey']) headers['WSKey'] = req.headers['wskey'];

  const muleReq = http.request(muleUrl, { method: req.method, headers }, (muleRes) => {
    let body = '';
    muleRes.on('data', chunk => body += chunk);
    muleRes.on('end', () => {
      res.status(muleRes.statusCode);
      res.setHeader('Content-Type', 'application/json');
      res.end(body);
    });
  });
  muleReq.on('error', (err) => {
    res.status(502).json({ error: 'No se pudo conectar con MuleSoft (puerto 9092)', detalle: err.message });
  });
  if (req.body && Object.keys(req.body).length > 0) {
    muleReq.write(JSON.stringify(req.body));
  }
  muleReq.end();
});

// --- Configuración oas3-tools ---
const options = {
  routing: {
    controllers: path.join(__dirname, './controllers')
  },
};

const expressAppConfig = oas3Tools.expressAppConfig(
  path.join(__dirname, 'api/openapi.yaml'),
  options
);

const oasApp = expressAppConfig.getApp();

// Montar la app OAS dentro del wrapper
server.use(oasApp);

http.createServer(server).listen(serverPort, function () {
  console.log('Servidor escuchando en http://localhost:%d', serverPort);
  console.log('Swagger UI disponible en http://localhost:%d/docs', serverPort);
  console.log('Cliente de pruebas en http://localhost:%d/cliente', serverPort);
});