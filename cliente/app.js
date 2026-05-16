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
  const btnEnviar = document.getElementById('btn-enviar');
  const btnWSKey = document.getElementById('btn-test-wskey');
  const btnEmpresa = document.getElementById('btn-test-empresa');
  const endpointSelect = document.getElementById('endpoint');

  if (flujo === 'emision') {
    seccionEmision.style.display = 'grid';
    seccionCobro.style.display = 'none';
    btnEnviar.textContent = '🚀 Iniciar Flujo de Emisión';
    btnWSKey.style.display = 'block';
    btnEmpresa.style.display = 'block';
    endpointSelect.innerHTML = `
      <option value="http://localhost:7777/proxy/mule/flujo-emision/iniciar">MuleSoft via proxy (puerto 9092)</option>
      <option value="http://localhost:7777/flujo-emision/iniciar">Node.js directo (puerto 7777)</option>
    `;
  } else {
    seccionEmision.style.display = 'none';
    seccionCobro.style.display = 'block';
    btnEnviar.textContent = '💳 Iniciar Flujo de Cobro';
    btnWSKey.style.display = 'none';
    btnEmpresa.style.display = 'none';
    endpointSelect.innerHTML = `
      <option value="http://localhost:7777/proxy/mule/cobros/iniciar">MuleSoft via proxy (puerto 14102)</option>
      <option value="http://localhost:7777/cobros/iniciar">Node.js directo (puerto 7777)</option>
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

// ===== TIMELINE =====

function mostrarTimeline(pasoActual, estado, flujo = 'emision') {
  const container = document.getElementById('timeline');
  container.innerHTML = '';
  const section = document.getElementById('timeline-section');
  section.style.display = 'block';

  const PASOS = flujo === 'emision' ? PASOS_BPMN_EMISION : PASOS_BPMN_COBRO;

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
    const PASOS = flujo === 'emision' ? PASOS_BPMN_EMISION : PASOS_BPMN_COBRO;
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
  // Errores en COBRO
  else {
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

  // Mostrar resumen conciso para cobro
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
  const bodyStr = JSON.stringify(bodyObj);
  document.getElementById('curl-cmd').textContent =
    `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -H "WSKey: ${wskey}" \\\n  -d '${bodyStr}'`;
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
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'WSKey': wskey },
      body: JSON.stringify(body),
    });
    const elapsed = Date.now() - start;
    
    // Leer el body UNA SOLA VEZ
    const text = await res.text();
    let data;
    try { 
      data = JSON.parse(text); 
    } catch { 
      data = { rawResponse: text }; 
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
  } else {
    body = getFormDataCobro();
  }
  
  hacerPeticion(url, wskey, body, flujo);
}

function testWSKeyInvalida() {
  const flujo = document.getElementById('flujo').value;
  const url = document.getElementById('endpoint').value;
  let body;
  
  if (flujo === 'emision') {
    body = getFormDataEmision();
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


function limpiarResultado() {
  document.getElementById('timeline-section').style.display = 'none';
  document.getElementById('resultado-section').style.display = 'none';
  document.getElementById('curl-section').style.display = 'none';
}
