/**
 * The War base (owner 2026-11-01; prototype + stage 2: crystals, Research Center, starter kits). The server (functions/warbase.py, war_lobby
 * "base*" actions) owns everything: gold, building levels, construction timers, production. This
 * file reads your base (warBases/{uid}, yours only) and estimates on screen what the mines have
 * made since the server last settled them, the same way the server will.
 */
import type { DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../../data/liveDoc';
import { callFunction } from '../../../lib/firebase';

export type Kind = 'hq' | 'mine' | 'barracks' | 'research';
export const KINDS: Kind[] = ['hq', 'mine', 'barracks', 'research'];
export type KitId = 'investor' | 'commander' | 'research';
export type Building = { id: string; kind: Kind; x: number; y: number; level: number; to: number | null; busyUntil: number | null; stored: number; prodAt: number | null };
export type Base = { season: string; gold: number; crystals: number; kit: KitId | null; buildings: Building[]; nextDone: number | null };

/** The same numbers as functions/warbase.py CONFIG (the server checks every one). */
export type KindConfig = { name: string; size: number; max: number; cost: number[]; crystals: number[]; time: number[]; count: number[]; makes?: 'gold' | 'crystals'; rate?: number[]; store?: number[]; soldiers?: number[] };
export const CONFIG: Record<Kind, KindConfig> = {
  hq: { name: 'Trading Headquarters', size: 4, max: 5, cost: [0, 600, 1800, 4500, 9000], crystals: [0, 0, 0, 20, 50], time: [0, 300, 900, 1800, 2700], count: [1, 1, 1, 1, 1] },
  mine: { name: 'Gold Mine', size: 3, max: 5, cost: [150, 300, 700, 1600, 3500], crystals: [0, 0, 0, 10, 25], time: [60, 120, 300, 900, 1800], count: [1, 2, 2, 3, 3], makes: 'gold', rate: [600, 900, 1300, 1900, 2700], store: [1200, 2400, 4500, 8000, 14000] },
  barracks: { name: 'Military Barracks', size: 3, max: 5, cost: [200, 400, 900, 2000, 4200], crystals: [0, 0, 0, 10, 25], time: [60, 120, 300, 900, 1800], count: [1, 1, 1, 2, 2], soldiers: [5, 10, 15, 20, 30] },
  research: { name: 'Research Center', size: 3, max: 5, cost: [500, 900, 1800, 3600, 7000], crystals: [0, 0, 0, 0, 30], time: [120, 300, 900, 1800, 2700], count: [0, 1, 1, 2, 2], makes: 'crystals', rate: [8, 12, 18, 26, 36], store: [40, 80, 150, 260, 400] },
};
/** functions/warbase.py KITS: picked once a season. */
export const KITS: Record<KitId, { gold: number; crystals: number; boost: Partial<Record<'gold' | 'crystals', number>>; soldiers: number }> = {
  investor: { gold: 1500, crystals: 0, boost: { gold: 0.15 }, soldiers: 0 },
  commander: { gold: 600, crystals: 10, boost: {}, soldiers: 10 },
  research: { gold: 600, crystals: 60, boost: { crystals: 0.25 }, soldiers: 0 },
};
export const SPEED_PER_MIN = 1;
export const GRID = 16;
export const SLOTS = 3;

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parseBase(d: DocumentData): Base | null {
  if (typeof d.season !== 'string' || typeof d.buildings !== 'object' || !d.buildings) return null;
  const buildings = Object.entries(d.buildings as Record<string, Record<string, unknown>>)
    .filter(([, b]) => KINDS.includes(b.kind as Kind))
    .map(([id, b]) => ({ id, kind: b.kind as Kind, x: num(b.x), y: num(b.y), level: num(b.level), to: numOrNull(b.to), busyUntil: numOrNull(b.busyUntil), stored: num(b.stored), prodAt: numOrNull(b.prodAt) }));
  const kit = d.kit === 'investor' || d.kit === 'commander' || d.kit === 'research' ? d.kit : null;
  return { season: d.season, gold: num(d.gold), crystals: num(d.crystals), kit, buildings, nextDone: numOrNull(d.nextDone) };
}

export const useWarBase = (uid: string | null) => useLiveDoc(uid ? `warBases/${uid}` : null, parseBase);

type BaseReq =
  | { action: 'baseOpen' }
  | { action: 'basePlace'; kind: Kind; x: number; y: number }
  | { action: 'baseUpgrade'; id: string }
  | { action: 'baseMove'; id: string; x: number; y: number }
  | { action: 'baseCollect'; id?: string }
  | { action: 'baseSpeed'; id: string }
  | { action: 'baseKit'; kit: KitId };
export const baseAction = (req: BaseReq) => callFunction<BaseReq, { base: DocumentData; collected: { gold: number; crystals: number } }>('war_lobby', req);

export const hqLevel = (b: Base) => b.buildings.find((x) => x.kind === 'hq')?.level ?? 1;
export const isBusy = (x: Building, now: number) => x.busyUntil !== null && x.busyUntil > now;
export const busyCount = (b: Base, now: number) => b.buildings.filter((x) => isBusy(x, now)).length;
/** A building whose timer ran out on screen shows its new level until the server confirms it. */
export const shownLevel = (x: Building, now: number) => (x.busyUntil !== null && x.busyUntil <= now && x.to ? x.to : x.level);

/** What a producer (Gold Mine, Research Center) holds now: what the server will count when you collect. */
export function storedNow(b: Base, x: Building, now: number): number {
  const cfg = CONFIG[x.kind];
  if (!cfg.makes || isBusy(x, now)) return x.stored;
  const lvl = shownLevel(x, now);
  if (lvl < 1) return 0;
  const since = x.busyUntil !== null && x.busyUntil <= now ? x.busyUntil : (x.prodAt ?? now);
  const rate = cfg.rate![lvl - 1]! * (1 + (b.kit ? (KITS[b.kit].boost[cfg.makes] ?? 0) : 0));
  return Math.min(cfg.store![lvl - 1]!, x.stored + (rate * Math.max(0, now - since)) / 3600000);
}

/** The Headquarters level that unlocks a building. */
export const unlockLevel = (kind: Kind) => CONFIG[kind].count.findIndex((n) => n > 0) + 1;

/** Crystals to finish a construction now (1 a minute or part of one left). */
export const speedCost = (x: Building, now: number) => (isBusy(x, now) ? Math.max(1, Math.ceil(((x.busyUntil ?? now) - now) / 60000)) * SPEED_PER_MIN : 0);

/** Why you can't place one more of this kind now, or null. */
export function cantPlace(b: Base, kind: Kind, now: number): 'locked' | 'count' | 'gold' | 'crystals' | 'slots' | null {
  const cfg = CONFIG[kind];
  const allowed = cfg.count[hqLevel(b) - 1]!;
  if (allowed === 0) return 'locked';
  if (b.buildings.filter((x) => x.kind === kind).length >= allowed) return 'count';
  if (busyCount(b, now) >= SLOTS) return 'slots';
  if (b.gold < cfg.cost[0]!) return 'gold';
  if (b.crystals < cfg.crystals[0]!) return 'crystals';
  return null;
}

/** Why this building can't be upgraded now, or null. */
export function cantUpgrade(b: Base, x: Building, now: number): 'max' | 'hq' | 'busy' | 'slots' | 'gold' | 'crystals' | null {
  const cfg = CONFIG[x.kind];
  const lvl = shownLevel(x, now);
  if (lvl >= cfg.max) return 'max';
  if (isBusy(x, now)) return 'busy';
  if (x.kind !== 'hq' && lvl + 1 > hqLevel(b) + 1) return 'hq';
  if (busyCount(b, now) >= SLOTS) return 'slots';
  if (b.gold < cfg.cost[lvl]!) return 'gold';
  if (b.crystals < cfg.crystals[lvl]!) return 'crystals';
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

/** The owner's land picture (base/land.webp) and where its buildable grass diamond is, in the
 *  picture's pixels: the top, right and left corners. Tile (x, y) has its top corner at
 *  TOP + x * UX + y * UY; GRID tiles reach the right and left corners. */
export const LAND = { w: 1672, h: 941 };
const TOP = { x: 830, y: 45 };
const RIGHT = { x: 1555, y: 478 };
const LEFT = { x: 92, y: 463 };
export const UX = { x: (RIGHT.x - TOP.x) / GRID, y: (RIGHT.y - TOP.y) / GRID };
export const UY = { x: (LEFT.x - TOP.x) / GRID, y: (LEFT.y - TOP.y) / GRID };
/** One tile's width on screen (its left corner to its right corner). */
export const TILE_W = UX.x - UY.x;
export const toScreen = (x: number, y: number) => ({ sx: TOP.x + UX.x * x + UY.x * y, sy: TOP.y + UX.y * x + UY.y * y });
export function toTile(sx: number, sy: number) {
  const dx = sx - TOP.x;
  const dy = sy - TOP.y;
  const det = UX.x * UY.y - UY.x * UX.y;
  return { x: Math.floor((dx * UY.y - dy * UY.x) / det), y: Math.floor((UX.x * dy - UX.y * dx) / det) };
}

export function formatLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
