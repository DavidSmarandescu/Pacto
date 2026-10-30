import { split } from './holdings';
import type { Snapshot } from './types';

export interface WaterfallResult {
  byHolder: Record<string, number>;
  byClass: Record<string, number>;
  /** Series no participativas que prefieren convertir a ordinarias. */
  converted: string[];
  prefPaid: number;
  perCommonShare: number;
}

/**
 * Reparto de una venta de la empresa. Las preferencias se pagan pari passu entre series;
 * las no participativas eligen entre cobrar su preferencia o convertir, lo que más les dé.
 */
export function waterfall(snap: Snapshot, exitValue: number, includePool = true): WaterfallResult {
  const classShares: Record<string, number> = {};
  const entries = Object.entries(snap.holdings).filter(([k]) => includePool || split(k)[0] !== 'pool');
  for (const [k, v] of entries) {
    const cid = split(k)[1];
    classShares[cid] = (classShares[cid] ?? 0) + v;
  }
  const prefClasses = Object.keys(classShares).filter((c) => (snap.classes[c]?.liqMultiple ?? 0) > 0);
  const prefAmount = (c: string) => classShares[c] * snap.classes[c].issuePrice * snap.classes[c].liqMultiple;

  const converted = new Set<string>();
  let classPay: Record<string, number> = {};
  let perShare = 0;
  let prefPaid = 0;

  const run = () => {
    classPay = {};
    const takers = prefClasses.filter((c) => !converted.has(c));
    const demand = takers.reduce((a, c) => a + prefAmount(c), 0);
    const ratio = demand > 0 ? Math.min(1, exitValue / demand) : 0;
    prefPaid = 0;
    for (const c of takers) {
      classPay[c] = prefAmount(c) * ratio;
      prefPaid += classPay[c];
    }
    const rest = Math.max(0, exitValue - prefPaid);
    const participants = Object.keys(classShares).filter((c) => {
      const cls = snap.classes[c];
      return !cls || cls.liqMultiple === 0 || converted.has(c) || cls.participating;
    });
    const pShares = participants.reduce((a, c) => a + classShares[c], 0);
    perShare = pShares > 0 ? rest / pShares : 0;
    for (const c of participants) classPay[c] = (classPay[c] ?? 0) + perShare * classShares[c];
  };

  run();
  // Convierte de una en una la serie que más gana convirtiendo, hasta que ninguna mejore.
  for (let i = 0; i < prefClasses.length; i++) {
    let best: string | null = null;
    let bestGain = 1e-9;
    for (const c of prefClasses) {
      if (converted.has(c) || snap.classes[c].participating) continue;
      const gain = perShare * classShares[c] - classPay[c];
      if (gain > bestGain) {
        best = c;
        bestGain = gain;
      }
    }
    if (!best) break;
    const before = { ...classPay };
    converted.add(best);
    run();
    if (classPay[best] < before[best]) {
      converted.delete(best);
      run();
      break;
    }
  }

  const byHolder: Record<string, number> = {};
  for (const [k, v] of entries) {
    const [hid, cid] = split(k);
    const share = classShares[cid] > 0 ? (classPay[cid] ?? 0) * (v / classShares[cid]) : 0;
    byHolder[hid] = (byHolder[hid] ?? 0) + share;
  }
  return { byHolder, byClass: classPay, converted: [...converted], prefPaid, perCommonShare: perShare };
}
