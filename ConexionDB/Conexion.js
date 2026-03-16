'use strict';

const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'facturacion'
});

connection.connect((err) => {
    if (err) {
        console.error('Error conectando a MySQL:', err);
        return;
    }
    console.log('Conexión a MySQL establecida.');
});

/**
 * Ejecuta una query y devuelve una promesa
 */
function ejecutarQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (error, results) => {
            if (error) {
                console.error('Error en query:', error);
                return reject(error);
            }
            resolve(results);
        });
    });
}

/**
 * Obtiene la WSKey REST desde la tabla parametros
 */
async function obtenerRestKey() {
    const sql = 'SELECT * FROM parametros WHERE clave = ? LIMIT 1';
    const results = await ejecutarQuery(sql, ['rest_key']);
    return results.length > 0 ? results[0] : null;
}

/**
 * Busca una empresa por email
 */
async function buscarEmpresaPorEmail(email) {
    const sql = 'SELECT * FROM empresas WHERE email = ? LIMIT 1';
    const results = await ejecutarQuery(sql, [email]);
    return results.length > 0 ? results[0] : null;
}

/**
 * Crea una factura nueva
 * Devuelve el objeto con el id insertado
 */
async function crearFactura(factura) {
    const sql = `
    INSERT INTO facturas
    (
      empresa_id,
      numero_factura,
      base_imponible,
      iva,
      moneda,
      tipo,
      estado,
      fecha_emision,
      fecha_desde_facturacion,
      fecha_hasta_facturacion
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
        factura.empresaId,
        factura.numeroFactura,
        factura.baseImponible,
        factura.iva,
        factura.moneda,
        factura.tipo,
        factura.estado,
        factura.fechaEmision,
        factura.fechaDesdeFacturacion || null,
        factura.fechaHastaFacturacion || null
    ];

    const result = await ejecutarQuery(sql, params);

    return {
        idFactura: result.insertId,
        ...factura
    };
}

/**
 * Obtiene una factura por su ID
 */
async function obtenerFacturaPorId(idFactura) {
    const sql = 'SELECT * FROM facturas WHERE id = ? LIMIT 1';
    const results = await ejecutarQuery(sql, [idFactura]);
    return results.length > 0 ? results[0] : null;
}

/**
 * Obtiene una factura por numero_factura
 */
async function obtenerFacturaPorNumero(numeroFactura) {
    const sql = 'SELECT * FROM facturas WHERE numero_factura = ? LIMIT 1';
    const results = await ejecutarQuery(sql, [numeroFactura]);
    return results.length > 0 ? results[0] : null;
}

/**
 * Obtiene estado de una factura por ID
 */
async function obtenerEstadoFacturaPorId(idFactura) {
    const sql = 'SELECT id, numero_factura, estado FROM facturas WHERE id = ? LIMIT 1';
    const results = await ejecutarQuery(sql, [idFactura]);
    return results.length > 0 ? results[0] : null;
}

/**
 * Actualiza el estado de una factura
 */
async function actualizarEstadoFactura(idFactura, nuevoEstado, motivo = null) {
    const sql = `
    UPDATE facturas
    SET estado = ?, motivo_estado = ?
    WHERE id = ?
  `;

    const result = await ejecutarQuery(sql, [nuevoEstado, motivo, idFactura]);

    return {
        idFactura,
        nuevoEstado,
        filasAfectadas: result.affectedRows
    };
}

/**
 * Registra un evento de auditoría
 * Opcional según tu práctica
 */
async function registrarEventoAuditoria(evento) {
    const sql = `
    INSERT INTO auditoria_eventos
    (
      tipo_evento,
      descripcion,
      fecha,
      origen
    )
    VALUES (?, ?, ?, ?)
  `;

    const params = [
        evento.tipoEvento,
        evento.descripcion,
        evento.fecha || new Date(),
        evento.origen || null
    ];

    const result = await ejecutarQuery(sql, params);

    return {
        id: result.insertId,
        ...evento
    };
}

/**
 * Registra un error técnico de auditoría
 * Opcional según tu práctica
 */
async function registrarErrorAuditoria(errorData) {
    const sql = `
    INSERT INTO auditoria_errores
    (
      tipo_error,
      descripcion,
      fecha,
      origen,
      factura_id
    )
    VALUES (?, ?, ?, ?, ?)
  `;

    const params = [
        errorData.tipoError,
        errorData.descripcion,
        errorData.fecha || new Date(),
        errorData.origen || null,
        errorData.idFactura || null
    ];

    const result = await ejecutarQuery(sql, params);

    return {
        id: result.insertId,
        ...errorData
    };
}

/**
 * Crea una factura rectificativa vinculada a la factura original
 * Devuelve el objeto con el id insertado
 */
async function crearFacturaRectificativa(factura) {
    const sql = `
    INSERT INTO facturas
    (
      empresa_id,
      numero_factura,
      base_imponible,
      iva,
      moneda,
      tipo,
      estado,
      fecha_emision,
      fecha_desde_facturacion,
      fecha_hasta_facturacion,
      factura_original_id,
      motivo_rectificacion
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
        factura.empresaId,
        factura.numeroFactura,
        factura.baseImponible,
        factura.iva,
        factura.moneda,
        'RECTIFICATIVA',
        'VALIDA',
        factura.fechaEmision,
        factura.fechaDesdeFacturacion || null,
        factura.fechaHastaFacturacion || null,
        factura.idFacturaOriginal,
        factura.motivoRectificacion || null
    ];

    const result = await ejecutarQuery(sql, params);

    return {
        idFacturaRectificativa: result.insertId,
        ...factura
    };
}

module.exports = {
    connection,
    ejecutarQuery,
    obtenerRestKey,
    buscarEmpresaPorEmail,
    crearFactura,
    crearFacturaRectificativa,
    obtenerFacturaPorId,
    obtenerFacturaPorNumero,
    obtenerEstadoFacturaPorId,
    actualizarEstadoFactura,
    registrarEventoAuditoria,
    registrarErrorAuditoria
};