import { describe, expect, it } from 'vitest';
import { demoScenario } from '../data/demo';
import {
  capTable, computeScenario, controlStatus, maxSellable, priceRound, MAYORIA_REFORZADA,
  MAYORIA_ORDINARIA, vestedAt, waterfall,
} from './index';
import type { Governance, Holder, ShareClass, Snapshot } from './types';

const round = (preMoney: number, amount: number, poolTargetPct = 0, poolTiming: 'pre' | 'post' = 'pre') => ({
  preMoney, investments: [{ holderId: 'i', amount }], poolTargetPct, poolTiming,
});

describe('rondas', () => {
  it('calcula precio, participaciones nuevas y post-money', () => {
    const r = priceRound(10000, 0, round(1_000_000, 250_000), []);
    expect(r.price).toBeCloseTo(100);
    expect(r.invShares).toBeCloseTo(2500);
    expect(r.postShares).toBeCloseTo(12500);
  });

  it('pool pre-money: diluye solo a los socios previos', () => {
    const r = priceRound(9000, 0, round(1_000_000, 250_000, 0.1, 'pre'), []);
    expect(r.poolNew / r.postShares).toBeCloseTo(0.1, 6);
    expect(r.invShares / r.postShares).toBeCloseTo(0.2, 6);
    expect(9000 / r.postShares).toBeCloseTo(0.7, 6);
  });

  it('pool post-money: diluye también al inversor', () => {
    const r = priceRound(9000, 0, round(1_000_000, 250_000, 0.1, 'post'), []);
    expect(r.poolNew / r.postShares).toBeCloseTo(0.1, 6);
    expect(r.invShares / r.postShares).toBeCloseTo(0.18, 6);
  });

  it('tiene en cuenta el pool que ya existe', () => {
    const r = priceRound(10000, 1000, round(1_000_000, 250_000, 0.1, 'pre'), []);
    expect((r.poolNew + 1000) / r.postShares).toBeCloseTo(0.1, 6);
  });
});

describe('notas convertibles', () => {
  it('convierte al cap cuando es más favorable que el descuento', () => {
    const r = priceRound(10000, 0, round(3_000_000, 500_000), [{ amount: 150_000, discount: 0.2, cap: 1_500_000 }]);
    expect(r.price).toBeCloseTo(300);
    expect(r.noteSharePrices[0]).toBeCloseTo(150);
    expect(r.noteShares[0]).toBeCloseTo(1000);
  });

  it('convierte con descuento cuando el cap no aplica', () => {
    const r = priceRound(10000, 0, round(3_000_000, 500_000), [{ amount: 150_000, discount: 0.2, cap: 5_000_000 }]);
    expect(r.noteSharePrices[0]).toBeCloseTo(240);
    expect(r.noteShares[0]).toBeCloseTo(625);
  });
});

describe('escenario demo', () => {
  const s = demoScenario();
  const res = computeScenario(s);

  it('los porcentajes económicos y de voto suman 100 %', () => {
    const rows = capTable(res.final, s.holders, s.governance);
    expect(rows.reduce((a, r) => a + r.econPct, 0)).toBeCloseTo(1, 9);
    expect(rows.reduce((a, r) => a + r.votePct, 0)).toBeCloseTo(1, 9);
  });

  it('la nota se convierte en la seed y la secundaria no cambia el total de participaciones', () => {
    const seedStep = res.steps.find((st) => st.eventId === 'e3')!;
    expect(seedStep.conversions?.[0].shares).toBeGreaterThan(0);
    const before = Object.values(res.snapshots[3].holdings).reduce((a, b) => a + b, 0);
    const after = Object.values(res.final.holdings).reduce((a, b) => a + b, 0);
    expect(after).toBe(before);
    expect(res.steps[4].sold).toBe(1000);
  });

  it('el pool no vota', () => {
    const rows = capTable(res.final, s.holders, s.governance);
    const pool = rows.find((r) => r.holderId === 'pool')!;
    expect(pool.econPct).toBeGreaterThan(0);
    expect(pool.votes).toBe(0);
  });
});

// Cap table mínimo para probar voto, control y waterfall.
const classes: Record<string, ShareClass> = {
  ord: { id: 'ord', name: 'Ordinarias', votesPerShare: 1, liqMultiple: 0, participating: false, issuePrice: 0, order: 0 },
  sinVoto: { id: 'sinVoto', name: 'Sin voto', votesPerShare: 0, liqMultiple: 0, participating: false, issuePrice: 0, order: 1 },
  A: { id: 'A', name: 'Serie A', votesPerShare: 1, liqMultiple: 1, participating: false, issuePrice: 1000, order: 2 },
};
const holders: Holder[] = [
  { id: 'f1', name: 'F1', role: 'fundador' },
  { id: 'f2', name: 'F2', role: 'fundador' },
  { id: 'inv', name: 'Inv', role: 'inversor' },
];
const gov: Governance = { votoPlural: 1, sindicacion: true, vetoMatters: [] };
const snap = (h: Record<string, number>, c = classes): Snapshot => ({ eventId: 'x', label: 'x', holdings: h, classes: c });

