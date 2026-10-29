/**
 * The War map (W4a, docs/WAR_DESIGN.md §3-§4): your secret placement and your enemy warnings
 * (wars/{id}/placements/{uid} and intel/{uid}, readable by you alone), and the map log. The
 * server (functions/warmap.py) checks every placement; the same limits here only guide the form.
 */
import { collection, limit, orderBy, query, type DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { db } from '../../lib/firebase';
import { COMPANIES, SECTORS } from './war';

export const MAX_PER_TERRITORY = 50;
export const CAMO_COST = 5;
export const CAMO_MAX = 2;
export const SECTOR_NAME: Record<string, string> = Object.fromEntries(SECTORS);
export const companiesOf = (t: string) => COMPANIES.filter((c) => c.sector === t);

export type Placement = { soldiers: Record<string, number>; camo: string[]; locked: boolean; auto: boolean };
const counts = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries((v && typeof v === 'object' ? v : {}) as Record<string, unknown>)) if (SECTOR_NAME[k] && typeof n === 'number' && Number.isInteger(n) && n > 0) out[k] = n;
  return out;
};
export function parsePlacement(d: DocumentData): Placement {
  return { soldiers: counts(d.soldiers), camo: (Array.isArray(d.camo) ? d.camo : []).filter((x: unknown): x is string => typeof x === 'string' && !!SECTOR_NAME[x]), locked: d.locked === true, auto: d.auto === true };
}
export type Warning = 'enemy' | 'heavy';
export function parseIntel(d: DocumentData): Record<string, Warning> {
  const out: Record<string, Warning> = {};
  for (const [k, v] of Object.entries((d.warnings && typeof d.warnings === 'object' ? d.warnings : {}) as Record<string, unknown>)) if (SECTOR_NAME[k] && (v === 'enemy' || v === 'heavy')) out[k] = v;
  return out;
}

/** What's wrong with a placement before it can be locked in (null when it's fine). */
export function placementProblem(p: { soldiers: Record<string, number>; camo: string[] }, territories: string[], soldiers: number): { key: 'over' | 'empty' | 'left' | 'camo'; n: number } | null {
  const vals = territories.map((t) => p.soldiers[t] ?? 0);
  if (vals.some((n) => n > MAX_PER_TERRITORY)) return { key: 'over', n: MAX_PER_TERRITORY };
  if (p.camo.some((t) => !(p.soldiers[t] ?? 0))) return { key: 'camo', n: 0 };
  if (vals.every((n) => n > 0)) return { key: 'empty', n: 0 };
  const left = soldiers - CAMO_COST * p.camo.length - vals.reduce((a, b) => a + b, 0);
  return left !== 0 ? { key: 'left', n: left } : null;
}

export const usePlacement = (warId: string, uid: string) => useLiveDoc(`wars/${warId}/placements/${uid}`, parsePlacement);
export const useIntel = (warId: string, uid: string) => useLiveDoc(`wars/${warId}/intel/${uid}`, parseIntel);
export const useWarLog = (warId: string | null) =>
  useLiveQuery(warId ? `warLog:${warId}` : null, () => query(collection(db(), 'wars', warId!, 'log'), orderBy('at', 'desc'), limit(40)), (id, d) => (typeof d.text === 'string' ? { id, text: d.text.slice(0, 160), at: Number(d.at) || 0 } : null));

