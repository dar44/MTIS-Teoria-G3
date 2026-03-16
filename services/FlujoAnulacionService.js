/* eslint-disable no-unused-vars */
const Service = require('./Service');

const iniciarFlujoAnulacion = ({ anulacionRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        anulacionRequest,
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
  iniciarFlujoAnulacion,
};
