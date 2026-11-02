/**
 * Territory outposts (owner 2026-11-02): a Fort or a Supply camp on a territory you hold in a War,
 * paid with your base gold. The server (functions/waroutpost.py, war_lobby outpost* actions) decides
 * everything; this file mirrors its numbers to show prices, levels and the gold waiting in a camp.
 */
import { callFunction } from '../../lib/firebase';

export type OutpostKind = 'fort' | 'camp';
export type Outpost = { kind: OutpostKind; owner: string; level: number; to: number | null; busyUntil: number | null; stored: number; prodAt: number | null };
export const OUTPOST_KINDS: OutpostKind[] = ['fort', 'camp'];
export const OUTPOST = {
  unlockHq: 2,
  maxLevel: 3,
  fort: { cost: [1000, 2500, 5000], time: [600, 1800, 3600], wins: [1, 2, 3] },
  camp: { cost: [800, 2000, 4500], time: [600, 1800, 3600], rate: [150, 300, 500], hours: 8 },
} as const;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parseOutposts(v: unknown): Record<string, Outpost> {
  const out: Record<string, Outpost> = {};
  for (const [k, raw] of Object.entries((v && typeof v === 'object' ? v : {}) as Record<string, Record<string, unknown>>)) {
    if (!raw || (raw.kind !== 'fort' && raw.kind !== 'camp') || typeof raw.owner !== 'string') continue;
    out[k] = { kind: raw.kind, owner: raw.owner, level: num(raw.level) ?? 0, to: num(raw.to), busyUntil: num(raw.busyUntil), stored: num(raw.stored) ?? 0, prodAt: num(raw.prodAt) };
  }
  return out;
}

/** The outpost as the server will see it now: its level, whether it's building, a camp's gold. */
export function outpostNow(o: Outpost, now: number, active: boolean) {
  let { level, busyUntil, prodAt } = o;
  if (busyUntil !== null && busyUntil <= now) {
    level = o.to ?? level;
    prodAt = busyUntil;
    busyUntil = null;
  }
  let stored = o.stored;
  if (o.kind === 'camp' && level >= 1 && busyUntil === null && active) {
    const rate = OUTPOST.camp.rate[level - 1]!;
    stored = Math.min(rate * OUTPOST.camp.hours, stored + (rate * Math.max(0, now - (prodAt ?? now))) / 3600000);
  }
  return { level, busy: busyUntil !== null, busyUntil, stored: Math.floor(stored) };
}

type OutpostReq = { action: 'outpostBuild'; warId: string; terr: string; kind: OutpostKind } | { action: 'outpostUpgrade' | 'outpostCollect'; warId: string; terr: string };
export const outpostAction = (req: OutpostReq) => callFunction<OutpostReq, { collected: number }>('war_lobby', req);
