/* eslint-disable no-unused-vars */
const Service = require('./Service');
const db = require('../ConexionDB/Conexion');
const { validarWSKey } = require('../utils/Utils');

/**
 * Consultar empresa
 * Consulta una empresa registrada a partir de su email.
 *
 * email String Email de la empresa
 * returns EmpresaResponse
 */
const consultarEmpresa = ({ email, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const empresa = await db.buscarEmpresaPorEmail(email);
      if (!empresa) {
        return reject(Service.rejectResponse(
          `Empresa con email ${email} no encontrada`,
          404,
        ));
      }

      resolve(Service.successResponse({
        id: empresa.id,
        email: empresa.email,
        nombre: empresa.nombre,
        nif: empresa.nif,
        iban: empresa.iban,
        direccion: empresa.direccion,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al consultar empresa',
        e.status || 500,
      ));
    }
  },
);

/**
 * Verificar coincidencia de datos de empresa
 *
 * email String Email de la empresa
 * verificarEmpresaRequest VerificarEmpresaRequest
 * returns VerificacionResponse
 */
const verificarDatosEmpresa = ({ email, body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const empresa = await db.buscarEmpresaPorEmail(email);
      if (!empresa) {
        return reject(Service.rejectResponse(
          `Empresa con email ${email} no encontrada`,
          404,
        ));
      }

      const coincide = (
        empresa.nombre === body.nombre
        && empresa.nif === body.nif
        && empresa.iban === body.iban
      );

      resolve(Service.successResponse({
        valido: coincide,
        mensaje: coincide
          ? 'Los datos de la empresa coinciden correctamente'
          : 'Los datos proporcionados no coinciden con los registrados',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al verificar datos',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  consultarEmpresa,
  verificarDatosEmpresa,
};
