const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const num0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export const eur = (v: number) => eur0.format(v);
export const eurPrecise = (v: number) => eur2.format(v);
export const num = (v: number) => num0.format(v);
export const pct = (v: number, d = 1) => `${(v * 100).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;

/** Formato compacto para ejes: 1,2 M€ · 350 k€. */
export function eurShort(v: number) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString('es-ES', { maximumFractionDigits: 0 })} k€`;
  return `${Math.round(v)} €`;
}

export const uid = () => Math.random().toString(36).slice(2, 9);
