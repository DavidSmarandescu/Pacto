export interface VestingPoint {
  month: number;
  date: string;
  vested: number;
  pct: number;
}

function addMonths(iso: string, m: number) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 7);
}

/** Consolidación lineal mensual con cliff: nada antes del cliff y el tramo acumulado al llegar. */
export function vestedAt(total: number, months: number, cliff: number, month: number) {
  if (months <= 0) return total;
  if (month < cliff) return 0;
  return Math.round((total * Math.min(month, months)) / months);
}

export function vestingSchedule(total: number, months: number, cliff: number, start: string): VestingPoint[] {
  const horizon = Math.max(months, 1);
  const out: VestingPoint[] = [];
  for (let m = 0; m <= horizon; m++) {
    const vested = vestedAt(total, months, cliff, m);
    out.push({ month: m, date: addMonths(start, m), vested, pct: total > 0 ? vested / total : 0 });
  }
  return out;
}
