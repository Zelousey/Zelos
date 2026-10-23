/**
 * Hall of Minds (owner 2026-10-22): history's great minds, and what a trader can take from them.
 * The content is bundled from data/minds.json (the server reads the same file, functions/minds.py):
 * figures with their story, accounts of how they carried themselves, who they learned from, short
 * lessons and checked quotes. Historical figures only, with public-domain portraits (owner: no
 * modern people's faces). The head-to-head pairs were removed (owner 2026-10-23).
 *
 * Lessons are free and pay 10 XP once each (xp_award "mind"); progress is kept on
 * users/{uid}.mindsDone. A figure's daily quote costs FOLLOW_COST tokens for 30 days (minds_follow).
 */
import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import raw from '../../../../data/minds.json';
import { callFunction, db } from '../../lib/firebase';

export type MindLesson = { id: string; title: string; text: string[]; trading: string };
export type MindQuote = { id: string; text: string; source: string; plain: string; trading: string };
export type Account = { title: string; text: string; source: string };
/** Who they learned from (or who learned from them), linking to those figures' pages. */
export type Studied = { title: string; text: string; source: string; figures: string[] };
export type Group = 'markets' | 'history';
/** Then & now: a words-only comparison with a modern person (owner 2026-10-23: no modern faces). */
export type ThenNow = { modern: string; text: string[]; trading: string };
export type Figure = {
  id: string; name: string; role: string; years: string; tagline: string; portrait: string;
  story: string[]; carried: Account[]; studied: Studied[]; group: Group; lessons: MindLesson[]; quotes: MindQuote[]; thenNow?: ThenNow;
};
export const FIGURES = raw.figures as Figure[];
export const MODERN_NOTE = raw.modernNote as string;
export const MIND_XP = 10;
export const FOLLOW_COST = 15;
export const FOLLOW_DAYS = 30;

const BY_ID = new Map(FIGURES.map((f) => [f.id, f]));
export const figureById = (id: string) => BY_ID.get(id);
/** The grid, in the owner's order. */
export const ORDERED: Figure[] = (raw.order as string[]).map((id) => figureById(id)).filter((f): f is Figure => !!f);

/** Portraits are public-domain paintings, served from /app/minds/. */
export const portraitUrl = (f: Figure) => `${import.meta.env.BASE_URL}minds/${f.portrait}`;

export const lessonRef = (figure: string, lesson: string) => `${figure}:${lesson}`;
export const figureProgress = (f: Figure, done: string[]) => f.lessons.filter((l) => done.includes(lessonRef(f.id, l.id))).length;

export const markMind = (uid: string, ref: string) => setDoc(doc(db(), 'users', uid), { mindsDone: arrayUnion(ref) }, { merge: true });
export const mindXp = (ref: string) => callFunction<{ type: string; refId: string }, { awarded?: boolean }>('xp_award', { type: 'mind', refId: ref });
export const followFigure = (figure: string) => callFunction<{ figure: string }, { balance: number; charged: number }>('minds_follow', { figure });
