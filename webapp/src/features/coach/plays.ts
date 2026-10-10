/**
 * Coach plays (owner 2026-10-10): the coach draws on a chart (lines, arrows, price levels,
 * boxes, labels) with a title and a note; the student gets "Your coach drew up a play" and
 * both can comment. Stored by the server in coachings/{id}/plays (functions/main.py coach_play,
 * coach_play_comment); drawings are pinned to bar dates and prices, so they show on the live chart.
 */
import { collection, limit, orderBy, query, type DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';
import type { Shape, ShapeColor, ShapeKind } from '../charts/engine';
import type { Timeframe } from '../charts/series';

export const PLAY_TFS: Timeframe[] = ['15m', '1h', 'D', 'W'];
export const MAX_SHAPES = 40; // same limits as functions/coaching.py
export const MAX_TITLE = 80;
export const MAX_NOTE = 500;
export const MAX_COMMENT = 300;
const KINDS: ShapeKind[] = ['line', 'arrow', 'box', 'hline', 'text'];
const COLORS: ShapeColor[] = ['blue', 'green', 'red', 'gold'];

export type PlayComment = { from: string; fromName: string; role: 'coach' | 'student'; text: string; at: number };
export type Play = { id: string; from: string; fromName: string; sym: string; tf: Timeframe; title: string; note: string; shapes: Shape[]; comments: PlayComment[]; at: number };

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function parseShape(v: unknown): Shape | null {
  const s = v as Record<string, unknown> | null;
  if (!s || !KINDS.includes(s.k as ShapeKind) || !Array.isArray(s.pts)) return null;
  const pts = (s.pts as Record<string, unknown>[]).filter((p) => p && typeof p.d === 'string' && typeof p.p === 'number' && p.p > 0).map((p) => ({ d: p.d as string, p: p.p as number }));
  if (pts.length !== (s.k === 'hline' || s.k === 'text' ? 1 : 2)) return null;
  const text = str(s.text, 80);
  return { k: s.k as ShapeKind, c: COLORS.includes(s.c as ShapeColor) ? (s.c as ShapeColor) : 'blue', pts, ...(text ? { text } : {}) };
}

export function parsePlay(id: string, d: DocumentData): Play | null {
  if (typeof d.sym !== 'string' || !PLAY_TFS.includes(d.tf)) return null;
  return {
    id,
    from: str(d.from, 64),
    fromName: str(d.fromName, 24) || 'Coach',
    sym: d.sym,
    tf: d.tf,
    title: str(d.title, MAX_TITLE),
    note: str(d.note, MAX_NOTE),
    shapes: Array.isArray(d.shapes) ? d.shapes.map(parseShape).filter((x: Shape | null): x is Shape => !!x) : [],
    comments: Array.isArray(d.comments)
      ? (d.comments as Record<string, unknown>[]).filter((c) => c && typeof c.text === 'string').map((c) => ({ from: str(c.from, 64), fromName: str(c.fromName, 24) || 'Someone', role: c.role === 'coach' ? 'coach' : 'student', text: str(c.text, MAX_COMMENT), at: num(c.at) }))
      : [],
    at: num(d.at),
  };
}

export const usePlays = (coachingId: string | null) => useLiveQuery(coachingId ? `plays:${coachingId}` : null, () => query(collection(db(), 'coachings', coachingId!, 'plays'), orderBy('at', 'desc'), limit(20)), parsePlay);
export const usePlay = (coachingId: string | null, playId: string | null) => useLiveDoc(coachingId && playId ? `coachings/${coachingId}/plays/${playId}` : null, (d) => parsePlay(playId ?? '', d));

export const sendPlay = (data: { coachingId: string; sym: string; tf: Timeframe; title: string; note: string; shapes: Shape[] }) => callFunction<typeof data, { playId: string }>('coach_play', data);
export const commentPlay = (data: { coachingId: string; playId: string; text: string }) => callFunction<typeof data, { ok: boolean }>('coach_play_comment', data);
