// Formateo para la interfaz (es-ES). Sin dependencias de servidor.

const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Fecha ISO (YYYY-MM-DD) como fecha local; si no es válida, el texto tal cual. */
export function formatDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
}

export function formatDateTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTimeFormat.format(date);
}

/** Importe con su moneda; si la moneda no es un código ISO válido, se pinta al lado. */
export function formatAmount(value: number | string | null, currency: string | null) {
  if (value === null || value === "") return null;
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  try {
    if (currency) {
      return new Intl.NumberFormat("es-ES", { style: "currency", currency, useGrouping: "always" }).format(number);
    }
  } catch {
    // Moneda que no es un código ISO válido.
  }
  const plain = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, useGrouping: "always" }).format(number);
  return currency ? `${plain} ${currency}` : plain;
}

export function formatNumber(value: number | null) {
  if (value === null) return null;
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 4, useGrouping: "always" }).format(value);
}

export function formatPercent(ratio: number) {
  return `${Math.round(ratio * 100)} %`;
}
