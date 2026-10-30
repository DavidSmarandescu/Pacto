import type { Scenario } from '../engine';

export const DEMO_ID = 'demo';

export function demoScenario(): Scenario {
  return {
    id: DEMO_ID,
    name: 'Demo · Rumbo Labs',
    company: 'Rumbo Labs, S.L.',
    holders: [
      { id: 'lucia', name: 'Lucía Ferrer', role: 'fundador' },
      { id: 'marcos', name: 'Marcos Gil', role: 'fundador' },
      { id: 'ana', name: 'Ana Ruiz', role: 'fundador' },
      { id: 'angels', name: 'Club de Angels', role: 'inversor' },
      { id: 'seed', name: 'Faro Seed Fund', role: 'inversor' },
      { id: 'norte', name: 'Norte Ventures', role: 'inversor' },
      { id: 'pool', name: 'Pool de opciones', role: 'pool' },
    ],
    events: [
      {
        id: 'e1', type: 'constitucion', name: 'Constitución', date: '2024-02-01',
        holdings: [
          { holderId: 'lucia', shares: 5000 },
          { holderId: 'marcos', shares: 4000 },
          { holderId: 'ana', shares: 1000 },
        ],
      },
      {
        id: 'e2', type: 'nota', name: 'Préstamo convertible presemilla', date: '2024-09-15',
        holderId: 'angels', amount: 150000, discount: 0.2, cap: 1500000,
      },
      {
        id: 'e3', type: 'ronda', name: 'Seed', date: '2025-04-10', preMoney: 2500000,
        investments: [{ holderId: 'seed', amount: 600000 }],
        poolTargetPct: 0.1, poolTiming: 'pre', liqMultiple: 1, participating: false,
      },
      {
        id: 'e4', type: 'ronda', name: 'Serie A', date: '2026-06-01', preMoney: 12000000,
        investments: [
          { holderId: 'norte', amount: 3000000 },
          { holderId: 'seed', amount: 500000 },
        ],
        poolTargetPct: 0.12, poolTiming: 'pre', liqMultiple: 1, participating: false,
      },
      {
        id: 'e5', type: 'secundaria', name: 'Venta secundaria fundadores', date: '2026-06-01',
        sellers: [
          { holderId: 'lucia', shares: 600 },
          { holderId: 'marcos', shares: 400 },
        ],
        buyerId: 'norte', pricePerShare: 600, structure: 'sinVoto',
      },
    ],
    governance: {
      votoPlural: 1,
      sindicacion: true,
      vetoMatters: [
        { id: 'v1', name: 'Aprobar cuentas y nombrar administradores', threshold: 0.5 },
        { id: 'v2', name: 'Ampliar capital o modificar estatutos', threshold: 0.5 },
        { id: 'v3', name: 'Fusión, escisión o transformación', threshold: 2 / 3 },
        { id: 'v4', name: 'Vender la compañía (pacto de socios)', threshold: 0.75 },
      ],
    },
    vesting: [
      { holderId: 'lucia', months: 48, cliffMonths: 12, start: '2024-02-01' },
      { holderId: 'marcos', months: 48, cliffMonths: 12, start: '2024-02-01' },
      { holderId: 'ana', months: 48, cliffMonths: 12, start: '2024-06-01' },
    ],
  };
}
