// ===== CONSTANTES =====

const PASOS_BPMN_EMISION = [
  'Validar WSKey',
  'Validar datos de entrada',
  'Consultar empresa en BD',
  'Verificar coincidencia de datos',
  'Crear y persistir factura en BD',
  'Generar XML de la factura',
  'Generar PDF de la factura',
  'Enviar XML y PDF a la Agencia Tributaria',
  'Actualizar estado de la factura',
  'Notificar resultado a la empresa',
];

const PASOS_BPMN_COBRO = [
  'Validar WSKey',
  'Validar permisos del solicitante',
  'Validar consistencia de fechas',
  'Consultar existencia y estado de la factura',
  'Validar aprobación de supervisor',
  'Calcular estadísticas de recaudación',
  'Formatear documento de pago y registrar en BD',
  'Generar justificante PDF',
  'Notificar resolución',
  'Fin',
];

const PASOS_BPMN_CONSULTA = [
  'Validar WSKey',
  'Validar formato de datos (ID factura)',
  'Recuperar datos detallados de factura en BD',
  'Verificar existencia de factura',
  'Formatear respuesta en XML',
  'Enviar aviso al solicitante',
  'Fin',
];

const PASOS_BPMN_ANULACION = [
  'Validar WSKey',
  'Validar datos del solicitante (NIF + empresa)',
  'Verificar existencia de la factura',
  'Consultar estado actual de la factura',
  'Comprobar que la factura es anulable',
  'Enviar solicitud a la Agencia Tributaria',
  'Actualizar estado a ANULADA en BD',
  'Notificar al emisor el resultado',
];

const PASOS_BPMN_REPORTES = [
  'Validar WSKey',
  'Validar Acceso (Usuario)',
  'Validar Rango de Fechas',
  'Obtener Volumen de Facturación',
  'Registrar Reporte en BD',
  'Generar PDF del Reporte',
  'Enviar Notificación por Email',
];

// ===== INICIALIZACIÓN =====

document.addEventListener('DOMContentLoaded', () => {
  // Poner fecha actual por defecto en emisión
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const facFecha = document.getElementById('fac-fecha');
  if (facFecha) {
    facFecha.value = local.toISOString().slice(0, 16);
  }

  // Rellenar fecha pago en cobro
  rellenarFechaHoy();
});

function rellenarFechaHoy() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const cobFechaPago = document.getElementById('cob-fechaPago');
  if (cobFechaPago) {
    cobFechaPago.value = local.toISOString().slice(0, 16);
  }
}

// ===== CAMBIAR FLUJO =====

