/**
 * The new-user quiz (owner 2026-10-15): five quick questions that place someone as a
 * Beginner, Learning or Experienced trader, so the app can show the right help. Skippable,
 * retakeable from the profile. Stored on users/{uid}.skill (your own doc; nothing is unlocked
 * or paid by it, so the browser may write it) and users/{uid}.experience (the welcome
 * screen's answer, kept in step).
 */
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Experience } from '../../data/userDoc';

export type Level = 'beginner' | 'learning' | 'experienced';
export type Goal = 'learn' | 'friends' | 'practice';
export type Answers = { experience: Experience | null; goal: Goal | null; checks: (number | null)[] };

type Choice = { id: string; label: string };
export type Question = { id: string; kind: 'experience' | 'goal' | 'check'; title: string; hint?: string; choices: Choice[]; correct?: number; explain?: string };

const NOT_SURE = { id: 'unsure', label: 'Not sure yet' };

export const QUESTIONS: Question[] = [
  {
    id: 'experience',
    kind: 'experience',
    title: 'How much have you traded?',
    choices: [
      { id: 'new', label: 'Never: I’m brand new' },
      { id: 'some', label: 'A little: a few trades' },
      { id: 'pro', label: 'A lot: I trade regularly' },
    ],
  },
  {
    id: 'goal',
    kind: 'goal',
    title: 'What do you want from Zelos?',
    choices: [
      { id: 'learn', label: 'Learn how trading works' },
      { id: 'friends', label: 'Compete with my friends' },
      { id: 'practice', label: 'Practice my own strategies' },
    ],
  },
  {
    id: 'pnl',
    kind: 'check',
    title: 'You buy 10 shares at $50. The price goes up to $55. What happened?',
    choices: [{ id: 'a', label: 'You made $50' }, { id: 'b', label: 'You made $5' }, { id: 'c', label: 'You lost $50' }, NOT_SURE],
    correct: 0,
    explain: 'Each share went up $5, and you have 10 of them: 10 × $5 = $50 profit (until you sell, it’s “unrealized”).',
  },
  {
    id: 'stop',
    kind: 'check',
    title: 'What does a stop-loss do?',
    choices: [{ id: 'a', label: 'Sells automatically if the price falls to a level you pick' }, { id: 'b', label: 'Buys more when the price drops' }, { id: 'c', label: 'Stops the price from moving' }, NOT_SURE],
    correct: 0,
    explain: 'A stop-loss limits how much you can lose: if the price falls to your level, the shares are sold for you.',
  },
  {
    id: 'limit',
    kind: 'check',
    title: 'A limit order to buy at $100 means…',
    choices: [{ id: 'a', label: 'It only buys at $100 or less' }, { id: 'b', label: 'It buys right away at any price' }, { id: 'c', label: 'You can buy at most 100 shares' }, NOT_SURE],
    correct: 0,
    explain: 'A limit order waits for your price (or better). A market order buys right away at the current price.',
  },
];

export const CHECKS = QUESTIONS.filter((q) => q.kind === 'check');

/** Pure: how many knowledge checks are right, and the level that follows. */
export function score(a: Answers): { right: number; level: Level } {
  const right = CHECKS.reduce((n, q, i) => n + (a.checks[i] === q.correct ? 1 : 0), 0);
  let level: Level;
  if (right <= 1 || (a.experience === 'new' && right < 3)) level = 'beginner';
  else if (right === 3 && a.experience !== 'new') level = 'experienced';
  else level = 'learning';
  return { right, level };
}

/** The level to use when someone skipped the quiz: their welcome answer, else none. */
export function levelFromExperience(e: Experience | null): Level | null {
  return e === 'new' ? 'beginner' : e === 'some' ? 'learning' : e === 'pro' ? 'experienced' : null;
}

export type Skill = { level: Level; right: number; goal: Goal | null; at: number };
export function parseSkill(v: unknown): Skill | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  const level = d.level === 'beginner' || d.level === 'learning' || d.level === 'experienced' ? d.level : null;
  if (!level) return null;
  const goal = d.goal === 'learn' || d.goal === 'friends' || d.goal === 'practice' ? d.goal : null;
  return { level, right: typeof d.right === 'number' ? d.right : 0, goal, at: typeof d.at === 'number' ? d.at : 0 };
}

export async function saveQuiz(uid: string, a: Answers): Promise<Skill> {
  const { right, level } = score(a);
  const skill: Skill = { level, right, goal: a.goal, at: Date.now() };
  await setDoc(doc(db(), 'users', uid), { skill, ...(a.experience ? { experience: a.experience } : {}) }, { merge: true });
  return skill;
}
