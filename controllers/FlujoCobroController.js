'use strict';

const FlujoCobroService = require('../services/FlujoCobroService');

/**
 * Controlador para el flujo de cobro
 */
async function iniciarProcesoCobro(req, res) {
  try {
    const wskey = req.headers['wskey'] || req.headers['WSKey'] || req.headers['Wskey'];
    const payload = req.body;

    const result = await FlujoCobroService.iniciarProcesoCobro(wskey, payload);

    // Según spec devuelve 202 cuando se inicia correctamente
    return res.status(202).json(result);
  } catch (err) {
    console.error('Error en FlujoCobroController.iniciarProcesoCobro:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Error interno' });
  }
}

/**
 * Crear documento de pago (endpoint independiente)
 */
async function crearDocumentoPago(req, res) {
  try {
    const wskey = req.headers['wskey'] || req.headers['WSKey'] || req.headers['Wskey'];
    const payload = req.body;

    const result = await FlujoCobroService.crearDocumentoPago(wskey, payload);
    return res.status(201).json(result);
  } catch (err) {
    console.error('Error en FlujoCobroController.crearDocumentoPago:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Error interno' });
  }
}

async function listarPagosPorFactura(req, res) {
  try {
    const wskey = req.headers['wskey'] || req.headers['WSKey'] || req.headers['Wskey'];
    const facturaId = req.params.idFactura;
    // If an idPago query param is provided, return that specific pago
    const idPagoQuery = req.query && (req.query.idPago || req.query.id);
    if (idPagoQuery) {
      const pago = await FlujoCobroService.obtenerDocumentoPago(wskey, idPagoQuery);
      return res.status(200).json(pago);
    }

    const result = await FlujoCobroService.listarPagosPorFactura(wskey, facturaId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error en FlujoCobroController.listarPagosPorFactura:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Error interno' });
  }
}

async function obtenerDocumentoPago(req, res) {
  try {
    const wskey = req.headers['wskey'] || req.headers['WSKey'] || req.headers['Wskey'];
    const idPago = req.params.idPago;
    const result = await FlujoCobroService.obtenerDocumentoPago(wskey, idPago);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error en FlujoCobroController.obtenerDocumentoPago:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Error interno' });
  }
}

module.exports = {
  iniciarProcesoCobro,
  crearDocumentoPago,
  listarPagosPorFactura,
  obtenerDocumentoPago,
};
