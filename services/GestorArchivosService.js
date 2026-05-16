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
  PDFDocument = null; // pdfkit not installed — fallback to plain text "PDF"
}

const DIR_FACTURAS = path.join(__dirname, '..', 'uploaded_files', 'facturas');
const DIR_PAGOS = path.join(__dirname, '..', 'uploaded_files', 'pagos');

function formatearFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return String(fecha);
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatearImporte(valor, moneda = 'EUR') {
  const number = Number(valor);
  if (Number.isNaN(number)) return `${valor} ${moneda}`;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: moneda || 'EUR',
  }).format(number);
}

function escribirLinea(doc, etiqueta, valor, xEtiqueta = 70, xValor = 190, lineHeight = 18) {
  const y = doc.y || 0;
  // write label and value on the same baseline
  doc.font('Helvetica-Bold').fillColor('#1f2937').fontSize(11).text(`${etiqueta}:`, xEtiqueta, y, { width: xValor - xEtiqueta - 8, continued: false });
  doc.font('Helvetica').fillColor('#111827').fontSize(11).text(String(valor ?? ''), xValor, y, { width: doc.page.width - xValor - 50 });
  // advance the cursor to the next line (set explicit y so subsequent calls align)
  doc.y = (y + lineHeight);
}

function pintarCabecera(doc, titulo, subtitulo) {
  doc.save();
  const headerHeight = 92;
  doc.rect(0, 0, doc.page.width, headerHeight).fill('#0f172a');
  const contentWidth = doc.page.width - 100;
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(titulo, 50, 28, { width: contentWidth, align: 'center' });
  if (subtitulo) {
    doc.font('Helvetica').fontSize(10).text(subtitulo, 58, 58, { width: contentWidth - 16, align: 'center' });
  }
  doc.restore();
  // position cursor below header
  doc.y = headerHeight + 12;
}

function pintarCaja(doc, x, y, width, height, titulo, color = '#2563eb') {
  doc.save();
  doc.roundedRect(x, y, width, height, 8).fillAndStroke('#f8fafc', '#e5e7eb');
  doc.roundedRect(x, y, width, 28, 8).fill(color);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text(titulo, x + 12, y + 8, { width: width - 24 });
  doc.restore();
  // set cursor start inside the box (content area) after restoring graphics state
  doc.y = y + 36;
  doc.x = x + 16;
}

function dibujarPie(doc, texto) {
  const y = doc.page.height - 60;
  doc.save();
  doc.strokeColor('#d1d5db').lineWidth(1).moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
  doc.fillColor('#6b7280').font('Helvetica').fontSize(9).text(texto, 50, y + 10, { width: doc.page.width - 100, align: 'center' });
  doc.restore();
}

function calcularImporteFactura(factura) {
  const baseImponible = Number.parseFloat(factura.base_imponible);
  const iva = Number.parseFloat(factura.iva || 0);
  const total = baseImponible * (1 + iva);
  return Number(total.toFixed(2));
}

/**
 * Genera contenido XML de una factura
 */
function construirXML(factura, empresa) {
  const total = (parseFloat(factura.base_imponible) * (1 + parseFloat(factura.iva))).toFixed(2);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<factura xmlns="urn:facturacion-electronica:g3">',
    `  <id>${factura.id}</id>`,
    `  <numeroFactura>${factura.numero_factura}</numeroFactura>`,
    '  <empresa>',
    `    <id>${empresa.id}</id>`,
    `    <nombre>${empresa.nombre}</nombre>`,
    `    <nif>${empresa.nif}</nif>`,
    `    <email>${empresa.email}</email>`,
    '  </empresa>',
    `  <baseImponible>${factura.base_imponible}</baseImponible>`,
    `  <iva>${factura.iva}</iva>`,
    `  <total>${total}</total>`,
    `  <moneda>${factura.moneda}</moneda>`,
    `  <tipo>${factura.tipo}</tipo>`,
    `  <estado>${factura.estado}</estado>`,
    `  <fechaEmision>${factura.fecha_emision}</fechaEmision>`,
    '</factura>',
  ].join('\n');
}

