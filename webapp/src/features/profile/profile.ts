/**
 * Profile data and actions (/profile, /profile/:uid), the same documents as the website's
 * practice/profile.html:
 *   practiceProfiles/{uid}  Trade War numbers (server-written)          dashboard/social.ts useMyProfile
 *   traders/{uid}           name, @username, picture, bio (public)     dashboard/social.ts useIdentity
 *   twRecords/{uid}         Trade War match record (server-written)
 *   cosmetics/{uid}         profile looks bought with tokens (server-written)
 * Editing: the server saves the name and @username (profile_setup, which checks the
 * username); the bio and picture are written to traders/{uid} directly, which
 * firestore.rules allows only for yourself and checks (bio ≤ 160, picture ≤ 20,000 chars).
 */
import { arrayRemove, arrayUnion, doc, getDoc, setDoc, updateDoc, type DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { callFunction, db } from '../../lib/firebase';
import { ACHIEVEMENTS, type AchievementDef } from '../dashboard/progress';
import { profileSetup } from '../welcome/welcome';
import type { Payload, Ruleset } from '../battles/settings';

export const UID_RE = /^[A-Za-z0-9]{10,40}$/;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '');

// ---------------------------------------------------------------- Trade War record
export type WarResult = { w: string; name: string; rank: number; of: number; pnlPct: number | null; surrendered: boolean };
export type WarRecord = { played: number; wins: number; losses: number; surrenders: number; recent: WarResult[] };

export function parseRecord(d: DocumentData): WarRecord {
  const recent = Array.isArray(d.recent) ? (d.recent as unknown[]) : [];
  return {
    played: Math.max(0, Math.floor(num(d.played))),
    wins: Math.max(0, Math.floor(num(d.wins))),
    losses: Math.max(0, Math.floor(num(d.losses))),
    surrenders: Math.max(0, Math.floor(num(d.surrenders))),
    recent: recent
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && /^[A-Za-z0-9]{6,40}$/.test(String((x as Record<string, unknown>).w ?? '')))
      .slice(0, 5)
      .map((x) => ({ w: String(x.w), name: str(x.name, 40) || 'Trade War', rank: Math.max(1, Math.floor(num(x.rank, 1))), of: Math.max(1, Math.floor(num(x.of, 1))), pnlPct: typeof x.pnlPct === 'number' && Number.isFinite(x.pnlPct) ? x.pnlPct : null, surrendered: x.surrendered === true })),
  };
}
export const useWarRecord = (uid: string | null) => useLiveDoc(uid ? `twRecords/${uid}` : null, parseRecord);

// ---------------------------------------------------------------- profile looks
/** Same items as the website (zelos-tokens.js LOOKS); the server owns names, prices and who owns what. */
export const LOOK_COLORS: Record<string, string> = { gold: '#f2c14e', emerald: '#34d399', electric: '#38bdf8', crimson: '#fb7185', violet: '#a78bfa', rainbow: 'prism' };
export const LOOK_BADGES: Record<string, string> = { bull: '🐂', bear: '🐻', rocket: '🚀', diamond: '💎', crown: '👑', coin: '🪙', fire: '🔥', bolt: '⚡', launch: '🚀' };
/** Animated badges (owner 2026-10-23): badge id -> its animation. */
export const LOOK_BADGE_ANIM: Record<string, 'spin' | 'flicker' | 'pulse' | 'lift'> = { coin: 'spin', fire: 'flicker', bolt: 'pulse', launch: 'lift' };
/** Photo frames: a coloured ring around your picture. */
export const LOOK_FRAMES: Record<string, string> = {
  gold: 'linear-gradient(135deg,#f9d976,#b8860b 55%,#f9d976)',
  diamond: 'linear-gradient(135deg,#a5f3fc,#e0e7ff 45%,#67e8f9)',
  flame: 'linear-gradient(135deg,#facc15,#f97316 45%,#ef4444)',
  emerald: 'linear-gradient(135deg,#6ee7b7,#059669 55%,#065f46)',
};
/** Chart theme swatches (the colours themselves live in practice/practice-chart.js THEMES). */
export const LOOK_CHARTS: Record<string, string> = {
  midnight: 'linear-gradient(135deg,#0b1630 60%,#5eead4 60% 80%,#f472b6 80%)',
  paper: 'linear-gradient(135deg,#f6f1e4 60%,#1f7a4d 60% 80%,#b42318 80%)',
  neon: 'linear-gradient(135deg,#05010d 60%,#39ff14 60% 80%,#ff2bd6 80%)',
};
export const LOOK_BANNERS: Record<string, string> = {
  sunset: 'linear-gradient(135deg,#ff7e5f,#feb47b 45%,#6a3093)',
  midnight: 'linear-gradient(135deg,#0f2027,#203a43 50%,#2c5364)',
  neon: 'linear-gradient(rgba(0,255,255,.18) 1px,transparent 1px) 0 0/18px 18px,linear-gradient(90deg,rgba(255,0,200,.18) 1px,transparent 1px) 0 0/18px 18px,linear-gradient(135deg,#12002b,#2b0050)',
  ocean: 'linear-gradient(135deg,#1c6e8c,#2193b0 45%,#6dd5ed)',
  gold: 'linear-gradient(135deg,#8a6a1f,#e8c66a 30%,#b38728 60%,#fbf5b7 80%,#aa771c)',
};
const FOUNDER_ICONS: Record<number, string> = { 5: '🏛️', 10: '⭐', 25: '🏗️', 50: '🛡️', 100: '🏆' };

