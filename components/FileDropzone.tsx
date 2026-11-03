"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Check, Copy, FileText, ImageIcon, RefreshCw, Upload, X } from "lucide-react";
import type { Analysis } from "@/lib/analysis";
import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZE,
  formatBytes,
  isAccepted,
} from "@/lib/files";
import TypeBadge from "@/components/TypeBadge";
import type { Stage } from "@/components/Pipeline";
import { Confidence, FieldsSkeleton, FieldsView, JsonView } from "@/components/ExtractionView";
import { Notice, Panel, Spinner, buttonClass } from "@/components/ui";

type Selected = {
  file: File;
  url: string;
  kind: "image" | "pdf";
};

type Result =
  | { status: "idle" }
  | { status: "analyzing" }
  | {
      status: "done";
      analysis: Analysis;
      model: string;
      id: string | null;
      warnings: string[];
    }
  | { status: "error"; message: string };

type Save =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; chunks: number }
  | { status: "error"; message: string };

/** Borra en el servidor un análisis que no se llegó a confirmar. */
function discard(id: string) {
  // keepalive: la petición sobrevive aunque se cierre la pestaña.
  void fetch(`/api/documents/${id}`, { method: "DELETE", keepalive: true }).catch(() => {});
}

function stageOf(selected: Selected | null, result: Result, save: Save): Stage {
  if (!selected || result.status === "idle") return "vacio";
  if (result.status === "analyzing") return "analizando";
  if (result.status === "error") return "error-analisis";
  if (save.status === "saving") return "guardando";
  if (save.status === "saved") return "guardado";
  if (save.status === "error") return "error-guardado";
  return "revision";
}

const EXTRACTS = [
  { type: "factura", fields: "número, fechas, emisor y receptor, líneas, impuestos y total" },
  { type: "recibo", fields: "emisor, fecha, conceptos, método de pago y total" },
  { type: "contrato", fields: "partes, vigencia y cláusulas clave" },
];

