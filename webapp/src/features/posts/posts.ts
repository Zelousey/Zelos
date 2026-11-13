/**
 * Community posts (owner 2026-11-13): a closed Solo trade or a finished Trade War battle shared as
 * a card with a short thesis, to the Zelos community or to other apps. The server builds the card
 * from the real record (functions/posts.py), so the numbers can't be made up; the app only sends
 * which trade or battle, and the thesis.
 */
import { collection, limit, orderBy, query, where, type DocumentData } from 'firebase/firestore';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';

export type PostSource = 'solo' | 'battle';
export type SoloCard = { sym: string; qty: number; entry: number; exit: number; pnl: number; pct: number; option?: string; openDay?: string; closeDay?: string };
export type BattleCard = { name: string; rank: number; of: number; pnlPct: number; pnl: number; start: number | null; final: number | null; trades: number; modes: string[]; endedAt?: number };
export type Post =
  | { id: string; uid: string; name: string; username: string | null; photo: string | null; source: 'solo'; card: SoloCard; thesis: string; createdAt: number }
  | { id: string; uid: string; name: string; username: string | null; photo: string | null; source: 'battle'; card: BattleCard; thesis: string; createdAt: number };

export const THESIS_MAX = 280;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');

export function parsePost(id: string, d: DocumentData): Post | null {
  const c = (d.card ?? {}) as Record<string, unknown>;
  const base = { id, uid: str(d.uid, 128), name: str(d.name, 24) || 'Trader', username: typeof d.username === 'string' ? d.username : null, photo: typeof d.photo === 'string' ? d.photo : null, thesis: str(d.thesis, 600), createdAt: num(d.createdAt) };
  if (!base.uid) return null;
  if (d.source === 'solo') {
    if (typeof c.sym !== 'string') return null;
    return { ...base, source: 'solo', card: { sym: c.sym, qty: num(c.qty), entry: num(c.entry), exit: num(c.exit), pnl: num(c.pnl), pct: num(c.pct), option: typeof c.option === 'string' ? c.option : undefined, openDay: typeof c.openDay === 'string' ? c.openDay : undefined, closeDay: typeof c.closeDay === 'string' ? c.closeDay : undefined } };
  }
  if (d.source === 'battle') {
    return { ...base, source: 'battle', card: { name: str(c.name, 40) || 'Trade War', rank: num(c.rank), of: num(c.of), pnlPct: num(c.pnlPct), pnl: num(c.pnl), start: typeof c.start === 'number' ? c.start : null, final: typeof c.final === 'number' ? c.final : null, trades: num(c.trades), modes: Array.isArray(c.modes) ? c.modes.filter((x): x is string => typeof x === 'string') : [], endedAt: typeof c.endedAt === 'number' ? c.endedAt : undefined } };
  }
  return null;
}

/** The newest posts of one kind (Solo trades and Trade War stay separate, owner 2026-11-13). */
export const useFeed = (source: PostSource) => useLiveQuery(`posts:${source}`, () => query(collection(db(), 'posts'), where('source', '==', source), orderBy('createdAt', 'desc'), limit(40)), parsePost);

export const createPost = (source: PostSource, ref: string, thesis: string) => callFunction<{ source: PostSource; ref: string; thesis: string }, { ok: boolean; id: string }>('community_post', { source, ref, thesis });
export const deletePost = (id: string) => callFunction<{ id: string }, { ok: boolean }>('community_post_delete', { id });

/** What a card shows before it's posted (the share sheet builds it from what the page already has). */
export type Draft = { source: 'solo'; ref: string; card: SoloCard; name: string } | { source: 'battle'; ref: string; card: BattleCard; name: string };
