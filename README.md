# reportAi

Next.js 16 (App Router) + PostgreSQL 17 con pgvector en Docker.
Una sola página: arrastras una imagen o un PDF, ves la vista previa al instante y
un modelo con visión lo clasifica (**factura**, **recibo**, **contrato** u **otro**) y extrae sus
datos en JSON, que se muestra al lado. Al pulsar **Confirmar y guardar**, los
datos se reparten en tablas de PostgreSQL y el texto del documento se indexa
como embeddings en pgvector. Debajo aparecen la lista de documentos guardados y
un chat que responde preguntas sobre ellos citando el documento de origen de
cada dato: los cálculos y totales con SQL sobre las tablas, el resto con
búsqueda semántica sobre los embeddings.

## Puesta en marcha

```bash
npm install
npm run db:up      # levanta Postgres + pgvector (puerto 5433)
npm run dev        # http://localhost:3000
```

`.env.local` (copiado de `.env.example`):

```
DATABASE_URL=postgresql://reportai:reportai@localhost:5433/reportai
DATABASE_READONLY_URL=postgresql://reportai_reader:reportai_reader@localhost:5433/reportai
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
```

> El puerto **5433** en el host evita chocar con un Postgres local en 5432.
> Sin `OPENROUTER_API_KEY` la vista previa funciona, pero el panel de datos
> muestra el error en vez del JSON. `OPENROUTER_MODEL` es opcional: sin ella
> se usa el modelo por defecto de `lib/analysis.ts`. Igual con
> `OPENROUTER_EMBEDDING_MODEL` (`lib/embeddings.ts`), que debe devolver
> vectores de 1536 dimensiones.

## Estructura

```
app/page.tsx                 única página
components/TopBar.tsx        barra superior: anclas y estado de Postgres/pgvector
components/Pipeline.tsx      pasos del proceso con el estado real del documento
components/Workspace.tsx     une la subida, el registro y el chat (refresca al guardar)
components/FileDropzone.tsx  drag & drop, preview, revisión y confirmación
components/ExtractionView.tsx campos extraídos legibles y JSON coloreado
components/DocumentList.tsx  registro de documentos guardados, filtrable por tipo
components/DocumentChat.tsx  chat con citas [n] enlazadas al documento original
components/ui.tsx            botones, paneles y avisos compartidos
lib/format.ts                fechas, importes y porcentajes en es-ES
app/api/upload/route.ts      guarda el archivo, lo analiza y lo deja 'pendiente'
app/api/documents/           GET lista · [id]/confirm POST guarda · [id] DELETE descarta
                             · [id]/file GET sirve el archivo original
app/api/chat/route.ts        POST { messages } → { answer, sources }
app/api/health/route.ts      comprueba la conexión y la versión de pgvector
lib/openrouter.ts            cliente de chat completions de OpenRouter
lib/analysis.ts              esquema Zod, extracción y transcripción
lib/chat.ts                  elige SQL o búsqueda semántica y redacta con citas
lib/sql.ts                   plan (modo + SQL) y ejecución de solo lectura
lib/embeddings.ts            troceado del texto + embeddings de OpenRouter
lib/documents.ts             confirmar (transacción), listar y descartar
lib/db.ts                    pool de pg reutilizable
lib/files.ts                 tipos MIME aceptados, límite de tamaño, formateo
db/init.sql                  extensión vector + tablas (al crear el volumen)
db/migrations/               cambios de esquema posteriores
docker-compose.yml           pgvector/pgvector:pg17
```

## Flujo

1. Al soltar o elegir el archivo se genera un `blob:` URL y se pinta la vista
   previa — en `<img>` si es imagen, en un `<iframe>` con el visor nativo del
   navegador si es PDF. Esto es 100 % cliente, no espera al servidor.
2. En paralelo se envía a `POST /api/upload`, que guarda el archivo en
   `./uploads/` con nombre UUID y lo manda a **OpenRouter**
   (`deepseek/deepseek-v4.1-flash`, visión + 1M de contexto) como parte
   `image_url` si es imagen, o como `file` si es PDF.
3. El modelo responde con **structured outputs**: el esquema Zod de
   `lib/analysis.ts` se convierte a JSON Schema y se manda como
   `response_format.json_schema` con `strict: true`. La respuesta se vuelve a
   validar con el mismo esquema Zod antes de llegar al navegador.
