// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
  // Poner fecha actual por defecto
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  document.getElementById('fac-fecha').value = local.toISOString().slice(0, 16);
});

// --- Pasos del BPMN ---
const PASOS_BPMN = [
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

// --- Recoger datos del formulario ---
function getFormData() {
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

// --- Mostrar timeline ---
function mostrarTimeline(pasoActual, estado) {
  const section = document.getElementById('timeline-section');
  section.style.display = 'block';
  const container = document.getElementById('timeline');
  container.innerHTML = '';

  PASOS_BPMN.forEach((paso, i) => {
    const div = document.createElement('div');
    div.className = 'step';
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

// --- Determinar paso fallido según respuesta ---
function detectarPasoFallido(status, body) {
  const msg = JSON.stringify(body).toLowerCase();
  if (status === 403 || msg.includes('wskey')) return { paso: 0, estado: 'error' };
  if (msg.includes('datos') && msg.includes('válido')) return { paso: 1, estado: 'error' };
  if (status === 404 || msg.includes('no registrada')) return { paso: 2, estado: 'error' };
  if (msg.includes('coincid') || msg.includes('invalida')) return { paso: 3, estado: 'error' };
  if (msg.includes('duplica') || msg.includes('dup_entry')) return { paso: 4, estado: 'error' };
  if (msg.includes('xml')) return { paso: 5, estado: 'error' };
  if (msg.includes('pdf')) return { paso: 6, estado: 'error' };
  if (status >= 400) return { paso: 0, estado: 'error' };
  return { paso: PASOS_BPMN.length - 1, estado: 'done' };
}

// --- Mostrar resultado ---
function mostrarResultado(status, body, elapsed) {
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

  const info = detectarPasoFallido(status, body);
  mostrarTimeline(info.paso, info.estado);
}

// --- Generar cURL ---
function mostrarCurl(url, wskey, bodyObj) {
  const section = document.getElementById('curl-section');
  section.style.display = 'block';
  const bodyStr = JSON.stringify(bodyObj);
  document.getElementById('curl-cmd').textContent =
    `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -H "WSKey: ${wskey}" \\\n  -d '${bodyStr}'`;
}

// --- Enviar petición ---
async function hacerPeticion(url, wskey, body) {
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex';
  document.getElementById('btn-enviar').disabled = true;

  // Mostrar timeline en progreso
  mostrarTimeline(0, 'running');

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'WSKey': wskey },
      body: JSON.stringify(body),
    });
    const elapsed = Date.now() - start;
    let data;
    try { data = await res.json(); } catch { data = { rawResponse: await res.text() }; }
    mostrarResultado(res.status, data, elapsed);
    mostrarCurl(url, wskey, body);
  } catch (err) {
    const elapsed = Date.now() - start;
    mostrarResultado(0, { error: 'No se pudo conectar', detalle: err.message }, elapsed);
    mostrarTimeline(0, 'error');
  } finally {
    overlay.style.display = 'none';
    document.getElementById('btn-enviar').disabled = false;
  }
}

// --- Acciones de los botones ---
function enviarEmision() {
  const url = document.getElementById('endpoint').value;
  const wskey = document.getElementById('wskey').value;
  const body = getFormData();
  hacerPeticion(url, wskey, body);
}

function testWSKeyInvalida() {
  const url = document.getElementById('endpoint').value;
  const body = getFormData();
  hacerPeticion(url, 'clave_incorrecta', body);
}

function testEmpresaNoRegistrada() {
  const url = document.getElementById('endpoint').value;
  const wskey = document.getElementById('wskey').value;
  const body = getFormData();
  body.empresa.email = 'noexiste@fantasma.com';
  body.empresa.nombre = 'Empresa Fantasma S.L.';
  body.empresa.nif = 'X00000000';
  hacerPeticion(url, wskey, body);
}

function limpiarResultado() {
  document.getElementById('timeline-section').style.display = 'none';
  document.getElementById('resultado-section').style.display = 'none';
  document.getElementById('curl-section').style.display = 'none';
}
