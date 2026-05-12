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
  validarWsKey,
  validarDatosSolicitante,
};
