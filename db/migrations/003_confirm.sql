-- Un documento analizado queda 'pendiente' hasta que el usuario lo confirma;
-- solo entonces se reparte en tablas y se indexa su texto.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendiente'
  CHECK (status IN ('pendiente', 'confirmado'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_text TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS documents_confirmed_idx
  ON documents (confirmed_at DESC) WHERE status = 'confirmado';

-- Campos escalares de la extracción (1:1 con documents)
CREATE TABLE IF NOT EXISTS document_fields (
  document_id       BIGINT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  tipo_documento    TEXT    NOT NULL,
  confianza         REAL,
  idioma            TEXT,
  resumen           TEXT,
  numero_documento  TEXT,
  fecha_emision     DATE,
  fecha_vencimiento DATE,
  moneda            TEXT,
  subtotal          NUMERIC,
  impuestos_total   NUMERIC,
  total             NUMERIC,
  metodo_pago       TEXT,
  vigencia_inicio   DATE,
  vigencia_fin      DATE
);

CREATE INDEX IF NOT EXISTS document_fields_tipo_idx ON document_fields (tipo_documento);
CREATE INDEX IF NOT EXISTS document_fields_fecha_idx ON document_fields (fecha_emision);

-- Emisor, receptor y partes de un contrato
CREATE TABLE IF NOT EXISTS document_parties (
  id                    BIGSERIAL PRIMARY KEY,
  document_id           BIGINT  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  rol                   TEXT    NOT NULL CHECK (rol IN ('emisor', 'receptor', 'parte')),
  posicion              INTEGER NOT NULL,
  nombre                TEXT,
  identificacion_fiscal TEXT,
  direccion             TEXT
);

CREATE INDEX IF NOT EXISTS document_parties_document_idx ON document_parties (document_id);
CREATE INDEX IF NOT EXISTS document_parties_fiscal_idx ON document_parties (identificacion_fiscal);

CREATE TABLE IF NOT EXISTS document_lines (
  document_id     BIGINT  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  posicion        INTEGER NOT NULL,
  descripcion     TEXT    NOT NULL,
  cantidad        NUMERIC,
  precio_unitario NUMERIC,
  importe         NUMERIC,
  PRIMARY KEY (document_id, posicion)
);

CREATE TABLE IF NOT EXISTS document_taxes (
  document_id    BIGINT  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  posicion       INTEGER NOT NULL,
  concepto       TEXT    NOT NULL,
  porcentaje     NUMERIC,
  base_imponible NUMERIC,
  importe        NUMERIC,
  PRIMARY KEY (document_id, posicion)
);

CREATE TABLE IF NOT EXISTS document_clauses (
  document_id BIGINT  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  posicion    INTEGER NOT NULL,
  texto       TEXT    NOT NULL,
  PRIMARY KEY (document_id, posicion)
);