describe('% económico frente a % de voto', () => {
  it('las participaciones sin voto cuentan en lo económico pero no votan', () => {
    const rows = capTable(snap({ 'f1|ord': 600, 'inv|sinVoto': 400 }), holders, gov);
    expect(rows.find((r) => r.holderId === 'inv')!.econPct).toBeCloseTo(0.4);
    expect(rows.find((r) => r.holderId === 'f1')!.votePct).toBeCloseTo(1);
  });

  it('el voto plural multiplica el voto de los fundadores', () => {
    const rows = capTable(snap({ 'f1|ord': 400, 'inv|ord': 600 }), holders, { ...gov, votoPlural: 3 });
    expect(rows.find((r) => r.holderId === 'f1')!.votePct).toBeCloseTo(1200 / 1800);
  });

  it('sin sindicación solo cuenta el mayor fundador', () => {
    const s = snap({ 'f1|ord': 400, 'f2|ord': 300, 'inv|ord': 300 });
    expect(controlStatus(s, holders, gov).blocVotePct).toBeCloseTo(0.7);
    expect(controlStatus(s, holders, { ...gov, sindicacion: false }).blocVotePct).toBeCloseTo(0.4);
  });
});

describe('máximo vendible manteniendo el control', () => {
  const s = snap({ 'f1|ord': 700, 'inv|ord': 300 });

  it('venta de ordinarias: mayoría ordinaria y reforzada', () => {
    expect(maxSellable(s, holders, gov, 'ordinarias', MAYORIA_ORDINARIA).shares).toBe(199);
    expect(maxSellable(s, holders, gov, 'ordinarias', MAYORIA_REFORZADA).shares).toBe(33);
  });

  it('venta sin voto permite vender más', () => {
    expect(maxSellable(s, holders, gov, 'sinVoto', MAYORIA_ORDINARIA).shares).toBe(399);
  });

  it('el límite legal del 50 % sin voto frena la venta', () => {
    const big = snap({ 'f1|ord': 900, 'inv|ord': 100 });
    const r = maxSellable(big, holders, gov, 'sinVoto', MAYORIA_ORDINARIA);
    expect(r.shares).toBe(500);
    expect(r.limitedBy).toBe('legal');
  });

  it('el voto plural amplía el margen', () => {
    expect(maxSellable(s, holders, { ...gov, votoPlural: 3 }, 'ordinarias', MAYORIA_ORDINARIA).shares).toBe(449);
  });

  it('si ya no hay control, no se puede vender nada', () => {
    const r = maxSellable(snap({ 'f1|ord': 400, 'inv|ord': 600 }), holders, gov, 'ordinarias', MAYORIA_ORDINARIA);
    expect(r).toEqual({ shares: 0, limitedBy: 'sinControl' });
  });
});

describe('waterfall', () => {
  // Inversor: 1.000 participaciones a 1.000 € (1 M€), 20 % del capital.
  const s = snap({ 'f1|ord': 4000, 'inv|A': 1000 });

  it('salida baja: el inversor cobra su preferencia 1x', () => {
    const w = waterfall(s, 2_000_000);
    expect(w.byHolder.inv).toBeCloseTo(1_000_000);
    expect(w.byHolder.f1).toBeCloseTo(1_000_000);
  });

  it('salida alta: el inversor no participativo convierte', () => {
    const w = waterfall(s, 10_000_000);
    expect(w.converted).toContain('A');
    expect(w.byHolder.inv).toBeCloseTo(2_000_000);
  });

  it('participativa: cobra preferencia y además participa', () => {
    const p = snap({ 'f1|ord': 4000, 'inv|A': 1000 }, { ...classes, A: { ...classes.A, participating: true } });
    const w = waterfall(p, 2_000_000);
    expect(w.byHolder.inv).toBeCloseTo(1_200_000);
  });

  it('salida por debajo de la preferencia: todo para el preferente', () => {
    const w = waterfall(s, 600_000);
    expect(w.byHolder.inv).toBeCloseTo(600_000);
    expect(w.byHolder.f1 ?? 0).toBeCloseTo(0);
  });

  it('el reparto siempre suma el precio de venta', () => {
    for (const v of [0, 500_000, 3_000_000, 50_000_000]) {
      const w = waterfall(s, v);
      expect(Object.values(w.byHolder).reduce((a, b) => a + b, 0)).toBeCloseTo(v, 3);
    }
  });
});

describe('vesting', () => {
  it('respeta el cliff y consolida linealmente', () => {
    expect(vestedAt(4800, 48, 12, 11)).toBe(0);
    expect(vestedAt(4800, 48, 12, 12)).toBe(1200);
    expect(vestedAt(4800, 48, 12, 30)).toBe(3000);
    expect(vestedAt(4800, 48, 12, 60)).toBe(4800);
  });
});
