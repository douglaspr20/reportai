ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS analysis JSONB;
CREATE INDEX IF NOT EXISTS documents_doc_type_idx ON documents (doc_type);
