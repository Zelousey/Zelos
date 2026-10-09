/**
 * The signed-in person's own users/{uid} doc (readable only by them), parsed once and shared:
 * watchlist, server-owned XP, the mission progress the classic site keeps there, and the
 * first-steps flags and experience from the welcome screens.
 * One parser for the path, because liveDoc shares one listener (and one parse) per path.
 */
import type { DocumentData } from 'firebase/firestore';
import { parseProgress, parseServerMissions, type Progress } from '../features/dashboard/progress';
import { useLiveDoc } from './liveDoc';
import { SYMBOL_RE } from './markets';

export type Experience = 'new' | 'some' | 'pro';
/** First steps checklist flags (users/{uid}.onboard), shared with the website (zelos-profile.js). */
export type Onboard = { profile: boolean; trade: boolean; invited: boolean };
export type UserDoc = { watchlist: string[]; xp: number; progress: Progress | null; missions: Progress | null; onboard: Onboard; experience: Experience | null; friends: string[] };

export function parseUserDoc(d: DocumentData): UserDoc {
  const watchlist = Array.isArray(d.watchlist) ? (d.watchlist as unknown[]).map((x) => String(x).toUpperCase()).filter((x) => SYMBOL_RE.test(x)).slice(0, 50) : [];
  const xp = typeof d.xp === 'number' && Number.isFinite(d.xp) && d.xp > 0 ? Math.floor(d.xp) : 0;
  const ob = (d.onboard && typeof d.onboard === 'object' ? d.onboard : {}) as Record<string, unknown>;
  const onboard = { profile: ob.profile === true, trade: ob.trade === true, invited: ob.invited === true };
  const experience = d.experience === 'new' || d.experience === 'some' || d.experience === 'pro' ? (d.experience as Experience) : null;
  return { watchlist, xp, progress: parseProgress(d.progress), missions: parseServerMissions(d.missions), onboard, experience, friends: Array.isArray(d.friends) ? (d.friends as unknown[]).filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9]{10,40}$/.test(x)).slice(0, 200) : [] };
}

export const useUserDoc = (uid: string | null) => useLiveDoc(uid ? `users/${uid}` : null, parseUserDoc);
