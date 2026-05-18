/* eslint-disable no-unused-vars */
const Service = require('./Service');
const db = require('../ConexionDB/Conexion');
const { validarWSKey } = require('../utils/Utils');

/**
 * Actualizar estado de factura
 * Actualiza el estado (y motivo opcional) de una factura existente.
 */
const actualizarEstadoFactura = ({ idFactura, body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const { nuevoEstado, motivo } = body || {};
      if (!nuevoEstado) {
        return reject(Service.rejectResponse('nuevoEstado es obligatorio', 400));
      }

      const factura = await db.obtenerFacturaPorId(Number(idFactura));
      if (!factura) {
        return reject(Service.rejectResponse('Factura no encontrada', 404));
      }

      await db.actualizarEstadoFactura(Number(idFactura), nuevoEstado, motivo || null);
      resolve(Service.successResponse({ mensaje: 'Estado de factura actualizado correctamente' }));
    } catch (e) {
      reject(Service.rejectResponse(e.salida || e.message || 'Error al actualizar estado de factura', e.status || 500));
    }
  },
);

/**
 * Consultar estado de factura
 * Devuelve el estado actual de una factura.
 */
const consultarEstadoFactura = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerEstadoFacturaPorId(Number(idFactura));
      if (!factura) {
        return reject(Service.rejectResponse('Factura no encontrada', 404));
      }

      resolve(Service.successResponse({
        idFactura: factura.id,
        numeroFactura: factura.numero_factura,
        estado: factura.estado,
      }));
    } catch (e) {
      reject(Service.rejectResponse(e.salida || e.message || 'Error al consultar estado', e.status || 500));
    }
  },
);

/**
 * Consultar existencia de factura
 * Verifica si una factura existe en el sistema.
 */
const consultarExistenciaFactura = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerFacturaPorId(Number(idFactura));
      resolve(Service.successResponse({
        idFactura: Number(idFactura),
        existe: !!factura,
        mensaje: factura ? 'Factura encontrada en el sistema' : 'Factura no encontrada',
      }));
    } catch (e) {
      reject(Service.rejectResponse(e.salida || e.message || 'Error al verificar existencia', e.status || 500));
    }
  },
);

/**
 * Recuperar datos detallados de factura
 * Recupera los datos completos de una factura por su identificador.
 * Incluye empresaEmail y empresaNombre (campos extra para uso de MuleSoft).
 */
const consultarFacturaDetalle = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerFacturaPorIdConEmpresa(Number(idFactura));
      if (!factura) {
        return reject(Service.rejectResponse('Factura no encontrada', 404));
      }

      resolve(Service.successResponse({
        idFactura:             factura.id,
        empresaId:             factura.empresa_id,
        empresaEmail:          factura.empresa_email,
        empresaNombre:         factura.empresa_nombre,
        numeroFactura:         factura.numero_factura,
        baseImponible:         factura.base_imponible,
        iva:                   factura.iva,
        moneda:                factura.moneda,
        tipo:                  factura.tipo,
        estado:                factura.estado,
        motivoEstado:          factura.motivo_estado || null,
        fechaEmision:          factura.fecha_emision,
        fechaDesdeFacturacion: factura.fecha_desde_facturacion || null,
        fechaHastaFacturacion: factura.fecha_hasta_facturacion || null,
        idFacturaOriginal:     factura.factura_original_id || null,
      }));
    } catch (e) {
      reject(Service.rejectResponse(e.salida || e.message || 'Error al consultar factura', e.status || 500));
    }
  },
);

const toMysqlDatetime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Crear factura
 * Crea y persiste una factura ordinaria en base de datos.
 */
