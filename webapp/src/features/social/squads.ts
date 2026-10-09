/**
 * Trading Squads in the app, on the same documents as the website (zelos-social.js,
 * practice/squads.js); firestore.rules checks every write:
 *   squads/{id}                 { name, owner, members, names, createdAt, comp, goal, code, config, helpMode }
 *   squads/{id}/messages/{id}   { author, name, text, photo?, createdAt, r: {uid: reaction} }  members only
 *   squadCodes/{CODE}           { squad }  a private 6-character room code
 * The squad leaderboard reads each member's public practiceProfiles doc. Scores are % growth in
 * "net P&L" (account value minus $10,000 plus what resets wiped out), so a reset never counts as a gain.
 */
import { collection, deleteDoc, deleteField, doc, documentId, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, addDoc, Timestamp, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { db } from '../../lib/firebase';
import { parseRanked, type Ranked } from '../dashboard/social';
import { monthKey, nyToday, seasonFor, weekKey } from '../leaderboard/periods';

export const START = 10000;
export const MAX_MEMBERS = 50;
const UID = /^[A-Za-z0-9]{10,40}$/;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export type Base = { net: number; eq: number; xp: number };
export type Comp = { start: number; end: number; days: number; base: Record<string, Base> };
export type Goal = { text: string; target: number; days: number; start: number; end: number; base: Record<string, Base> };
export type SquadConfig = { reactions: boolean; photos: boolean; viewTrades: boolean; symbols: string[] | null };
export type Squad = { id: string; name: string; owner: string; members: string[]; names: Record<string, string>; createdAt: number; comp: Comp | null; goal: Goal | null; code: string | null; config: SquadConfig; rawConfig: Record<string, unknown>; helpMode: boolean | null };

function parseBase(v: unknown): Record<string, Base> {
  const out: Record<string, Base> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [u, b] of Object.entries(v as Record<string, unknown>).slice(0, 60)) if (b && typeof b === 'object') out[u] = { net: num((b as Base).net), eq: num((b as Base).eq, START), xp: num((b as Base).xp) };
  return out;
}

export function parseSquad(id: string, d: DocumentData): Squad {
  const members = Array.isArray(d.members) ? (d.members as unknown[]).filter((x): x is string => typeof x === 'string' && UID.test(x)).slice(0, MAX_MEMBERS) : [];
  const names: Record<string, string> = {};
  if (d.names && typeof d.names === 'object') for (const [u, n] of Object.entries(d.names as Record<string, unknown>)) if (typeof n === 'string') names[u] = n.slice(0, 24);
  const c = d.comp && typeof d.comp === 'object' ? (d.comp as Record<string, unknown>) : null;
  const g = d.goal && typeof d.goal === 'object' ? (d.goal as Record<string, unknown>) : null;
  const cfg = d.config && typeof d.config === 'object' ? (d.config as Record<string, unknown>) : {};
  return {
    id,
    name: str(d.name, 32) || 'Squad',
    owner: str(d.owner, 40),
    members,
    names,
    createdAt: num(d.createdAt),
    comp: c && num(c.end) > 0 ? { start: num(c.start), end: num(c.end), days: num(c.days, 7), base: parseBase(c.base) } : null,
    goal: g && num(g.end) > 0 && num(g.target) > 0 ? { text: str(g.text, 80), target: num(g.target), days: num(g.days, 7), start: num(g.start), end: num(g.end), base: parseBase(g.base) } : null,
    code: typeof d.code === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(d.code) ? d.code : null,
    config: {
      reactions: cfg.reactions !== false,
      photos: cfg.photos === true,
      viewTrades: cfg.viewTrades === true,
      symbols: Array.isArray(cfg.symbols) ? (cfg.symbols as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 60) : null,
    },
    rawConfig: cfg,
    helpMode: typeof d.helpMode === 'boolean' ? d.helpMode : null,
  };
}

export const useSquad = (id: string | null) => useLiveDoc(id ? `squads/${id}` : null, (d) => parseSquad(id ?? '', d));
export const useMySquadList = (uid: string | null) => useLiveQuery(uid ? `squadlist:${uid}` : null, () => query(collection(db(), 'squads'), where('members', 'array-contains', uid), limit(20)), parseSquad);

