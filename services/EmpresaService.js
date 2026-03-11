/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Consultar empresa
* Consulta una empresa registrada a partir de su email.
*
* email String Email de la empresa
* returns EmpresaResponse
* */
const consultarEmpresa = ({ email }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        email,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Verificar coincidencia de datos de empresa
* Comprueba si los datos introducidos coinciden con los almacenados para la empresa identificada por su email. 
*
* email String Email de la empresa
* verificarEmpresaRequest VerificarEmpresaRequest 
* returns VerificacionResponse
* */
const verificarDatosEmpresa = ({ email, verificarEmpresaRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        email,
        verificarEmpresaRequest,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);

module.exports = {
  consultarEmpresa,
  verificarDatosEmpresa,
};
