import { Check, X } from "lucide-react";
import { Spinner } from "@/components/ui";

/** Fase del documento activo; la comparten la subida y la cabecera. */
export type Stage =
  | "vacio"
  | "analizando"
  | "error-analisis"
  | "revision"
  | "guardando"
  | "error-guardado"
  | "guardado";

type StepState = "pendiente" | "actual" | "ocupado" | "hecho" | "error";

const STEPS = [
  { title: "Subir", detail: "Imagen o PDF, hasta 25 MB" },
  { title: "Extraer", detail: "Visión + esquema estricto validado con Zod" },
  { title: "Revisar y guardar", detail: "Tablas en Postgres + embeddings en pgvector" },
  { title: "Preguntar", detail: "SQL de solo lectura o búsqueda semántica, con citas" },
];

function stepStates(stage: Stage): StepState[] {
  switch (stage) {
    case "vacio":
      return ["actual", "pendiente", "pendiente", "pendiente"];
    case "analizando":
      return ["hecho", "ocupado", "pendiente", "pendiente"];
    case "error-analisis":
      return ["hecho", "error", "pendiente", "pendiente"];
    case "revision":
      return ["hecho", "hecho", "actual", "pendiente"];
    case "guardando":
      return ["hecho", "hecho", "ocupado", "pendiente"];
    case "error-guardado":
      return ["hecho", "hecho", "error", "pendiente"];
    case "guardado":
      return ["hecho", "hecho", "hecho", "actual"];
  }
}

function Marker({ state, index }: { state: StepState; index: number }) {
  const ring = "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold";
  if (state === "hecho")
    return (
      <span className={`${ring} bg-ok text-surface`}>
        <Check className="size-3" strokeWidth={3} aria-hidden />
      </span>
    );
  if (state === "error")
    return (
      <span className={`${ring} bg-bad text-surface`}>
        <X className="size-3" strokeWidth={3} aria-hidden />
      </span>
    );
  if (state === "ocupado")
    return (
      <span className={`${ring} border border-line-strong bg-surface`}>
        <Spinner className="size-3" />
      </span>
    );
  return (
    <span
      className={`${ring} tnum ${
        state === "actual" ? "bg-ink text-ink-fg" : "border border-line-strong text-fg-3"
      }`}
    >
      {index + 1}
    </span>
  );
}

const STATE_LABEL: Record<StepState, string> = {
  pendiente: "pendiente",
  actual: "paso actual",
  ocupado: "en curso",
  hecho: "completado",
  error: "con error",
};

export default function Pipeline({ stage }: { stage: Stage }) {
  const states = stepStates(stage);
  return (
    <ol
      aria-label="Proceso del documento"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4"
    >
      {STEPS.map((step, index) => {
        const state = states[index];
        const active = state === "actual" || state === "ocupado" || state === "error";
        return (
          <li
            key={step.title}
            aria-current={active ? "step" : undefined}
            className={`relative flex gap-3 px-4 py-3.5 transition-colors duration-200 ${
              active ? "bg-surface" : "bg-surface-2"
            }`}
          >
            <Marker state={state} index={index} />
            <div className="min-w-0">
              <p
                className={`text-[13px] font-medium ${
                  state === "pendiente" ? "text-fg-2" : "text-fg"
                }`}
              >
                {step.title}
                <span className="sr-only"> ({STATE_LABEL[state]})</span>
              </p>
              <p className="mt-0.5 text-xs leading-snug text-fg-3">{step.detail}</p>
            </div>
            {active && (
              <span
                aria-hidden
                className={`absolute inset-x-0 bottom-0 h-0.5 ${
                  state === "error" ? "bg-bad" : "bg-ink"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
