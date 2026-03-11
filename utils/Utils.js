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
            status: 400,
            message: 'WSKey no proporcionada en la cabecera HTTP',
            salida: 'Error: La cabecera WSKey es obligatoria'
        };
    }

    if (wsKey.trim() !== VALID_WS_KEY) {
        throw {
            status: 403,
            message: 'Acceso no autorizado',
            salida: 'Error: WSKey inválida. Acceso denegado'
        };
    }
}

module.exports = {
    validarWSKey
};