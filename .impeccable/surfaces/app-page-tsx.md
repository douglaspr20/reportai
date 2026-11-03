---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["components/Workspace.tsx","components/FileDropzone.tsx","components/DocumentList.tsx","components/DocumentChat.tsx"]
---

# reportAi — página única

Scope: `app/page.tsx` and the components it renders (Workspace, FileDropzone, DocumentList, DocumentChat, TypeBadge). Visitor mode: **Operate**.

Audience: technical evaluators (recruiters, clients, engineers), guided by the author over screen-share or exploring alone from a link. Job: upload a sample document, verify the extraction, save it, ask questions, and judge whether every number is traceable. Must not hide the technique (SQL, similitud, confianza, JSON) and must work on mobile. Extraction shows a formatted view plus the raw JSON (copiable).

User chose the category standard on purpose (canon). Quality bar: Linear and Stripe Dashboard. Theme: light and dark, following the system.

## Direction contract

THESIS: The category standard for a document-AI workspace, executed at Linear/Stripe craft: one calm workspace where review → registro → pregunta read top to bottom. Refuses the incumbent dark-indigo card stack and a generic sidebar SaaS shell.

OWN-WORLD: Neutral warm-gray ground, white surfaces (near-black in dark), hairline borders, 8–10px radii, ink-colored primary buttons, one blue accent reserved for citations, focus and selection. Inter for UI, JetBrains Mono only for code, JSON, ids and figures. Type badges are the only other color.

STORY: The evaluator sees the pipeline and its live state, drops a file, reads extracted fields as a Stripe-like record (nulls shown honestly, JSON one tab away), confirms, sees it land in the registro, then asks and inspects the SQL or the sources behind every answer.

FIRST VIEWPORT: Sticky top bar (wordmark, in-page anchors, DB/pgvector health). Below, title and one-line description left, pipeline stepper right reflecting the active document's state. Then the review workspace: wide dropzone when empty; preview left / extraction panel right with the primary "Confirmar y guardar" pinned at the panel foot.

FORM: Category canon (chosen via the standing exit); seed key 2d8755a6. Signature interaction: the pipeline stepper advancing with the real state of the document; citations [n] that highlight their source row.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
