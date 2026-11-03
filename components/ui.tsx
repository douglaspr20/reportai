import type { ReactNode } from "react";

// Vocabulario común de controles: mismo alto, radio y estados en toda la página.

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const sizes = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-[13px]",
  lg: "h-9 px-4 text-[13px]",
};

const variants = {
  primary: "bg-ink text-ink-fg hover:bg-ink-hover",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg",
};

export function buttonClass(
  variant: keyof typeof variants = "secondary",
  size: keyof typeof sizes = "md",
  extra = ""
) {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`;
}

export function Panel({
  children,
  className = "",
  as: Tag = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
  id?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <Tag className={`rounded-xl border border-line bg-surface ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-3.5 animate-spin rounded-full border-[1.5px] border-line-strong border-t-fg-2 ${className}`}
    />
  );
}

export function Notice({
  tone,
  children,
  className = "",
}: {
  tone: "bad" | "warn" | "ok";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    bad: "bg-bad-soft text-bad",
    warn: "bg-warn-soft text-warn",
    ok: "bg-ok-soft text-ok",
  };
  return (
    <p
      role={tone === "bad" ? "alert" : "status"}
      className={`rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${tones[tone]} ${className}`}
    >
      {children}
    </p>
  );
}

/** Valor ausente: el modelo devolvió null. Se enseña tal cual, sin rellenar. */
export function Null() {
  return (
    <span className="font-mono text-xs text-fg-3" title="El modelo devolvió null: no aparece o no es legible">
      null
    </span>
  );
}