function cambiarFlujo() {
  const flujo = document.getElementById('flujo').value;
  const seccionEmision = document.querySelector('.two-col');
  const seccionCobro = document.getElementById('seccion-cobro');
  const seccionConsulta = document.getElementById('seccion-consulta');
  const seccionAnulacion = document.getElementById('seccion-anulacion');
  const btnEnviar = document.getElementById('btn-enviar');
  const btnWSKey = document.getElementById('btn-test-wskey');
  const btnEmpresa = document.getElementById('btn-test-empresa');
  const endpointSelect = document.getElementById('endpoint');

  if (flujo === 'emision') {
    seccionEmision.style.display = 'grid';
    seccionCobro.style.display = 'none';
    seccionConsulta.style.display = 'none';
    seccionAnulacion.style.display = 'none';
    document.getElementById('btn-test-anulada').style.display = 'none';
    if (document.getElementById('seccion-reportes')) document.getElementById('seccion-reportes').style.display = 'none';
    btnEnviar.textContent = '🚀 Iniciar Flujo de Emisión';
    btnWSKey.style.display = 'block';
    btnEmpresa.style.display = 'block';
    endpointSelect.innerHTML = `
      <option value="http://localhost:7777/proxy/mule/flujo-emision/iniciar">MuleSoft via proxy (puerto 9092)</option>
      <option value="http://localhost:7777/flujo-emision/iniciar">Node.js directo (puerto 7777)</option>
    `;
  } else if (flujo === 'cobro') {
    seccionEmision.style.display = 'none';
    seccionCobro.style.display = 'block';
    seccionConsulta.style.display = 'none';
    seccionAnulacion.style.display = 'none';
    if (document.getElementById('seccion-reportes')) document.getElementById('seccion-reportes').style.display = 'none';
    btnEnviar.textContent = '💳 Iniciar Flujo de Cobro';
    btnWSKey.style.display = 'none';
    btnEmpresa.style.display = 'none';
    document.getElementById('btn-test-anulada').style.display = 'none';
    endpointSelect.innerHTML = `
      <option value="http://localhost:7777/proxy/mule/cobros/iniciar">MuleSoft via proxy (puerto 14102)</option>
      <option value="http://localhost:7777/cobros/iniciar">Node.js directo (puerto 7777)</option>
    `;
  } else if (flujo === 'consulta') {
    seccionEmision.style.display = 'none';
    seccionCobro.style.display = 'none';
    seccionConsulta.style.display = 'block';
    if (document.getElementById('seccion-reportes')) document.getElementById('seccion-reportes').style.display = 'none';
    btnEnviar.textContent = '🔍 Iniciar Flujo de Consulta';
    btnWSKey.style.display = 'none';
    btnEmpresa.style.display = 'none';
    document.getElementById('btn-test-anulada').style.display = 'none';
    seccionAnulacion.style.display = 'none';
    endpointSelect.innerHTML = `
      <option value="http://localhost:7777/proxy/mule/flujo-consulta/iniciar">MuleSoft via proxy (puerto 9092)</option>
      <option value="http://localhost:7777/flujo-consulta/iniciar">Node.js directo (puerto 7777)</option>
    `;
  } else if (flujo === 'anulacion') {
    seccionEmision.style.display = 'none';
    seccionCobro.style.display = 'none';
    seccionConsulta.style.display = 'none';
    seccionAnulacion.style.display = 'block';
    btnEnviar.textContent = '🚫 Iniciar Flujo de Anulación';
    btnWSKey.style.display = 'block';
    btnEmpresa.style.display = 'none';
    document.getElementById('btn-test-anulada').style.display = 'block';
    endpointSelect.innerHTML = `
      <option value="http://localhost:7777/proxy/mule/flujo-anulacion/iniciar">MuleSoft via proxy (puerto 9095)</option>
      <option value="http://localhost:7777/flujo-anulacion/iniciar">Node.js directo (puerto 7777)</option>
    `;
  } else if (flujo === 'reportes') {
    seccionEmision.style.display = 'none';
    seccionCobro.style.display = 'none';
    seccionConsulta.style.display = 'none';
    if (document.getElementById('seccion-reportes')) document.getElementById('seccion-reportes').style.display = 'block';
    btnEnviar.textContent = '📊 Solicitar Generación de Reportes';
    btnWSKey.style.display = 'none';
    btnEmpresa.style.display = 'none';
    endpointSelect.innerHTML = `
      <option value="http://localhost:14103/api/reportes/solicitar">MuleSoft directo (puerto 14103)</option>
      <option value="http://localhost:7777/proxy/mule/reportes/solicitar">MuleSoft via proxy (puerto 7777)</option>
    `;
  }
}

// ===== RECOGER DATOS DEL FORMULARIO =====

function getFormDataEmision() {
  const empresa = {
    email: document.getElementById('emp-email').value,
    nombre: document.getElementById('emp-nombre').value,
    nif: document.getElementById('emp-nif').value,
    iban: document.getElementById('emp-iban').value,
  };
  const dir = document.getElementById('emp-direccion').value;
  if (dir) empresa.direccion = dir;

  const factura = {
    numeroFactura: document.getElementById('fac-numero').value,
    baseImponible: parseFloat(document.getElementById('fac-base').value),
    iva: parseFloat(document.getElementById('fac-iva').value),
    moneda: document.getElementById('fac-moneda').value,
    tipo: document.getElementById('fac-tipo').value,
    fechaEmision: new Date(document.getElementById('fac-fecha').value).toISOString(),
  };

  const desde = document.getElementById('fac-desde').value;
  const hasta = document.getElementById('fac-hasta').value;
  if (desde) factura.fechaDesdeFacturacion = desde;
  if (hasta) factura.fechaHastaFacturacion = hasta;

  return { empresa, factura };
}

