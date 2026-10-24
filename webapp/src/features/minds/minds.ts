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

/**
 * A scroll lesson (owner 2026-10-23): slides that pin while their lines come in, each ending in
 * a task you do to go on (hold, drag, a question). Each task pays STEP_XP once (xp_award
 * "mind-step", checked by the server against functions/minds.py STEP_REFS).
 */
export type TapSpot = { label: string; x: number; y: number; w: number; h: number; right?: boolean };
export type ScrollTask =
  | { id: string; kind: 'hold'; label: string; done: string; scene?: 'march' | 'rally' }
  | { id: string; kind: 'quiz'; question: string; options: string[]; answer: number; why: string }
  | { id: string; kind: 'drag'; label: string; tap: string; done: string }
  | { id: string; kind: 'level'; label: string; tap: string; done: string }
  /** drag the right items into one place (a wrong one bounces back with `wrong`); tapping an item moves it too */
  | { id: string; kind: 'collect'; label: string; target: string; items: { label: string; wrong?: boolean }[]; wrong?: string; done: string }
  /** find something in a picture: spots are fractions of the image; one or more are right */
  | { id: string; kind: 'tap'; label: string; image: string; credit: string; spots: TapSpot[]; miss: string; done: string }
  /** drag one token to the right zone out of several; each zone is also a button */
  | { id: string; kind: 'target'; label: string; token: string; zones: { label: string; right?: boolean; why?: string }[]; done: string }
  /** choose exactly `need` options, all of them right ones */
  | { id: string; kind: 'pick'; label: string; need: number; options: { label: string; right?: boolean }[]; why: string };
/** image: true uses the lesson's picture; a file name gives the slide its own (with its credit) */
export type ScrollSlide = { lines: string[]; image?: boolean | string; credit?: string; source?: string; task?: ScrollTask };
export type ScrollLesson = { image: string; credit: string; slides: ScrollSlide[] };
export type MindLesson = { id: string; title: string; text: string[]; trading: string; scroll?: ScrollLesson };
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
export const STEP_XP = 2; // functions/minds.py STEP_XP
export const FOLLOW_COST = 15;
export const FOLLOW_DAYS = 30;

const BY_ID = new Map(FIGURES.map((f) => [f.id, f]));
export const figureById = (id: string) => BY_ID.get(id);
/** The grid, in the owner's order. */
export const ORDERED: Figure[] = (raw.order as string[]).map((id) => figureById(id)).filter((f): f is Figure => !!f);

/** Portraits are public-domain paintings, served from /app/minds/. */
export const portraitUrl = (f: Figure) => `${import.meta.env.BASE_URL}minds/${f.portrait}`;
export const mindImageUrl = (file: string) => `${import.meta.env.BASE_URL}minds/${file}`;

export const lessonRef = (figure: string, lesson: string) => `${figure}:${lesson}`;
export const stepRef = (figure: string, lesson: string, task: string) => `${figure}:${lesson}:${task}`;
export const lessonPath = (figure: string, lesson: string) => `/minds/${figure}/learn/${lesson}`;
export const scrollTasks = (l: MindLesson) => (l.scroll?.slides ?? []).flatMap((x) => (x.task ? [x.task] : []));
export const figureProgress = (f: Figure, done: string[]) => f.lessons.filter((l) => done.includes(lessonRef(f.id, l.id))).length;

export const markMind = (uid: string, ref: string) => setDoc(doc(db(), 'users', uid), { mindsDone: arrayUnion(ref) }, { merge: true });
export const stepXp = (ref: string) => callFunction<{ type: string; refId: string }, { awarded?: boolean; xp?: number; before?: number }>('xp_award', { type: 'mind-step', refId: ref });
export const mindXp = (ref: string) => callFunction<{ type: string; refId: string }, { awarded?: boolean }>('xp_award', { type: 'mind', refId: ref });
export const followFigure = (figure: string) => callFunction<{ figure: string }, { balance: number; charged: number }>('minds_follow', { figure });
