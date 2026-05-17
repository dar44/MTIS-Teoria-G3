# API REST - Facturación Electrónica G3

Proyecto de integración MTIS — Flujo BPMN de emisión de facturas electrónicas con **Node.js** y **MuleSoft**.

---

## Requisitos previos

| Software | Versión | Puerto |
|----------|---------|--------|
| Node.js | >= 18 | 7777 |
| MySQL | >= 8.0 | 3306 |
| FakeSMTP | cualquiera | 2525 |
| Anypoint Studio (MuleSoft) | 7.x | 9092 |

---

## 1. Crear la base de datos

Ejecutar el script `ConexionDB/init_db.sql` en MySQL. Esto crea la BD `facturacion` con todas las tablas y datos iniciales.

### Opción A: Desde terminal

```bash
mysql -u root -proot < ConexionDB/init_db.sql
```

### Opción B: Desde MySQL Workbench

1. Abrir MySQL Workbench
2. Conectar a `localhost:3306` con usuario `root` / contraseña `root`
3. Abrir el archivo `ConexionDB/init_db.sql`
4. Ejecutar todo el script (botón de rayo)

Esto crea:

| Tabla | Descripción |
|-------|-------------|
| `parametros` | WSKey del sistema (`prueba`) |
| `empresas` | Empresas registradas (1 de ejemplo) |
| `facturas` | Facturas emitidas |
| `auditoria_eventos` | Log de eventos del flujo |
| `auditoria_errores` | Log de errores técnicos |

> Si ya tienes la BD creada, el script usa `IF NOT EXISTS` y `ON DUPLICATE KEY`, por lo que es seguro re-ejecutarlo.

---

## 2. Iniciar FakeSMTP

Abrir FakeSMTP y configurar en puerto **2525**. Pulsar "Start server".

---

## 3. Iniciar Node.js

```bash
cd proyecto-integracion
npm install   # solo la primera vez
npm start
```

Esto arranca:

| URL | Descripción |
|-----|-------------|
| http://localhost:7777 | API REST |
| http://localhost:7777/docs | Swagger UI |
| http://localhost:7777/cliente | **Cliente de pruebas** |

---

## 4. Iniciar MuleSoft (Anypoint Studio)

### 4.1 Despliegue de Emisión de Factura

1. **Crear un nuevo proyecto Mule** en Anypoint Studio
2. Copiar estos archivos del repositorio al proyecto Mule:
   - `mulesoft/emision-factura.raml` → `src/main/resources/api/`
   - `mulesoft/emision-factura.xml` → `src/main/mule/`
3. Añadir dependencias al `pom.xml`:

```xml
<dependency>
    <groupId>org.mule.connectors</groupId>
    <artifactId>mule-db-connector</artifactId>
    <version>1.14.6</version>
    <classifier>mule-plugin</classifier>
</dependency>
<dependency>
    <groupId>mysql</groupId>
    <artifactId>mysql-connector-java</artifactId>
    <version>8.0.30</version>
</dependency>
```

4. Click derecho en el proyecto → **Maven → Update Project**
5. Click derecho → **Run As → Mule Application**

Arrancará en **http://localhost:9092/api/console**.

### 4.2 Despliegue de Consulta de Factura

1. **Crear nuevo proyecto Mule**: File → New → Mule Project → Nombre: `consulta-factura`
2. **Copiar archivos**:
   - `mulesoft/consulta-factura.raml` → `src/main/resources/api/`
   - `mulesoft/consulta-factura.xml` → `src/main/mule/`
3. **Actualizar pom.xml** si es necesario (mismas dependencias que emisión)
4. **Maven Update**: Click derecho → Maven → Update Project
5. **Ejecutar**: Click derecho → Run As → Mule Application

---

## 5. Probar con el cliente web

Abrir en el navegador: **http://localhost:7777/cliente**

### Endpoint

En el selector de endpoint puedes elegir:

- **MuleSoft via proxy (9092)**: La petición pasa por MuleSoft → Node.js → MySQL
- **Node.js directo (7777)**: La petición va directo a Node.js → MySQL

### Botones de test

| Botón | Qué hace | Respuesta esperada |
|-------|----------|-------------------|
| Iniciar Flujo de Emisión | Flujo BPMN completo | 200 - `ENVIADA` |
| Test WSKey Inválida | Envía WSKey incorrecta | 403 |
| Test Empresa No Registrada | Envía empresa inexistente | 404 |

> **Cambia el Nº Factura** en cada prueba (ej: `FAC-2026-TEST01`, `FAC-2026-TEST02`...) porque no se pueden repetir.

### Datos de prueba por defecto

| Campo | Valor |
|-------|-------|
| WSKey | `prueba` |
| Email | `empresa@correo.com` |
| Nombre | `Mi Empresa S.L.` |
| NIF | `B12345678` |
| IBAN | `ES9121000418450200051332` |

---

## 6. Probar con curl