/**
 * Genera contenido PDF simulado (texto plano)
 */
function construirPDF(factura, empresa) {
  const total = (parseFloat(factura.base_imponible) * (1 + parseFloat(factura.iva))).toFixed(2);
  return [
    '════════════════════════════════════════════════',
    '         FACTURA ELECTRÓNICA',
    '════════════════════════════════════════════════',
    `  Factura Nº:      ${factura.numero_factura}`,
    `  Fecha emisión:   ${factura.fecha_emision}`,
    `  Empresa:         ${empresa.nombre} (${empresa.nif})`,
    `  Base imponible:  ${factura.base_imponible} ${factura.moneda}`,
    `  IVA:             ${(parseFloat(factura.iva) * 100)}%`,
    `  Total:           ${total} ${factura.moneda}`,
    `  Tipo:            ${factura.tipo}`,
    `  Estado:          ${factura.estado}`,
    '════════════════════════════════════════════════',
  ].join('\n');
}

/**
 * Generar XML de la factura
 */
const generarXmlFactura = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerFacturaPorId(idFactura);
      if (!factura) {
        return reject(Service.rejectResponse(`Factura ${idFactura} no encontrada`, 404));
      }

      const empresa = await db.buscarEmpresaPorEmail(
        (await db.ejecutarQuery('SELECT email FROM empresas WHERE id = ?', [factura.empresa_id]))[0]?.email,
      );

      if (!fs.existsSync(DIR_FACTURAS)) fs.mkdirSync(DIR_FACTURAS, { recursive: true });

      const ruta = path.join(DIR_FACTURAS, `${factura.numero_factura}.xml`);
      const xml = construirXML(factura, empresa || { id: factura.empresa_id, nombre: '', nif: '', email: '' });
      fs.writeFileSync(ruta, xml, 'utf8');

      resolve(Service.successResponse({
        idFactura: factura.id,
        tipoDocumento: 'XML',
        generado: true,
        ruta,
        mensaje: 'Documento XML generado correctamente',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al generar XML',
        e.status || 500,
      ));
    }
  },
);

/**
 * Generar PDF de la factura
 */
