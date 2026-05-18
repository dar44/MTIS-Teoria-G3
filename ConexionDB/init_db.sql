-- ============================================
-- Script de inicialización de la BD facturacion
-- Ejecutar con: mysql -u root -proot < init_db.sql
-- ============================================

CREATE DATABASE IF NOT EXISTS facturacion
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE facturacion;

-- ── Tabla de parámetros del sistema (WSKey, etc.) ──
CREATE TABLE IF NOT EXISTS parametros (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  clave     VARCHAR(100) NOT NULL UNIQUE,
  valor     VARCHAR(500) NOT NULL
);

-- ── Tabla de empresas ──
CREATE TABLE IF NOT EXISTS empresas (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  email     VARCHAR(255) NOT NULL UNIQUE,
  nombre    VARCHAR(255) NOT NULL,
  nif       VARCHAR(20)  NOT NULL,
  iban      VARCHAR(34)  NOT NULL,
  direccion VARCHAR(500)
);

-- ── Tabla de facturas ──
CREATE TABLE IF NOT EXISTS facturas (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id              INT          NOT NULL,
  numero_factura          VARCHAR(50)  NOT NULL UNIQUE,
  base_imponible          DECIMAL(12,2) NOT NULL,
  iva                     DECIMAL(5,4)  NOT NULL,
  moneda                  VARCHAR(10)  NOT NULL DEFAULT 'EUR',
  tipo                    VARCHAR(30)  NOT NULL,
  estado                  VARCHAR(30)  NOT NULL,
  motivo_estado           VARCHAR(500),
  fecha_emision           DATETIME     NOT NULL,
  fecha_desde_facturacion DATE,
  fecha_hasta_facturacion DATE,
  factura_original_id     INT,
  motivo_rectificacion    VARCHAR(500),
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (factura_original_id) REFERENCES facturas(id)
);

-- ── Tabla de pagos (cobros) ──
CREATE TABLE IF NOT EXISTS pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  factura_id INT NOT NULL,
  importe DECIMAL(13,2) NOT NULL,
  metodo_pago VARCHAR(50),
  referencia VARCHAR(100),
  fecha_pago DATETIME,
  estado VARCHAR(50) DEFAULT 'PENDIENTE',
  creado_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factura_id) REFERENCES facturas(id)
);

-- ── Tabla de auditoría de eventos ──
CREATE TABLE IF NOT EXISTS auditoria_eventos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tipo_evento VARCHAR(100) NOT NULL,
  descripcion VARCHAR(1000),
  fecha       DATETIME DEFAULT CURRENT_TIMESTAMP,
  origen      VARCHAR(100)
);

-- ── Tabla de auditoría de errores ──
CREATE TABLE IF NOT EXISTS auditoria_errores (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tipo_error  VARCHAR(100) NOT NULL,
  descripcion VARCHAR(1000),
  fecha       DATETIME DEFAULT CURRENT_TIMESTAMP,
  origen      VARCHAR(100),
  factura_id  INT,
  FOREIGN KEY (factura_id) REFERENCES facturas(id)
);

-- 🗂️ Tabla de reportes de generación de facturación 🗂️
CREATE TABLE IF NOT EXISTS reportes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id      VARCHAR(100)   NOT NULL,
  fecha_inicio    DATE           NOT NULL,
  fecha_fin       DATE           NOT NULL,
  categoria       VARCHAR(100)   NOT NULL DEFAULT 'GENERAL',
  numero_registros INT           NOT NULL DEFAULT 0,
  monto_total     DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
  estado          VARCHAR(30)    NOT NULL DEFAULT 'PENDIENTE',
  url_documento   VARCHAR(500),
  creado_at       DATETIME       DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Datos iniciales
-- ============================================

-- WSKey del sistema (la que deben enviar los clientes REST)
INSERT INTO parametros (clave, valor) VALUES
  ('rest_key', 'prueba')
ON DUPLICATE KEY UPDATE valor = VALUES(valor);

-- Empresa de ejemplo para pruebas
INSERT INTO empresas (email, nombre, nif, iban, direccion) VALUES
  ('empresa@correo.com', 'Mi Empresa S.L.', 'B12345678', 'ES9121000418450200051332', 'Calle Mayor 1, Alicante')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);