/** Public profiles for a list of uids (the squad leaderboard, the friends list). */
export function useProfiles(uids: string[]): Record<string, Ranked> | null {
  const key = [...new Set(uids)].filter((u) => UID.test(u)).sort().join(',');
  const [state, setState] = useState<{ key: string; data: Record<string, Ranked> } | null>(null);
  useEffect(() => {
    let live = true;
    const list = key ? key.split(',') : [];
    (async () => {
      const out: Record<string, Ranked> = {};
      for (let i = 0; i < list.length; i += 30) {
        const snap = await getDocs(query(collection(db(), 'practiceProfiles'), where(documentId(), 'in', list.slice(i, i + 30))));
        snap.forEach((d) => {
          const r = parseRanked(d.id, d.data());
          if (r) out[d.id] = r;
        });
      }
      if (live) setState({ key, data: out });
    })().catch(() => live && setState({ key, data: {} }));
    return () => {
      live = false;
    };
  }, [key]);
  return state?.key === key ? state.data : null;
}

// ---------------------------------------------------------------- scoring (zelos-social.js)
export const net = (p: Ranked) => p.netPnl;
export const dayOf = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
/** The profile's end-of-day snapshot on or before a day (YYYY-MM-DD). */
export function netOn(p: Ranked, day: string): { n: number; x: number; e: number } | null {
  const h = p.detail?.hist ?? {};
  const key = 'd' + day.replace(/-/g, '');
  let best: string | null = null;
  for (const k of Object.keys(h)) if (k <= key && (!best || k > best)) best = k;
  return best ? h[best]! : null;
}
export const baseFor = (p: Ranked): Base => ({ net: Math.round(net(p) * 100) / 100, eq: p.equity || START, xp: p.xp });
/** Growth since a baseline; frozen at `endMs` once that has passed. */
export function scoreSince(p: Ranked, base: Base, endMs: number | null, now = Date.now()) {
  let n = net(p);
  let xp = p.xp;
  if (endMs && now > endMs) {
    const h = netOn(p, dayOf(endMs));
    if (h) {
      n = h.n;
      xp = h.x;
    }
  }
  const pnl = n - (base.net || 0);
  return { pnl, pct: (pnl / (base.eq || START)) * 100, xp: xp - (base.xp || 0) };
}

export type BoardId = 'comp' | 'all' | 'week' | 'month' | 'season';
export type Score = { pct: number; pnl: number; xp?: number };
export function metric(sq: Squad, board: BoardId, uid: string, p: Ranked | undefined, now = Date.now()): Score | null {
  if (!p) return null;
  const day = nyToday(now);
  if (board === 'comp' && sq.comp) {
    let base = sq.comp.base[uid];
    if (!base) {
      const hs = netOn(p, dayOf(sq.comp.start));
      base = hs ? { net: hs.n, eq: hs.e, xp: hs.x } : baseFor(p);
    }
    return scoreSince(p, base, sq.comp.end, now);
  }
  const per = (k: string | undefined) => (k && p.p[k] ? { pct: p.p[k]!.pct ?? 0, pnl: p.p[k]!.pnl ?? 0, xp: p.p[k]!.xp } : { pct: 0, pnl: 0 });
  if (board === 'week') return per(weekKey(day));
  if (board === 'month') return per(monthKey(day));
  if (board === 'season') return per(seasonFor(day)?.id);
  return { pct: p.growthPct, pnl: net(p) };
}

export function goalProgress(sq: Squad, profs: Record<string, Ranked>, now = Date.now()) {
  const g = sq.goal;
  if (!g) return null;
  const list = sq.members.flatMap((u) => {
    const p = profs[u];
    return p ? [scoreSince(p, g.base[u] ?? baseFor(p), g.end, now).pct] : [];
  });
  const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
  return { avg, pct: Math.max(0, Math.min(100, (avg / g.target) * 100)), done: avg >= g.target, over: now >= g.end, counted: list.length };
}

// ---------------------------------------------------------------- actions
const squadRef = (id: string) => doc(db(), 'squads', id);
const cleanName = (v: string) => v.replace(/[<>]/g, '').trim().slice(0, 32);
function newId(n = 12, abc = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  const r = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(r, (x) => abc[x % abc.length]).join('');
}