export default function FileDropzone({
  onSaved,
  onStageChange,
}: {
  onSaved?: (id: string) => void;
  onStageChange?: (stage: Stage) => void;
}) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const [save, setSave] = useState<Save>({ status: "idle" });
  const [view, setView] = useState<"campos" | "json">("campos");
  // Id del análisis mostrado mientras no se confirme, para descartarlo si se
  // sustituye o se quita. Y un contador para ignorar respuestas de subidas
  // anteriores que lleguen tarde.
  const pendingId = useRef<string | null>(null);
  const requestSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const stage = stageOf(selected, result, save);
  useEffect(() => {
    onStageChange?.(stage);
  }, [stage, onStageChange]);

  // Liberamos el object URL anterior cuando cambia o se desmonta el componente.
  useEffect(() => {
    return () => {
      if (selected) URL.revokeObjectURL(selected.url);
    };
  }, [selected]);

  const releasePending = useCallback(() => {
    if (pendingId.current) discard(pendingId.current);
    pendingId.current = null;
  }, []);

  // Cerrar o recargar la pestaña también descarta lo no confirmado.
  useEffect(() => {
    window.addEventListener("pagehide", releasePending);
    return () => window.removeEventListener("pagehide", releasePending);
  }, [releasePending]);

  const analyze = useCallback(async (file: File) => {
    const seq = ++requestSeq.current;
    setResult({ status: "analyzing" });
    setSave({ status: "idle" });
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json();

      if (seq !== requestSeq.current) {
        if (data.id) discard(data.id);
        return;
      }

      if (!response.ok) {
        setResult({
          status: "error",
          message: data.error ?? `Error ${response.status}.`,
        });
        return;
      }

      pendingId.current = data.id;
      setResult({
        status: "done",
        analysis: data.analysis,
        model: data.model,
        id: data.id,
        warnings: data.warnings ?? [],
      });
    } catch (cause) {
      if (seq !== requestSeq.current) return;
      setResult({ status: "error", message: (cause as Error).message });
    }
  }, []);

  async function confirm() {
    if (result.status !== "done" || !result.id) return;
    setSave({ status: "saving" });
    try {
      const response = await fetch(`/api/documents/${result.id}/confirm`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setSave({ status: "error", message: data.error ?? `Error ${response.status}.` });
        return;
      }
      pendingId.current = null;
      setSave({ status: "saved", chunks: data.chunks });
      onSaved?.(result.id);
    } catch (cause) {
      setSave({ status: "error", message: (cause as Error).message });
    }
  }

  const accept = useCallback(
    (file: File) => {
      if (!isAccepted(file.type)) {
        setError("Ese formato no se admite. Sube una imagen (PNG, JPG, WEBP, GIF) o un PDF.");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`El archivo pesa ${formatBytes(file.size)}. El máximo es 25 MB.`);
        return;
      }

      setError(null);
      setCopied(false);
      releasePending();
      setSelected((previous) => {
        if (previous) URL.revokeObjectURL(previous.url);
        return {
          file,
          url: URL.createObjectURL(file),
          kind: file.type === "application/pdf" ? "pdf" : "image",
        };
      });
      void analyze(file);
    },
    [analyze, releasePending]
  );

  const clear = useCallback(() => {
    setSelected((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return null;
    });
    requestSeq.current += 1;
    releasePending();
    setError(null);
    setCopied(false);
    setResult({ status: "idle" });
    setSave({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }, [releasePending]);

  async function copyJson() {
    if (result.status !== "done") return;
    await navigator.clipboard.writeText(JSON.stringify(result.analysis, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const pick = () => inputRef.current?.click();

  const dragHandlers = {
    onDragEnter: (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
    onDragLeave: (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) setDragging(false);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) accept(file);
    },
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_MIME_TYPES.join(",")}
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) accept(file);
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );

  return (
    <div className="flex flex-col gap-3" {...dragHandlers}>
      {fileInput}

      {error && <Notice tone="bad">{error}</Notice>}

      {!selected ? (
        <div
          onClick={pick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              pick();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Subir una imagen o un PDF"
          className={`group grid cursor-pointer overflow-hidden rounded-xl border border-dashed transition-colors duration-150 lg:grid-cols-[1.3fr_1fr] ${
            dragging
              ? "border-accent bg-accent-soft"
              : "border-line-strong bg-surface hover:border-fg-3"
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center sm:py-16">
            <span
              className={`flex size-11 items-center justify-center rounded-xl border transition-colors duration-150 ${
                dragging
                  ? "border-accent bg-surface text-accent"
                  : "border-line bg-surface-2 text-fg-2 group-hover:text-fg"
              }`}
            >
              {dragging ? <ArrowDown className="size-5" aria-hidden /> : <Upload className="size-5" aria-hidden />}
            </span>
            <div>
              <p className="text-[15px] font-medium text-fg">
                {dragging ? "Suelta para analizarlo" : "Arrastra un documento aquí"}
              </p>
              <p className="mt-1 text-[13px] text-fg-3">
                PNG, JPG, WEBP, GIF o PDF · hasta 25 MB · se analiza al soltarlo
              </p>
            </div>
            <span className={buttonClass("primary", "md")}>
              Seleccionar archivo
            </span>
          </div>

          <div className="hidden flex-col justify-center gap-4 border-l border-dashed border-line-strong bg-surface-2 px-7 py-8 lg:flex">
            <p className="text-xs font-semibold text-fg-2">Qué se extrae</p>
            <ul className="flex flex-col gap-3.5">
              {EXTRACTS.map((item) => (
                <li key={item.type} className="flex flex-col items-start gap-1.5">
                  <TypeBadge type={item.type} />
                  <span className="text-[13px] leading-snug text-fg-2">{item.fields}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-fg-3">
              Lo que no aparece o no se lee llega como <span className="font-mono">null</span>: el
              modelo no rellena huecos.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative grid items-start gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {dragging && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-dashed border-accent bg-accent-soft/80 backdrop-blur-[2px]">
              <p className="rounded-lg bg-surface px-4 py-2 text-[13px] font-medium text-fg shadow-md">
                Suelta para sustituir el documento
              </p>
            </div>
          )}

          {/* Vista previa */}
          <Panel className="overflow-hidden lg:sticky lg:top-20" aria-labelledby="preview-title">
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-2">
                {selected.kind === "pdf" ? <FileText className="size-4" aria-hidden /> : <ImageIcon className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <p id="preview-title" className="truncate text-[13px] font-medium text-fg" title={selected.file.name}>
                  {selected.file.name}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-fg-3">
                  {selected.file.type} · {formatBytes(selected.file.size)}
                </p>
              </div>
              <button type="button" onClick={pick} className={buttonClass("ghost", "sm")} title="Elegir otro archivo">
                <RefreshCw aria-hidden />
                <span className="hidden sm:inline">Cambiar</span>
              </button>
              <button type="button" onClick={clear} className={buttonClass("ghost", "sm", "px-1.5")} aria-label="Quitar documento" title="Quitar documento">
                <X aria-hidden />
              </button>
            </header>

            <div className="bg-surface-2 p-3">
              {selected.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.url}
                  alt={`Vista previa de ${selected.file.name}`}
                  className="mx-auto max-h-[64vh] w-auto rounded-md object-contain shadow-sm"
                />
              ) : (
                <iframe
                  src={selected.url}
                  title={`Vista previa de ${selected.file.name}`}
                  className="h-[64vh] w-full rounded-md border-0 bg-white"
                />
              )}
            </div>
          </Panel>

          {/* Resultado del análisis */}
          <Panel className="flex min-w-0 flex-col overflow-hidden" aria-labelledby="extraction-title">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
              <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-3 gap-y-1.5 sm:basis-auto">
                <h2 id="extraction-title" className="whitespace-nowrap text-[13px] font-semibold text-fg">
                  Datos extraídos
                </h2>
                {result.status === "done" && (
                  <>
                    <TypeBadge type={result.analysis.tipo_documento} />
                    <Confidence value={result.analysis.confianza} />
                  </>
                )}
              </div>
              {result.status === "done" && (
                <div className="flex items-center gap-1.5">
                  <div role="tablist" aria-label="Formato" className="flex rounded-md bg-surface-2 p-0.5">
                    {(["campos", "json"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="tab"
                        aria-selected={view === option}
                        onClick={() => setView(option)}
                        className={`h-6 rounded px-2.5 text-xs font-medium transition-colors duration-150 ${
                          view === option ? "bg-surface text-fg shadow-sm" : "text-fg-3 hover:text-fg"
                        }`}
                      >
                        {option === "campos" ? "Campos" : "JSON"}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={copyJson} className={buttonClass("ghost", "sm")}>
                    {copied ? <Check aria-hidden className="text-ok" /> : <Copy aria-hidden />}
                    {copied ? "Copiado" : "Copiar JSON"}
                  </button>
                </div>
              )}
            </header>

            <div className="scroll-thin flex-1 p-4 sm:p-5 lg:max-h-[64vh] lg:overflow-y-auto" aria-busy={result.status === "analyzing"}>
              {result.status === "analyzing" && (
                <div className="flex flex-col gap-5">
                  <p className="flex items-center gap-2 text-[13px] text-fg-2" role="status">
                    <Spinner />
                    Leyendo el documento con el modelo de visión…
                  </p>
                  <FieldsSkeleton />
                </div>
              )}

              {result.status === "error" && (
                <div className="flex flex-col items-start gap-3">
                  <Notice tone="bad" className="w-full">{result.message}</Notice>
                  <button type="button" onClick={() => selected && analyze(selected.file)} className={buttonClass("secondary", "md")}>
                    <RefreshCw aria-hidden />
                    Volver a analizar
                  </button>
                </div>
              )}

              {result.status === "done" && (
                <div key={view} className="fade-in flex flex-col gap-4">
                  {view === "campos" ? <FieldsView analysis={result.analysis} /> : <JsonView value={result.analysis} />}
                  {result.warnings.map((warning) => (
                    <Notice key={warning} tone="warn">{warning}</Notice>
                  ))}
                </div>
              )}
            </div>

            {result.status === "done" && (
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                  {result.id ? (
                    <p
                      className={`text-[13px] ${
                        save.status === "error" ? "text-bad" : save.status === "saved" ? "text-ok" : "text-fg-2"
                      }`}
                      role={save.status === "error" ? "alert" : "status"}
                    >
                      {save.status === "idle" && "Revisa los datos antes de guardarlos."}
                      {save.status === "saving" && "Guardando datos y generando embeddings…"}
                      {save.status === "saved" && (
                        <>
                          Guardado como <span className="font-mono">#{result.id}</span> ·{" "}
                          {save.chunks} {save.chunks === 1 ? "fragmento indexado" : "fragmentos indexados"} ·{" "}
                          <a href="#registro" className="underline decoration-current/30 underline-offset-2 hover:decoration-current">
                            ver en el registro
                          </a>
                        </>
                      )}
                      {save.status === "error" && save.message}
                    </p>
                  ) : (
                    <p className="text-[13px] text-fg-2">No se puede guardar este análisis; vuelve a subirlo cuando la base de datos esté disponible.</p>
                  )}
                  <p className="mt-0.5 break-all font-mono text-[11px] text-fg-3 sm:truncate" title="Modelo que hizo la extracción">
                    {result.model}
                  </p>
                </div>
                {result.id && save.status !== "saved" && (
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={save.status === "saving"}
                    className={buttonClass("primary", "lg", "w-full disabled:cursor-wait sm:w-auto")}
                  >
                    {save.status === "saving" ? (
                      <>
                        <Spinner className="border-ink-fg/30 border-t-ink-fg" />
                        Guardando…
                      </>
                    ) : save.status === "error" ? (
                      <>
                        <RefreshCw aria-hidden />
                        Reintentar
                      </>
                    ) : (
                      <>
                        <Check aria-hidden />
                        Confirmar y guardar
                      </>
                    )}
                  </button>
                )}
                {save.status === "saved" && (
                  <button type="button" onClick={pick} className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
                    <Upload aria-hidden />
                    Subir otro
                  </button>
                )}
              </footer>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