export type Looks = { color: string | null; prism: boolean; badge: string | null; badgeAnim: 'spin' | 'flicker' | 'pulse' | 'lift' | null; frame: string | null; chart: string | null; banner: string | null; founder: { title: string; icon: string; of: string } | null; community: { cid: string; name: string; state: string } | null };
export function parseLooks(d: DocumentData): Looks {
  const c = typeof d.color === 'string' ? LOOK_COLORS[d.color] : undefined;
  const f = d.founder && typeof d.founder === 'object' ? (d.founder as Record<string, unknown>) : null;
  const cm = d.community && typeof d.community === 'object' ? (d.community as Record<string, unknown>) : null;
  return {
    color: c && c !== 'prism' ? c : null,
    prism: c === 'prism',
    badge: typeof d.badge === 'string' ? (LOOK_BADGES[d.badge] ?? null) : null,
    badgeAnim: typeof d.badge === 'string' ? (LOOK_BADGE_ANIM[d.badge] ?? null) : null,
    frame: typeof d.frame === 'string' ? (LOOK_FRAMES[d.frame] ?? null) : null,
    chart: typeof d.chart === 'string' && d.chart in LOOK_CHARTS ? d.chart : null,
    banner: typeof d.banner === 'string' ? (LOOK_BANNERS[d.banner] ?? null) : null,
    founder: f && str(f.title, 40) ? { title: str(f.title, 40), icon: FOUNDER_ICONS[num(f.tier)] ?? '🏛️', of: str(f.name, 40) } : null,
    community: cm && /^[A-Za-z0-9_-]{3,40}$/.test(String(cm.cid ?? '')) ? { cid: String(cm.cid), name: str(cm.name, 40), state: str(cm.state, 20) } : null,
  };
}
export const useLooks = (uid: string | null) => useLiveDoc(uid ? `cosmetics/${uid}` : null, parseLooks);

// ---------------------------------------------------------------- friends and challenges
/** Add a friend (your users/{uid}.friends, like the website) and let them know (friend_ping, once per pair). */
export async function addFriend(me: string, uid: string): Promise<{ mutual: boolean }> {
  await setDoc(doc(db(), 'users', me), { friends: arrayUnion(uid) }, { merge: true });
  try {
    const r = await callFunction<{ uid: string }, { sent: boolean; mutual?: boolean }>('friend_ping', { uid });
    return { mutual: !!r.mutual };
  } catch {
    return { mutual: false }; // the friend is added either way; the ping is a courtesy
  }
}
export const removeFriend = (me: string, uid: string) => updateDoc(doc(db(), 'users', me), { friends: arrayRemove(uid) });

/** Challenge a trader, or everyone else in your squad, to a Trade War (functions/main.py tw_challenge: they get a card to accept or decline). */
export const challenge = (data: ({ to: string } | { squadId: string; ruleset?: Ruleset }) & { name: string; buyIn: number; days: number } & Payload & { extraSlot?: boolean }) => callFunction<typeof data, { warId: string }>('tw_challenge', data);

