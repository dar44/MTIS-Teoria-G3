/* eslint-disable no-unused-vars */
const Service = require('./Service');
const { validarWSKey } = require('../utils/Utils');

/**
 * Validar WSKey
 * Valida la clave WSKey enviada por cabecera.
 *
 * returns ValidacionResponse
 */
const validarWsKey = ({ WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);
      resolve(Service.successResponse({
        valido: true,
        mensaje: 'WSKey válida',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'WSKey no válida',
        e.status || 401,
      ));
    }
  },
);

/**
 * Validar datos de entrada de factura
 * Valida la estructura y reglas de negocio de los datos de entrada.
 *
 * facturaInput FacturaInput
 * returns ValidacionResponse
 */
const validarDatosFactura = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = body;
      const faltantes = [];
      if (!factura.numeroFactura) faltantes.push('numeroFactura');
      if (factura.baseImponible == null) faltantes.push('baseImponible');
      if (factura.iva == null) faltantes.push('iva');
      if (!factura.moneda) faltantes.push('moneda');
      if (!factura.tipo) faltantes.push('tipo');
      if (!factura.fechaEmision) faltantes.push('fechaEmision');

      if (faltantes.length > 0) {
        return reject(Service.rejectResponse(
          `Datos inválidos. Campos faltantes: ${faltantes.join(', ')}`,
          400,
        ));
      }

      if (factura.baseImponible <= 0) {
        return reject(Service.rejectResponse(
          'La base imponible debe ser mayor que 0',
          400,
        ));
      }

      if (factura.iva < 0 || factura.iva > 1) {
        return reject(Service.rejectResponse(
          'El IVA debe estar entre 0 y 1',
          400,
        ));
      }

      resolve(Service.successResponse({
        valido: true,
        mensaje: 'Validación realizada correctamente',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error en validación',
        e.status || 500,
      ));
    }
  },
);

/**
 * Validar permisos del solicitante
 * Comprueba que la acción solicitada está permitida para el usuario.
 */
const validarPermisosSolicitante = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const usuarioId = body && body.usuarioId;
      const accion = body && body.accion;
      if (!usuarioId || !accion) {
        return reject(Service.rejectResponse(
          'usuarioId y accion son obligatorios',
          400,
        ));
      }

      const accionesPermitidas = new Set([
        'COBRAR_FACTURA',
        'EMITIR_FACTURA',
        'CONSULTAR_FACTURA',
        'ANULAR_FACTURA',
        'SUBSANAR_FACTURA',
      ]);

      if (!accionesPermitidas.has(String(accion).toUpperCase())) {
        return reject(Service.rejectResponse(
          `El usuario ${usuarioId} no tiene permisos para la accion ${accion}`,
          403,
        ));
      }

      resolve(Service.successResponse({
        valido: true,
        permisos: true,
        mensaje: 'Permisos validados correctamente',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al validar permisos',
        e.status || 500,
      ));
    }
  },
);

/**
 * Validar consistencia de fechas
 * Comprueba que la fecha de operación existe, es válida y no está en el futuro.
 */
const validarConsistenciaFechas = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const fechaOperacion = body && body.fechaOperacion;
      if (!fechaOperacion) {
        return reject(Service.rejectResponse(
          'fechaOperacion es obligatoria',
          400,
        ));
      }

      const fecha = new Date(fechaOperacion);
      if (Number.isNaN(fecha.getTime())) {
        return reject(Service.rejectResponse(
          'fechaOperacion no tiene un formato válido',
          400,
        ));
      }

      const ahora = new Date();
      if (fecha.getTime() > ahora.getTime()) {
        return reject(Service.rejectResponse(
          'La fecha de operacion no puede estar en el futuro',
          400,
        ));
      }

      resolve(Service.successResponse({
        valido: true,
        mensaje: 'Fechas consistentes',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al validar fechas',
        e.status || 500,
      ));
    }
  },
);

/**
 * Validar datos del solicitante
 *
 * validacionSolicitanteRequest ValidacionSolicitanteRequest
 * returns ValidacionSolicitanteResponse
 */
const validarDatosSolicitante = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const { nif } = body;
      if (!nif || nif.trim().length === 0) {
        return reject(Service.rejectResponse(
          'El NIF del solicitante es obligatorio',
          400,
        ));
      }

      const db = require('../ConexionDB/Conexion');
      const empresa = await db.buscarEmpresaPorEmail(body.email || '');

      resolve(Service.successResponse({
        valido: !!empresa,
        mensaje: empresa
          ? 'Solicitante válido'
          : 'Solicitante no encontrado en el sistema',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error en validación',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  validarDatosFactura,
  validarConsistenciaFechas,
  validarPermisosSolicitante,
  validarWsKey,
  validarDatosSolicitante,
};
