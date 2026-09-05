import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

export function Panel({
  title,
  hint,
  action,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {hint && <p className="panel-hint">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  unit,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  tone?: "plain" | "good" | "bad" | "warn";
}) {
  return (
    <div className={`stat stat--${tone}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <em>{unit}</em>}
      </span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn" | "info";
}) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  type = "button",
  disabled,
  full,
  title,
  ariaLabel,
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "quiet";
  type?: "button" | "submit";
  disabled?: boolean;
  full?: boolean;
  title?: string;
  ariaLabel?: string;
  pressed?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className={`btn btn--${variant} ${full ? "btn--full" : ""}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "field--wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Text({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      className="input"
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Num({
  value,
  onChange,
  step = 1,
  min = 0,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  placeholder?: string;
}) {
  return (
    <input
      className="input input--num"
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      value={value === undefined || Number.isNaN(value) ? "" : String(value)}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))
      }
    />
  );
}

export const isNum = (v: number) => typeof v === "number" && Number.isFinite(v);

export function Choice({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select className="input select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal ${wide ? "modal--wide" : ""}`}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="បិទ">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Table({
  head,
  soft = [],
  children,
  dense,
}: {
  head: (string | ReactNode)[];
  /** 1-based column numbers that collapse on very narrow phones. */
  soft?: number[];
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table
        className={`table ${dense ? "table--dense" : ""} ${soft
          .map((n) => `hide-col-${n}`)
          .join(" ")}`}
      >
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** Horizontal bar chart built from divs so the Khmer text never gets clipped. */
export function Bars({
  rows,
  format,
  tone = "moss",
}: {
  rows: { label: string; value: number; hint?: string }[];
  format: (v: number) => string;
  tone?: "moss" | "clay" | "amber";
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={`bars bars--${tone}`}>
      {rows.map((r) => (
        <li key={r.label}>
          <span className="bars-label">{r.label}</span>
          <span className="bars-track">
            <span className="bars-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="bars-value">
            {format(r.value)}
            {r.hint && <em>{r.hint}</em>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Column chart: produced kg, the plan target for the month, and an optional line metric. */
export function Columns({
  rows,
  formatTop,
  labelOf,
}: {
  rows: { key: string; value: number; line?: number; target?: number }[];
  formatTop: (v: number) => string;
  labelOf: (key: string) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.value, r.target ?? 0)));
  const maxLine = Math.max(1, ...rows.map((r) => r.line ?? 0));
  return (
    <div className="cols">
      {rows.map((r) => (
        <div
          className="cols-item"
          key={r.key}
          title={`${labelOf(r.key)} · ផលិត ${formatTop(r.value)}${r.target ? ` · គោលដៅ ${formatTop(r.target)}` : ""}`}
        >
          <span className="cols-line" style={{ height: `${((r.line ?? 0) / maxLine) * 100}%` }} />
          {r.target ? (
            <span className="cols-target" style={{ bottom: `calc(${(r.target / max) * 100}% - 1px)` }} />
          ) : null}
          <span className="cols-bar" style={{ height: `${(r.value / max) * 100}%` }}>
            <b>{r.value ? formatTop(r.value) : ""}</b>
          </span>
          <span className="cols-label">{labelOf(r.key)}</span>
        </div>
      ))}
    </div>
  );
}

/** Sparkline for temperature / moisture history. */
export function Spark({
  points,
  color = "var(--moss)",
  suffix = "",
  bands,
}: {
  points: { x: string; y?: number }[];
  color?: string;
  suffix?: string;
  bands?: { from: number; to: number; tone: string }[];
}) {
  const vals = points.map((p) => p.y).filter((v): v is number => v !== undefined);
  if (vals.length < 2) return <p className="empty">ត្រូវការការវាស់យ៉ាងតិច ២ ដងដើម្បីគូសកែវ</p>;
  const min = Math.min(...vals, ...(bands?.map((b) => b.from) ?? []));
  const max = Math.max(...vals, ...(bands?.map((b) => b.to) ?? []));
  const w = 560;
  const h = 150;
  const px = (i: number) => (i / (points.length - 1)) * w;
  const py = (v: number) => h - ((v - min) / (max - min || 1)) * (h - 18) - 9;
  const d = points
    .map((p, i) => (p.y === undefined ? "" : `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(p.y).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img">
      {bands?.map((b) => (
        <rect
          key={`${b.from}-${b.to}`}
          x={0}
          width={w}
          y={py(b.to)}
          height={Math.max(2, py(b.from) - py(b.to))}
          fill={b.tone}
          opacity={0.16}
        />
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" />
      {points.map((p, i) =>
        p.y === undefined ? null : (
          <circle key={p.x} cx={px(i)} cy={py(p.y)} r={3} fill="var(--paper)" stroke={color} strokeWidth={2} />
        ),
      )}
      <text x={4} y={12} className="spark-axis">
        {max}
        {suffix}
      </text>
      <text x={4} y={h - 3} className="spark-axis">
        {min}
        {suffix}
      </text>
    </svg>
  );
}

/** Windrow temperature strip used on lot cards. */
export function StageTrack({ stages, current }: { stages: string[]; current: number }) {
  return (
    <ol className="track">
      {stages.map((s, i) => (
        <li key={s} className={i < current ? "done" : i === current ? "now" : ""}>
          {s}
        </li>
      ))}
    </ol>
  );
}

export function useDismiss<T>(initial: T | null) {
  const [value, setValue] = useState<T | null>(initial);
  const close = () => setValue(null);
  return { value, setValue, close };
}

export function ScrollTop({ on }: { on: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [on]);
  return <div ref={ref} />;
}

/** Print only the marked zone (labels, purchase list, invoice). */
export function printZone() {
  document.body.classList.add("printing");
  const done = () => {
    document.body.classList.remove("printing");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
  window.setTimeout(done, 4000);
}
