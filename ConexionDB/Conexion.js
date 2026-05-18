'use strict';

const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
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
 * Crea un documento de pago (registro de pago) en la BD
 */
async function crearDocumentoPago(pago) {
    const sql = `
    INSERT INTO pagos
    (
      factura_id,
      importe,
      metodo_pago,
      referencia,
      fecha_pago,
      estado
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `;

    const params = [
        pago.facturaId,
        pago.importe,
        pago.metodoPago || null,
        pago.referencia || null,
        pago.fechaPago || null,
        pago.estado || 'PENDIENTE'
    ];

    const result = await ejecutarQuery(sql, params);

    return {
        idPago: result.insertId,
        ...pago
    };
}

/**
 * Obtener documento de pago por id
 */
async function obtenerDocumentoPagoPorId(idPago) {
    const sql = 'SELECT * FROM pagos WHERE id = ? LIMIT 1';
    const results = await ejecutarQuery(sql, [idPago]);
    return results.length > 0 ? results[0] : null;
}

/**
 * Listar pagos por factura
 */
async function listarPagosPorFactura(facturaId) {
    const sql = 'SELECT * FROM pagos WHERE factura_id = ? ORDER BY creado_at DESC';
    const results = await ejecutarQuery(sql, [facturaId]);
    return results;
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

/**
 * Obtiene una factura con los datos de su empresa mediante JOIN.
 * Devuelve empresa_email y empresa_nombre como campos adicionales,
 * necesarios para notificaciones en el flujo de subsanación.
 */
async function obtenerFacturaPorIdConEmpresa(idFactura) {
    const sql = `
        SELECT f.*,
               e.email  AS empresa_email,
               e.nombre AS empresa_nombre
        FROM facturas f
        INNER JOIN empresas e ON f.empresa_id = e.id
        WHERE f.id = ?
        LIMIT 1
    `;
    const results = await ejecutarQuery(sql, [idFactura]);
    return results.length > 0 ? results[0] : null;
}

/**
 * Devuelve todas las facturas rectificativas asociadas a una factura original.
 * Usado por el flujo MuleSoft de subsanación para el bucle de anulación.
 */
async function obtenerRectificativasPorFacturaOriginal(idFacturaOriginal) {
    const sql = `
        SELECT id, numero_factura, estado, empresa_id
        FROM facturas
        WHERE factura_original_id = ?
    `;
    return ejecutarQuery(sql, [idFacturaOriginal]);
}

/**
 * Crea un reporte de generación de facturación
 */
async function crearReporte(reporte) {
    const sql = `
    INSERT INTO reportes
    (
      usuario_id,
      fecha_inicio,
      fecha_fin,
      categoria,
      numero_registros,
      monto_total,
      estado,
      url_documento
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
        reporte.usuarioId,
        reporte.fechaInicio,
        reporte.fechaFin,
        reporte.categoria || 'GENERAL',
        reporte.numeroRegistros || 0,
        reporte.montoTotal || 0,
        reporte.estado || 'GENERADO',
        reporte.urlDocumento || null
    ];

    const result = await ejecutarQuery(sql, params);

    return {
        idReporte: result.insertId,
        ...reporte
    };
}

/**
 * Obtiene un reporte por su ID
 */
async function obtenerReportePorId(idReporte) {
    const sql = 'SELECT * FROM reportes WHERE id = ? LIMIT 1';
    const results = await ejecutarQuery(sql, [idReporte]);
    return results.length > 0 ? results[0] : null;
}

/**
 * Actualiza la URL del documento PDF de un reporte
 */
async function actualizarUrlReporte(idReporte, urlDocumento) {
    const sql = 'UPDATE reportes SET url_documento = ?, estado = ? WHERE id = ?';
    const result = await ejecutarQuery(sql, [urlDocumento, 'COMPLETADO', idReporte]);
    return { idReporte, urlDocumento, filasAfectadas: result.affectedRows };
}

module.exports = {
    connection,
    ejecutarQuery,
    obtenerRestKey,
    buscarEmpresaPorEmail,
    crearFactura,
    crearFacturaRectificativa,
    obtenerFacturaPorId,
    obtenerFacturaPorIdConEmpresa,
    obtenerFacturaPorNumero,
    obtenerEstadoFacturaPorId,
    obtenerRectificativasPorFacturaOriginal,
    actualizarEstadoFactura,
    registrarEventoAuditoria,
    registrarErrorAuditoria,
    crearDocumentoPago,
    obtenerDocumentoPagoPorId,
    listarPagosPorFactura,
    registrarErrorAuditoria
    , crearDocumentoPago
    , obtenerDocumentoPagoPorId
    , listarPagosPorFactura
    , crearReporte
    , obtenerReportePorId
    , actualizarUrlReporte
};
