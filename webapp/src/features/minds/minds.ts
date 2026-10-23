/**
 * Hall of Minds (owner 2026-10-22): history's great minds, and what a trader can take from them.
 * The content is bundled from data/minds.json (the server reads the same file, functions/minds.py):
 * figures with short lessons and checked quotes, and head-to-head pairs. Historical figures only,
 * with public-domain portraits (owner: no modern people's faces).
 *
 * Lessons and pairs are free and pay 10 XP once each (xp_award "mind"); progress is kept on
 * users/{uid}.mindsDone. A figure's daily quote costs FOLLOW_COST tokens for 30 days (minds_follow).
 */
import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import raw from '../../../../data/minds.json';
import { callFunction, db } from '../../lib/firebase';

export type MindLesson = { id: string; title: string; text: string[]; trading: string };
export type MindQuote = { id: string; text: string; source: string; plain: string; trading: string };
export type Account = { title: string; text: string; source: string };
/** Then & now: a words-only comparison with a modern person (owner 2026-10-23: no modern faces). */
export type ThenNow = { modern: string; text: string[]; trading: string };
export type Figure = {
  id: string; name: string; role: string; years: string; tagline: string; portrait: string;
  story: string[]; carried: Account[]; lessons: MindLesson[]; quotes: MindQuote[]; thenNow?: ThenNow;
};
export type Pair = { id: string; a: string; b: string; title: string; tagline: string; rounds: { topic: string; a: string; b: string }[]; takeaway: string };
export type Tile = { kind: 'figure'; figure: Figure } | { kind: 'pair'; pair: Pair };

export const FIGURES = raw.figures as Figure[];
export const PAIRS = raw.pairs as Pair[];
export const MODERN_NOTE = raw.modernNote as string;
export const MIND_XP = 10;
export const FOLLOW_COST = 15;
export const FOLLOW_DAYS = 30;

const BY_ID = new Map(FIGURES.map((f) => [f.id, f]));
export const figureById = (id: string) => BY_ID.get(id);
export const pairById = (id: string) => PAIRS.find((p) => p.id === id);
/** The pairs a figure is part of. */
export const pairsOf = (id: string) => PAIRS.filter((p) => p.a === id || p.b === id);

/** The grid, in the owner's order: figures with head-to-head pairs mixed in. */
export const TILES: Tile[] = (raw.order as string[]).flatMap((id): Tile[] => {
  const f = figureById(id);
  if (f) return [{ kind: 'figure', figure: f }];
  const p = pairById(id);
  return p ? [{ kind: 'pair', pair: p }] : [];
});

/** Portraits are public-domain paintings, served from /app/minds/. */
export const portraitUrl = (f: Figure) => `${import.meta.env.BASE_URL}minds/${f.portrait}`;
export const pairUrl = (p: Pair) => `${import.meta.env.BASE_URL}minds/pair-${p.id}.webp`;

export const lessonRef = (figure: string, lesson: string) => `${figure}:${lesson}`;
export const pairRef = (pair: string) => `vs:${pair}`;
export const figureProgress = (f: Figure, done: string[]) => f.lessons.filter((l) => done.includes(lessonRef(f.id, l.id))).length;

export const markMind = (uid: string, ref: string) => setDoc(doc(db(), 'users', uid), { mindsDone: arrayUnion(ref) }, { merge: true });
export const mindXp = (ref: string) => callFunction<{ type: string; refId: string }, { awarded?: boolean }>('xp_award', { type: 'mind', refId: ref });
export const followFigure = (figure: string) => callFunction<{ figure: string }, { balance: number; charged: number }>('minds_follow', { figure });
