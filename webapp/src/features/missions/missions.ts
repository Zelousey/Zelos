/**
 * Missions & XP data for the app (/missions), on the same documents as the website's
 * "XP & Missions" tab (practice/practice.js renderProgress, zelos-progress.js):
 *   users/{uid}.xp                 XP, paid only by the server (xp_award / xp_grant)
 *   users/{uid}.missions           the server's mission count (functions/missions.py)
 *   users/{uid}.progress           mission/achievement progress shared with the website
 *   users/{uid}/activity/{id}      the XP ledger, written by the server, readable by you
 *   referrals/{uid}                friends who joined from your invite (server-written)
 */
import { collection, doc, getCountFromServer, getDoc, limit, orderBy, query, setDoc, Timestamp, updateDoc, arrayUnion, where, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';
import { t } from '../../lib/i18n';

// ---------------------------------------------------------------- achievements the app unlocks
/**
 * Unlock an achievement earned in the app (the website unlocks the rest in the browser):
 * record it in users/{uid}.progress like zelos-progress.js does (plus the running total it
 * counts, e.g. squads), ask the server for its XP (once per achievement, bounded by
 * functions/xp.py), and show it on the public profile. Returns the XP paid (0 if already had).
 */
export async function unlockAchievement(uid: string, id: string, total?: { key: string; n: number }): Promise<number> {
  const ref = doc(db(), 'users', uid);
  const snap = await getDoc(ref).catch(() => null);
  const prog = (snap?.exists() ? (snap.data().progress as Record<string, unknown> | undefined) : undefined) ?? {};
  const had = !!(prog.achievements as Record<string, unknown> | undefined)?.[id];
  const totals = (prog.totals as Record<string, number> | undefined) ?? {};
  if (!had || (total && (totals[total.key] ?? 0) < total.n)) {
    await setDoc(ref, { progress: { v: 1, ...(had ? {} : { achievements: { [id]: Date.now() } }), ...(total ? { totals: { [total.key]: Math.max(totals[total.key] ?? 0, total.n) } } : {}) } }, { merge: true });
  }
  let xp = 0;
  try {
    const r = await callFunction<{ type: string; refId: string }, { awarded?: boolean; before?: number; xp?: number }>('xp_award', { type: 'achievement', refId: id });
    xp = r.awarded ? Math.max(0, (r.xp ?? 0) - (r.before ?? 0)) : 0;
  } catch {
    /* XP is a bonus; the badge is recorded either way */
  }
  try {
    const pp = doc(db(), 'practiceProfiles', uid);
    if ((await getDoc(pp)).exists()) await updateDoc(pp, { achievements: arrayUnion(id) });
  } catch {
    /* no public profile yet */
  }
  return xp;
}

/** Unlock in the background and say so (never blocks or fails the action that earned it). */
export function unlockQuietly(uid: string, id: 'squad-up' | 'challenger', name: string, show: (msg: string) => void): Promise<void> {
  const total = id === 'squad-up' ? { key: 'squads', n: 1 } : { key: 'challenges', n: 1 };
  return unlockAchievement(uid, id, total)
    .then((xp) => void (xp > 0 && show(t('ms.unlocked.xp', { name, xp }))))
    .catch(() => {});
}

// ---------------------------------------------------------------- XP history
export type XpEvent = { id: string; label: string; xp: number; source: string; at: number };
export function parseXpEvent(id: string, d: DocumentData): XpEvent | null {
  if (typeof d.xp !== 'number' || !Number.isFinite(d.xp) || d.xp <= 0) return null;
  return { id, label: typeof d.label === 'string' ? d.label.slice(0, 60) : 'XP', xp: Math.floor(d.xp), source: typeof d.source === 'string' ? d.source.slice(0, 20) : '', at: d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : 0 };
}
export const useXpHistory = (uid: string | null) => useLiveQuery(uid ? `xp:${uid}` : null, () => query(collection(db(), 'users', uid!, 'activity'), orderBy('createdAt', 'desc'), limit(20)), parseXpEvent);

// ---------------------------------------------------------------- referrals
export const REFERRAL_TIERS = [
  { at: 1, name: 'Bronze', icon: '🥉' },
  { at: 3, name: 'Silver', icon: '🥈' },
  { at: 10, name: 'Gold', icon: '🥇' },
  { at: 25, name: 'Diamond', icon: '💎' },
] as const;
export const referralTier = (n: number) => [...REFERRAL_TIERS].reverse().find((x) => n >= x.at) ?? null;
export const nextTier = (n: number) => REFERRAL_TIERS.find((x) => x.at > n) ?? null;

/** How many friends joined from your invite (one count query). */
export function useReferralCount(uid: string | null): number | null {
  const [v, setV] = useState<{ uid: string; n: number } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    getCountFromServer(query(collection(db(), 'referrals'), where('referrer', '==', uid), limit(500)))
      .then((r) => live && setV({ uid, n: r.data().count }))
      .catch(() => live && setV({ uid, n: 0 }));
    return () => {
      live = false;
    };
  }, [uid]);
  return v && v.uid === uid ? v.n : null;
}

export const STREAK_REWARDS: [number, number][] = [
  [3, 25],
  [7, 75],
  [14, 150],
  [30, 300],
];