4. A la vez se obtiene el **texto completo**: de la capa de texto si es un PDF
   digital, o pidiéndole al modelo una transcripción literal si es una imagen o
   un PDF escaneado (menos de 40 caracteres útiles por página).
5. Análisis y texto se guardan en `documents` con `status = 'pendiente'` y se
   pintan en pantalla.
6. **Confirmar y guardar** llama a `POST /api/documents/:id/confirm`, que:
   - trocea el texto (~1.500 caracteres, 200 de solape, cortando en párrafos)
     y pide los embeddings a OpenRouter (`openai/text-embedding-3-small`);
   - en una sola transacción rellena `document_fields`, `document_parties`,
     `document_lines`, `document_taxes`, `document_clauses` y
     `document_chunks`, y marca el documento como `confirmado`.
7. La lista de guardados se recarga. Quitar el archivo, subir otro o cerrar la
   pestaña sin confirmar borra la fila pendiente y el archivo del disco.

Tipos aceptados: PNG, JPEG, WEBP, GIF y PDF, hasta 25 MB.

### Campos extraídos

Un único esquema cubre los tres tipos; lo que no aplica al documento viene a
`null` o como lista vacía, en vez de desaparecer:

- **Clasificación** — `tipo_documento`, `confianza`, `idioma`, `resumen`.
- **Factura / recibo** — `numero_documento`, `fecha_emision`,
  `fecha_vencimiento`, `emisor`, `receptor` (nombre, CIF/NIF, dirección),
  `moneda`, `subtotal`, `impuestos`, `total`, `metodo_pago` y `lineas[]`
  (descripción, cantidad, precio unitario, importe).
- **Contrato** — `partes_contrato[]`, `vigencia_inicio`, `vigencia_fin`,
  `clausulas_clave[]`.

El prompt es explícito en no inventar: lo ilegible se devuelve como `null`.

## Chat con los documentos

Cada pregunta pasa primero por un **planificador** (una llamada al modelo con
salida estructurada `{ modo, sql }`) que decide cómo responderla:

- **`sql`** — cálculos o agregados sobre varios documentos: totales, sumas,
  IVA, recuentos, máximos, rankings, listados filtrados por fecha o importe
  («¿cuánto gasté en marzo?», «¿cuál es la factura más cara?»). El modelo recibe
  el esquema de las tablas estructuradas y la fecha de hoy, y escribe una
  consulta que debe incluir una columna `document_ids` con los documentos de
  los que sale cada fila. Esos ids se convierten en las citas `[n]`. Si
  Postgres rechaza la consulta, se le devuelve el error para que la corrija
  una vez; si vuelve a fallar, se responde con búsqueda semántica.
- **`semantica`** — preguntas sobre el contenido de un documento: el flujo de
  abajo.

En la interfaz cada respuesta indica el modo, y en modo SQL se puede
desplegar la consulta ejecutada.

### Seguridad del SQL generado

La consulta la escribe un modelo, así que se trata como no confiable. La
protección no depende de revisar el texto, sino de dónde se ejecuta
(`db/migrations/004_readonly_role.sql`, `lib/sql.ts`):

- Rol **`reportai_reader`** con login propio (el de la app es superusuario):
  solo `SELECT` sobre las tablas estructuradas y algunas columnas de
  `documents`. No puede leer `content_text`, `analysis` ni
  `document_chunks`, y no puede cambiar de rol.
- Transacción `READ ONLY` con `statement_timeout` de 5 s, que siempre se
  deshace (también los `set_config` que intente la consulta).
- Protocolo extendido de `pg` (no admite varias sentencias), y la consulta va
  envuelta en `SELECT * FROM (…) LIMIT 101`: como mucho se devuelven 100 filas.

Probado con varias sentencias encadenadas, `DELETE` dentro de `WITH`, tablas
sin permiso, `pg_sleep` y `set_config`: todo falla o se revierte.

### Búsqueda semántica

1. La pregunta se convierte en embedding con el mismo modelo que los
   fragmentos. En una repregunta se combina con la pregunta anterior del
   usuario, para que «¿y cuándo vence?» siga encontrando la misma factura.
