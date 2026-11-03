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
