import type { Holder } from '../engine';

const FOUNDERS = ['#5FE3FF', '#3B82F6', '#818CF8', '#22D3EE', '#60A5FA'];
const INVESTORS = ['#F5B547', '#F472B6', '#34D399', '#FB923C', '#C084FC', '#A3E635'];
export const POOL_COLOR = '#64748B';
export const BUYER_COLOR = '#F87171';

/** Color estable por socio: fundadores en azules/cian, inversores en tonos cálidos. */
export function holderColors(holders: Holder[]): Record<string, string> {
  const out: Record<string, string> = { pool: POOL_COLOR, __comprador: BUYER_COLOR };
  let f = 0;
  let i = 0;
  for (const h of holders) {
    if (h.role === 'pool') out[h.id] = POOL_COLOR;
    else if (h.role === 'fundador') out[h.id] = FOUNDERS[f++ % FOUNDERS.length];
    else out[h.id] = INVESTORS[i++ % INVESTORS.length];
  }
  return out;
}

export const ROLE_LABEL: Record<Holder['role'], string> = {
  fundador: 'Fundador/a',
  inversor: 'Inversor',
  empleado: 'Empleado/a',
  pool: 'Pool',
};
