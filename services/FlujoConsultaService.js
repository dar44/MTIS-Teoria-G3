/* eslint-disable no-unused-vars */
const Service = require('./Service');
const db = require('../ConexionDB/Conexion');
const fs = require('fs');
const { validarWSKey } = require('../utils/Utils');
const GestorArchivosService = require('./GestorArchivosService');
const AuditoriaService = require('./AuditoriaService');
const GestorRespuestasService = require('./GestorRespuestasService');
const ComunicacionService = require('./ComunicacionService');

/**
 * Iniciar flujo de consulta de factura
 * Orquesta: validar WSKey, comprobar existencia, generar XML y devolver contenido.
 * acepta payload en `consultaFacturaRequest` o en `body`.
 */
const iniciarFlujoConsulta = ({ consultaFacturaRequest, body, WSKey }) => new Promise(
  async (resolve, reject) => {
    let idFactura = null;

    try {
      await validarWSKey(WSKey);

      const payload = consultaFacturaRequest || body || {};
      idFactura = Number(payload.idFactura || payload.id || payload.id_factura);
      if (!idFactura || Number.isNaN(idFactura)) {
        return reject(Service.rejectResponse('idFactura es obligatorio', 400));
      }

      // Verificar existencia
      const factura = await db.obtenerFacturaPorId(Number(idFactura));
      if (!factura) {
        // Registrar intento en auditoría (no bloquear si falla)
        try {
          await AuditoriaService.registrarEventoAuditoria({
            body: {
              tipoEvento: 'CONSULTA_FACTURA_NO_ENCONTRADA',
              descripcion: `Intento de consulta para factura ${idFactura}`,
              fecha: new Date(),
              origen: 'flujo-consulta',
            },
            WSKey,
          });
        } catch (_) { /* ignore audit errors */ }

        return reject(Service.rejectResponse('Factura no encontrada', 404));
      }

      // Obtener datos completos (incluye datos de empresa)
      const detalle = await db.obtenerFacturaPorIdConEmpresa(Number(idFactura));

      // Generar XML (escribe fichero y devuelve ruta)
      const xmlResult = await GestorArchivosService.generarXmlFactura({ idFactura: Number(idFactura), WSKey });
      const ruta = xmlResult && xmlResult.payload && xmlResult.payload.ruta;
      let contenido = '';
      if (ruta && fs.existsSync(ruta)) {
        try {
          contenido = fs.readFileSync(ruta, 'utf8');
        } catch (e) {
          contenido = '';
        }
      }

      // Respuesta conforme a ProcesoConsultaResponse
      // Intentar notificar al solicitante (no bloquear si falla)
      (async () => {
        try {
          if (ruta) {
            await ComunicacionService.enviarComunicacion({
              body: {
                destinatario: detalle && detalle.empresa_email ? detalle.empresa_email : undefined,
                asunto: `Consulta factura ${idFactura}`,
                cuerpo: `Su consulta de la factura ${idFactura} ha sido procesada. Archivo: ${ruta}`,
                payload: { idFactura: Number(idFactura), ruta }
              },
              WSKey,
            }).catch(() => {});
          }
        } catch (_) { /* ignore notify errors */ }
      })();

      resolve(Service.successResponse({
        idFactura: Number(idFactura),
        numeroFactura: detalle ? detalle.numero_factura : factura.numero_factura,
        formato: 'XML',
        contenido,
        mensaje: 'Consulta de factura completada correctamente',
      }));
    } catch (e) {
      // Registrar error técnico en auditoría (no bloquear si falla)
      try {
        await AuditoriaService.registrarErrorAuditoria({
          body: {
            tipoError: 'ERROR_CONSULTA',
            descripcion: e && e.message ? e.message : String(e),
            fecha: new Date(),
            origen: 'flujo-consulta',
            idFactura: idFactura || null,
          },
          WSKey,
        });
      } catch (_) { /* ignore audit errors */ }

      reject(Service.rejectResponse(e.salida || e.message || 'Error técnico durante la consulta', e.status || 500));
    }
  },
);

module.exports = {
  iniciarFlujoConsulta,
};