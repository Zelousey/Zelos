/**
 * The learning loop (research review 2026-11-22: reward learning, never trading). Mirrors
 * functions/learnloop.py:
 *   - learning streak: a New York day with a lesson, chapter quiz, Hall of Minds step or review;
 *   - daily goal: learning XP today against the goal you picked (users.learnGoal, yours to set);
 *   - review: questions you missed come back after 1, 3, 7, 14 and 30 days; always free;
 *   - weekly learning league: learning XP this week (learnLeague/{week}/rows), public.
 * The server owns users.learnLoop and users.review; lessons report quick-check answers with
 * learn_check and review answers go through learn_review (both graded on the server).
 */
import { collection, doc, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';
import { nyDate } from '../dashboard/progress';
import quizzes from './quizzes.json';
import { ALL_LESSONS, CHAPTERS } from './chapters';

export const GOALS = [10, 20, 30, 50] as const;
export const DEFAULT_GOAL = 20;
export const REVIEW_XP = 2;

export type LearnLoop = { streak: { days: number; best: number; last: string }; day: { date: string; xp: number }; week: { key: string; xp: number } };
export type ReviewItem = { box: number; due: string };
export type LoopView = { streak: number; best: number; today: number; week: number };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const s = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : '');

export function parseLoop(v: unknown): LearnLoop | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, Record<string, unknown> | undefined>;
  return {
    streak: { days: n(o.streak?.days), best: n(o.streak?.best), last: s(o.streak?.last, DAY) },
    day: { date: s(o.day?.date, DAY), xp: n(o.day?.xp) },
    week: { key: s(o.week?.key, /^\d{4}-W\d{2}$/), xp: n(o.week?.xp) },
  };
}

export function parseReview(v: unknown): Record<string, ReviewItem> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, ReviewItem> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 400)) {
    const due = s((x as { due?: unknown } | null)?.due, DAY);
    if (/^(c:[a-z-]{2,30}|q:[a-z-]{2,30}:\d)$/.test(k) && due) out[k] = { box: n((x as { box?: unknown }).box), due };
  }
  return out;
}

export const parseGoal = (v: unknown): number => (GOALS as readonly number[]).includes(v as number) ? (v as number) : DEFAULT_GOAL;

const addDay = (day: string, k: number) => new Date(Date.parse(`${day}T12:00:00Z`) + k * 864e5).toISOString().slice(0, 10);

/** ISO week, written like the server: "2026-W48". */
export function weekId(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // the week's Thursday
  const y = d.getUTCFullYear();
  const w = 1 + Math.floor((d.getTime() - Date.UTC(y, 0, 1, 12)) / 864e5 / 7); // week 1 holds the year's first Thursday
  return `${y}-W${String(w).padStart(2, '0')}`;
}

/** What the app shows (learnloop.view): the streak is 0 once a whole day was missed. */
export function loopView(loop: LearnLoop | null, today: string): LoopView {
  if (!loop) return { streak: 0, best: 0, today: 0, week: 0 };
  const alive = loop.streak.last === today || loop.streak.last === addDay(today, -1);
  return { streak: alive ? loop.streak.days : 0, best: loop.streak.best, today: loop.day.date === today ? loop.day.xp : 0, week: loop.week.key === weekId(today) ? loop.week.xp : 0 };
}

/** Question ids due today or earlier, oldest first (learnloop.due). */
export function dueIds(review: Record<string, ReviewItem>, today: string): string[] {
  return Object.entries(review)
    .filter(([, v]) => v.due <= today)
    .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : a[0] < b[0] ? -1 : 1))
    .map(([k]) => k);
}

export type ReviewQuestion = { id: string; from: string; q: string; opts: string[]; why: (pick: number, right: number) => string };

/** The question behind a review id: a lesson's quick check or a chapter quiz question. */
export function reviewQuestion(id: string): ReviewQuestion | null {
  if (id.startsWith('c:')) {
    const l = ALL_LESSONS.find((x) => x.id === id.slice(2));
    if (!l) return null;
    return { id, from: l.title, q: l.check.q, opts: l.check.opts, why: (pick) => l.check.why[pick] ?? '' };
  }
  const [, ch, k] = id.split(':');
  const c = CHAPTERS.find((x) => x.id === ch);
  const qq = (quizzes as unknown as Record<string, { q: string; opts: string[]; why: string }[] | undefined>)[ch ?? '']?.[Number(k)];
  if (!c || !qq) return null;
  return { id, from: c.title, q: qq.q, opts: qq.opts, why: () => qq.why };
}

export const today = (now = Date.now()) => nyDate(now);

export const setGoal = (uid: string, goal: number) => setDoc(doc(db(), 'users', uid), { learnGoal: goal }, { merge: true });
/** A lesson's quick check, graded on the server; a miss goes to your review. */
export const learnCheck = (lesson: string, pick: number) => callFunction<{ lesson: string; pick: number }, { ok: boolean; answer: number }>('learn_check', { lesson, pick });
export type ReviewResult = { ok: boolean; answer: number; xp: number; due: string | null; left: number };
export const learnReview = (id: string, pick: number) => callFunction<{ id: string; pick: number }, ReviewResult>('learn_review', { id, pick });

export type LeagueRow = { uid: string; name: string; xp: number };
/** This week's learning league, top 30 by learning XP. */
export const useLeague = (week: string) =>
  useLiveQuery(
    `learnLeague:${week}`,
    () => query(collection(db(), 'learnLeague', week, 'rows'), orderBy('xp', 'desc'), limit(30)),
    (uid, d): LeagueRow | null => (typeof d.xp === 'number' && d.xp > 0 ? { uid, name: typeof d.name === 'string' && d.name ? d.name.slice(0, 40) : 'Trader', xp: Math.floor(d.xp) } : null),
  );