const crearFactura = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = body;
      if (!factura.empresaId || !factura.numeroFactura || factura.baseImponible == null) {
        return reject(Service.rejectResponse(
          'Campos obligatorios faltantes: empresaId, numeroFactura, baseImponible', 400,
        ));
      }

      const resultado = await db.crearFactura({
        empresaId:             factura.empresaId,
        numeroFactura:         factura.numeroFactura,
        baseImponible:         factura.baseImponible,
        iva:                   factura.iva ?? 0,
        moneda:                factura.moneda || 'EUR',
        tipo:                  factura.tipo || 'ORDINARIA',
        estado:                factura.estado || 'VALIDA',
        fechaEmision:          toMysqlDatetime(factura.fechaEmision || new Date().toISOString()),
        fechaDesdeFacturacion: factura.fechaDesdeFacturacion || null,
        fechaHastaFacturacion: factura.fechaHastaFacturacion || null,
      });

      resolve(Service.successResponse({
        idFactura:             resultado.idFactura,
        empresaId:             factura.empresaId,
        numeroFactura:         factura.numeroFactura,
        baseImponible:         factura.baseImponible,
        iva:                   factura.iva ?? 0,
        moneda:                factura.moneda || 'EUR',
        tipo:                  factura.tipo || 'ORDINARIA',
        estado:                factura.estado || 'VALIDA',
        fechaEmision:          factura.fechaEmision,
        fechaDesdeFacturacion: factura.fechaDesdeFacturacion || null,
        fechaHastaFacturacion: factura.fechaHastaFacturacion || null,
      }, 201));
    } catch (e) {
      reject(Service.rejectResponse(e.salida || e.message || 'Error al crear factura', e.status || 500));
    }
  },
);

/**
 * Crear factura rectificativa
 * Crea y persiste una factura rectificativa vinculada a la original que se subsana.
 */
const crearFacturaRectificativa = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const datos = body;
      if (!datos.idFacturaOriginal || !datos.empresaId || !datos.numeroFactura) {
        return reject(Service.rejectResponse(
          'Campos obligatorios faltantes: idFacturaOriginal, empresaId, numeroFactura', 400,
        ));
      }

      const original = await db.obtenerFacturaPorId(Number(datos.idFacturaOriginal));
      if (!original) {
        return reject(Service.rejectResponse('Factura original referenciada no encontrada', 404));
      }

      const resultado = await db.crearFacturaRectificativa({
        empresaId:             datos.empresaId,
        numeroFactura:         datos.numeroFactura,
        baseImponible:         datos.baseImponible,
        iva:                   datos.iva,
        moneda:                datos.moneda || 'EUR',
        fechaEmision:          toMysqlDatetime(datos.fechaEmision || new Date().toISOString()),
        fechaDesdeFacturacion: datos.fechaDesdeFacturacion || null,
        fechaHastaFacturacion: datos.fechaHastaFacturacion || null,
        idFacturaOriginal:     datos.idFacturaOriginal,
        motivoRectificacion:   datos.motivoRectificacion || null,
      });

      resolve(Service.successResponse({
        idFacturaRectificativa: resultado.idFacturaRectificativa,
        idFacturaOriginal:      datos.idFacturaOriginal,
        empresaId:              datos.empresaId,
        numeroFactura:          datos.numeroFactura,
        baseImponible:          datos.baseImponible,
        iva:                    datos.iva,
        moneda:                 datos.moneda || 'EUR',
        tipo:                   'RECTIFICATIVA',
        estado:                 'VALIDA',
        motivoRectificacion:    datos.motivoRectificacion || null,
        fechaEmision:           datos.fechaEmision,
        fechaDesdeFacturacion:  datos.fechaDesdeFacturacion || null,
        fechaHastaFacturacion:  datos.fechaHastaFacturacion || null,
      }, 201));
    } catch (e) {
      reject(Service.rejectResponse(e.salida || e.message || 'Error al crear factura rectificativa', e.status || 500));
    }
  },
);

/**
 * Listar facturas rectificativas previas de una factura original.
 * Endpoint interno consumido por el flujo MuleSoft de subsanación
 * para el bucle de anulación de rectificativas anteriores.
 */
const listarRectificativasPrevias = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const filas = await db.obtenerRectificativasPorFacturaOriginal(Number(idFactura));
      const rectificativas = filas.map((f) => ({
        idFactura:     f.id,
        numeroFactura: f.numero_factura,
        estado:        f.estado,
        empresaId:     f.empresa_id,
      }));

      resolve(Service.successResponse(rectificativas));
    } catch (e) {
      reject(Service.rejectResponse(e.salida || e.message || 'Error al listar rectificativas previas', e.status || 500));
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
  listarRectificativasPrevias,
};
