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
server.use('/proxy/mule', express.json(), express.text({ type: 'text/xml' }), (req, res) => {
  let puerto;
  if (req.url.includes('anulacion')) {
    puerto = 9095;
  } else if (req.url.includes('cobro')) {
    puerto = 14102;
  } else if (req.url.includes('subsanacion')) {
    puerto = 9094;
  } else if (req.url.includes('reporte')) {
    puerto = 14103;
  } else {
    puerto = 9092;
  }
  
  const isSoap = req.headers['content-type'] && req.headers['content-type'].includes('text/xml');
  const muleUrl = `http://localhost:${puerto}/api${req.url}`;
  const headers = { 'Content-Type': isSoap ? 'text/xml' : 'application/json' };
  if (req.headers['wskey']) headers['WSKey'] = req.headers['wskey'];

  const muleReq = http.request(muleUrl, { method: req.method, headers }, (muleRes) => {
    const chunks = [];
    muleRes.on('data', chunk => chunks.push(chunk));
    muleRes.on('end', () => {
      const raw = Buffer.concat(chunks);
      const contentType = muleRes.headers['content-type'] || '';
      res.status(muleRes.statusCode);
      if (contentType.includes('application/json') || contentType.includes('text/xml') || raw[0] === 0x7b || raw[0] === 0x5b || raw[0] === 0x3c) {
        res.setHeader('Content-Type', contentType.includes('xml') ? 'text/xml' : 'application/json');
        res.end(raw.toString('utf8'));
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({
          error: 'MuleSoft devolvio una respuesta desconocida',
          statusMule: muleRes.statusCode,
          contentType: contentType
        });
      }
    });
  });
  muleReq.on('error', (err) => {
    res.status(502).json({ error: `No se pudo conectar con MuleSoft (puerto ${puerto})`, detalle: err.message });
  });
  
  if (req.body) {
    if (isSoap && typeof req.body === 'string') {
      muleReq.write(req.body);
    } else if (Object.keys(req.body).length > 0) {
      muleReq.write(JSON.stringify(req.body));
    }
  }
  muleReq.end();
});

// --- Configuración oas3-tools ---
// Rutas directas (fallback cuando OpenAPI no mapea correctamente)
const FlujoCobroController = require('./controllers/FlujoCobroController');
const FacturaController = require('./controllers/FacturaController');
const ValidacionController = require('./controllers/ValidacionController');
const GeneracionReportesController = require('./controllers/GeneracionReportesController');


// Fallback: listar rectificativas previas de una factura (usado por flujo MuleSoft de subsanación)
server.get('/facturas/:idFactura/rectificativas', async (req, res) => {
  try {
    await FacturaController.listarRectificativasPrevias(req, res);
  } catch (e) {
    console.error('Fallback route /facturas/:idFactura/rectificativas error:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Fallback: validar permisos del solicitante (usado por flujos MuleSoft)
server.post('/validaciones/permisos', express.json(), async (req, res) => {
  try {
    await ValidacionController.validarPermisosSolicitante(req, res);
  } catch (e) {
    console.error('Fallback route /validaciones/permisos error:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Fallback: validar datos del solicitante (nif + email) — usado por flujo anulacion MuleSoft
server.post('/validaciones/datos-solicitante', express.json(), async (req, res) => {
  try {
    await ValidacionController.validarDatosSolicitante(req, res);
  } catch (e) {
    console.error('Fallback route /validaciones/datos-solicitante error:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

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
  console.log('Cliente Subsanación en http://localhost:%d/cliente/subsanacion.html', serverPort);
});