// ---------------------------------------------------------------- editing
export const BIO_MAX = 160;
export const PHOTO_MAX = 19500; // characters of the data: URL; firestore.rules allows 20,000
export const cleanBio = (v: string) => v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, BIO_MAX);

export type ProfileEdit = { name: string; username: string; bio: string; avatar: string | null };
/**
 * Save the editor: name + @username through the server first (it claims the username), then
 * the bio and picture, then the copy on the public leaderboard row if there is one.
 */
export async function saveProfile(uid: string, v: ProfileEdit): Promise<{ awarded: boolean }> {
  const r = await profileSetup({ name: v.name, username: v.username });
  const bio = cleanBio(v.bio);
  await setDoc(doc(db(), 'traders', uid), { bio: bio || null, avatar: v.avatar, updatedAt: Date.now() }, { merge: true });
  const pp = doc(db(), 'practiceProfiles', uid);
  try {
    if ((await getDoc(pp)).exists()) await updateDoc(pp, { name: r.name, username: r.username, photo: v.avatar });
  } catch {
    /* the leaderboard picks the new name up on the next trade */
  }
  return { awarded: r.awarded };
}

/** The square sizes and JPEG qualities tried, largest first (same as the website's zelos-profile.js). */
export const SHRINK_STEPS: [number, number][] = [
  [160, 0.85],
  [128, 0.8],
  [112, 0.7],
  [96, 0.6],
];
export const PHOTO_FILE_MAX = 15 * 1024 * 1024;

/** A picture file → a small centre-cropped square JPEG data: URL that fits the profile doc. */
export async function shrinkImage(file: File): Promise<string> {
  if (!/^image\//.test(file.type)) throw new Error('not-image');
  if (file.size > PHOTO_FILE_MAX) throw new Error('too-big');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('not-image'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('not-image');
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    for (const [px, q] of SHRINK_STEPS) {
      const c = document.createElement('canvas');
      c.width = c.height = px;
      const g = c.getContext('2d');
      if (!g) break;
      g.fillStyle = '#101216'; // transparent parts get the website's dark background
      g.fillRect(0, 0, px, px);
      g.drawImage(img, sx, sy, side, side, 0, 0, px, px);
      const out = c.toDataURL('image/jpeg', q);
      if (out.startsWith('data:image/jpeg;base64,') && out.length <= PHOTO_MAX) return out;
    }
    throw new Error('too-big');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------- achievements
/** Earned achievements grouped like the website (groups in first-earned order); unknown ids are dropped. */
export function groupEarned(ids: string[]): { group: string; items: AchievementDef[] }[] {
  const out: { group: string; items: AchievementDef[] }[] = [];
  for (const id of new Set(ids)) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) continue;
    let g = out.find((x) => x.group === a.group);
    if (!g) out.push((g = { group: a.group, items: [] }));
    g.items.push(a);
  }
  return out;
}
/** Groups earned in Trade War (virtual) play, tagged TRADE WAR like on the website. */
export const isWarGroup = (g: string) => g === 'Trading' || g === 'Milestones' || g === 'Seasons';

// ---------------------------------------------------------------- the looks shop (cosmetics_*)
export type ShopKind = 'color' | 'badge' | 'frame' | 'banner' | 'chart';
export const SHOP_KINDS: ShopKind[] = ['color', 'badge', 'frame', 'banner', 'chart'];
export type ShopItem = { id: string; name: string; price: number };
export type ShopState = { shop: Partial<Record<ShopKind, ShopItem[]>>; owned: string[]; look: Record<string, unknown> };
/** The shop, what you own and what you're wearing (the server owns names, prices and ownership). */
export const loadShop = () => callFunction<Record<string, never>, ShopState>('cosmetics_equip', {});
/** Buy an item (charged once) and wear it. */
export const buyLook = (kind: ShopKind, id: string) => callFunction<{ kind: ShopKind; id: string }, { balance: number; owned: string[]; charged: number }>('cosmetics_buy', { kind, id });
/** Wear something you own, or take it off (id null). */
export const wearLook = (kind: ShopKind, id: string | null) => callFunction<{ kind: ShopKind; id: string | null }, ShopState>('cosmetics_equip', { kind, id });
