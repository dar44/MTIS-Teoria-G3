/* eslint-disable no-unused-vars */
const Service = require('./Service');
const db = require('../ConexionDB/Conexion');
const { validarWSKey } = require('../utils/Utils');

function parseRange(rangoFechas) {
  if (!rangoFechas) return null;

  const partes = String(rangoFechas).split('/');
  if (partes.length !== 2) return null;

  const inicio = new Date(partes[0]);
  const fin = new Date(partes[1]);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    return null;
  }

  return { inicio, fin };
}

const calcularEstadisticasRecaudacion = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const rango = parseRange(body && body.rangoFechas);
      if (body && body.rangoFechas && !rango) {
        return reject(Service.rejectResponse(
          'rangoFechas debe tener el formato YYYY-MM-DD/YYYY-MM-DD',
          400,
        ));
      }

      const filtros = ["COALESCE(estado, '') <> 'PENDIENTE'"];
      const params = [];

      if (rango) {
        filtros.push('COALESCE(fecha_pago, creado_at) BETWEEN ? AND ?');
        params.push(
          `${rango.inicio.toISOString().slice(0, 10)} 00:00:00`,
          `${rango.fin.toISOString().slice(0, 10)} 23:59:59`,
        );
      }

      const sql = `
        SELECT
          COALESCE(SUM(importe), 0) AS totalCobrado,
          COUNT(DISTINCT factura_id) AS totalFacturasCobradas,
          COALESCE(AVG(importe), 0) AS promedioCobro
        FROM pagos
        WHERE ${filtros.join(' AND ')}
      `;

      const rows = await db.ejecutarQuery(sql, params);
      const estadisticas = rows[0] || {};

      resolve(Service.successResponse({
        totalCobrado: Number.parseFloat(Number(estadisticas.totalCobrado || 0).toFixed(2)),
        totalFacturasCobradas: Number.parseInt(estadisticas.totalFacturasCobradas || 0, 10),
        promedioCobro: Number.parseFloat(Number(estadisticas.promedioCobro || 0).toFixed(2)),
        mensaje: 'Estadísticas calculadas devueltas con éxito.',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al calcular estadísticas',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  calcularEstadisticasRecaudacion,
};