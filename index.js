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
  // Detectar puerto MuleSoft según el flujo:
  //   /cobros  -> 14102  |  /reportes -> 14103  |  resto -> 9092
  let puerto;
  if (req.url.includes('cobro')) {
    puerto = 14102;
  } else if (req.url.includes('reporte')) {
    puerto = 14103;
  } else {
    puerto = 9092;
  }
  const muleUrl = `http://localhost:${puerto}/api${req.url}`;
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
    res.status(502).json({ error: `No se pudo conectar con MuleSoft (puerto ${puerto})`, detalle: err.message });
  });
  if (req.body && Object.keys(req.body).length > 0) {
    muleReq.write(JSON.stringify(req.body));
  }
  muleReq.end();
});

// --- Configuración oas3-tools ---
// Rutas directas (fallback cuando OpenAPI no mapea correctamente)
const FlujoCobroController = require('./controllers/FlujoCobroController');
const GeneracionReportesController = require('./controllers/GeneracionReportesController');

server.get('/facturas/:idFactura/pagos', async (req, res) => {
  try {
    await FlujoCobroController.listarPagosPorFactura(req, res);
  } catch (e) {
    console.error('Fallback route /facturas/:idFactura/pagos error:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

server.get('/pagos/:idPago', async (req, res) => {
  try {
    await FlujoCobroController.obtenerDocumentoPago(req, res);
  } catch (e) {
    console.error('Fallback route /pagos/:idPago error:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── Rutas directas: Generación de Reportes ─────────────────────────────────
server.post('/reportes/validar-acceso', express.json(), async (req, res) => {
  try { await GeneracionReportesController.validarAccesoReporte(req, res); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Error interno' }); }
});

server.post('/reportes/validar-rango-fechas', express.json(), async (req, res) => {
  try { await GeneracionReportesController.validarRangoFechasReporte(req, res); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Error interno' }); }
});

server.post('/reportes/obtener-volumen', express.json(), async (req, res) => {
  try { await GeneracionReportesController.obtenerVolumenFacturacion(req, res); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Error interno' }); }
});

server.post('/reportes/registrar', express.json(), async (req, res) => {
  try { await GeneracionReportesController.registrarReporte(req, res); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Error interno' }); }
});

server.post('/reportes/generar-pdf/:idReporte', express.json(), async (req, res) => {
  try { await GeneracionReportesController.generarDocumentoPDFReporte(req, res); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Error interno' }); }
});

server.post('/reportes/notificar', express.json(), async (req, res) => {
  try { await GeneracionReportesController.enviarNotificacionReporte(req, res); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Error interno' }); }
});

server.get('/reportes/:idReporte', async (req, res) => {
  try { await GeneracionReportesController.obtenerReportePorId(req, res); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Error interno' }); }
});

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