function getFormDataCobro() {
  const solicitante = {
    usuarioId: document.getElementById('cob-usuarioId').value,
    emailSolicitante: document.getElementById('cob-email').value,
    aprobadaSupervisor: true,
  };

  const cobro = {
    idFactura: document.getElementById('cob-idFactura').value,
    metodoPago: document.getElementById('cob-metodo').value,
    referencia: document.getElementById('cob-referencia').value || null,
    fechaPago: new Date(document.getElementById('cob-fechaPago').value).toISOString(),
  };

  const validaciones = {
    fechaDesdeFacturacion: document.getElementById('cob-fechaDesde').value || null,
    fechaHastaFacturacion: document.getElementById('cob-fechaHasta').value || null,
    accion: document.getElementById('cob-accion').value,
  };

  return { ...solicitante, ...cobro, ...validaciones };
}

function getFormDataConsulta() {
  return {
    idFactura: parseInt(document.getElementById('con-idFactura').value),
    emailSolicitante: document.getElementById('con-email').value,
    usuarioId: document.getElementById('con-usuarioId').value,
  };
}

function getFormDataAnulacion() {
  return {
    idFactura: parseInt(document.getElementById('anu-idFactura').value),
    nifSolicitante: document.getElementById('anu-nif').value,
    emailSolicitante: document.getElementById('anu-email').value,
    motivo: document.getElementById('anu-motivo').value || undefined,
  };
}

function getFormDataReportes() {
  return {
    auth: {
      usuarioId: document.getElementById('rep-usuarioId').value,
    },
    periodo: {
      fechaInicio: document.getElementById('rep-fechaInicio').value,
      fechaFin: document.getElementById('rep-fechaFin').value,
    },
    categoria: document.getElementById('rep-categoria').value,
    emailContacto: document.getElementById('rep-email').value,
  };
}

// ===== TIMELINE =====

function mostrarTimeline(pasoActual, estado, flujo = 'emision') {
  const container = document.getElementById('timeline');
  container.innerHTML = '';
  const section = document.getElementById('timeline-section');
  section.style.display = 'block';

  let PASOS;
  if (flujo === 'emision') PASOS = PASOS_BPMN_EMISION;
  else if (flujo === 'cobro') PASOS = PASOS_BPMN_COBRO;
  else if (flujo === 'anulacion') PASOS = PASOS_BPMN_ANULACION;
  else if (flujo === 'reportes') PASOS = PASOS_BPMN_REPORTES;
  else PASOS = PASOS_BPMN_CONSULTA;

  PASOS.forEach((paso, i) => {
    const div = document.createElement('div');
    div.classList.add('step');
    let icon = '⬜';

    if (i < pasoActual) {
      div.classList.add('done');
      icon = '✅';
    } else if (i === pasoActual) {
      if (estado === 'error') {
        div.classList.add('fail');
        icon = '❌';
      } else if (estado === 'running') {
        div.classList.add('active');
        icon = '⏳';
      } else {
        div.classList.add('done');
        icon = '✅';
      }
    }

    div.innerHTML = `<span class="step-icon">${icon}</span><span>${paso}</span>`;
    container.appendChild(div);
  });
}

// ===== DETECCIÓN DE ERRORES =====