2. pgvector devuelve los 6 fragmentos más cercanos (distancia coseno, índice
   HNSW) de documentos confirmados, y se descartan los de similitud < 0,2.
   Como referencia: una pregunta sobre un documento da ~0,5 con él, y una
   ajena a todos (“capital de Australia”) < 0,1. Si no queda ninguno, se
   responde que no hay nada relacionado sin llamar al modelo.
3. Los fragmentos van al modelo numerados como `[1]…[n]`, cada uno con los
   datos estructurados de su documento (nº, fecha, total, partes). El prompt le
   obliga a citar la fuente de cada dato, a decir que no lo sabe si las
   fuentes no lo contienen y a tratar el contenido de los documentos como
   datos, no como instrucciones.
4. Cada `[n]` de la respuesta se pinta como enlace al archivo original
   (`/api/documents/:id/file`), y debajo aparecen las fuentes citadas con su
   similitud y el fragmento. Si el modelo no cita ninguna, se enseñan los
   fragmentos consultados.

El historial (últimos 10 mensajes) vive en el navegador; «Nueva conversación»
lo vacía. Las citas de respuestas anteriores se quitan del historial que se
envía, porque apuntaban a otra lista de fuentes.

## Esquema de base de datos

- `documents` — nombre original, nombre en disco (UUID), MIME, tamaño, fecha,
  `doc_type`, `analysis JSONB` con la extracción completa, `model`, `status`
  (`pendiente` / `confirmado`), `content_text` (texto completo),
  `embedding_model` y `confirmed_at`.
- `document_fields` — 1:1 con `documents`: clasificación, número, fechas
  (`DATE`), moneda, importes (`NUMERIC`), método de pago y vigencia.
- `document_parties` — `rol` (`emisor`, `receptor`, `parte`), nombre, NIF/CIF y
  dirección.
- `document_lines`, `document_taxes`, `document_clauses` — líneas de detalle,
  desglose de impuestos y cláusulas clave, ordenadas por `posicion`.
- `document_chunks` — fragmentos de texto + `embedding vector(1536)` con índice
  HNSW (`vector_cosine_ops`).

Las fechas que no son ISO válidas se guardan como `NULL`. En documentos que no
son contratos se ignoran `partes_contrato`, `clausulas_clave` y la vigencia,
porque el modelo a veces los rellena copiando emisor, receptor y fechas.

Consultas útiles:

```bash
curl http://localhost:3000/api/health
# {"database":"ok","pgvector":"0.8.6"}

docker exec reportai-postgres psql -U reportai -d reportai \
  -c "SELECT d.id, d.filename, f.tipo_documento, f.total FROM documents d JOIN document_fields f ON f.document_id = d.id;"
```

Si cambias `db/init.sql` después del primer arranque hay que recrear el volumen
(`docker compose down -v && npm run db:up`); para un esquema ya en uso, añade un
archivo en `db/migrations/` y aplícalo:

```bash
docker exec -i reportai-postgres psql -U reportai -d reportai < db/migrations/004_readonly_role.sql
```

Búsqueda por similitud (`<=>` es la distancia coseno; `$1` es el embedding de
la pregunta, generado con el mismo modelo):

```sql
SELECT document_id, 1 - (embedding <=> $1) AS similitud, content
  FROM document_chunks
 ORDER BY embedding <=> $1
 LIMIT 5;
```

## Notas

- Si el análisis falla, el archivo se borra del disco y no se crea fila: la
  respuesta es un 502 con el motivo, que la página muestra en el panel derecho.
- Si Postgres está caído pero el análisis funciona, el JSON se muestra igual,
  sin botón de guardar, con un aviso para volver a subirlo.
- Si falla la transcripción, el documento se puede guardar igual: se indexan
  el resumen y el JSON extraído en lugar del texto.
- Si fallan los embeddings al confirmar, no se escribe nada y el botón pasa a
  «Reintentar».
- Los PDF no los lee el modelo directamente: OpenRouter los pasa por el plugin
  `file-parser` con motor `mistral-ocr` (~$0,001/1.000 páginas), así que los
  escaneados también funcionan. Las imágenes van directas al modelo.
- Para cambiar de modelo basta con `OPENROUTER_MODEL`; tiene que aceptar
  imágenes y `structured_outputs` (compruébalo en la ficha del modelo en
  openrouter.ai).
