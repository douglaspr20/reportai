"use client";

import { useState } from "react";
import DocumentChat from "@/components/DocumentChat";
import DocumentList from "@/components/DocumentList";
import FileDropzone from "@/components/FileDropzone";
import Pipeline, { type Stage } from "@/components/Pipeline";

export default function Workspace() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [stage, setStage] = useState<Stage>("vacio");
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  return (
    <main id="top" className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
      <div id="revision" className="flex flex-col gap-5">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-balance text-fg sm:text-2xl">
            Del documento al dato, con su fuente
          </h1>
          <p className="max-w-[68ch] text-sm leading-relaxed text-fg-2">
            Sube una factura, un recibo o un contrato — en imagen o PDF — y el modelo lo
            clasifica y extrae sus datos en JSON. Revísalos antes de guardarlos y luego
            pregunta: cada respuesta cita el documento del que sale.
          </p>
        </header>

        <Pipeline stage={stage} />

        <FileDropzone
          onStageChange={setStage}
          onSaved={(id) => {
            setLastSavedId(id);
            setRefreshKey((key) => key + 1);
          }}
        />
      </div>

      <DocumentList refreshKey={refreshKey} highlightId={lastSavedId} />
      <DocumentChat />
    </main>
  );
}