function detectarPasoFallido(status, body, flujo = 'emision') {
  const msg = JSON.stringify(body).toLowerCase();

  // Éxito (2xx)
  if (status >= 200 && status < 300) {
    let PASOS;
    if (flujo === 'emision') PASOS = PASOS_BPMN_EMISION;
    else if (flujo === 'cobro') PASOS = PASOS_BPMN_COBRO;
    else if (flujo === 'anulacion') PASOS = PASOS_BPMN_ANULACION;
    else if (flujo === 'reportes') PASOS = PASOS_BPMN_REPORTES;
    else PASOS = PASOS_BPMN_CONSULTA;
    return { paso: PASOS.length - 1, estado: 'done' };
  }

  // Errores en EMISIÓN
  if (flujo === 'emision') {
    if (msg.includes('wskey')) return { paso: 0, estado: 'error' };
    if (msg.includes('datos') && msg.includes('válido')) return { paso: 1, estado: 'error' };
    if (status === 404 || msg.includes('no registrada')) return { paso: 2, estado: 'error' };
    if (msg.includes('coincid') || msg.includes('invalida')) return { paso: 3, estado: 'error' };
    if (msg.includes('duplica') || msg.includes('dup_entry')) return { paso: 4, estado: 'error' };
    if (msg.includes('xml')) return { paso: 5, estado: 'error' };
    if (msg.includes('pdf')) return { paso: 6, estado: 'error' };
    return { paso: 0, estado: 'error' };
  }
  // Errores en ANULACION
  if (flujo === 'anulacion') {
    if (msg.includes('wskey') || status === 401) return { paso: 0, estado: 'error' };
    if (msg.includes('solicitante') || msg.includes('nif') || msg.includes('nif') || status === 400) return { paso: 1, estado: 'error' };
    if (msg.includes('no encontrada') || msg.includes('no existe') || status === 404) return { paso: 2, estado: 'error' };
    if (msg.includes('ya anulada') || status === 409) return { paso: 4, estado: 'error' };
    if (msg.includes('agencia') || msg.includes('tributaria')) return { paso: 5, estado: 'error' };
    if (msg.includes('actualiz') || msg.includes('estado')) return { paso: 6, estado: 'error' };
    return { paso: 0, estado: 'error' };
  }
  // Errores en COBRO
  else if (flujo === 'cobro') {
    if (msg.includes('wskey')) return { paso: 0, estado: 'error' };
    if (msg.includes('permiso')) return { paso: 1, estado: 'error' };
    if (msg.includes('fecha')) return { paso: 2, estado: 'error' };
    if (msg.includes('no encontrada') || msg.includes('no existe') || msg.includes('cobrada') || msg.includes('no apta')) return { paso: 3, estado: 'error' };
    if (msg.includes('supervisor') || msg.includes('aprobad') || msg.includes('denegada')) return { paso: 4, estado: 'error' };
    if (msg.includes('estadístic') || msg.includes('recaudacion')) return { paso: 5, estado: 'error' };
    if (msg.includes('documento de pago') || msg.includes('pago')) return { paso: 6, estado: 'error' };
    if (msg.includes('pdf') || msg.includes('justificante')) return { paso: 7, estado: 'error' };
    if (msg.includes('incidencia')) return { paso: 8, estado: 'error' };
    return { paso: 0, estado: 'error' };
  }
  // Errores en CONSULTA
  else if (flujo === 'consulta') {
    if (msg.includes('wskey')) return { paso: 0, estado: 'error' };
    if (msg.includes('error_formato') || msg.includes('inválido')) return { paso: 1, estado: 'error' };
    if (msg.includes('recuperacion') || msg.includes('fallo')) return { paso: 2, estado: 'error' };
    if (msg.includes('no encontrada') || msg.includes('no existe') || status === 404) return { paso: 3, estado: 'error' };
    if (msg.includes('xml')) return { paso: 4, estado: 'error' };
    if (msg.includes('aviso') || msg.includes('notify')) return { paso: 5, estado: 'error' };
    return { paso: 0, estado: 'error' };
  }
  // Errores en REPORTES
  else {
    if (msg.includes('wskey')) return { paso: 0, estado: 'error' };
    if (msg.includes('validar-acceso')) return { paso: 1, estado: 'error' };
    if (msg.includes('validar-rango-fechas')) return { paso: 2, estado: 'error' };
    if (msg.includes('obtener-volumen')) return { paso: 3, estado: 'error' };
    if (msg.includes('registrar')) return { paso: 4, estado: 'error' };
    if (msg.includes('generar-pdf')) return { paso: 5, estado: 'error' };
    if (msg.includes('notificar')) return { paso: 6, estado: 'error' };
    return { paso: 0, estado: 'error' };
  }
}

