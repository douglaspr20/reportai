"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, ArrowUpRight, ChevronRight, Database, RotateCcw, Search } from "lucide-react";
import TypeBadge from "@/components/TypeBadge";
import { Notice, Panel, buttonClass } from "@/components/ui";
import type { ChatAnswer, Source } from "@/lib/chat";

type Turn =
  | { role: "user"; content: string }
  | ({ role: "assistant"; content: string } & Omit<ChatAnswer, "answer" | "model">)
  | { role: "error"; content: string };

type AssistantTurn = Extract<Turn, { role: "assistant" }>;

const SUGGESTIONS = [
  "¿Cuánto suman mis facturas y cuánto IVA pagué?",
  "¿Qué se compró en el recibo?",
  "¿Cuál es la renta del contrato de alquiler?",
];

function fileUrl(documentId: string) {
  return `/api/documents/${documentId}/file`;
}

/** Sustituye cada [n] del texto por un enlace al documento de esa fuente. */
function AnswerText({
  text,
  sources,
  onHover,
}: {
  text: string;
  sources: Source[];
  onHover: (n: number | null) => void;
}) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-[1.65] text-fg">
      {parts.map((part, index) => {
        const match = /^\[(\d+)\]$/.exec(part);
        const source = match && sources.find((s) => s.n === Number(match[1]));
        if (!source) return part;
        return (
          <a
            key={index}
            href={fileUrl(source.documentId)}
            target="_blank"
            rel="noreferrer"
            title={`${source.filename} · documento #${source.documentId}`}
            onMouseEnter={() => onHover(source.n)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(source.n)}
            onBlur={() => onHover(null)}
            className="tnum mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-accent-soft px-1 align-[1px] font-mono text-[11px] font-medium text-accent-fg no-underline transition-colors duration-150 hover:bg-accent hover:text-surface"
          >
            {source.n}
          </a>
        );
      })}
    </p>
  );
}

/** Cómo se obtuvo la respuesta: el modo y, si fue con SQL, la consulta ejecutada. */
function MethodChip({ turn }: { turn: AssistantTurn }) {
  const sql = turn.mode === "sql";
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 text-xs text-fg-2">
      {sql ? <Database className="size-3.5" aria-hidden /> : <Search className="size-3.5" aria-hidden />}
      {sql ? (
        <>
          SQL
          <span className="text-fg-3">·</span>
          <span className="tnum font-mono text-[11px]">
            {turn.rowCount} {turn.rowCount === 1 ? "fila" : "filas"}
            {turn.truncated && " (recortado)"}
          </span>
        </>
      ) : (
        "Búsqueda semántica"
      )}
    </span>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  return (
    <details className="group/sql rounded-lg border border-line">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform duration-150 group-open/sql:rotate-90" aria-hidden />
        Consulta ejecutada
        <span className="ml-auto hidden font-normal text-fg-3 sm:inline">rol de solo lectura · máx. 100 filas</span>
      </summary>
      <pre className="scroll-thin max-h-64 overflow-auto border-t border-line bg-surface-2 px-3 py-2.5 font-mono text-xs leading-relaxed text-fg">
        <code>{sql}</code>
      </pre>
    </details>
  );
}

