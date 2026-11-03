const TYPES: Record<string, { label: string; color: string }> = {
  factura: { label: "Factura", color: "var(--t-factura)" },
  recibo: { label: "Recibo", color: "var(--t-recibo)" },
  contrato: { label: "Contrato", color: "var(--t-contrato)" },
  otro: { label: "Otro", color: "var(--t-otro)" },
};

export function typeColor(type: string) {
  return (TYPES[type] ?? TYPES.otro).color;
}

export default function TypeBadge({ type }: { type: string }) {
  const { label, color } = TYPES[type] ?? { label: type, color: TYPES.otro.color };
  return (
    <span
      className="inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
