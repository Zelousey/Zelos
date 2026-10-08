/**
 * The signed-in person's own users/{uid} doc (readable only by them), parsed once and shared:
 * watchlist, server-owned XP, and the mission progress the classic site keeps there.
 * One parser for the path, because liveDoc shares one listener (and one parse) per path.
 */
import type { DocumentData } from 'firebase/firestore';
import { parseProgress, parseServerMissions, type Progress } from '../features/dashboard/progress';
import { useLiveDoc } from './liveDoc';
import { SYMBOL_RE } from './markets';

export type UserDoc = { watchlist: string[]; xp: number; progress: Progress | null; missions: Progress | null };

export function parseUserDoc(d: DocumentData): UserDoc {
  const watchlist = Array.isArray(d.watchlist) ? (d.watchlist as unknown[]).map((x) => String(x).toUpperCase()).filter((x) => SYMBOL_RE.test(x)).slice(0, 50) : [];
  const xp = typeof d.xp === 'number' && Number.isFinite(d.xp) && d.xp > 0 ? Math.floor(d.xp) : 0;
  return { watchlist, xp, progress: parseProgress(d.progress), missions: parseServerMissions(d.missions) };
}

export const useUserDoc = (uid: string | null) => useLiveDoc(uid ? `users/${uid}` : null, parseUserDoc);
