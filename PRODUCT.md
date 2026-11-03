# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary audience: people evaluating the project as a technical demo or portfolio piece (recruiters, prospective clients, other engineers). They upload a sample invoice, receipt or contract, watch it get read, and ask questions to judge whether the pipeline is trustworthy and well built. The operator running the demo is the author.

## Product Purpose
reportAi reads business documents (images or PDFs), classifies them as factura, recibo, contrato u otro, extracts their data with a vision model under a strict schema, and — after human confirmation — stores the data in PostgreSQL tables and the text as pgvector embeddings. A chat then answers questions over the stored documents: aggregates and totals via generated read-only SQL, everything else via semantic search, always citing the source document. Success: an evaluator leaves convinced every number on screen can be traced back to a real document.

## Positioning
Verifiable trust. Nothing is saved without review; every answer shows how it was obtained (SQL query visible, or semantic search with similarity scores) and links each cited fact `[n]` to the original file. The model is told not to invent: illegible fields come back as null.

## Operating Context
Single-page flow: drop file → instant client-side preview → analysis (classification, confidence, summary, structured fields, warnings, model name) → "Confirmar y guardar" (chunks + embeddings, transactional) → saved documents table → chat. Unconfirmed analyses are discarded when replaced, removed, or the tab closes.

## Capabilities and Constraints
- Accepted: PNG, JPEG, WEBP, GIF, PDF up to 25 MB.
- Extracted schema: tipo_documento, confianza, idioma, resumen; número, fechas de emisión/vencimiento, emisor/receptor (nombre, NIF/CIF, dirección), moneda, subtotal, impuestos, total, método de pago, líneas; for contracts partes, vigencia, cláusulas clave. Missing values are null or empty lists.
- Chat answers carry `mode` (`sql` | `semantica`), optional `sql`, `rowCount`, `truncated`, and `sources` (n, documentId, filename, tipo, similarity, excerpt, cited).
- Extracted JSON stays copyable ("Copiar JSON").
- Stack: Next.js 16 App Router, React 19, Tailwind CSS 4, PostgreSQL 17 + pgvector, OpenRouter.
- Must remain a single page (one route, no new navigation).
- Interface copy is Spanish (Spain).

## Brand Commitments
Name is fixed: **reportAi** (lowercase "report", capital "Ai").

## Evidence on Hand
No testimonials, customers, metrics or press exist. Do not fabricate usage numbers, accuracy claims or logos. The README's technical facts (models, security of generated SQL, thresholds) are real and may be surfaced.

## Product Principles
1. Show the work: provenance, method and confidence are first-class, never hidden in fine print.
2. Human confirms, machine proposes: review before save is the hinge of the flow.
3. Honest uncertainty: nulls, low confidence, warnings and errors are displayed plainly.
4. One page, one story: upload → verify → store → ask, readable top to bottom by a first-time evaluator.