const generarPdfFactura = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerFacturaPorId(idFactura);
      if (!factura) {
        return reject(Service.rejectResponse(`Factura ${idFactura} no encontrada`, 404));
      }

      const empresa = await db.buscarEmpresaPorEmail(
        (await db.ejecutarQuery('SELECT email FROM empresas WHERE id = ?', [factura.empresa_id]))[0]?.email,
      );

      if (!fs.existsSync(DIR_FACTURAS)) fs.mkdirSync(DIR_FACTURAS, { recursive: true });

      const ruta = path.join(DIR_FACTURAS, `${factura.numero_factura}.pdf`);
      const empresaObj = empresa || { id: factura.empresa_id, nombre: '', nif: '', email: '' };

      if (PDFDocument) {
        // Generate a real PDF using pdfkit
        await new Promise((res, rej) => {
          const doc = new PDFDocument({ size: 'A4', margin: 50 });
          const stream = fs.createWriteStream(ruta);
          doc.pipe(stream);

          const total = (parseFloat(factura.base_imponible) * (1 + parseFloat(factura.iva))).toFixed(2);

          pintarCabecera(
            doc,
            'FACTURA ELECTRÓNICA',
            `Documento generado automáticamente · ${factura.numero_factura}`,
          );

          pintarCaja(doc, 50, 120, 495, 120, 'Datos de la factura');
          doc.fontSize(11);
          escribirLinea(doc, 'Número', factura.numero_factura);
          escribirLinea(doc, 'Fecha emisión', formatearFecha(factura.fecha_emision));
          escribirLinea(doc, 'Tipo', factura.tipo);
          escribirLinea(doc, 'Estado', factura.estado);
          escribirLinea(doc, 'Moneda', factura.moneda);

          pintarCaja(doc, 50, 260, 495, 150, 'Datos de la empresa', '#0ea5e9');
          doc.fontSize(11);
          escribirLinea(doc, 'Empresa', empresaObj.nombre);
          escribirLinea(doc, 'NIF', empresaObj.nif);
          escribirLinea(doc, 'Email', empresaObj.email);
          escribirLinea(doc, 'IBAN', empresaObj.iban || '');

          pintarCaja(doc, 50, 430, 495, 140, 'Importes', '#16a34a');
          doc.fontSize(11);
          escribirLinea(doc, 'Base imponible', formatearImporte(factura.base_imponible, factura.moneda));
          escribirLinea(doc, 'IVA', `${(parseFloat(factura.iva) * 100).toFixed(0)}%`);
          escribirLinea(doc, 'Total', formatearImporte(total, factura.moneda));

          doc.fontSize(9).fillColor('#6b7280').text(
            'Este documento ha sido generado por el sistema de facturación.',
            50,
            590,
            { align: 'center' },
          );

          dibujarPie(doc, 'MTIS · Flujo de Facturación Electrónica');

          doc.end();
          stream.on('finish', () => res());
          stream.on('error', (err) => rej(err));
        });
      } else {
        // Fallback: write a plain-text pseudo-PDF so behavior is unchanged
        const pdf = construirPDF(factura, empresaObj);
        fs.writeFileSync(ruta, pdf, 'utf8');
      }

      resolve(Service.successResponse({
        idFactura: factura.id,
        tipoDocumento: 'PDF',
        generado: true,
        ruta,
        mensaje: 'Documento PDF generado correctamente',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al generar PDF',
        e.status || 500,
      ));
    }
  },
);

/**
 * Crear documento de pago
 */
const crearDocumentoPago = ({ body, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const numeroFactura = body && (body.numeroFactura || body.facturaNumero);
      const facturaId = body && (body.facturaId || body.idFactura);

      if (!numeroFactura && !facturaId) {
        return reject(Service.rejectResponse(
          'numeroFactura o facturaId es obligatorio',
          400,
        ));
      }

      let factura = null;
      if (numeroFactura) {
        factura = await db.obtenerFacturaPorNumero(numeroFactura);
      }
      if (!factura && facturaId) {
        factura = await db.obtenerFacturaPorId(facturaId);
      }

      if (!factura) {
        return reject(Service.rejectResponse(
          `Factura ${numeroFactura || facturaId} no encontrada`,
          404,
        ));
      }

      const importeCobradoRaw = body && (body.importeCobrado != null ? body.importeCobrado : body.importe);
      const importeCobrado = importeCobradoRaw != null
        ? Number.parseFloat(importeCobradoRaw)
        : calcularImporteFactura(factura);

      if (Number.isNaN(importeCobrado)) {
        return reject(Service.rejectResponse(
          'importeCobrado no tiene un formato válido',
          400,
        ));
      }

      // Convertir fecha ISO a formato MySQL (YYYY-MM-DD HH:mm:ss)
      let fechaPago = (body && body.fechaPago) || null;
      if (fechaPago && typeof fechaPago === 'string') {
        // Si es ISO (ej: 2026-05-15T12:21:00.000Z), convertir a MySQL
        if (fechaPago.includes('T')) {
          const d = new Date(fechaPago);
          fechaPago = d.toISOString().slice(0, 19).replace('T', ' ');
        }
      }

      const pago = await db.crearDocumentoPago({
        facturaId: factura.id,
        importe: importeCobrado,
        metodoPago: (body && (body.metodoPago || body.metodo)) || null,
        referencia: (body && body.referencia) || null,
        fechaPago: fechaPago,
        estado: (body && body.estado) || 'PENDIENTE',
      });

      try {
        await crearPdfDocumentoPagoInterno({ idPago: pago.idPago, factura, WSKey });
      } catch (e) {
        // La creación del documento de pago no depende de que el PDF se genere.
      }

      resolve(Service.successResponse({
        idDocumentoPago: pago.idPago,
        numeroFactura: factura.numero_factura,
        importeCobrado,
        mensaje: 'Documento de pago creado con éxito.',
      }, 201));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al crear documento de pago',
        e.status || 500,
      ));
    }
  },
);

