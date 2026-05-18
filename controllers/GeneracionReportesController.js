'use strict';

const GeneracionReportesService = require('../services/GeneracionReportesService');

// Helper para extraer WSKey de distintos lugares
function getWSKey(req) {
  return req.headers['wskey'] || req.headers['WSKey'] || '';
}

// ─── OPERACION 1: validarAcceso ───────────────────────────────────────────────
module.exports.validarAccesoReporte = async function validarAccesoReporte(req, res) {
  try {
    const response = await GeneracionReportesService.validarAccesoReporte({
      body: req.body,
      WSKey: getWSKey(req),
    });
    res.status(response.code || 200).json(response.payload);
  } catch (e) {
    res.status(e.code || 500).json(e.error);
  }
};

// ─── OPERACION 2: validarRangoFechas ─────────────────────────────────────────
module.exports.validarRangoFechasReporte = async function validarRangoFechasReporte(req, res) {
  try {
    const response = await GeneracionReportesService.validarRangoFechasReporte({
      body: req.body,
      WSKey: getWSKey(req),
    });
    res.status(response.code || 200).json(response.payload);
  } catch (e) {
    res.status(e.code || 500).json(e.error);
  }
};

// ─── OPERACION 3: obtenerVolumenFacturacion ───────────────────────────────────
module.exports.obtenerVolumenFacturacion = async function obtenerVolumenFacturacion(req, res) {
  try {
    const response = await GeneracionReportesService.obtenerVolumenFacturacion({
      body: req.body,
      WSKey: getWSKey(req),
    });
    res.status(response.code || 200).json(response.payload);
  } catch (e) {
    res.status(e.code || 500).json(e.error);
  }
};

// ─── OPERACION 4: registrarReporte ───────────────────────────────────────────
module.exports.registrarReporte = async function registrarReporte(req, res) {
  try {
    const response = await GeneracionReportesService.registrarReporte({
      body: req.body,
      WSKey: getWSKey(req),
    });
    res.status(response.code || 200).json(response.payload);
  } catch (e) {
    res.status(e.code || 500).json(e.error);
  }
};

// ─── OPERACION 5: generarDocumentoPDF ────────────────────────────────────────
module.exports.generarDocumentoPDFReporte = async function generarDocumentoPDFReporte(req, res) {
  try {
    const idReporte = req.params.idReporte || req.body.idReporte;
    const response = await GeneracionReportesService.generarDocumentoPDFReporte({
      body: { ...req.body, idReporte },
      WSKey: getWSKey(req),
    });
    res.status(response.code || 200).json(response.payload);
  } catch (e) {
    res.status(e.code || 500).json(e.error);
  }
};

// ─── OPERACION 6: enviarNotificacionReporte ──────────────────────────────────
module.exports.enviarNotificacionReporte = async function enviarNotificacionReporte(req, res) {
  try {
    const response = await GeneracionReportesService.enviarNotificacionReporte({
      body: req.body,
      WSKey: getWSKey(req),
    });
    res.status(response.code || 200).json(response.payload);
  } catch (e) {
    res.status(e.code || 500).json(e.error);
  }
};

// ─── AUXILIAR: obtener reporte por ID ────────────────────────────────────────
module.exports.obtenerReportePorId = async function obtenerReportePorId(req, res) {
  try {
    const idReporte = req.params.idReporte;
    const response = await GeneracionReportesService.obtenerReportePorId({
      idReporte,
      WSKey: getWSKey(req),
    });
    res.status(response.code || 200).json(response.payload);
  } catch (e) {
    res.status(e.code || 500).json(e.error);
  }
};