function SourceList({ sources, active }: { sources: Source[]; active: number | null }) {
  const cited = sources.filter((source) => source.cited);
  // Si el modelo no citó nada, enseñamos igualmente qué consultó.
  const shown = cited.length > 0 ? cited : sources;
  if (shown.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-fg-2">
        {cited.length > 0 ? "Fuentes citadas" : "Fragmentos consultados (sin citar)"}
      </p>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line">
        {shown.map((source) => (
          <li
            key={source.n}
            className={`px-3 py-2 transition-colors duration-150 ${active === source.n ? "source-hit" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
              <span className="tnum font-mono font-medium text-accent-fg">[{source.n}]</span>
              <a
                href={fileUrl(source.documentId)}
                target="_blank"
                rel="noreferrer"
                className="group/link inline-flex min-w-0 items-center gap-1 text-[13px] font-medium text-fg hover:text-accent-fg"
              >
                <span className="truncate">{source.filename}</span>
                <ArrowUpRight className="size-3.5 shrink-0 text-fg-3 group-hover/link:text-accent-fg" aria-hidden />
              </a>
              <TypeBadge type={source.tipo} />
              <span className="tnum ml-auto font-mono text-[11px] text-fg-3">
                #{source.documentId}
                {source.similarity !== null && ` · similitud ${source.similarity.toFixed(2).replace(".", ",")}`}
              </span>
            </div>
            <details className="group/ex mt-1">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-fg-3 hover:text-fg [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-3 transition-transform duration-150 group-open/ex:rotate-90" aria-hidden />
                {source.similarity === null ? "Ver resumen" : "Ver fragmento"}
              </summary>
              <p className="scroll-thin mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-surface-2 px-3 py-2 text-xs leading-relaxed text-fg-2">
                {source.excerpt}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssistantMessage({ turn }: { turn: AssistantTurn }) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div className="fade-in flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-fg">
          reportAi
        </span>
        <MethodChip turn={turn} />
      </div>
      <AnswerText text={turn.content} sources={turn.sources} onHover={setActive} />
      {turn.mode === "sql" && turn.sql && <SqlBlock sql={turn.sql} />}
      <SourceList sources={turn.sources} active={active} />
    </div>
  );
}

export default function DocumentChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking]);

  async function ask(question: string) {
    const content = question.trim();
    if (!content || thinking) return;

    const next: Turn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setInput("");
    setThinking(true);

    // Los errores se quedan en pantalla pero no se mandan como historial.
    const messages = next
      .filter((turn) => turn.role !== "error")
      .map(({ role, content }) => ({ role, content }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `Error ${response.status}.`);
      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          mode: data.mode,
          sql: data.sql,
          rowCount: data.rowCount,
          truncated: data.truncated,
        },
      ]);
    } catch (cause) {
      setTurns((current) => [...current, { role: "error", content: (cause as Error).message }]);
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  return (
    <Panel id="preguntar" aria-labelledby="preguntar-title" className="flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 id="preguntar-title" className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
            Preguntar
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-3">
            Cálculos con SQL sobre los datos, el resto con búsqueda semántica · cada respuesta cita su origen.
          </p>
        </div>
        {turns.length > 0 && (
          <button type="button" onClick={() => setTurns([])} disabled={thinking} className={buttonClass("ghost", "sm")}>
            <RotateCcw aria-hidden />
            Nueva conversación
          </button>
        )}
      </header>

      <div
        ref={scrollRef}
        className={`scroll-thin flex max-h-[70vh] ${turns.length > 0 || thinking ? "min-h-[300px]" : ""} flex-col gap-7 overflow-y-auto px-4 py-5 sm:px-6`}
        aria-live="polite"
      >
        {turns.length === 0 && !thinking && (
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:gap-10">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-fg-2">Prueba con</p>
              <ul className="flex flex-col gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => ask(suggestion)}
                      className="group flex w-full items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5 text-left text-[13px] text-fg transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
                    >
                      {suggestion}
                      <ArrowRight className="size-4 shrink-0 text-fg-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-fg-2">Cómo responde</p>
              <div className="flex gap-3">
                <Database className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
                <p className="text-[13px] leading-relaxed text-fg-2">
                  <span className="font-medium text-fg">SQL</span> para totales, sumas, recuentos o
                  rankings: el modelo escribe la consulta y se ejecuta con un rol de solo lectura.
                  Puedes ver la consulta.
                </p>
              </div>
              <div className="flex gap-3">
                <Search className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
                <p className="text-[13px] leading-relaxed text-fg-2">
                  <span className="font-medium text-fg">Búsqueda semántica</span> para el contenido:
                  busca los fragmentos más cercanos en pgvector y enseña su similitud.
                </p>
              </div>
            </div>
          </div>
        )}

        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <div
              key={index}
              className="fade-in max-w-[85%] self-end whitespace-pre-wrap rounded-xl rounded-br-sm bg-surface-3 px-3.5 py-2.5 text-sm leading-relaxed text-fg"
            >
              {turn.content}
            </div>
          ) : turn.role === "assistant" ? (
            <AssistantMessage key={index} turn={turn} />
          ) : (
            <Notice key={index} tone="bad" className="fade-in self-start">
              {turn.content}
            </Notice>
          )
        )}

        {thinking && (
          <div className="flex flex-col gap-2.5" role="status">
            <p className="text-xs text-fg-3">Buscando en tus documentos…</p>
            <span className="skeleton h-3.5 w-4/5" />
            <span className="skeleton h-3.5 w-3/5" />
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
        className="border-t border-line bg-surface-2 p-3"
      >
        <div className="flex items-end gap-2 rounded-lg border border-line-strong bg-surface p-1.5 transition-colors duration-150 focus-within:border-accent">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void ask(input);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Pregunta sobre tus documentos…"
            aria-label="Pregunta"
            className="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-fg outline-none [field-sizing:content] placeholder:text-fg-3 focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={thinking || !input.trim()}
            aria-label="Preguntar"
            className={buttonClass("primary", "md", "size-8 px-0")}
          >
            <ArrowUp aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 hidden px-1 text-[11px] text-fg-3 sm:block">
          Intro para enviar · Mayús + Intro para una línea nueva
        </p>
      </form>
    </Panel>
  );
}
