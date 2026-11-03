"use client";

import type { ReactNode } from "react";
import type { Analysis } from "@/lib/analysis";
import { formatAmount, formatDate, formatNumber, formatPercent } from "@/lib/format";
import { Null } from "@/components/ui";

// Vista legible de la extracción. Muestra lo que devolvió el modelo tal cual:
// los null se ven como null, no se rellenan ni se esconden.

function Value({ children }: { children: ReactNode | null }) {
  return children === null || children === undefined || children === "" ? <Null /> : <>{children}</>;
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold text-fg-2">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Fields({ rows }: { rows: [string, ReactNode | null][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line pb-2.5 sm:block sm:border-0 sm:pb-0">
          <dt className="shrink-0 text-xs text-fg-3">{label}</dt>
          <dd className="min-w-0 truncate text-right text-[13px] text-fg sm:mt-0.5 sm:text-left">
            <Value>{value}</Value>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Party({ title, party }: { title: string; party: Analysis["emisor"] }) {
  return (
    <div className="min-w-0 py-3 first:pt-0 last:pb-0 sm:py-0 sm:last:pl-6">
      <p className="text-xs text-fg-3">{title}</p>
      {party ? (
        <>
          <p className="mt-1 truncate text-[13px] font-medium text-fg" title={party.nombre ?? undefined}>
            <Value>{party.nombre}</Value>
          </p>
          <p className="mt-0.5 font-mono text-xs text-fg-2">
            <Value>{party.identificacion_fiscal}</Value>
          </p>
          <p className="mt-1 text-xs leading-snug text-fg-2">
            <Value>{party.direccion}</Value>
          </p>
        </>
      ) : (
        <p className="mt-1">
          <Null />
        </p>
      )}
    </div>
  );
}

function Table({
  head,
  rows,
  align,
}: {
  head: string[];
  rows: (ReactNode | null)[][];
  align: ("left" | "right")[];
}) {
  return (
    <>
      {/* Móvil: cada fila apilada, con sus importes bajo la descripción */}
      <ul className="divide-y divide-line rounded-lg border border-line sm:hidden">
        {rows.map((row, r) => (
          <li key={r} className="flex flex-col gap-1.5 px-3 py-2.5">
            <span className="text-[13px] text-fg">
              <Value>{row[0]}</Value>
            </span>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              {row.slice(1).map((cell, i) => (
                <span key={i} className="flex items-baseline gap-1.5 text-xs">
                  <span className="text-fg-3">{head[i + 1]}</span>
                  <span className={`tnum font-mono ${i === row.length - 2 ? "font-medium text-fg" : "text-fg-2"}`}>
                    <Value>{cell}</Value>
                  </span>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    <div className="scroll-thin hidden overflow-x-auto rounded-lg border border-line sm:block">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-surface-2 text-xs text-fg-3">
            {head.map((label, i) => (
              <th
                key={label}
                scope="col"
                className={`px-3 py-2 font-medium ${align[i] === "right" ? "text-right" : "text-left"}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`px-3 py-2 align-top ${
                    align[i] === "right" ? "tnum whitespace-nowrap text-right font-mono text-xs" : "text-fg"
                  }`}
                >
                  <Value>{cell}</Value>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export function confidenceTone(value: number) {
  return value >= 0.8 ? "text-ok" : value >= 0.5 ? "text-warn" : "text-bad";
}

export function Confidence({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-fg-3" title="Seguridad de la clasificación según el modelo">
      Confianza
      <span className={`tnum font-mono font-medium ${confidenceTone(value)}`}>{formatPercent(value)}</span>
    </span>
  );
}

export function FieldsView({ analysis }: { analysis: Analysis }) {
  const a = analysis;
  const money = (value: number | null) => formatAmount(value, a.moneda);
  const isContract = a.tipo_documento === "contrato";
  const hasMoney =
    !isContract || a.total !== null || a.subtotal !== null || a.lineas.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-[-0.01em] text-fg">
              {(isContract ? a.partes_contrato.join(" · ") : a.emisor?.nombre) || "Sin emisor identificado"}
            </p>
            <p className="mt-0.5 font-mono text-xs text-fg-3">
              {a.numero_documento ?? "sin número"}
              {a.fecha_emision && ` · ${formatDate(a.fecha_emision)}`}
            </p>
          </div>
          {a.total !== null && (
            <p className="tnum font-mono text-xl font-semibold tracking-[-0.02em] text-fg">{money(a.total)}</p>
          )}
        </div>
        <p className="text-[13px] leading-relaxed text-fg-2">{a.resumen}</p>
      </div>

      <Section title="Documento">
        <Fields
          rows={[
            ["Número", a.numero_documento && <span className="font-mono text-xs">{a.numero_documento}</span>],
            ["Fecha de emisión", formatDate(a.fecha_emision)],
            ...(isContract
              ? ([
                  ["Vigencia desde", formatDate(a.vigencia_inicio)],
                  ["Vigencia hasta", formatDate(a.vigencia_fin)],
                ] as [string, ReactNode | null][])
              : ([
                  ["Vencimiento", formatDate(a.fecha_vencimiento)],
                  ["Método de pago", a.metodo_pago],
                ] as [string, ReactNode | null][])),
            ["Moneda", a.moneda && <span className="font-mono text-xs">{a.moneda}</span>],
            ["Idioma", a.idioma],
          ]}
        />
      </Section>

      {isContract ? (
        <Section title="Partes" aside={<span className="tnum text-xs text-fg-3">{a.partes_contrato.length}</span>}>
          {a.partes_contrato.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {a.partes_contrato.map((parte, i) => (
                <li key={i} className="rounded-lg bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg">
                  {parte}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-fg-3">El modelo no identificó partes.</p>
          )}
        </Section>
      ) : (
        <Section title="Emisor y receptor">
          <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <Party title="Emisor" party={a.emisor} />
            <Party title="Receptor" party={a.receptor} />
          </div>
        </Section>
      )}

      {a.lineas.length > 0 && (
        <Section title="Líneas" aside={<span className="tnum text-xs text-fg-3">{a.lineas.length}</span>}>
          <Table
            head={["Descripción", "Cant.", "Precio", "Importe"]}
            align={["left", "right", "right", "right"]}
            rows={a.lineas.map((linea) => [
              linea.descripcion,
              formatNumber(linea.cantidad),
              money(linea.precio_unitario),
              money(linea.importe),
            ])}
          />
        </Section>
      )}

      {a.impuestos_detalle.length > 0 && (
        <Section title="Impuestos">
          <Table
            head={["Concepto", "%", "Base", "Importe"]}
            align={["left", "right", "right", "right"]}
            rows={a.impuestos_detalle.map((tax) => [
              tax.concepto,
              tax.porcentaje === null ? null : `${formatNumber(tax.porcentaje)} %`,
              money(tax.base_imponible),
              money(tax.importe),
            ])}
          />
        </Section>
      )}

      {hasMoney && (
        <Section title="Importes">
          <dl className="ml-auto flex w-full max-w-xs flex-col gap-1.5 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-2">Subtotal</dt>
              <dd className="tnum font-mono text-xs leading-5"><Value>{money(a.subtotal)}</Value></dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-2">Impuestos</dt>
              <dd className="tnum font-mono text-xs leading-5"><Value>{money(a.impuestos_total)}</Value></dd>
            </div>
            <div className="mt-1 flex justify-between gap-4 border-t border-line pt-2.5">
              <dt className="font-medium text-fg">Total</dt>
              <dd className="tnum font-mono text-sm font-semibold text-fg"><Value>{money(a.total)}</Value></dd>
            </div>
          </dl>
        </Section>
      )}

      {isContract && (
        <Section title="Cláusulas clave" aside={<span className="tnum text-xs text-fg-3">{a.clausulas_clave.length}</span>}>
          {a.clausulas_clave.length > 0 ? (
            <ol className="flex flex-col gap-2 text-[13px] leading-relaxed text-fg">
              {a.clausulas_clave.map((clausula, i) => (
                <li key={i} className="flex gap-3">
                  <span className="tnum w-4 shrink-0 text-right font-mono text-xs leading-[1.6rem] text-fg-3">{i + 1}</span>
                  <span>{clausula}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-fg-3">El modelo no extrajo cláusulas.</p>
          )}
        </Section>
      )}
    </div>
  );
}

/** JSON con color para claves, textos, números y null. */
export function JsonView({ value }: { value: unknown }) {
  const json = JSON.stringify(value, null, 2);
  const tokens = json.split(/("(?:\\.|[^"\\])*"(?:\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\bnull\b|\btrue\b|\bfalse\b)/g);
  return (
    <pre className="whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-4 font-mono text-xs leading-relaxed text-fg-2">
      <code>
        {tokens.map((token, i) => {
          if (i % 2 === 0) return token;
          const cls = token.endsWith(":")
            ? "text-fg"
            : token.startsWith('"')
              ? "text-ok"
              : token === "null"
                ? "text-fg-3 italic"
                : "text-accent-fg";
          return (
            <span key={i} className={cls}>
              {token}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

export function FieldsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2">
        <span className="skeleton h-3.5 w-11/12" />
        <span className="skeleton h-3.5 w-2/3" />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <span className="skeleton h-2.5 w-16" />
            <span className="skeleton h-3.5 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <span className="skeleton h-20" />
        <span className="skeleton h-20" />
      </div>
      <div className="ml-auto flex w-full max-w-xs flex-col gap-2">
        <span className="skeleton h-3 w-full" />
        <span className="skeleton h-3 w-full" />
        <span className="skeleton h-4 w-full" />
      </div>
    </div>
  );
}