// ===== MOSTRAR RESULTADO =====

function mostrarResultado(status, body, elapsed, flujo = 'emision') {
  const section = document.getElementById('resultado-section');
  section.style.display = 'block';

  const badge = document.getElementById('status-badge');
  badge.textContent = `HTTP ${status}`;
  badge.className = 'badge';
  if (status >= 200 && status < 300) badge.classList.add('success');
  else if (status >= 400 && status < 500) badge.classList.add('warn');
  else badge.classList.add('error');

  document.getElementById('response-time').textContent = `${elapsed}ms`;
  document.getElementById('resultado').textContent = JSON.stringify(body, null, 2);

  // Mostrar resumen conciso para cobro, consulta y anulacion
  const resumenEl = document.getElementById('resultado-info');
  if (resumenEl) {
    resumenEl.innerHTML = '';
    if (flujo === 'cobro' && status >= 200 && status < 300) {
      const idDoc = body.idDocumentoPago || body.idPago || null;
      const estado = body.estadoFactura || body.estado || null;
      const importe = body.importe || body.importe_factura || null;
      const lines = [];
      if (idDoc) lines.push(`<strong>ID pago:</strong> ${idDoc}`);
      if (estado) lines.push(`<strong>Estado factura:</strong> ${estado}`);
      if (importe) lines.push(`<strong>Importe usado:</strong> ${importe}`);
      resumenEl.innerHTML = lines.join(' — ');
      resumenEl.style.display = lines.length ? 'block' : 'none';
    } else if (flujo === 'consulta' && status >= 200 && status < 300) {
      const xml = body.xml ? body.xml.substring(0, 100) + '...' : null;
      const ruta = body.ruta || null;
      const lines = [];
      if (xml) lines.push(`<strong>XML:</strong> ${xml}`);
      if (ruta) lines.push(`<strong>Archivo:</strong> ${ruta}`);
      resumenEl.innerHTML = lines.join(' — ');
      resumenEl.style.display = lines.length ? 'block' : 'none';
    } else if (flujo === 'anulacion' && status >= 200 && status < 300) {
      const estadoFinal = body.estadoFinal || null;
      const numFactura = body.numeroFactura || null;
      const lines = [];
      if (numFactura) lines.push(`<strong>Factura:</strong> ${numFactura}`);
      if (estadoFinal) lines.push(`<strong>Estado final:</strong> ${estadoFinal}`);
      resumenEl.innerHTML = lines.join(' — ');
      resumenEl.style.display = lines.length ? 'block' : 'none';
    } else {
      resumenEl.style.display = 'none';
    }
  }

  const info = detectarPasoFallido(status, body, flujo);
  mostrarTimeline(info.paso, info.estado, flujo);
}

// ===== GENERAR CURL =====

function mostrarCurl(url, wskey, bodyObj) {
  const section = document.getElementById('curl-section');
  section.style.display = 'block';
  const isXml = typeof bodyObj === 'string' && bodyObj.includes('<soapenv:Envelope');
  const bodyStr = isXml ? bodyObj : JSON.stringify(bodyObj);
  const cType = isXml ? 'text/xml' : 'application/json';
  document.getElementById('curl-cmd').textContent =
    `curl -X POST "${url}" \\\n  -H "Content-Type: ${cType}" \\\n  -H "WSKey: ${wskey}" \\\n  -d '${bodyStr}'`;
}

// ===== HACER PETICIÓN =====

