import type { ReactNode } from 'react';

export function Card({ title, subtitle, actions, children, className = '' }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'ok' | 'bad' | 'accent' }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Badge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <span className={`badge ${ok ? 'badge-ok' : 'badge-bad'}`}>{ok ? '✓' : '✕'} {children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Entrada numérica con sufijo. `scale` permite editar porcentajes guardados como 0..1. */
export function NumInput({ value, onChange, suffix, step = 1, min = 0, max, scale = 1, decimals = 3 }: {
  value: number; onChange: (v: number) => void; suffix?: string; step?: number; min?: number; max?: number; scale?: number; decimals?: number;
}) {
  const f = 10 ** decimals;
  const shown = Math.round(value * scale * f) / f;
  return (
    <span className="num-input">
      <input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(shown) ? shown : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v / scale : 0);
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </span>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden><span className="toggle-thumb" /></span>
      <span>{label}</span>
    </label>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
}

/** Barra doble: % económico frente a % de voto. */
export function SplitBar({ econ, vote, color }: { econ: number; vote: number; color: string }) {
  return (
    <div className="splitbar">
      <div className="splitbar-row"><span>Eco.</span><div className="track"><div style={{ width: `${econ * 100}%`, background: color, opacity: 0.55 }} /></div></div>
      <div className="splitbar-row"><span>Voto</span><div className="track"><div style={{ width: `${vote * 100}%`, background: color }} /></div></div>
    </div>
  );
}