/** The name squadmates see: your Trade War name, else your @username, else your first name. */
export async function myName(uid: string, displayName: string | null): Promise<string> {
  let n: string | null = null;
  try {
    const p = await getDoc(doc(db(), 'practiceProfiles', uid));
    n = p.exists() ? str(p.data().name, 24) || null : null;
    if (!n) {
      const t = await getDoc(doc(db(), 'traders', uid));
      const d = t.exists() ? t.data() : {};
      n = typeof d.username === 'string' ? `@${d.username}` : str(d.name, 24) || null;
    }
  } catch {
    /* fall back to the sign-in name */
  }
  return (n || (displayName ?? '').split(' ')[0] || 'Trader').slice(0, 24);
}

export async function createSquad(uid: string, displayName: string | null, name: string): Promise<string> {
  const nm = cleanName(name);
  if (!nm) throw new Error('Give your squad a name.');
  const id = newId();
  await setDoc(squadRef(id), { name: nm, owner: uid, members: [uid], names: { [uid]: await myName(uid, displayName) }, createdAt: Date.now(), comp: null });
  return id;
}
export async function joinSquad(sq: Squad, uid: string, displayName: string | null) {
  if (sq.members.includes(uid)) return;
  if (sq.members.length >= MAX_MEMBERS) throw new Error(`This squad is full (${MAX_MEMBERS} members).`);
  await updateDoc(squadRef(sq.id), { members: [...sq.members, uid], names: { ...sq.names, [uid]: await myName(uid, displayName) } });
}
export function leaveSquad(sq: Squad, uid: string) {
  const names = { ...sq.names };
  delete names[uid];
  return updateDoc(squadRef(sq.id), { members: sq.members.filter((m) => m !== uid), names });
}
export function removeMember(sq: Squad, uid: string) {
  return leaveSquad(sq, uid); // same write; the rules let only the owner remove someone else
}
export function renameSquad(sq: Squad, name: string) {
  const nm = cleanName(name);
  if (!nm) return Promise.reject(new Error('Give your squad a name.'));
  return updateDoc(squadRef(sq.id), { name: nm });
}
const basesFor = (sq: Squad, profs: Record<string, Ranked>) => Object.fromEntries(sq.members.flatMap((u) => (profs[u] ? [[u, baseFor(profs[u])]] : [])));
export function startComp(sq: Squad, profs: Record<string, Ranked>, days: 7 | 30) {
  const start = Date.now();
  return updateDoc(squadRef(sq.id), { comp: { start, end: start + days * 864e5, days, base: basesFor(sq, profs) } });
}
export const endComp = (sq: Squad) => updateDoc(squadRef(sq.id), { comp: null });
export const GOAL_TARGETS = [1, 2, 3, 5, 10, 20];
export function setGoal(sq: Squad, profs: Record<string, Ranked>, text: string, target: number, days: 7 | 30) {
  const start = Date.now();
  return updateDoc(squadRef(sq.id), { goal: { text: text.replace(/[<>]/g, '').trim().slice(0, 80), target, days, start, end: start + days * 864e5, base: basesFor(sq, profs) } });
}
export const clearGoal = (sq: Squad) => updateDoc(squadRef(sq.id), { goal: null });
export const setHelpMode = (sq: Squad, on: boolean) => updateDoc(squadRef(sq.id), { helpMode: on });
export const setConfig = (sq: Squad, patch: Partial<SquadConfig>) => updateDoc(squadRef(sq.id), { config: { ...sq.rawConfig, ...patch } });

