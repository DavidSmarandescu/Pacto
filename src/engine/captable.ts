import { add, key, sharesOf, split, totalShares } from './holdings';
import type {
  CapRow, ConvertibleNote, Governance, Holder, Holdings, Round, Scenario, Secondary,
  ShareClass, Snapshot, StepResult,
} from './types';

export const POOL_ID = 'pool';

export const BASE_CLASSES: Record<string, ShareClass> = {
  ord: { id: 'ord', name: 'Ordinarias', votesPerShare: 1, liqMultiple: 0, participating: false, issuePrice: 0, order: 0 },
  sinVoto: { id: 'sinVoto', name: 'Sin voto', votesPerShare: 0, liqMultiple: 0, participating: false, issuePrice: 0, order: 1 },
};

/** Límite legal de participaciones sin voto en una SL: la mitad del capital (art. 98 LSC). */
export const MAX_NON_VOTING_SHARE = 0.5;

export interface ScenarioResult {
  snapshots: Snapshot[];
  steps: StepResult[];
  final: Snapshot;
}

function roundShares(n: number) {
  return Math.max(0, Math.round(n));
}

/** Calcula el precio de la ronda, la conversión de notas y la ampliación del pool. */
export function priceRound(
  issued: number,
  poolExisting: number,
  round: Pick<Round, 'preMoney' | 'investments' | 'poolTargetPct' | 'poolTiming'>,
  notes: Pick<ConvertibleNote, 'amount' | 'discount' | 'cap'>[],
) {
  const invTotal = round.investments.reduce((a, i) => a + i.amount, 0);
  const t = Math.min(Math.max(round.poolTargetPct, 0), 0.95);
  let poolNew = 0;
  let price = 0;
  let noteShares: number[] = [];
  let noteSharePrices: number[] = [];
  let invShares = 0;

  const solve = (preShares: number) => {
    price = round.preMoney / preShares;
    noteSharePrices = notes.map((n) => {
      const discounted = price * (1 - n.discount);
      const capped = n.cap > 0 ? n.cap / preShares : Infinity;
      return Math.min(discounted, capped);
    });
    noteShares = notes.map((n, i) => n.amount / noteSharePrices[i]);
    invShares = invTotal / price;
  };

  if (issued <= 0 || round.preMoney <= 0) {
    return { price: 0, poolNew: 0, noteShares: notes.map(() => 0), noteSharePrices: notes.map(() => 0), invShares: 0, postShares: issued };
  }

  if (round.poolTiming === 'pre') {
    // Punto fijo: el pool forma parte del pre-money, por lo que su tamaño cambia el precio.
    for (let i = 0; i < 200; i++) {
      solve(issued + poolNew);
      const post = issued + poolNew + noteShares.reduce((a, b) => a + b, 0) + invShares;
      const next = Math.max(0, t * post - poolExisting);
      if (Math.abs(next - poolNew) < 1e-6) break;
      poolNew = next;
    }
    solve(issued + poolNew);
  } else {
    solve(issued);
    const post = issued + noteShares.reduce((a, b) => a + b, 0) + invShares;
    poolNew = Math.max(0, (t * post - poolExisting) / (1 - t));
  }

  const postShares = issued + poolNew + noteShares.reduce((a, b) => a + b, 0) + invShares;
  return { price, poolNew, noteShares, noteSharePrices, invShares, postShares };
}

/** Recorre las operaciones en orden y devuelve una foto del cap table tras cada una. */
export function computeScenario(s: Scenario): ScenarioResult {
  const holdings: Holdings = {};
  const classes: Record<string, ShareClass> = { ...BASE_CLASSES };
  const snapshots: Snapshot[] = [];
  const steps: StepResult[] = [];
  let pending: ConvertibleNote[] = [];
  let lastPrice: number | undefined;
  let lastPost: number | undefined;

  for (const ev of s.events) {
    const step: StepResult = { eventId: ev.id, warnings: [] };

    if (ev.type === 'constitucion') {
      for (const h of ev.holdings) add(holdings, h.holderId, 'ord', roundShares(h.shares));
    } else if (ev.type === 'nota') {
      pending.push(ev);
      step.warnings.push('Pendiente de conversión en la siguiente ronda con precio.');
    } else if (ev.type === 'ronda') {
      applyRound(ev, holdings, classes, pending, step);
      pending = [];
      lastPrice = step.pricePerShare;
      lastPost = step.postMoney;
    } else if (ev.type === 'secundaria') {
      applySecondary(ev, holdings, step, s.holders);
    }

    steps.push(step);
    snapshots.push({
      eventId: ev.id,
      label: ev.name,
      holdings: { ...holdings },
      classes: { ...classes },
      pricePerShare: lastPrice,
      postMoney: lastPost,
    });
  }

  const final = snapshots[snapshots.length - 1] ?? { eventId: '', label: '', holdings: {}, classes };
  return { snapshots, steps, final };
}