/**
 * Almacenar documentos en directorio de red
 */
const almacenarDocumentosRed = ({ idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const factura = await db.obtenerFacturaPorId(idFactura);
      if (!factura) {
        return reject(Service.rejectResponse(`Factura ${idFactura} no encontrada`, 404));
      }

      // Simulación de almacenamiento en red
      resolve(Service.successResponse({
        idFactura: factura.id,
        almacenado: true,
        mensaje: 'Documentos almacenados en directorio de red correctamente',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al almacenar documentos',
        e.status || 500,
      ));
    }
  },
);

/**
 * Generar PDF para un documento de pago
 */
const generarPdfDocumentoPago = ({ idPago, idFactura, WSKey }) => new Promise(
  async (resolve, reject) => {
    try {
      await validarWSKey(WSKey);

      const pago = await db.obtenerDocumentoPagoPorId(idPago);
      if (!pago) return reject(Service.rejectResponse(`Pago ${idPago} no encontrado`, 404));

      const factura = await db.obtenerFacturaPorId(idFactura || pago.factura_id);
      if (!factura) return reject(Service.rejectResponse(`Factura ${idFactura || pago.factura_id} no encontrada`, 404));

      const empresa = await db.buscarEmpresaPorEmail(
        (await db.ejecutarQuery('SELECT email FROM empresas WHERE id = ?', [factura.empresa_id]))[0]?.email,
      );

      if (!fs.existsSync(DIR_PAGOS)) fs.mkdirSync(DIR_PAGOS, { recursive: true });

      const nombreFichero = `${factura.numero_factura}-pago-${idPago}.pdf`;
      const ruta = path.join(DIR_PAGOS, nombreFichero);

      if (PDFDocument) {
        await new Promise((res, rej) => {
          const doc = new PDFDocument({ size: 'A4', margin: 50 });
          const stream = fs.createWriteStream(ruta);
          doc.pipe(stream);

          pintarCabecera(
            doc,
            'DOCUMENTO DE PAGO',
            `Registro asociado a la factura ${factura.numero_factura}`,
          );

          pintarCaja(doc, 50, 120, 495, 145, 'Resumen del pago');
          doc.fontSize(11);
          escribirLinea(doc, 'ID pago', idPago);
          escribirLinea(doc, 'Factura', factura.numero_factura);
          escribirLinea(doc, 'Fecha pago', formatearFecha(pago.fecha_pago || pago.fechaPago || new Date()));
          escribirLinea(doc, 'Método', pago.metodo_pago || pago.metodoPago || '');
          escribirLinea(doc, 'Referencia', pago.referencia || '');

          pintarCaja(doc, 50, 290, 495, 120, 'Importe y empresa', '#0ea5e9');
          doc.fontSize(11);
          escribirLinea(doc, 'Importe', formatearImporte(pago.importe, factura.moneda));
          escribirLinea(doc, 'Empresa', empresa ? empresa.nombre : '');
          escribirLinea(doc, 'NIF', empresa ? empresa.nif : '');

          doc.fontSize(9).fillColor('#6b7280').text(
            'Documento emitido automáticamente como confirmación del cobro.',
            50,
            460,
            { align: 'center' },
          );

          dibujarPie(doc, 'MTIS · Documento de pago');

          doc.end();
          stream.on('finish', () => res());
          stream.on('error', (err) => rej(err));
        });
      } else {
        const contenido = [
          'DOCUMENTO DE PAGO',
          `Factura Nº: ${factura.numero_factura}`,
          `Pago ID: ${idPago}`,
          `Fecha pago: ${pago.fecha_pago || pago.fechaPago || ''}`,
          `Importe: ${pago.importe}`,
          `Método: ${pago.metodo_pago || pago.metodoPago || ''}`,
          `Referencia: ${pago.referencia || ''}`,
          `Empresa: ${empresa ? empresa.nombre : ''} (${empresa ? empresa.nif : ''})`,
        ].join('\n');
        fs.writeFileSync(ruta, contenido, 'utf8');
      }

      resolve(Service.successResponse({
        idPago,
        idFactura: factura.id,
        ruta,
        mensaje: 'Documento de pago generado correctamente',
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.salida || e.message || 'Error al generar PDF de documento de pago',
        e.status || 500,
      ));
    }
  },
);

async function crearPdfDocumentoPagoInterno({ idPago, factura }) {
  const pago = await db.obtenerDocumentoPagoPorId(idPago);
  if (!pago) {
    throw new Error(`Pago ${idPago} no encontrado`);
  }

  const empresa = await db.buscarEmpresaPorEmail(
    (await db.ejecutarQuery('SELECT email FROM empresas WHERE id = ?', [factura.empresa_id]))[0]?.email,
  );

  if (!fs.existsSync(DIR_PAGOS)) fs.mkdirSync(DIR_PAGOS, { recursive: true });

  const nombreFichero = `${factura.numero_factura}-pago-${idPago}.pdf`;
  const ruta = path.join(DIR_PAGOS, nombreFichero);

  if (PDFDocument) {
    await new Promise((res, rej) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(ruta);
      doc.pipe(stream);

      pintarCabecera(
        doc,
        'DOCUMENTO DE PAGO',
        `Registro asociado a la factura ${factura.numero_factura}`,
      );

      pintarCaja(doc, 50, 120, 495, 145, 'Resumen del pago');
      doc.fontSize(11);
      escribirLinea(doc, 'ID pago', idPago);
      escribirLinea(doc, 'Factura', factura.numero_factura);
      escribirLinea(doc, 'Fecha pago', formatearFecha(pago.fecha_pago || pago.fechaPago || new Date()));
      escribirLinea(doc, 'Método', pago.metodo_pago || pago.metodoPago || '');
      escribirLinea(doc, 'Referencia', pago.referencia || '');

      pintarCaja(doc, 50, 290, 495, 120, 'Importe y empresa', '#0ea5e9');
      doc.fontSize(11);
      escribirLinea(doc, 'Importe', formatearImporte(pago.importe, factura.moneda));
      escribirLinea(doc, 'Empresa', empresa ? empresa.nombre : '');
      escribirLinea(doc, 'NIF', empresa ? empresa.nif : '');

      doc.fontSize(9).fillColor('#6b7280').text(
        'Documento emitido automáticamente como confirmación del cobro.',
        50,
        460,
        { align: 'center' },
      );

      dibujarPie(doc, 'MTIS · Documento de pago');

      doc.end();
      stream.on('finish', () => res());
      stream.on('error', (err) => rej(err));
    });
  } else {
    const contenido = [
      'DOCUMENTO DE PAGO',
      `Factura Nº: ${factura.numero_factura}`,
      `Pago ID: ${idPago}`,
      `Fecha pago: ${pago.fecha_pago || pago.fechaPago || ''}`,
      `Importe: ${pago.importe}`,
      `Método: ${pago.metodo_pago || pago.metodoPago || ''}`,
      `Referencia: ${pago.referencia || ''}`,
      `Empresa: ${empresa ? empresa.nombre : ''} (${empresa ? empresa.nif : ''})`,
    ].join('\n');
    fs.writeFileSync(ruta, contenido, 'utf8');
  }

  return { ruta };
}

module.exports = {
  almacenarDocumentosRed,
  generarPdfFactura,
  generarXmlFactura,
  generarPdfDocumentoPago,
  crearDocumentoPago,
};