### Flujo de Emisión de Factura

```bash
# Via Node.js directo (puerto 7777)
curl -X POST "http://localhost:7777/flujo-emision/iniciar" \
  -H "Content-Type: application/json" \
  -H "WSKey: prueba" \
  -d '{"empresa":{"email":"empresa@correo.com","nombre":"Mi Empresa S.L.","nif":"B12345678","iban":"ES9121000418450200051332"},"factura":{"numeroFactura":"FAC-2026-CURL01","baseImponible":1250.75,"iva":0.21,"moneda":"EUR","tipo":"ORDINARIA","fechaEmision":"2026-05-12T14:30:50Z"}}'

# Via MuleSoft (puerto 9092)
curl -X POST "http://localhost:9092/api/flujo-emision/iniciar" \
  -H "Content-Type: application/json" \
  -H "WSKey: prueba" \
  -d '{"empresa":{"email":"empresa@correo.com","nombre":"Mi Empresa S.L.","nif":"B12345678","iban":"ES9121000418450200051332"},"factura":{"numeroFactura":"FAC-2026-CURL02","baseImponible":1250.75,"iva":0.21,"moneda":"EUR","tipo":"ORDINARIA","fechaEmision":"2026-05-12T14:30:50Z"}}'
```

### Flujo de Consulta de Factura

```bash
# Via Node.js directo (puerto 7777)
curl -X POST "http://localhost:7777/flujo-consulta/iniciar" \
  -H "Content-Type: application/json" \
  -H "WSKey: prueba" \
  -d '{"idFactura": 1}'

# Via MuleSoft (puerto 9092)
curl -X POST "http://localhost:9092/api/flujo-consulta/iniciar" \
  -H "Content-Type: application/json" \
  -H "WSKey: prueba" \
  -d '{"idFactura": 1}'
```

---

## Arquitectura del sistema

```
┌──────────────────────────────┐
│  Cliente Web (navegador)     │
│  http://localhost:7777       │
│  /cliente                    │
└───────────┬──────────────────┘
            │
            ├── /flujo-emision/iniciar ────────► Node.js (7777) ──► MySQL
            │                                         │
            └── /proxy/mule/flujo-emision/iniciar     │
                        │                             │
                        ▼                             │
                   MuleSoft (9092)                    │
                        │                             │
                        └── Llama a Node.js (7777) ───┘
                                    │
                                    ▼
                              MySQL (facturacion)
                                    │
                                    ▼
                             FakeSMTP (2525)
```

### ¿Por qué existe el proxy?

El navegador no puede llamar directamente a MuleSoft (puerto 9092) desde una página servida en Node.js (puerto 7777) por restricciones **CORS** (Cross-Origin Resource Sharing).

Para solucionarlo, Node.js tiene una ruta `/proxy/mule/*` que reenvía las peticiones a MuleSoft:

```
Navegador (7777) → /proxy/mule/* → Node.js reenvía a → MuleSoft (9092)
```

---

## Estructura del proyecto

```
proyecto-integracion/
├── api/
│   └── openapi.yaml          # Contrato OpenAPI 3.0
├── cliente/
│   ├── index.html             # Cliente web de pruebas
│   ├── styles.css             # Estilos
│   └── app.js                 # Lógica del cliente
├── ConexionDB/
│   ├── Conexion.js            # Funciones de acceso a MySQL
│   └── init_db.sql            # Script para crear la BD
├── ConexionFakeSMTP/
│   └── ConexionFakeSMTP.js    # Conexión SMTP
├── controllers/               # Controladores (generados + modificados)
├── mulesoft/
│   ├── emision-factura.raml   # Contrato RAML para APIkit
│   └── emision-factura.xml    # Flujo MuleSoft completo
├── services/                  # Lógica de negocio
│   ├── FlujoEmisionService.js # Orquestación BPMN
│   ├── FacturaService.js      # CRUD facturas
│   ├── EmpresaService.js      # Consulta empresas
│   ├── ValidacionService.js   # Validación WSKey y datos
│   ├── GestorArchivosService.js # Generación XML/PDF
│   ├── ComunicacionService.js # Envío emails
│   └── AuditoriaService.js    # Registro de auditoría
├── uploaded_files/facturas/   # Archivos XML/PDF generados
├── index.js                   # Servidor principal (CORS + proxy + API)
├── config.js                  # Configuración
└── package.json
```

---

## Respuestas del flujo

| Escenario | HTTP | Respuesta |
|-----------|------|-----------|
| Éxito (datos coinciden) | 200 | `estadoFinal: "ENVIADA"` |
| Éxito (datos NO coinciden) | 200 | `estadoFinal: "INVALIDA"` |
| WSKey inválida | 403 | Error de acceso |
| Empresa no registrada | 404 | Notifica por email |
| Factura duplicada | 500 | Error de BD |
| MuleSoft no arrancado | 502 | Error de proxy |
