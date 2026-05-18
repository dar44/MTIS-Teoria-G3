/* eslint-disable no-unused-vars */
const Service = require('./Service');
const db = require('../ConexionDB/Conexion');
const { validarWSKey } = require('../utils/Utils');
const fs = require('fs');
const path = require('path');

let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  PDFDocument = null;
}

const DIR_REPORTES = path.join(__dirname, '..', 'uploaded_files', 'reportes');

// Asegurar que el directorio de reportes existe
if (!fs.existsSync(DIR_REPORTES)) {
  fs.mkdirSync(DIR_REPORTES, { recursive: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIÓN 1 (WSDL: validarAcceso)
// Valida que la wsKey y el usuarioId sean correctos
// ─────────────────────────────────────────────────────────────────────────────
const validarAccesoReporte = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const { usuarioId } = body;
      if (!usuarioId || usuarioId.trim() === '') {
        return reject(Service.rejectResponse(
          'El campo usuarioId es obligatorio',
          400,
        ));
      }

      resolve(Service.successResponse({
        exito: true,
        mensaje: `Acceso autorizado para el usuario ${usuarioId}`,
        codigoError: null,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al validar acceso',
        e.status || 500,
      ));
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIÓN 2 (WSDL: validarRangoFechas)
// Valida que fechaInicio <= fechaFin y que no estén en el futuro
// ─────────────────────────────────────────────────────────────────────────────
const validarRangoFechasReporte = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const { fechaInicio, fechaFin } = body;
      if (!fechaInicio || !fechaFin) {
        return reject(Service.rejectResponse(
          'fechaInicio y fechaFin son obligatorias',
          400,
        ));
      }

      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      const ahora = new Date();

      if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
        return reject(Service.rejectResponse(
          'Formato de fecha inválido. Use YYYY-MM-DD',
          400,
        ));
      }

      if (inicio > fin) {
        return reject(Service.rejectResponse(
          'La fecha de inicio no puede ser posterior a la fecha de fin',
          400,
        ));
      }

      if (fin > ahora) {
        return reject(Service.rejectResponse(
          'La fecha de fin no puede ser futura',
          400,
        ));
      }

      resolve(Service.successResponse({
        exito: true,
        mensaje: 'Rango de fechas válido',
        codigoError: null,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al validar rango de fechas',
        e.status || 500,
      ));
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIÓN 3 (WSDL: obtenerVolumenFacturacion)
// Calcula el volumen de facturación en un periodo y categoría dados
// ─────────────────────────────────────────────────────────────────────────────
const obtenerVolumenFacturacion = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const { fechaInicio, fechaFin, categoria } = body;

      // Construir filtro de categoría (tipo de factura)
      const params = [
        `${fechaInicio} 00:00:00`,
        `${fechaFin} 23:59:59`,
      ];

      let filtroCategoria = '';
      if (categoria && categoria !== 'GENERAL' && categoria !== 'TODAS') {
        filtroCategoria = 'AND tipo = ?';
        params.push(categoria);
      }

      const sql = `
        SELECT
          COUNT(*) AS numeroRegistros,
          COALESCE(SUM(base_imponible * (1 + iva)), 0) AS montoTotalEstimado
        FROM facturas
        WHERE fecha_emision BETWEEN ? AND ?
          AND estado NOT IN ('ANULADA')
          ${filtroCategoria}
      `;

      const rows = await db.ejecutarQuery(sql, params);
      const datos = rows[0] || {};

      resolve(Service.successResponse({
        status: {
          exito: true,
          mensaje: 'Volumen de facturación obtenido correctamente',
          codigoError: null,
        },
        datos: {
          numeroRegistros: parseInt(datos.numeroRegistros || 0, 10),
          montoTotalEstimado: parseFloat(Number(datos.montoTotalEstimado || 0).toFixed(2)),
          categoria: categoria || 'GENERAL',
        },
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al obtener volumen de facturación',
        e.status || 500,
      ));
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIÓN 4 (WSDL: registrarReporte)
// Persiste el reporte en BD y devuelve el idReporte
// ─────────────────────────────────────────────────────────────────────────────
const registrarReporte = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const { contenido, usuarioId, fechaInicio, fechaFin } = body;

      if (!contenido) {
        return reject(Service.rejectResponse(
          'El campo contenido (ResumenFacturacion) es obligatorio',
          400,
        ));
      }

      const reporte = await db.crearReporte({
        usuarioId: usuarioId || 'sistema',
        fechaInicio: fechaInicio || new Date().toISOString().slice(0, 10),
        fechaFin: fechaFin || new Date().toISOString().slice(0, 10),
        categoria: contenido.categoria || 'GENERAL',
        numeroRegistros: contenido.numeroRegistros || 0,
        montoTotal: contenido.montoTotalEstimado || 0,
        estado: 'GENERADO',
        urlDocumento: null,
      });

      resolve(Service.successResponse({
        status: {
          exito: true,
          mensaje: 'Reporte registrado correctamente en la base de datos',
          codigoError: null,
        },
        idReporte: reporte.idReporte,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al registrar el reporte',
        e.status || 500,
      ));
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIÓN 5 (WSDL: generarDocumentoPDF)
// Genera el PDF del reporte y actualiza su URL en BD
// ─────────────────────────────────────────────────────────────────────────────
const generarDocumentoPDFReporte = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const { idReporte } = body;
      if (!idReporte) {
        return reject(Service.rejectResponse('El campo idReporte es obligatorio', 400));
      }

      const reporte = await db.obtenerReportePorId(idReporte);
      if (!reporte) {
        return reject(Service.rejectResponse(
          `No se encontró el reporte con ID ${idReporte}`,
          404,
        ));
      }

      const nombreArchivo = `reporte_${idReporte}_${Date.now()}.pdf`;
      const rutaArchivo = path.join(DIR_REPORTES, nombreArchivo);
      const urlDocumento = `/uploaded_files/reportes/${nombreArchivo}`;

      if (PDFDocument) {
        // Generar PDF real con pdfkit
        await new Promise((res, rej) => {
          const doc = new PDFDocument({ margin: 50 });
          const stream = fs.createWriteStream(rutaArchivo);
          doc.pipe(stream);

          // Cabecera
          doc.rect(0, 0, doc.page.width, 90).fill('#0f172a');
          doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20)
            .text('INFORME DE GENERACIÓN DE REPORTES', 50, 25, { align: 'center' });
          doc.font('Helvetica').fontSize(10)
            .text(`Sistema de Facturación G3 — Reporte #${idReporte}`, 50, 55, { align: 'center' });
          doc.fillColor('#000000');
          doc.moveDown(3);

          // Datos del reporte
          doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e40af')
            .text('Datos del Reporte', 50, doc.y);
          doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke('#93c5fd');
          doc.moveDown(0.5);
          doc.font('Helvetica').fontSize(11).fillColor('#111827');

          const campos = [
            ['ID Reporte', reporte.id],
            ['Usuario', reporte.usuario_id],
            ['Período', `${reporte.fecha_inicio} → ${reporte.fecha_fin}`],
            ['Categoría', reporte.categoria],
            ['Nº Registros', reporte.numero_registros],
            ['Monto Total Estimado', `${Number(reporte.monto_total).toFixed(2)} EUR`],
            ['Estado', reporte.estado],
            ['Fecha Creación', new Date(reporte.creado_at).toLocaleString('es-ES')],
          ];

          campos.forEach(([etiqueta, valor]) => {
            const y = doc.y;
            doc.font('Helvetica-Bold').text(`${etiqueta}:`, 60, y, { continued: false });
            doc.font('Helvetica').text(String(valor ?? '-'), 200, y);
            doc.y = y + 18;
          });

          // Pie
          doc.moveDown(2);
          const yPie = doc.page.height - 55;
          doc.moveTo(50, yPie).lineTo(545, yPie).stroke('#d1d5db');
          doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
            .text(`Generado el ${new Date().toLocaleString('es-ES')} — MTIS Facturación G3`, 50, yPie + 10, { align: 'center' });

          doc.end();
          stream.on('finish', res);
          stream.on('error', rej);
        });
      } else {
        // Fallback: archivo de texto si pdfkit no está disponible
        fs.writeFileSync(
          rutaArchivo,
          `REPORTE #${idReporte}\nPeriodo: ${reporte.fecha_inicio} - ${reporte.fecha_fin}\nCategoria: ${reporte.categoria}\nRegistros: ${reporte.numero_registros}\nMonto: ${reporte.monto_total} EUR\n`,
        );
      }

      // Actualizar URL en BD
      await db.actualizarUrlReporte(idReporte, urlDocumento);

      resolve(Service.successResponse({
        exito: true,
        mensaje: 'PDF del reporte generado correctamente',
        codigoError: null,
        urlDocumento,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al generar el PDF del reporte',
        e.status || 500,
      ));
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIÓN 6 (WSDL: enviarNotificacionReporte)
// Envía un email de notificación con la URL del documento generado
// ─────────────────────────────────────────────────────────────────────────────
const enviarNotificacionReporte = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const { usuarioId, emailDestinatario, urlDocumento } = body;

      if (!emailDestinatario || !urlDocumento) {
        return reject(Service.rejectResponse(
          'emailDestinatario y urlDocumento son obligatorios',
          400,
        ));
      }

      const smtp = require('../ConexionFakeSMTP/ConexionFakeSMTP');
      await smtp.sendEmail(
        'facturacion@sistema-g3.com',
        emailDestinatario,
        'Reporte de Generación de Facturación — Disponible',
        `Estimado/a usuario,\n\nSu reporte de generación de facturación ha sido generado y está disponible en:\n${urlDocumento}\n\nSistema de Facturación G3`,
      );

      resolve(Service.successResponse({
        exito: true,
        mensaje: `Notificación enviada correctamente a ${emailDestinatario}`,
        codigoError: null,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al enviar notificación del reporte',
        e.status || 500,
      ));
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIÓN AUXILIAR: Obtener reporte por ID
// ─────────────────────────────────────────────────────────────────────────────
const obtenerReportePorId = ({ idReporte, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const reporte = await db.obtenerReportePorId(idReporte);
      if (!reporte) {
        return reject(Service.rejectResponse(
          `Reporte con ID ${idReporte} no encontrado`,
          404,
        ));
      }

      resolve(Service.successResponse(reporte));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al obtener el reporte',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  validarAccesoReporte,
  validarRangoFechasReporte,
  obtenerVolumenFacturacion,
  registrarReporte,
  generarDocumentoPDFReporte,
  enviarNotificacionReporte,
  obtenerReportePorId,
};