async function hacerPeticion(url, wskey, body, flujo = 'emision') {
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.style.display = 'flex';

  const btnEnviar = document.getElementById('btn-enviar');
  if (btnEnviar) btnEnviar.disabled = true;

  // Mostrar timeline en progreso
  mostrarTimeline(0, 'running', flujo);

  const start = Date.now();
  try {
    let finalBody = body;
    let headers = { 'Content-Type': 'application/json', 'WSKey': wskey };

    if (flujo === 'reportes') {
      headers['Content-Type'] = 'text/xml';
      finalBody = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gen="http://www.mtis.org/GeneracionReportes/">
   <soapenv:Header/>
   <soapenv:Body>
      <gen:solicitarGeneracionReporte>
         <auth>
            <wsKey>${wskey}</wsKey>
            <usuarioId>${body.auth.usuarioId}</usuarioId>
         </auth>
         <periodo>
            <fechaInicio>${body.periodo.fechaInicio}</fechaInicio>
            <fechaFin>${body.periodo.fechaFin}</fechaFin>
         </periodo>
         <categoria>${body.categoria}</categoria>
      </gen:solicitarGeneracionReporte>
   </soapenv:Body>
</soapenv:Envelope>`;
    } else {
      finalBody = JSON.stringify(body);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: finalBody,
    });
    const elapsed = Date.now() - start;

    // Leer el body UNA SOLA VEZ
    const text = await res.text();
    let data;
    if (flujo === 'reportes') {
      // Extracción rudimentaria del XML para parsear la respuesta SOAP
      data = { rawXml: text };
      if (text.includes('exito')) {
        data.exito = text.includes('<exito>true</exito>');
        const matchMensaje = text.match(/<mensaje>(.*?)<\/mensaje>/);
        if (matchMensaje) data.mensaje = matchMensaje[1];
      }
    } else {
      try {
        data = JSON.parse(text);
      } catch {
        data = { rawResponse: text };
      }
    }

    mostrarResultado(res.status, data, elapsed, flujo);
    mostrarCurl(url, wskey, body);
  } catch (err) {
    const elapsed = Date.now() - start;
    mostrarResultado(0, { error: 'No se pudo conectar', detalle: err.message }, elapsed, flujo);
    mostrarTimeline(0, 'error', flujo);
  } finally {
    if (overlay) overlay.style.display = 'none';
    if (btnEnviar) btnEnviar.disabled = false;
  }
}

// ===== ACCIONES DE BOTONES =====

function enviarPeticion() {
  const flujo = document.getElementById('flujo').value;
  const url = document.getElementById('endpoint').value;
  const wskey = document.getElementById('wskey').value;
  let body;

  if (flujo === 'emision') {
    body = getFormDataEmision();
  } else if (flujo === 'cobro') {
    body = getFormDataCobro();
  } else if (flujo === 'anulacion') {
    body = getFormDataAnulacion();
  } else if (flujo === 'reportes') {
    body = getFormDataReportes();
  } else {
    body = getFormDataConsulta();
  }

  hacerPeticion(url, wskey, body, flujo);
}

function testWSKeyInvalida() {
  const flujo = document.getElementById('flujo').value;
  const url = document.getElementById('endpoint').value;
  let body;

  if (flujo === 'emision') {
    body = getFormDataEmision();
  } else if (flujo === 'anulacion') {
    body = getFormDataAnulacion();
  } else {
    body = getFormDataCobro();
  }

  hacerPeticion(url, 'clave_incorrecta_12345', body, flujo);
}

function testEmpresaNoRegistrada() {
  const url = document.getElementById('endpoint').value;
  const wskey = document.getElementById('wskey').value;
  const body = getFormDataEmision();
  body.empresa.email = 'noexiste@fantasma.com';
  body.empresa.nombre = 'Empresa Fantasma S.L.';
  body.empresa.nif = 'X00000000';
  hacerPeticion(url, wskey, body, 'emision');
}

function testFacturaYaAnulada() {
  const url = document.getElementById('endpoint').value;
  const wskey = document.getElementById('wskey').value;
  // Reutiliza los datos del formulario pero con un ID que se asume ya anulado
  const body = getFormDataAnulacion();
  hacerPeticion(url, wskey, body, 'anulacion');
}

function limpiarResultado() {
  document.getElementById('timeline-section').style.display = 'none';
  document.getElementById('resultado-section').style.display = 'none';
  document.getElementById('curl-section').style.display = 'none';
}
