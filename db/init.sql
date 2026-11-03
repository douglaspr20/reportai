-- Extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Archivos subidos (imágenes y PDFs)
CREATE TABLE IF NOT EXISTS documents (
  id            BIGSERIAL PRIMARY KEY,
  filename      TEXT        NOT NULL,
  stored_name   TEXT        NOT NULL UNIQUE,
  mime_type     TEXT        NOT NULL,
  size_bytes    BIGINT      NOT NULL,
  doc_type      TEXT,
  analysis      JSONB,
  model         TEXT,
  -- 'pendiente' tras el análisis; 'confirmado' cuando el usuario lo guarda
  status        TEXT        NOT NULL DEFAULT 'pendiente'
                CHECK (status IN ('pendiente', 'confirmado')),
  content_text  TEXT,
  embedding_model TEXT,
  confirmed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_doc_type_idx ON documents (doc_type);
CREATE INDEX IF NOT EXISTS documents_confirmed_idx
  ON documents (confirmed_at DESC) WHERE status = 'confirmado';

-- Fragmentos de texto + embeddings (1536 dims, estilo OpenAI text-embedding-3-small)
CREATE TABLE IF NOT EXISTS document_chunks (
  id          BIGSERIAL PRIMARY KEY,
  document_id BIGINT      NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER     NOT NULL,
  content     TEXT        NOT NULL,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

-- Índice para búsqueda por similitud coseno
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

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

-- Rol con el que se ejecuta el SQL que genera el modelo en el chat. Tiene su
-- propio login (no se usa SET ROLE desde el superusuario, que se podría
-- deshacer desde la propia consulta) y solo puede leer las tablas estructuradas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reportai_reader') THEN
    CREATE ROLE reportai_reader LOGIN PASSWORD 'reportai_reader';
  END IF;
END
$$;

ALTER ROLE reportai_reader SET default_transaction_read_only = on;
ALTER ROLE reportai_reader SET statement_timeout = '5s';
ALTER ROLE reportai_reader CONNECTION LIMIT 5;

GRANT CONNECT ON DATABASE reportai TO reportai_reader;
GRANT USAGE ON SCHEMA public TO reportai_reader;
GRANT SELECT ON document_fields, document_parties, document_lines, document_taxes,
  document_clauses TO reportai_reader;
-- De documents solo los metadatos: ni el análisis crudo ni el texto completo.
GRANT SELECT (id, filename, mime_type, size_bytes, status, created_at, confirmed_at)
  ON documents TO reportai_reader;
