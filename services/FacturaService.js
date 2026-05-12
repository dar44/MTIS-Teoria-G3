/* eslint-disable no-unused-vars */
const Service = require('./Service');
const db = require('../ConexionDB/Conexion');
const { validarWSKey } = require('../utils/Utils');

/**
 * Convierte fecha ISO 8601 a formato MySQL DATETIME
 */
function toMySQLDatetime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Crear factura
 * Crea y persiste una factura en base de datos.
 *
 * facturaCreateRequest FacturaCreateRequest
 * returns FacturaResponse
 */
const crearFactura = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const result = await db.crearFactura({
        empresaId: body.empresaId,
        numeroFactura: body.numeroFactura,
        baseImponible: body.baseImponible,
        iva: body.iva,
        moneda: body.moneda,
        tipo: body.tipo,
        estado: body.estado,
        fechaEmision: toMySQLDatetime(body.fechaEmision),
        fechaDesdeFacturacion: body.fechaDesdeFacturacion || null,
        fechaHastaFacturacion: body.fechaHastaFacturacion || null,
      });

      resolve(Service.successResponse({
        idFactura: result.idFactura,
        empresaId: body.empresaId,
        numeroFactura: body.numeroFactura,
        baseImponible: body.baseImponible,
        iva: body.iva,
        moneda: body.moneda,
        tipo: body.tipo,
        estado: body.estado,
        fechaEmision: body.fechaEmision,
        fechaDesdeFacturacion: body.fechaDesdeFacturacion,
        fechaHastaFacturacion: body.fechaHastaFacturacion,
      }, 201));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al crear factura',
        e.status || 500,
      ));
    }
  },
);

/**
 * Consultar estado de factura
 */
const consultarEstadoFactura = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerEstadoFacturaPorId(idFactura);
      if (!factura) {
        return reject(Service.rejectResponse(
          `Factura con id ${idFactura} no encontrada`, 404,
        ));
      }

      resolve(Service.successResponse({
        idFactura: factura.id,
        numeroFactura: factura.numero_factura,
        estado: factura.estado,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al consultar estado',
        e.status || 500,
      ));
    }
  },
);

/**
 * Consultar existencia de factura
 */
const consultarExistenciaFactura = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerFacturaPorId(idFactura);

      resolve(Service.successResponse({
        idFactura: parseInt(idFactura),
        existe: !!factura,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al consultar existencia',
        e.status || 500,
      ));
    }
  },
);

/**
 * Recuperar datos detallados de factura
 */
const consultarFacturaDetalle = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const f = await db.obtenerFacturaPorId(idFactura);
      if (!f) {
        return reject(Service.rejectResponse(
          `Factura con id ${idFactura} no encontrada`, 404,
        ));
      }

      resolve(Service.successResponse({
        idFactura: f.id,
        empresaId: f.empresa_id,
        numeroFactura: f.numero_factura,
        baseImponible: f.base_imponible,
        iva: f.iva,
        moneda: f.moneda,
        tipo: f.tipo,
        estado: f.estado,
        fechaEmision: f.fecha_emision,
        fechaDesdeFacturacion: f.fecha_desde_facturacion,
        fechaHastaFacturacion: f.fecha_hasta_facturacion,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al consultar factura',
        e.status || 500,
      ));
    }
  },
);

/**
 * Actualizar estado de factura
 */
const actualizarEstadoFactura = ({ idFactura, body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerFacturaPorId(idFactura);
      if (!factura) {
        return reject(Service.rejectResponse(
          `Factura con id ${idFactura} no encontrada`, 404,
        ));
      }

      await db.actualizarEstadoFactura(
        idFactura, body.nuevoEstado, body.motivo || null,
      );

      resolve(Service.successResponse({
        mensaje: `Estado de la factura ${idFactura} actualizado a ${body.nuevoEstado}`,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al actualizar estado',
        e.status || 500,
      ));
    }
  },
);

/**
 * Crear factura rectificativa
 */
const crearFacturaRectificativa = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const result = await db.crearFacturaRectificativa({
        empresaId: body.empresaId,
        numeroFactura: body.numeroFactura,
        baseImponible: body.baseImponible,
        iva: body.iva,
        moneda: body.moneda,
        fechaEmision: toMySQLDatetime(body.fechaEmision),
        fechaDesdeFacturacion: body.fechaDesdeFacturacion || null,
        fechaHastaFacturacion: body.fechaHastaFacturacion || null,
        idFacturaOriginal: body.idFacturaOriginal,
        motivoRectificacion: body.motivoRectificacion || null,
      });

      resolve(Service.successResponse({
        idFacturaRectificativa: result.idFacturaRectificativa,
        mensaje: 'Factura rectificativa creada correctamente',
      }, 201));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al crear factura rectificativa',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  actualizarEstadoFactura,
  consultarExistenciaFactura,
  consultarFacturaDetalle,
  consultarEstadoFactura,
  crearFactura,
  crearFacturaRectificativa,
};
