'use strict';

const ValidacionService = require('./ValidacionService');
const EmpresaService = require('./EmpresaService');
const FacturaService = require('./FacturaService');
const GestorArchivosService = require('./GestorArchivosService');
const ComunicacionService = require('./ComunicacionService');
const AuditoriaService = require('./AuditoriaService');
const db = require('../ConexionDB/Conexion');
const fs = require('fs');
const path = require('path');

/**
 * Orquesta el proceso de cobro:
 * 1. Validar WSKey y payload
 * 2. Consultar la factura / empresa
 * 3. Registrar pago / crear documento de pago
 * 4. Generar PDF/XML si procede
 * 5. Notificar por email y auditar
 *
 * Devuelve un objeto mensaje para respuesta 202.
 */
async function iniciarProcesoCobro(wskey, payload) {
  if (!wskey) {
    const err = new Error('WSKey requerida');
    err.statusCode = 401;
    throw err;
  }

  // Validar WSKey
  await ValidacionService.validarWsKey({ WSKey: wskey }).catch((e) => {
    const err = new Error(e || 'WSKey no válida');
    err.statusCode = 401;
    throw err;
  });

  // Validación básica del payload
  if (!payload || (!payload.idFactura && !(payload.factura && payload.factura.id))) {
    const err = new Error('idFactura no especificado en payload');
    err.statusCode = 400;
    throw err;
  }

  // Recuperar factura
  const facturaId = payload.idFactura || (payload.factura && payload.factura.id);
  if (!facturaId) {
    const err = new Error('idFactura no especificado');
    err.statusCode = 400;
    throw err;
  }

  const factura = await db.obtenerFacturaPorId(facturaId);
  if (!factura) {
    const err = new Error('Factura no encontrada');
    err.statusCode = 404;
    throw err;
  }

  // Recuperar empresa asociada
  let empresa = await db.buscarEmpresaPorEmail((await db.ejecutarQuery('SELECT email FROM empresas WHERE id = ?', [factura.empresa_id]))[0]?.email).catch(() => null);
  if (!empresa && payload.empresa && payload.empresa.email) {
    empresa = await EmpresaService.consultarEmpresa({ email: payload.empresa.email, WSKey: wskey }).catch(() => null);
  }

  // Registrar intento en auditoría
  await AuditoriaService.registrarEventoAuditoria({ body: {
    tipoEvento: 'COBRO_INICIADO',
    descripcion: `Inicio proceso cobro factura ${facturaId}`,
    origen: 'FlujoCobroService'
  }, WSKey: wskey }).catch(() => null);

  // Persistir pago en la BD
  const pagoPayload = {
    facturaId,
    importe: payload.importe != null ? payload.importe : parseFloat((parseFloat(factura.base_imponible) * (1 + parseFloat(factura.iva || 0))).toFixed(2)),
    metodoPago: payload.metodoPago || 'TRANSFERENCIA',
    referencia: payload.referencia || null,
    fechaPago: payload.fechaPago || null,
    estado: payload.estado || 'PENDIENTE'
  };

  let documentoPago;
  try {
    const documentoPagoResponse = await GestorArchivosService.crearDocumentoPago({
      body: {
        facturaId,
        importeCobrado: pagoPayload.importe,
        metodoPago: pagoPayload.metodoPago,
        referencia: pagoPayload.referencia,
        fechaPago: pagoPayload.fechaPago,
        estado: pagoPayload.estado,
      },
      WSKey: wskey,
    });
    documentoPago = documentoPagoResponse.payload || documentoPagoResponse;
  } catch (e) {
    const err = new Error('Error creando documento de pago en BD: ' + (e.message || e));
    err.statusCode = 500;
    throw err;
  }

  // Generar PDF de la factura (documento existente)
  try {
    await GestorArchivosService.generarPdfFactura({ idFactura: facturaId, WSKey: wskey });
  } catch (e) {
    await AuditoriaService.registrarErrorAuditoria({ body: {
      tipoError: 'PDF_GENERACION',
      descripcion: e.message || String(e),
      origen: 'FlujoCobroService',
      idFactura: facturaId
    }, WSKey: wskey }).catch(() => null);
  }

  // Notificar a la empresa
  try {
    await ComunicacionService.enviarComunicacion({ body: {
      destinatario: empresa ? empresa.email : (payload.empresa && payload.empresa.email),
      asunto: `Documento de pago factura ${facturaId}`,
      cuerpo: `Se ha generado el documento de pago para la factura ${facturaId}. Documento: ${documentoPago.idPago}`,
    }, WSKey: wskey });
  } catch (e) {
    await AuditoriaService.registrarErrorAuditoria({ body: {
      tipoError: 'NOTIFICACION_FALLIDA',
      descripcion: e.message || String(e),
      origen: 'FlujoCobroService',
      idFactura: facturaId
    }, WSKey: wskey }).catch(() => null);
  }

  // Respuesta mínima según spec
  return { mensaje: 'Proceso de cobro iniciado', idFactura: facturaId, idDocumentoPago: documentoPago.idDocumentoPago || documentoPago.idPago };
}

/**
 * Crear un documento de pago de forma independiente
 */
async function crearDocumentoPago(wskey, payload) {
  const documentoPagoResponse = await GestorArchivosService.crearDocumentoPago({
    body: payload,
    WSKey: wskey,
  });

  const documentoPago = documentoPagoResponse.payload || documentoPagoResponse;
  return {
    mensaje: documentoPago.mensaje || 'Documento de pago creado',
    idDocumentoPago: documentoPago.idDocumentoPago || documentoPago.idPago,
    numeroFactura: documentoPago.numeroFactura,
    importeCobrado: documentoPago.importeCobrado,
  };
}

/**
 * Listar pagos por factura
 */
async function listarPagosPorFactura(wskey, facturaId) {
  if (!wskey) {
    const err = new Error('WSKey requerida');
    err.statusCode = 401;
    throw err;
  }
  await ValidacionService.validarWsKey({ WSKey: wskey }).catch((e) => {
    const err = new Error(e || 'WSKey no válida');
    err.statusCode = 401;
    throw err;
  });

  const factura = await db.obtenerFacturaPorId(facturaId);
  if (!factura) {
    const err = new Error('Factura no encontrada');
    err.statusCode = 404;
    throw err;
  }

  const pagos = await db.listarPagosPorFactura(facturaId);
  return pagos;
}

/**
 * Obtener detalle de un pago por id
 */
async function obtenerDocumentoPago(wskey, idPago) {
  if (!wskey) {
    const err = new Error('WSKey requerida');
    err.statusCode = 401;
    throw err;
  }
  await ValidacionService.validarWsKey({ WSKey: wskey }).catch((e) => {
    const err = new Error(e || 'WSKey no válida');
    err.statusCode = 401;
    throw err;
  });

  const pago = await db.obtenerDocumentoPagoPorId(idPago);
  if (!pago) {
    const err = new Error('Pago no encontrado');
    err.statusCode = 404;
    throw err;
  }
  return pago;
}

module.exports = {
  iniciarProcesoCobro,
  crearDocumentoPago,
  listarPagosPorFactura,
  obtenerDocumentoPago,
};
