/**
 * Safety (App Store guideline 1.2): reporting what people post, blocking people, and agreeing
 * to the Terms and community rules once.
 *
 *   reportContent(...)        report_content callable: the server saves a copy and tells the admins
 *   block / unblock           users/{uid}.blocked (your own list; the server also refuses
 *                             challenges and friend pings from people who blocked you)
 *   acceptTerms(uid)          users/{uid}.termsAt, plus a device flag so the prompt doesn't flash
 *
 * Blocked words are masked by the server (functions/moderation.py), not here.
 */
import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore';
import { callFunction, db } from '../../lib/firebase';
import { readString, writeString } from '../../lib/storage';

export type ReportKind = 'chat' | 'profile' | 'squad' | 'coach';
export const REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'other'] as const;
export type Reason = (typeof REASONS)[number];
export type ReportTarget = { kind: ReportKind; target: string; where?: string };

export const reportContent = (r: ReportTarget & { reason: Reason; note?: string }) => callFunction<typeof r, { ok: boolean }>('report_content', r);

export const block = (uid: string, who: string) => setDoc(doc(db(), 'users', uid), { blocked: arrayUnion(who) }, { merge: true });
export const unblock = (uid: string, who: string) => setDoc(doc(db(), 'users', uid), { blocked: arrayRemove(who) }, { merge: true });

const TERMS_KEY = 'zelosTerms';
/** Agreed on this device ('all' is set by the browser tests, whose accounts are made fresh each run). */
export const termsAcceptedHere = (uid: string) => [uid, 'all'].includes(readString(TERMS_KEY) ?? '');
export async function acceptTerms(uid: string) {
  await setDoc(doc(db(), 'users', uid), { termsAt: Date.now() }, { merge: true });
  writeString(TERMS_KEY, uid);
}
