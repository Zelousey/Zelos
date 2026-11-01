/**
 * The War base (owner 2026-11-01; prototype stage). The server (functions/warbase.py, war_lobby
 * "base*" actions) owns everything: gold, building levels, construction timers, production. This
 * file reads your base (warBases/{uid}, yours only) and estimates on screen what the mines have
 * made since the server last settled them, the same way the server will.
 */
import type { DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../../data/liveDoc';
import { callFunction } from '../../../lib/firebase';

export type Kind = 'hq' | 'mine' | 'barracks';
export const KINDS: Kind[] = ['hq', 'mine', 'barracks'];
export type Building = { id: string; kind: Kind; x: number; y: number; level: number; to: number | null; busyUntil: number | null; stored: number; prodAt: number | null };
export type Base = { season: string; gold: number; buildings: Building[]; nextDone: number | null };

/** The same numbers as functions/warbase.py CONFIG (the server checks every one). */
export type KindConfig = { name: string; size: number; max: number; cost: number[]; time: number[]; count: number[]; rate?: number[]; store?: number[]; soldiers?: number[] };
export const CONFIG: Record<Kind, KindConfig> = {
  hq: { name: 'Trading Headquarters', size: 4, max: 5, cost: [0, 600, 1800, 4500, 9000], time: [0, 300, 900, 1800, 2700], count: [1, 1, 1, 1, 1] },
  mine: { name: 'Gold Mine', size: 3, max: 5, cost: [150, 300, 700, 1600, 3500], time: [60, 120, 300, 900, 1800], count: [1, 2, 2, 3, 3], rate: [600, 900, 1300, 1900, 2700], store: [1200, 2400, 4500, 8000, 14000] },
  barracks: { name: 'Military Barracks', size: 3, max: 5, cost: [200, 400, 900, 2000, 4200], time: [60, 120, 300, 900, 1800], count: [1, 1, 1, 2, 2], soldiers: [5, 10, 15, 20, 30] },
};
export const GRID = 18;
export const SLOTS = 3;

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parseBase(d: DocumentData): Base | null {
  if (typeof d.season !== 'string' || typeof d.buildings !== 'object' || !d.buildings) return null;
  const buildings = Object.entries(d.buildings as Record<string, Record<string, unknown>>)
    .filter(([, b]) => KINDS.includes(b.kind as Kind))
    .map(([id, b]) => ({ id, kind: b.kind as Kind, x: num(b.x), y: num(b.y), level: num(b.level), to: numOrNull(b.to), busyUntil: numOrNull(b.busyUntil), stored: num(b.stored), prodAt: numOrNull(b.prodAt) }));
  return { season: d.season, gold: num(d.gold), buildings, nextDone: numOrNull(d.nextDone) };
}

export const useWarBase = (uid: string | null) => useLiveDoc(uid ? `warBases/${uid}` : null, parseBase);

type BaseReq =
  | { action: 'baseOpen' }
  | { action: 'basePlace'; kind: Kind; x: number; y: number }
  | { action: 'baseUpgrade'; id: string }
  | { action: 'baseMove'; id: string; x: number; y: number }
  | { action: 'baseCollect'; id?: string };
export const baseAction = (req: BaseReq) => callFunction<BaseReq, { base: DocumentData; collected: number }>('war_lobby', req);

export const hqLevel = (b: Base) => b.buildings.find((x) => x.kind === 'hq')?.level ?? 1;
export const isBusy = (x: Building, now: number) => x.busyUntil !== null && x.busyUntil > now;
export const busyCount = (b: Base, now: number) => b.buildings.filter((x) => isBusy(x, now)).length;
/** A building whose timer ran out on screen shows its new level until the server confirms it. */
export const shownLevel = (x: Building, now: number) => (x.busyUntil !== null && x.busyUntil <= now && x.to ? x.to : x.level);

/** Gold a mine holds now (what the server will count when you collect), capped at its store. */
export function storedNow(x: Building, now: number): number {
  const cfg = CONFIG.mine;
  if (x.kind !== 'mine' || isBusy(x, now)) return x.stored;
  const lvl = shownLevel(x, now);
  if (lvl < 1) return 0;
  const since = x.busyUntil !== null && x.busyUntil <= now ? x.busyUntil : (x.prodAt ?? now);
  return Math.min(cfg.store![lvl - 1]!, x.stored + (cfg.rate![lvl - 1]! * Math.max(0, now - since)) / 3600000);
}

/** Why you can't place one more of this kind now, or null. */
export function cantPlace(b: Base, kind: Kind, now: number): 'count' | 'gold' | 'slots' | null {
  const cfg = CONFIG[kind];
  if (b.buildings.filter((x) => x.kind === kind).length >= cfg.count[hqLevel(b) - 1]!) return 'count';
  if (busyCount(b, now) >= SLOTS) return 'slots';
  if (b.gold < cfg.cost[0]!) return 'gold';
  return null;
}

/** Why this building can't be upgraded now, or null. */
export function cantUpgrade(b: Base, x: Building, now: number): 'max' | 'hq' | 'busy' | 'slots' | 'gold' | null {
  const cfg = CONFIG[x.kind];
  const lvl = shownLevel(x, now);
  if (lvl >= cfg.max) return 'max';
  if (isBusy(x, now)) return 'busy';
  if (x.kind !== 'hq' && lvl + 1 > hqLevel(b) + 1) return 'hq';
  if (busyCount(b, now) >= SLOTS) return 'slots';
  if (b.gold < cfg.cost[lvl]!) return 'gold';
  return null;
}

/** Whether a building of this kind fits at (x, y) on free land (the server checks again). */
export function fits(b: Base, kind: Kind, x: number, y: number, skip?: string): boolean {
  const size = CONFIG[kind].size;
  if (x < 0 || y < 0 || x + size > GRID || y + size > GRID) return false;
  return b.buildings.every((o) => {
    if (o.id === skip) return true;
    const s2 = CONFIG[o.kind].size;
    return !(x < o.x + s2 && o.x < x + size && y < o.y + s2 && o.y < y + size);
  });
}

/** Isometric drawing: tile (x, y) to the screen, and back. TW × TH is one tile's diamond. */
export const TW = 64;
export const TH = 32;
export const ORIGIN = { x: (GRID * TW) / 2, y: TH };
export const toScreen = (x: number, y: number) => ({ sx: ORIGIN.x + ((x - y) * TW) / 2, sy: ORIGIN.y + ((x + y) * TH) / 2 });
export function toTile(sx: number, sy: number) {
  const px = (sx - ORIGIN.x) / (TW / 2);
  const py = (sy - ORIGIN.y) / (TH / 2);
  return { x: Math.floor((px + py) / 2), y: Math.floor((py - px) / 2) };
}

export function formatLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
