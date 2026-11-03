"use client";

import { useEffect, useState } from "react";

type Health =
  | { status: "loading" }
  | { status: "ok"; pgvector: string | null }
  | { status: "down" };

const LINKS = [
  { href: "#revision", label: "Revisión" },
  { href: "#registro", label: "Registro" },
  { href: "#preguntar", label: "Preguntar" },
];

/** Estado real de Postgres y pgvector, leído de /api/health. */
function HealthStatus() {
  const [health, setHealth] = useState<Health>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        setHealth(
          response.ok && data.database === "ok"
            ? { status: "ok", pgvector: data.pgvector ?? null }
            : { status: "down" }
        );
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setHealth({ status: "down" });
      });
    return () => controller.abort();
  }, []);

  const dot =
    health.status === "ok" ? "bg-ok" : health.status === "down" ? "bg-bad" : "bg-line-strong";
  const label =
    health.status === "ok"
      ? `Postgres${health.pgvector ? ` · pgvector ${health.pgvector}` : ""}`
      : health.status === "down"
        ? "Base de datos sin conexión"
        : "Comprobando base de datos…";

  return (
    <span
      className="inline-flex h-7 items-center gap-2 rounded-full border border-line bg-surface px-2.5 text-xs text-fg-2"
      role="status"
      title={health.status === "down" ? "Arráncala con npm run db:up" : undefined}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      <span className="font-mono text-[11px] tracking-tight">{label}</span>
    </span>
  );
}

export default function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-sm supports-[backdrop-filter]:bg-bg/75">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 px-4 sm:px-6">
        <a href="#top" className="text-[15px] font-semibold tracking-[-0.02em] text-fg">
          report<span className="text-fg-3">Ai</span>
        </a>
        <nav aria-label="Secciones" className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-1.5 text-[13px] text-fg-2 transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto">
          <HealthStatus />
        </div>
      </div>
    </header>
  );
}
