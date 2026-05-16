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
 * Orquesta el proceso de cobro (9 pasos como flujo-cobro.xml de MuleSoft):
 * 1. Validar permisos del usuario
 * 2. Validar fecha de operación
 * 3. Consultar factura
 * 4. Validar estado de factura (debe ser cobrable)
 * 5. Validar aprobación del supervisor
 * 6. Calcular estadísticas de recaudación
 * 7. Crear documento de pago
 * 8. Actualizar estado de factura a COBRADA
 * 9. Notificar al usuario
 */
async function iniciarProcesoCobro(wskey, payload) {
  let pasoActual = 0;
  
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

  // Registrar inicio de cobro
  await AuditoriaService.registrarEventoAuditoria({ body: {
    tipoEvento: 'COBRO_INICIADO',
    descripcion: `Inicio del flujo de cobro para factura: ${payload.idFactura || 'DESCONOCIDA'} por usuario: ${payload.usuarioId || 'DESCONOCIDO'}`,
    origen: 'FlujoCobroService'
  }, WSKey: wskey }).catch(() => null);

  try {
    // PASO 1: Validar Permisos
    pasoActual = 1;
    const permisoValido = (payload.usuarioId != null); // Simplificado, debería validar contra BD
    if (!permisoValido) {
      await AuditoriaService.registrarErrorAuditoria({ body: {
        tipoError: 'PERMISOS_DENEGADOS',
        descripcion: `Usuario ${payload.usuarioId || 'DESCONOCIDO'} no tiene permisos para acción: ${payload.accion || 'COBRAR_FACTURA'}`,
        origen: 'FlujoCobroService',
        idFactura: payload.idFactura
      }, WSKey: wskey }).catch(() => null);
      const err = new Error('Permisos insuficientes');
      err.statusCode = 403;
      throw err;
    }

    // PASO 2: Validar Fecha de Operación
    pasoActual = 2;
    const fechaPago = payload.fechaPago || new Date().toISOString().split('T')[0];

    // PASO 3: Consultar Factura
    pasoActual = 3;
    if (!payload.idFactura) {
      const err = new Error('idFactura no especificado');
      err.statusCode = 400;
      throw err;
    }

    const factura = await db.obtenerFacturaPorId(payload.idFactura);
    if (!factura) {
      const err = new Error(`Factura ${payload.idFactura} no encontrada`);
      err.statusCode = 404;
      throw err;
    }

    const estadoFactura = factura.estado || 'DESCONOCIDO';
    const importeFactura = parseFloat(factura.base_imponible) * (1 + parseFloat(factura.iva || 0));

    // PASO 4: Validar Estado de Factura Cobrable
    pasoActual = 4;
    if (estadoFactura === 'COBRADA' || estadoFactura === 'ANULADA') {
      await AuditoriaService.registrarErrorAuditoria({ body: {
        tipoError: 'FACTURA_NO_COBRABLE',
        descripcion: `Factura ${payload.idFactura} no apta para cobro. Estado actual: ${estadoFactura}`,
        origen: 'FlujoCobroService',
        idFactura: payload.idFactura
      }, WSKey: wskey }).catch(() => null);

      // Notificar incidencia
      await ComunicacionService.enviarComunicacion({ body: {
        destinatario: payload.emailSolicitante || payload.emailEmpresa || 'info@empresa.com',
        asunto: `Incidencia en cobro de factura ${payload.idFactura}`,
        cuerpo: `La factura no es apta para cobro porque su estado actual es: ${estadoFactura}`
      }, WSKey: wskey }).catch(() => null);

      const err = new Error(`Factura no apta para cobro. Estado: ${estadoFactura}`);
      err.statusCode = 409;
      throw err;
    }

    // PASO 5: Validar Aprobación de Supervisor
    pasoActual = 5;
    if (payload.aprobadaSupervisor !== true) {
      await AuditoriaService.registrarErrorAuditoria({ body: {
        tipoError: 'SUPERVISOR_NO_APROBADO',
        descripcion: `Solicitud de cobro de factura ${payload.idFactura} por usuario ${payload.usuarioId || 'DESCONOCIDO'} requiere aprobación de supervisor`,
        origen: 'FlujoCobroService',
        idFactura: payload.idFactura
      }, WSKey: wskey }).catch(() => null);

      const err = new Error('Aprobación de supervisor requerida');
      err.statusCode = 403;
      throw err;
    }

    // PASO 6: Calcular Estadísticas de Recaudación
    pasoActual = 6;
    let estadisticasRecaudacion = null;
    if (payload.fechaDesdeFacturacion && payload.fechaHastaFacturacion) {
      try {
        const estadisticasResponse = await db.ejecutarQuery(
          'SELECT COUNT(*) as total_facturas, SUM(base_imponible) as total_base FROM facturas WHERE fecha_emision BETWEEN ? AND ? AND estado = "COBRADA"',
          [payload.fechaDesdeFacturacion, payload.fechaHastaFacturacion]
        );
        estadisticasRecaudacion = estadisticasResponse[0] || {};
      } catch (e) {
        // Estadísticas no críticas, continuar
      }
    }

    // PASO 7: Crear Documento de Pago
    pasoActual = 7;
    let documentoPago;
    try {
      const documentoPagoResponse = await GestorArchivosService.crearDocumentoPago({
        body: {
          facturaId: payload.idFactura,
          importeCobrado: importeFactura,
          metodoPago: payload.metodoPago || 'TRANSFERENCIA',
          referencia: payload.referencia || null,
          fechaPago: fechaPago,
          estado: 'COMPLETADO'
        },
        WSKey: wskey,
      });
      documentoPago = documentoPagoResponse.payload || documentoPagoResponse;
    } catch (e) {
      await AuditoriaService.registrarErrorAuditoria({ body: {
        tipoError: 'ERROR_CREAR_PAGO',
        descripcion: `Error creando documento de pago: ${e.message}`,
        origen: 'FlujoCobroService',
        idFactura: payload.idFactura
      }, WSKey: wskey }).catch(() => null);
      throw e;
    }

    const idPago = documentoPago.idDocumentoPago || documentoPago.idPago;

    // PASO 8: Actualizar Estado de Factura a COBRADA
    pasoActual = 8;
    try {
      await db.ejecutarQuery(
        'UPDATE facturas SET estado = ? WHERE id = ?',
        ['COBRADA', payload.idFactura]
      );
    } catch (e) {
      await AuditoriaService.registrarErrorAuditoria({ body: {
        tipoError: 'ERROR_ACTUALIZAR_FACTURA',
        descripcion: `Error actualizando estado de factura: ${e.message}`,
        origen: 'FlujoCobroService',
        idFactura: payload.idFactura
      }, WSKey: wskey }).catch(() => null);
      throw e;
    }

    // PASO 9: Notificar Cobro Exitoso
    pasoActual = 9;
    try {
      await ComunicacionService.enviarComunicacion({ body: {
        destinatario: payload.emailSolicitante || payload.emailEmpresa || 'info@empresa.com',
        asunto: `Justificante de cobro de factura ${payload.idFactura}`,
        cuerpo: `Se ha generado exitosamente el cobro para la factura. Referencia de pago: ${idPago || 'N/A'}`
      }, WSKey: wskey }).catch(() => null);
    } catch (e) {
      // Notificación no es crítica
    }

    // Registrar cobro exitoso
    await AuditoriaService.registrarEventoAuditoria({ body: {
      tipoEvento: 'COBRO_EXITOSO',
      descripcion: `Cobro realizado exitosamente para factura: ${payload.idFactura} por usuario: ${payload.usuarioId || 'DESCONOCIDO'}. Importe: ${importeFactura}`,
      origen: 'FlujoCobroService'
    }, WSKey: wskey }).catch(() => null);

    return {
      mensaje: 'Flujo de cobro completado exitosamente',
      idFactura: payload.idFactura,
      idDocumentoPago: idPago,
      estadoFactura: 'COBRADA',
      importeFactura: importeFactura,
      estadisticasRecaudacion: estadisticasRecaudacion
    };

  } catch (e) {
    // Registrar error general de cobro
    await AuditoriaService.registrarErrorAuditoria({ body: {
      tipoError: 'COBRO_FALLO',
      descripcion: `Error en flujo de cobro. Paso: ${pasoActual}. Factura: ${payload.idFactura || 'DESCONOCIDA'}. Detalle: ${e.message}`,
      origen: 'FlujoCobroService',
      idFactura: payload.idFactura
    }, WSKey: wskey }).catch(() => null);

    throw e;
  }
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
