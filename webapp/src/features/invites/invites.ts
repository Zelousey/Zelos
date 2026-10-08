/**
 * Invites: Battle (a Trade War lobby), Team up (your squad) and Invite a friend (join Zelos).
 * The server creates and answers every invite (functions/main.py invite_*), records
 * referrals and pays their XP; this file only reads invites/{code} and calls those functions.
 */
import { collection, limit, query, where, type DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';

export type InviteKind = 'battle' | 'squad' | 'join' | 'coach';
export type Invite = {
  code: string;
  kind: InviteKind;
  from: string;
  fromName: string;
  fromUsername: string | null;
  fromPhoto: string | null;
  warId: string | null;
  warName: string | null;
  buyIn: number | null;
  days: number | null;
  squadId: string | null;
  squadName: string | null;
  status: 'open' | 'cancelled';
  expiresAt: number;
};

export const CODE_RE = /^[A-Za-z0-9]{10}$/;
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : null);
const safeImg = (v: unknown) => (typeof v === 'string' && (/^https:\/\//.test(v) || /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v)) ? v : null);

export function parseInvite(code: string) {
  return (d: DocumentData): Invite => {
    const kind = (['battle', 'squad', 'join', 'coach'] as const).find((k) => k === d.kind);
    if (!kind || typeof d.from !== 'string') throw new Error('bad invite');
    return {
      code,
      kind,
      from: d.from,
      fromName: str(d.fromName, 24) || 'A friend',
      fromUsername: typeof d.fromUsername === 'string' && /^[a-z0-9_]{3,20}$/.test(d.fromUsername) ? d.fromUsername : null,
      fromPhoto: safeImg(d.fromPhoto),
      warId: typeof d.warId === 'string' && /^[A-Za-z0-9]{12}$/.test(d.warId) ? d.warId : null,
      warName: str(d.warName, 40),
      buyIn: typeof d.buyIn === 'number' && Number.isFinite(d.buyIn) ? d.buyIn : null,
      days: typeof d.days === 'number' && Number.isFinite(d.days) ? d.days : null,
      squadId: typeof d.squadId === 'string' && /^[A-Za-z0-9]{6,40}$/.test(d.squadId) ? d.squadId : null,
      squadName: str(d.squadName, 32),
      status: d.status === 'open' ? 'open' : 'cancelled',
      expiresAt: typeof d.expiresAt === 'number' ? d.expiresAt : 0,
    };
  };
}

export const useInvite = (code: string | null) => useLiveDoc(code && CODE_RE.test(code) ? `invites/${code}` : null, parseInvite(code ?? ''));

export type Squad = { id: string; name: string; members: number };
export const useMySquads = (uid: string | null) =>
  useLiveQuery(uid ? `squads:${uid}` : null, () => query(collection(db(), 'squads'), where('members', 'array-contains', uid), limit(20)), (id, d): Squad | null => ({ id, name: str(d.name, 32) || 'Squad', members: Array.isArray(d.members) ? d.members.length : 1 }));

export type Created = { code: string; url: string; reused: boolean };
export const createInvite = (data: { kind: InviteKind; warId?: string; squadId?: string }) => callFunction<typeof data, Created>('invite_create', data);
export const sendInvite = (code: string, to: string) => callFunction<{ code: string; to: string }, { sent: boolean; already?: boolean }>('invite_send', { code, to });
export type Accepted = { kind: InviteKind; warId: string | null; squadId: string | null; coachingId?: string; referral: boolean; xp: number; again: boolean };
export const acceptInvite = (code: string) => callFunction<{ code: string }, Accepted>('invite_accept', { code });
export const createBattle = (data: { name: string; buyIn: number; days: number; maxPlayers: number }) => callFunction<typeof data, { warId: string }>('tw_create', data);
export const respondChallenge = (inviteId: string, accept: boolean) =>
  callFunction<{ inviteId: string; accept: boolean }, { status: string; warId: string; started?: boolean }>('tw_respond', { inviteId, accept });

/** The server's message for a failed call ("This invite has expired…"), or a generic one. */
export function errorText(e: unknown, fallback: string): string {
  const m = (e as { message?: string })?.message;
  return m && !/^internal$/i.test(m) && m.length < 200 ? m.replace(/^FirebaseError:\s*/, '') : fallback;
}

/** Share a link with the system share sheet, or copy it. */
export async function shareLink(url: string, title: string, text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled';
    }
  }
  return copyText(url);
}

export async function copyText(text: string): Promise<'copied' | 'failed'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export const BUY_INS = [100, 500, 1000, 5000, 10000];
export const DAYS = [1, 3, 7, 14, 30];