const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I)
export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export async function newRoomCode(sq: Squad): Promise<string> {
  const c = newId(6, CODE_ABC);
  await setDoc(doc(db(), 'squadCodes', c), { squad: sq.id });
  await updateDoc(squadRef(sq.id), { code: c });
  if (sq.code) await deleteDoc(doc(db(), 'squadCodes', sq.code)).catch(() => {});
  return c;
}
export async function removeRoomCode(sq: Squad) {
  if (!sq.code) return;
  await updateDoc(squadRef(sq.id), { code: null });
  await deleteDoc(doc(db(), 'squadCodes', sq.code)).catch(() => {});
}
export const cleanCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');
export async function findRoomCode(code: string): Promise<string> {
  const c = cleanCode(code);
  if (!CODE_RE.test(c)) throw new Error('Room codes are 6 letters and numbers, like K7QX2M.');
  const d = await getDoc(doc(db(), 'squadCodes', c));
  const id = d.exists() ? d.data().squad : null;
  if (typeof id !== 'string') throw new Error(`No squad has the room code ${c}.`);
  return id;
}
/** Chat first (only readable while the squad exists), then the room code, then the squad. */
export async function deleteSquad(sq: Squad) {
  for (;;) {
    const snap = await getDocs(query(collection(squadRef(sq.id), 'messages'), limit(200)));
    if (snap.empty) break;
    const b = writeBatch(db());
    snap.forEach((d) => b.delete(d.ref));
    await b.commit();
    if (snap.size < 200) break;
  }
  if (sq.code) await deleteDoc(doc(db(), 'squadCodes', sq.code)).catch(() => {});
  await deleteDoc(squadRef(sq.id));
}

// ---------------------------------------------------------------- chat
export const REACTIONS = ['like', 'fire', 'rocket', 'trophy', 'smile'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_EMOJI: Record<Reaction, string> = { like: '👍', fire: '🔥', rocket: '🚀', trophy: '🏆', smile: '😄' };
export type Message = { id: string; author: string; name: string; text: string; photo: string | null; at: number; r: Record<string, Reaction> };

export function parseMessage(id: string, d: DocumentData): Message | null {
  if (typeof d.author !== 'string') return null;
  const r: Record<string, Reaction> = {};
  if (d.r && typeof d.r === 'object') for (const [u, k] of Object.entries(d.r as Record<string, unknown>)) if (REACTIONS.includes(k as Reaction)) r[u] = k as Reaction;
  const at = d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now(); // pending server time: now
  return { id, author: d.author, name: str(d.name, 24) || 'Trader', text: str(d.text, 500), photo: typeof d.photo === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(d.photo) ? d.photo : null, at, r };
}
/** The last 60 messages, oldest first. `attempt` restarts the listener (right after joining, membership may lag). */
export function useMessages(squadId: string | null, attempt: number) {
  const s = useLiveQuery(squadId ? `chat:${squadId}:${attempt}` : null, () => query(collection(squadRef(squadId!), 'messages'), orderBy('createdAt', 'desc'), limit(60)), parseMessage);
  return s.status === 'ready' ? { status: 'ready' as const, data: [...s.data].reverse() } : s;
}
export async function sendMessage(sq: Squad, uid: string, text: string, photo: string | null) {
  const t = text.trim().slice(0, 500);
  if (!t && !photo) return;
  await addDoc(collection(squadRef(sq.id), 'messages'), { author: uid, name: (sq.names[uid] || 'Trader').slice(0, 24), text: t, createdAt: serverTimestamp(), r: {}, ...(photo ? { photo } : {}) });
}
export function react(sq: Squad, m: Message, uid: string, kind: Reaction) {
  return updateDoc(doc(db(), 'squads', sq.id, 'messages', m.id), { [`r.${uid}`]: m.r[uid] === kind ? deleteField() : kind });
}
export const deleteMessage = (sq: Squad, m: Message) => deleteDoc(doc(db(), 'squads', sq.id, 'messages', m.id));

export const CHAT_PHOTO_MAX = 240000; // the rules allow 250,000 characters
/** A camera-roll photo resized to a JPEG of at most 900px that fits the chat rules. */
export async function chatPhoto(file: File): Promise<string> {
  if (!/^image\//.test(file.type)) throw new Error('Pick a photo.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error('Couldn’t read that photo.'));
      i.src = url;
    });
    const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    for (let q = 0.8; q > 0.25; q -= 0.1) {
      const out = c.toDataURL('image/jpeg', q);
      if (out.length <= CHAT_PHOTO_MAX) return out;
    }
    throw new Error('That photo is too large. Try a smaller one.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------- friends
/** A trader's uid from their @username (usernames/{name} is public). */
export async function uidForUsername(v: string): Promise<string> {
  const u = v.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(u)) throw new Error('Type a username like @amy_trades.');
  const d = await getDoc(doc(db(), 'usernames', u));
  const id = d.exists() ? d.data().uid : null;
  if (typeof id !== 'string') throw new Error(`No trader has the username @${u} yet.`);
  return id;
}
