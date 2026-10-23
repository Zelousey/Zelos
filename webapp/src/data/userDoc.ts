/**
 * The signed-in person's own users/{uid} doc (readable only by them), parsed once and shared:
 * watchlist, server-owned XP, the mission progress the classic site keeps there, and the
 * first-steps flags and experience from the welcome screens, the traders you blocked and when
 * you agreed to the Terms.
 * One parser for the path, because liveDoc shares one listener (and one parse) per path.
 */
import type { DocumentData } from 'firebase/firestore';
import { parseProgress, parseServerMissions, type Progress } from '../features/dashboard/progress';
import { parsePrefs, type Prefs } from '../features/alerts/alerts';
import { parseSkill, type Skill } from '../features/learn/quiz';
import { useLiveDoc } from './liveDoc';
import { SYMBOL_RE } from './markets';

export type Experience = 'new' | 'some' | 'pro';
/** First steps checklist flags (users/{uid}.onboard), shared with the website (zelos-profile.js). */
export type Onboard = { profile: boolean; trade: boolean; invited: boolean };
export type UserDoc = { watchlist: string[]; xp: number; progress: Progress | null; missions: Progress | null; onboard: Onboard; experience: Experience | null; prefs: Prefs; friends: string[]; blocked: string[]; termsAt: number | null; skill: Skill | null; learnDone: string[]; learnPassed: Record<string, number>; mindsDone: string[]; xpBoostUntil: number | null };

const uids = (v: unknown, max: number) => (Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9]{10,40}$/.test(x)).slice(0, max) : []);

export function parseUserDoc(d: DocumentData): UserDoc {
  const watchlist = Array.isArray(d.watchlist) ? (d.watchlist as unknown[]).map((x) => String(x).toUpperCase()).filter((x) => SYMBOL_RE.test(x)).slice(0, 50) : [];
  const xp = typeof d.xp === 'number' && Number.isFinite(d.xp) && d.xp > 0 ? Math.floor(d.xp) : 0;
  const ob = (d.onboard && typeof d.onboard === 'object' ? d.onboard : {}) as Record<string, unknown>;
  const onboard = { profile: ob.profile === true, trade: ob.trade === true, invited: ob.invited === true };
  const experience = d.experience === 'new' || d.experience === 'some' || d.experience === 'pro' ? (d.experience as Experience) : null;
  return {
    watchlist, xp, progress: parseProgress(d.progress), missions: parseServerMissions(d.missions), onboard, experience, prefs: parsePrefs(d),
    friends: uids(d.friends, 200),
    blocked: uids(d.blocked, 500),
    termsAt: typeof d.termsAt === 'number' && d.termsAt > 0 ? d.termsAt : null,
    skill: parseSkill(d.skill),
    learnDone: Array.isArray(d.learnDone) ? (d.learnDone as unknown[]).filter((x): x is string => typeof x === 'string' && /^[a-z-]{2,20}$/.test(x)).slice(0, 80) : [],
    // Hall of Minds lessons and head-to-head pairs read ("napoleon:speed", "vs:edison-tesla")
    mindsDone: Array.isArray(d.mindsDone) ? (d.mindsDone as unknown[]).filter((x): x is string => typeof x === 'string' && /^[a-z-]{2,30}:[a-z-]{2,40}$/.test(x)).slice(0, 400) : [],
    // XP booster bought with tokens (written by the server's xp_boost): double XP until then
    xpBoostUntil: typeof d.xpBoostUntil === 'number' && d.xpBoostUntil > 0 ? d.xpBoostUntil : null,
    // Trading 101 chapter quizzes passed (written by the server's learn_quiz): chapter id -> when
    learnPassed: d.learnPassed && typeof d.learnPassed === 'object' ? Object.fromEntries(Object.entries(d.learnPassed as Record<string, unknown>).filter(([k, v]) => /^[a-z-]{2,20}$/.test(k) && typeof v === 'number')) as Record<string, number> : {},
  };
}

export const useUserDoc = (uid: string | null) => useLiveDoc(uid ? `users/${uid}` : null, parseUserDoc);