function applyRound(
  ev: Round, holdings: Holdings, classes: Record<string, ShareClass>,
  notes: ConvertibleNote[], step: StepResult,
) {
  const all = totalShares(holdings);
  const poolExisting = sharesOf(holdings, POOL_ID);
  const r = priceRound(all, poolExisting, ev, notes);
  if (r.price <= 0) {
    step.warnings.push('La ronda necesita una valoración pre-money y participaciones previas.');
    return;
  }
  const cls: ShareClass = {
    id: `serie-${ev.id}`,
    name: ev.name,
    votesPerShare: 1,
    liqMultiple: ev.liqMultiple,
    participating: ev.participating,
    issuePrice: r.price,
    order: Object.keys(classes).length,
  };
  classes[cls.id] = cls;

  const poolNew = roundShares(r.poolNew);
  if (poolNew > 0) add(holdings, POOL_ID, 'ord', poolNew);

  step.conversions = notes.map((n, i) => {
    const sh = roundShares(r.noteShares[i]);
    add(holdings, n.holderId, cls.id, sh);
    return { noteId: n.id, holderId: n.holderId, shares: sh, price: r.noteSharePrices[i] };
  });

  let invShares = 0;
  for (const inv of ev.investments) {
    const sh = roundShares(inv.amount / r.price);
    invShares += sh;
    add(holdings, inv.holderId, cls.id, sh);
  }

  step.pricePerShare = r.price;
  step.newInvestorShares = invShares;
  step.newPoolShares = poolNew;
  step.postMoney = r.price * totalShares(holdings);
}

/** Venta de participaciones existentes: no hay ampliación de capital, solo cambia el titular. */
function applySecondary(ev: Secondary, holdings: Holdings, step: StepResult, holders: Holder[]) {
  const targetClass = ev.structure === 'sinVoto' ? 'sinVoto' : 'ord';
  let sold = 0;
  for (const s of ev.sellers) {
    // Se venden primero ordinarias; si no bastan, cualquier otra clase del vendedor.
    let left = roundShares(s.shares);
    const own = Object.entries(holdings)
      .filter(([k]) => split(k)[0] === s.holderId)
      .sort(([a], [b]) => (split(a)[1] === 'ord' ? -1 : split(b)[1] === 'ord' ? 1 : 0));
    for (const [k, v] of own) {
      if (left <= 0) break;
      const take = Math.min(v, left);
      const cid = split(k)[1];
      add(holdings, s.holderId, cid, -take);
      // Las participaciones preferentes conservan su clase; las ordinarias pueden pasar a sin voto.
      add(holdings, ev.buyerId, cid === 'ord' ? targetClass : cid, take);
      left -= take;
      sold += take;
    }
    if (left > 0) {
      const name = holders.find((h) => h.id === s.holderId)?.name ?? s.holderId;
      step.warnings.push(`${name} no tiene participaciones suficientes (faltan ${left}).`);
    }
  }
  step.sold = sold;
  step.proceeds = sold * ev.pricePerShare;
  if (ev.structure === 'sinVoto' && nonVotingRatio(holdings) > MAX_NON_VOTING_SHARE) {
    step.warnings.push('Las participaciones sin voto superan la mitad del capital (art. 98 LSC).');
  }
}

/** Proporción de participaciones sin voto sobre el capital emitido (el pool no está emitido). */
export function nonVotingRatio(h: Holdings) {
  let nv = 0;
  let issued = 0;
  for (const [k, v] of Object.entries(h)) {
    const [hid, cid] = split(k);
    if (hid === POOL_ID) continue;
    issued += v;
    if (cid === 'sinVoto') nv += v;
  }
  return issued > 0 ? nv / issued : 0;
}

export function votesPerShare(
  holderId: string, classId: string, classes: Record<string, ShareClass>,
  holders: Holder[], gov: Pick<Governance, 'votoPlural'>,
) {
  if (holderId === POOL_ID) return 0; // opciones no ejercitadas: no votan
  const cls = classes[classId];
  if (!cls) return 0;
  const role = holders.find((h) => h.id === holderId)?.role;
  if (classId === 'ord' && role === 'fundador') return Math.max(1, gov.votoPlural);
  return cls.votesPerShare;
}

/** Cap table con % económico (totalmente diluido) frente a % de voto. */
export function capTable(snap: Snapshot, holders: Holder[], gov: Pick<Governance, 'votoPlural'>): CapRow[] {
  const rows = new Map<string, CapRow>();
  let total = 0;
  let totalVotes = 0;
  for (const [k, v] of Object.entries(snap.holdings)) {
    const [hid, cid] = split(k);
    const row = rows.get(hid) ?? { holderId: hid, shares: 0, econPct: 0, votes: 0, votePct: 0, byClass: {} };
    const votes = v * votesPerShare(hid, cid, snap.classes, holders, gov);
    row.shares += v;
    row.votes += votes;
    row.byClass[cid] = (row.byClass[cid] ?? 0) + v;
    rows.set(hid, row);
    total += v;
    totalVotes += votes;
  }
  const out = [...rows.values()];
  for (const r of out) {
    r.econPct = total > 0 ? r.shares / total : 0;
    r.votePct = totalVotes > 0 ? r.votes / totalVotes : 0;
  }
  const order = (id: string) => {
    const i = holders.findIndex((h) => h.id === id);
    return i < 0 ? 999 : i;
  };
  return out.sort((a, b) => order(a.holderId) - order(b.holderId));
}

export { key };
