"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Inbox } from "lucide-react";
import TypeBadge from "@/components/TypeBadge";
import { Notice, Null, Panel } from "@/components/ui";
import type { SavedDocument } from "@/lib/documents";
import { formatAmount, formatDate, formatDateTime } from "@/lib/format";

type State =
  | { status: "loading" }
  | { status: "ready"; documents: SavedDocument[] }
  | { status: "error"; message: string };

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "factura", label: "Facturas" },
  { id: "recibo", label: "Recibos" },
  { id: "contrato", label: "Contratos" },
  { id: "otro", label: "Otros" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

function fileUrl(id: string) {
  return `/api/documents/${id}/file`;
}

function FileLink({ doc }: { doc: SavedDocument }) {
  return (
    <a
      href={fileUrl(doc.id)}
      target="_blank"
      rel="noreferrer"
      title={`Abrir el original: ${doc.filename}`}
      className="group/link inline-flex max-w-full items-center gap-1 font-medium text-fg hover:text-accent-fg"
    >
      <span className="truncate">{doc.filename}</span>
      <ArrowUpRight className="size-3.5 shrink-0 text-fg-3 transition-colors group-hover/link:text-accent-fg" aria-hidden />
    </a>
  );
}

/** `refreshKey` cambia cada vez que se guarda un documento nuevo. */
export default function DocumentList({
  refreshKey,
  highlightId,
}: {
  refreshKey: number;
  highlightId?: string | null;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [filter, setFilter] = useState<Filter>("todos");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/documents", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `Error ${response.status}.`);
        setState({ status: "ready", documents: data.documents });
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setState({ status: "error", message: error.message });
      });
    return () => controller.abort();
  }, [refreshKey]);

  const documents = useMemo(() => (state.status === "ready" ? state.documents : []), [state]);
  const counts = useMemo(() => {
    const result: Record<string, number> = { todos: documents.length };
    for (const doc of documents) result[doc.tipo_documento] = (result[doc.tipo_documento] ?? 0) + 1;
    return result;
  }, [documents]);
  const shown = filter === "todos" ? documents : documents.filter((doc) => doc.tipo_documento === filter);

  return (
    <Panel id="registro" aria-labelledby="registro-title" className="overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pb-3 pt-4 sm:px-5">
        <div>
          <h2 id="registro-title" className="flex items-baseline gap-2 text-[15px] font-semibold tracking-[-0.01em] text-fg">
            Registro
            {state.status === "ready" && (
              <span className="tnum font-mono text-xs font-normal text-fg-3">{documents.length}</span>
            )}
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-3">
            Documentos confirmados: sus datos en tablas de Postgres y su texto indexado en pgvector.
          </p>
        </div>

        {documents.length > 0 && (
          <div role="tablist" aria-label="Filtrar por tipo" className="scroll-thin -mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
            {FILTERS.filter((f) => f.id === "todos" || counts[f.id]).map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150 ${
                  filter === f.id ? "bg-surface-3 text-fg" : "text-fg-3 hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {f.label}
                <span className="tnum font-mono text-[11px] text-fg-3">{counts[f.id] ?? 0}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {state.status === "loading" && (
        <div className="flex flex-col gap-px border-t border-line" aria-busy>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 px-5 py-3.5">
              <span className="skeleton h-3.5 w-48" />
              <span className="skeleton h-3.5 w-16" />
              <span className="skeleton ml-auto h-3.5 w-20" />
            </div>
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="border-t border-line p-4 sm:p-5">
          <Notice tone="bad">
            {state.message} Arráncalo con <code className="font-mono text-xs">npm run db:up</code> y recarga.
          </Notice>
        </div>
      )}

      {state.status === "ready" && documents.length === 0 && (
        <div className="flex flex-col items-center gap-2 border-t border-line px-6 py-12 text-center">
          <Inbox className="size-5 text-fg-3" aria-hidden />
          <p className="text-[13px] font-medium text-fg">Aún no hay documentos registrados</p>
          <p className="max-w-sm text-[13px] text-fg-3">
            Sube uno en <a href="#revision" className="text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg">Revisión</a>, comprueba los datos y pulsa «Confirmar y guardar».
          </p>
        </div>
      )}

      {state.status === "ready" && documents.length > 0 && (
        <>
          {/* Escritorio: tabla */}
          <div className="scroll-thin hidden overflow-x-auto border-t border-line md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-xs text-fg-3">
                  <th scope="col" className="px-5 py-2 font-medium">Documento</th>
                  <th scope="col" className="px-3 py-2 font-medium">Tipo</th>
                  <th scope="col" className="px-3 py-2 font-medium">Emisor / partes</th>
                  <th scope="col" className="px-3 py-2 font-medium">Nº</th>
                  <th scope="col" className="px-3 py-2 font-medium">Fecha</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                  <th scope="col" className="px-5 py-2 text-right font-medium" title="Fragmentos de texto indexados en pgvector">Fragm.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`transition-colors duration-700 hover:bg-surface-2 ${doc.id === highlightId ? "bg-accent-soft" : ""}`}
                  >
                    <td className="max-w-[280px] px-5 py-2.5">
                      <FileLink doc={doc} />
                      <p className="mt-0.5 font-mono text-[11px] text-fg-3">
                        #{doc.id} · {formatDateTime(doc.confirmed_at)}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <TypeBadge type={doc.tipo_documento} />
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2.5 text-fg-2" title={doc.partes ?? doc.resumen ?? undefined}>
                      {doc.partes ?? <Null />}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-fg-2">{doc.numero_documento ?? <Null />}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-fg-2">{formatDate(doc.fecha_emision) ?? <Null />}</td>
                    <td className="tnum whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs font-medium text-fg">
                      {formatAmount(doc.total, doc.moneda) ?? <Null />}
                    </td>
                    <td className="tnum px-5 py-2.5 text-right font-mono text-xs text-fg-3">{doc.chunks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: lista */}
          <ul className="divide-y divide-line border-t border-line md:hidden">
            {shown.map((doc) => (
              <li key={doc.id} className={`flex flex-col gap-1.5 px-4 py-3 ${doc.id === highlightId ? "bg-accent-soft" : ""}`}>
                <div className="flex items-start justify-between gap-3 text-[13px]">
                  <span className="min-w-0"><FileLink doc={doc} /></span>
                  <span className="tnum shrink-0 font-mono text-xs font-medium text-fg">
                    {formatAmount(doc.total, doc.moneda) ?? <Null />}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-3">
                  <TypeBadge type={doc.tipo_documento} />
                  {doc.partes && <span className="min-w-0 truncate text-fg-2">{doc.partes}</span>}
                </div>
                <p className="font-mono text-[11px] text-fg-3">
                  #{doc.id}
                  {doc.numero_documento && ` · Nº ${doc.numero_documento}`}
                  {doc.fecha_emision && ` · ${formatDate(doc.fecha_emision)}`} · {doc.chunks} fragm.
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
