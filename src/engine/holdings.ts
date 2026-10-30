import type { Holdings } from './types';

export const key = (holderId: string, classId: string) => `${holderId}|${classId}`;

export function split(k: string): [string, string] {
  const i = k.indexOf('|');
  return [k.slice(0, i), k.slice(i + 1)];
}

export function add(h: Holdings, holderId: string, classId: string, shares: number) {
  const k = key(holderId, classId);
  const v = (h[k] ?? 0) + shares;
  if (v <= 0) delete h[k];
  else h[k] = v;
}

export const totalShares = (h: Holdings) => Object.values(h).reduce((a, b) => a + b, 0);

export function sharesOf(h: Holdings, holderId: string, classId?: string) {
  let s = 0;
  for (const [k, v] of Object.entries(h)) {
    const [hid, cid] = split(k);
    if (hid === holderId && (classId === undefined || cid === classId)) s += v;
  }
  return s;
}
