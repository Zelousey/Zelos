/**
 * First sign-in: the welcome screens (/welcome) and the First steps checklist on the Dashboard.
 * The server saves the name and @username (functions/main.py profile_setup); the checklist
 * reads the same users/{uid}.onboard flags as the website's "Get set up" (zelos-profile.js).
 */
import { doc, getDoc } from 'firebase/firestore';
import type { Experience, Onboard } from '../../data/userDoc';
import { callFunction, db } from '../../lib/firebase';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/; // same as firestore.rules and functions/onboarding.py
export const SKIP_KEY = 'zelosWelcomeSkip'; // "Skip for now": don't open the welcome again on this device
export const HIDE_KEY = 'zelosOnboardHidden'; // the website's "Hide checklist" (shared)
export const DONE_KEY = 'zelosOnboardDone'; // the website's "all steps done" (shared)

export type SetupResult = { name: string; username: string; experience: Experience | null; xp: number; awarded: boolean };
export const profileSetup = (data: { name: string; username: string; experience?: Experience }) =>
  callFunction<typeof data, SetupResult>('profile_setup', data);

/** A starting @username from a display name: "Ada Lovelace" -> "ada_lovelace" (3-20 chars). */
export function suggestUsername(name: string, salt = ''): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16);
  const u = (base.length >= 3 ? base : `trader${base ? '_' + base : ''}`).slice(0, 20 - salt.length) + salt;
  return u.slice(0, 20);
}

export type Availability = 'checking' | 'free' | 'mine' | 'taken' | 'invalid';
export async function checkUsername(u: string, uid: string): Promise<Availability> {
  if (!USERNAME_RE.test(u)) return 'invalid';
  const s = await getDoc(doc(db(), 'usernames', u));
  if (!s.exists()) return 'free';
  return s.data()?.uid === uid ? 'mine' : 'taken';
}

export type Step = { id: 'profile' | 'account' | 'trade' | 'invite' | 'coach'; done: boolean; optional?: boolean; xp: number; to: string };
/** The checklist: same steps and XP as the website's, minus its install/notification steps. */
export function firstSteps(v: { onboard: Onboard; hasUsername: boolean; hasAccount: boolean; experience: Experience | null; hasCoach: boolean }): Step[] {
  const steps: Step[] = [
    { id: 'profile', done: v.hasUsername || v.onboard.profile, xp: 25, to: '/welcome' },
    { id: 'account', done: v.hasAccount, xp: 0, to: '/practice' },
    { id: 'trade', done: v.onboard.trade, xp: 25, to: '/markets' },
    { id: 'invite', done: v.onboard.invited, xp: 50, to: '/invite' },
  ];
  if (v.experience === 'new') steps.push({ id: 'coach', done: v.hasCoach, optional: true, xp: 0, to: '/coach' });
  return steps;
}

export const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
export const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};
