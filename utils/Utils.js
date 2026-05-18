const db = require('../ConexionDB/Conexion');

async function validarWSKey(wsKey) {
    const validWsKeyRow = await db.obtenerRestKey();

    if (!validWsKeyRow) {
        throw {
            status: 500,
            message: 'No se encontró la WSKey en la base de datos',
            salida: 'Error interno: WSKey no encontrada en la base de datos'
        };
    }

    const VALID_WS_KEY = validWsKeyRow.valor;

    if (!wsKey) {
        throw {
            status: 401,
            error: { error: 'WSKey no valida. Acceso no autorizado al sistema de anulacion de facturas.' }
        };
    }

    if (wsKey.trim() !== VALID_WS_KEY) {
        throw {
            status: 401,
            error: { error: 'WSKey no valida. Acceso no autorizado al sistema de anulacion de facturas.' }
        };
    }
}

module.exports = {
    validarWSKey
};