import { capTable, MAX_NON_VOTING_SHARE, nonVotingRatio, POOL_ID } from './captable';
import { add, sharesOf } from './holdings';
import type { Governance, Holder, SaleStructure, Snapshot } from './types';

export const MAYORIA_ORDINARIA = 0.5;
export const MAYORIA_REFORZADA = 2 / 3;
export const BUYER_ID = '__comprador';

/** Mayoría ordinaria: más de la mitad. Resto de umbrales: igual o superior. */
export function meets(pct: number, threshold: number) {
  return threshold <= 0.5 ? pct > threshold + 1e-12 : pct >= threshold - 1e-9;
}

/** Fundadores cuyo voto cuenta como bloque: todos con sindicación, o solo el mayor sin ella. */
export function blocIds(snap: Snapshot, holders: Holder[], gov: Governance): string[] {
  const founders = holders.filter((h) => h.role === 'fundador').map((h) => h.id);
  if (gov.sindicacion || founders.length <= 1) return founders;
  const rows = capTable(snap, holders, gov);
  let best = founders[0];
  let bestVotes = -1;
  for (const r of rows) {
    if (founders.includes(r.holderId) && r.votes > bestVotes) {
      best = r.holderId;
      bestVotes = r.votes;
    }
  }
  return [best];
}

export interface ControlStatus {
  bloc: string[];
  blocVotePct: number;
  blocEconPct: number;
  ordinaria: boolean;
  reforzada: boolean;
  vetoes: { id: string; name: string; threshold: number; foundersPass: boolean }[];
}

export function controlStatus(snap: Snapshot, holders: Holder[], gov: Governance): ControlStatus {
  const bloc = blocIds(snap, holders, gov);
  const rows = capTable(snap, holders, gov);
  const inBloc = rows.filter((r) => bloc.includes(r.holderId));
  const blocVotePct = inBloc.reduce((a, r) => a + r.votePct, 0);
  const blocEconPct = inBloc.reduce((a, r) => a + r.econPct, 0);
  return {
    bloc,
    blocVotePct,
    blocEconPct,
    ordinaria: meets(blocVotePct, MAYORIA_ORDINARIA),
    reforzada: meets(blocVotePct, MAYORIA_REFORZADA),
    vetoes: gov.vetoMatters.map((m) => ({
      ...m,
      // Si el bloque no llega solo al umbral, el resto de socios puede bloquear la decisión.
      foundersPass: meets(blocVotePct, m.threshold),
    })),
  };
}

/** Aplica una venta secundaria repartida a prorrata entre los fundadores del bloque. */
export function simulateSale(
  snap: Snapshot, holders: Holder[], gov: Governance, shares: number, structure: SaleStructure,
): Snapshot {
  const bloc = blocIds(snap, holders, gov);
  const holdings = { ...snap.holdings };
  const avail = bloc.map((id) => sharesOf(holdings, id, 'ord'));
  const total = avail.reduce((a, b) => a + b, 0);
  const x = Math.min(Math.max(0, Math.round(shares)), total);
  if (total <= 0 || x <= 0) return { ...snap, holdings };
  let left = x;
  bloc.forEach((id, i) => {
    const take = i === bloc.length - 1 ? left : Math.min(left, Math.round((x * avail[i]) / total));
    add(holdings, id, 'ord', -take);
    add(holdings, BUYER_ID, structure === 'sinVoto' ? 'sinVoto' : 'ord', take);
    left -= take;
  });
  return { ...snap, holdings };
}

export function blocOrdinaryShares(snap: Snapshot, holders: Holder[], gov: Governance) {
  return blocIds(snap, holders, gov).reduce((a, id) => a + sharesOf(snap.holdings, id, 'ord'), 0);
}

export interface SellLimit {
  shares: number;
  /** Qué frena la venta: perder el umbral, el límite legal de sin voto o vender todo. */
  limitedBy: 'control' | 'legal' | 'todo' | 'sinControl';
}

/** Máximo de participaciones que el bloque puede vender conservando el umbral indicado. */
export function maxSellable(
  snap: Snapshot, holders: Holder[], gov: Governance, structure: SaleStructure, threshold: number,
): SellLimit {
  const buyer: Holder = { id: BUYER_ID, name: 'Comprador', role: 'inversor' };
  const hs = [...holders, buyer];
  const blocVote = (x: number) => {
    const s = simulateSale(snap, hs, gov, x, structure);
    return controlStatus(s, hs, gov).blocVotePct;
  };
  const okLegal = (x: number) =>
    structure !== 'sinVoto' || nonVotingRatio(simulateSale(snap, hs, gov, x, structure).holdings) <= MAX_NON_VOTING_SHARE + 1e-12;

  const total = blocOrdinaryShares(snap, holders, gov);
  if (!meets(blocVote(0), threshold)) return { shares: 0, limitedBy: 'sinControl' };
  const pred = (x: number) => meets(blocVote(x), threshold) && okLegal(x);
  if (pred(total)) return { shares: total, limitedBy: 'todo' };
  let lo = 0;
  let hi = total;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (pred(mid)) lo = mid;
    else hi = mid;
  }
  const limitedBy = meets(blocVote(hi), threshold) && !okLegal(hi) ? 'legal' : 'control';
  return { shares: lo, limitedBy };
}

export interface StructureOption {
  id: string;
  name: string;
  description: string;
  structure: SaleStructure;
  votoPlural: number;
  sindicacion: boolean;
}

/** Combinaciones de estructuras que se comparan en el simulador de control. */
export function structureOptions(plural: number): StructureOption[] {
  const options: StructureOption[] = [
    {
      id: 'base', name: 'Venta de ordinarias', structure: 'ordinarias', votoPlural: 1, sindicacion: false,
      description: 'Sin estructura: el voto viaja con la participación y cada fundador vota por su cuenta.',
    },
    {
      id: 'sind', name: 'Pacto de sindicación', structure: 'ordinarias', votoPlural: 1, sindicacion: true,
      description: 'Los fundadores votan en bloque según lo decidido entre ellos.',
    },
    {
      id: 'sinvoto', name: 'Sindicación + sin voto', structure: 'sinVoto', votoPlural: 1, sindicacion: true,
      description: 'Se venden participaciones sin voto (máx. 50 % del capital, art. 98 LSC).',
    },
    {
      id: 'plural', name: `Sindicación + voto plural ×${plural}`, structure: 'ordinarias', votoPlural: plural, sindicacion: true,
      description: 'Los estatutos dan más votos a las participaciones de fundador (art. 188 LSC).',
    },
    {
      id: 'todo', name: `Sin voto + voto plural ×${plural}`, structure: 'sinVoto', votoPlural: plural, sindicacion: true,
      description: 'Combinación máxima: venden sin voto y conservan voto reforzado en lo que no venden.',
    },
  ];
  return options.map((o) => ({ ...o, votoPlural: Math.max(1, o.votoPlural) }));
}

export { POOL_ID };
