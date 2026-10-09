/**
 * Missions, mission streaks and achievements, read for display.
 *
 * The classic site keeps this progress in the browser (localStorage zelosProgress-v1) and
 * copies it to users/{uid}.progress (zelos-progress.js). The app is on the same origin, so
 * it reads both and keeps the best of each, the same way the classic merge() does. Since
 * 2026-10-08 the server counts missions itself (users/{uid}.missions, functions/missions.py)
 * and pays their XP; that count is merged in too (parseServerMissions). Mission and achievement ids/XP match the server's functions/xp.py
 * (progress.test.ts checks).
 */
export type MissionDef = { id: string; label: string; goal: number; xp: number; ev: string; href?: string };
export type AchievementDef = { id: string; label: string; desc: string; icon: string; xp: number; group: string };
export type Progress = {
  day: { date: string; counts: Record<string, number>; done: Record<string, boolean> };
  week: { key: string; counts: Record<string, number>; done: Record<string, boolean> };
  streak: { days: number; best: number; lastDate: string };
  achievements: Record<string, number>;
  updatedAt: number;
};
export type MissionView = { id: string; label: string; goal: number; count: number; done: boolean; xp: number; href?: string };

export const DAILY: MissionDef[] = [
  { id: 'trade', label: 'Make 1 Trade War trade', goal: 1, xp: 10, ev: 'trade', href: '/markets' },
  { id: 'analyze', label: 'Analyze 3 stocks', goal: 3, xp: 10, ev: 'analyze', href: '/markets' },
  { id: 'grade', label: 'Complete a Grade the Setup round', goal: 1, xp: 10, ev: 'grade', href: '/training/grade-the-setup' },
  { id: 'news', label: 'Check the market news', goal: 1, xp: 5, ev: 'news', href: '/news' },
  { id: 'xp', label: 'Earn 100 XP', goal: 100, xp: 20, ev: 'xp' },
];
export const WEEKLY: MissionDef[] = [
  { id: 'trades10', label: 'Make 10 Trade War trades', goal: 10, xp: 40, ev: 'trade' },
  { id: 'wins3', label: 'Close 3 winning trades', goal: 3, xp: 50, ev: 'win' },
  { id: 'grade10', label: 'Grade 10 setups', goal: 10, xp: 40, ev: 'grade' },
  { id: 'days5', label: 'Keep your streak 5 days this week', goal: 5, xp: 75, ev: 'mday' },
  { id: 'xp300', label: 'Earn 300 XP', goal: 300, xp: 60, ev: 'xp' },
];
export const STREAK_NEED = 2;

const SEASONS = [
  { id: 's1', name: 'Season 1', title: 'Agentic Trading Championship' },
  { id: 's2', name: 'Season 2', title: 'Winter Breakout' },
];
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-trade', label: 'First Trade', desc: 'Place your first Trade War trade', icon: '🎯', xp: 25, group: 'Trading' },
  { id: 'first-win', label: 'First Win', desc: 'Close a trade in profit', icon: '✅', xp: 25, group: 'Trading' },
  { id: 'perfect-exit', label: 'Perfect Exit', desc: 'Get taken out at your take-profit', icon: '🎯', xp: 50, group: 'Trading' },
  { id: 'hot-hand', label: 'Hot Hand', desc: '5 winning trades in a row', icon: '🔥', xp: 50, group: 'Trading' },
  { id: 'win-streak-10', label: '10-Win Streak', desc: '10 winning trades in a row', icon: '⚡', xp: 150, group: 'Trading' },
  { id: 'explorer', label: 'Explorer', desc: 'Trade 10 different stocks', icon: '🧭', xp: 50, group: 'Trading' },
  { id: 'options-rookie', label: 'Options Rookie', desc: 'Trade your first option', icon: '🎲', xp: 25, group: 'Trading' },
  { id: 'agent-handler', label: 'Agent Handler', desc: 'Place a trade from an agent signal', icon: '🤖', xp: 50, group: 'Trading' },
  { id: 'centurion', label: 'Centurion', desc: 'Close 100 trades', icon: '💯', xp: 200, group: 'Trading' },
  { id: 'club-12k', label: '$12K Club', desc: 'Grow the account to $12,000', icon: '💵', xp: 50, group: 'Milestones' },
  { id: 'club-25k', label: '$25K Club', desc: 'Grow the account to $25,000', icon: '💰', xp: 150, group: 'Milestones' },
  { id: 'club-50k', label: '$50K Club', desc: 'Grow the account to $50,000', icon: '🏦', xp: 300, group: 'Milestones' },
  { id: 'club-100k', label: '$100K Club', desc: 'Grow the account to $100,000', icon: '👑', xp: 500, group: 'Milestones' },
  { id: 'comeback-kid', label: 'Comeback Kid', desc: 'Fall to $9,000 or less, then climb back to $10,000 without a reset', icon: '🦅', xp: 150, group: 'Milestones' },
  { id: 'comeback-brink', label: 'Back from the Brink', desc: 'Fall to $5,000 or less, then climb back to $10,000 without a reset', icon: '🦅', xp: 300, group: 'Milestones' },
  { id: 'comeback-phoenix', label: 'Phoenix', desc: 'Fall to $1,000 or less, then climb all the way back to $10,000 without a reset', icon: '🦅', xp: 600, group: 'Milestones' },
  { id: 'sharp-eye', label: 'Sharp Eye', desc: 'Grade 25 setups', icon: '👁️', xp: 50, group: 'Training' },
  { id: 'on-a-roll', label: 'On a Roll', desc: 'Keep a 7-day mission streak', icon: '📅', xp: 75, group: 'Training' },
  { id: 'challenger', label: 'Challenger', desc: 'Start or accept a friend challenge', icon: '⚔️', xp: 50, group: 'Social' },
  { id: 'champion', label: 'Champion', desc: 'Win a friend challenge', icon: '🏆', xp: 150, group: 'Social' },
  { id: 'squad-up', label: 'Squad Up', desc: 'Create or join a Trading Squad', icon: '👥', xp: 25, group: 'Social' },
  { id: 'ref-bronze', label: 'Bronze Recruiter', desc: '1 friend joined from your invite', icon: '🥉', xp: 50, group: 'Referrals' },
  { id: 'ref-silver', label: 'Silver Recruiter', desc: '3 friends joined from your invite', icon: '🥈', xp: 100, group: 'Referrals' },
  { id: 'ref-gold', label: 'Gold Recruiter', desc: '10 friends joined from your invite', icon: '🥇', xp: 250, group: 'Referrals' },
  { id: 'ref-diamond', label: 'Diamond Recruiter', desc: '25 friends joined from your invite', icon: '💎', xp: 500, group: 'Referrals' },
  ...SEASONS.flatMap((s) => [
    { id: `season-${s.id}-in`, label: `${s.name} Competitor`, desc: `Trade during ${s.name} (${s.title})`, icon: '🏁', xp: 25, group: 'Seasons' },
    { id: `season-${s.id}-green`, label: `${s.name} Green Season`, desc: `Grow your account 10% in ${s.name}`, icon: '📈', xp: 100, group: 'Seasons' },
  ]),
];

// ---------------------------------------------------------------- calendar (New York)
export function nyDate(at: number, offsetDays = 0): string {
  const d = new Date(at + offsetDays * 864e5);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
/** ISO week key, written like the classic site: "w2026_41". */
export function weekKey(day: string): string {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const y = d.getUTCFullYear();
  const first = new Date(Date.UTC(y, 0, 4));
  return `w${y}_${String(1 + Math.round(((d.getTime() - first.getTime()) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- parsing + merging
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const counts = (v: unknown) => Object.fromEntries(Object.entries(obj(v)).map(([k, x]) => [k, num(x)]));
const flags = (v: unknown) => Object.fromEntries(Object.entries(obj(v)).filter(([, x]) => x === true).map(([k]) => [k, true]));

/** A progress object from Firestore or localStorage; anything unexpected becomes empty. */
export function parseProgress(raw: unknown): Progress | null {
  const p = obj(raw);
  if (p.v !== 1) return null;
  const day = obj(p.day);
  const week = obj(p.week);
  const st = obj(p.streak);
  return {
    day: { date: str(day.date), counts: counts(day.counts), done: flags(day.done) },
    week: { key: str(week.key), counts: counts(week.counts), done: flags(week.done) },
    streak: { days: num(st.days), best: num(st.best), lastDate: str(st.lastDate) },
    achievements: counts(p.achievements),
    updatedAt: num(p.updatedAt),
  };
}

/** The server's own mission count (users/{uid}.missions): same day/week/streak shape, no version. */
export function parseServerMissions(raw: unknown): Progress | null {
  const m = obj(raw);
  if (!m.day && !m.week && !m.streak) return null;
  return parseProgress({ ...m, v: 1, achievements: {}, updatedAt: 0 });
}

/** Keep the best of two copies (this browser + the account), like the classic merge(). */
export function mergeProgress(a: Progress | null, b: Progress | null): Progress | null {
  if (!a || !b) return a ?? b;
  const out: Progress = structuredClone(a);
  if (b.day.date === out.day.date) {
    for (const [k, v] of Object.entries(b.day.counts)) out.day.counts[k] = Math.max(out.day.counts[k] ?? 0, v);
    Object.assign(out.day.done, b.day.done);
  } else if (b.day.date > out.day.date) out.day = structuredClone(b.day);
  if (b.week.key === out.week.key) {
    for (const [k, v] of Object.entries(b.week.counts)) out.week.counts[k] = Math.max(out.week.counts[k] ?? 0, v);
    Object.assign(out.week.done, b.week.done);
  } else if (b.week.key > out.week.key) out.week = structuredClone(b.week);
  const best = Math.max(out.streak.best, b.streak.best);
  if (b.streak.lastDate > out.streak.lastDate || (b.streak.lastDate === out.streak.lastDate && b.streak.days > out.streak.days)) out.streak = { ...b.streak };
  out.streak.best = best;
  for (const [k, v] of Object.entries(b.achievements)) out.achievements[k] = out.achievements[k] ? Math.min(out.achievements[k]!, v) : v;
  out.updatedAt = Math.max(a.updatedAt, b.updatedAt);
  return out;
}

export type XpLog = { day?: { date: string; xp: number }; week?: { key: string; xp: number } };

export function readLocal(): { progress: Progress | null; xpLog: XpLog } {
  const read = (k: string) => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? 'null') as unknown;
    } catch {
      return null;
    }
  };
  const l = obj(read('zelosXpLog'));
  const d = obj(l.day);
  const w = obj(l.week);
  return {
    progress: parseProgress(read('zelosProgress-v1')),
    xpLog: { day: d.date ? { date: str(d.date), xp: num(d.xp) } : undefined, week: w.key ? { key: str(w.key), xp: num(w.xp) } : undefined },
  };
}

// ---------------------------------------------------------------- views
export function missionsView(p: Progress | null, xpLog: XpLog, now: number) {
  const today = nyDate(now);
  const wk = weekKey(today);
  const day = p && p.day.date === today ? p.day : { counts: {}, done: {} as Record<string, boolean> };
  const week = p && p.week.key === wk ? p.week : { counts: {}, done: {} as Record<string, boolean> };
  const count = (m: MissionDef, scope: 'day' | 'week') => {
    const counted = ((scope === 'day' ? day.counts : week.counts) as Record<string, number>)[m.ev] ?? 0;
    if (m.ev === 'xp') return Math.max(counted, scope === 'day' ? (xpLog.day?.date === today ? xpLog.day.xp : 0) : xpLog.week && `w${xpLog.week.key}` === wk ? xpLog.week.xp : 0);
    return ((scope === 'day' ? day.counts : week.counts) as Record<string, number>)[m.ev] ?? 0;
  };
  const view = (list: MissionDef[], scope: 'day' | 'week', done: Record<string, boolean>): MissionView[] =>
    list.map((m) => {
      const isDone = !!done[m.id];
      return { id: m.id, label: m.label, goal: m.goal, xp: m.xp, href: m.href, done: isDone, count: isDone ? m.goal : Math.min(count(m, scope), m.goal) };
    });
  const daily = view(DAILY, 'day', day.done);
  const s = p?.streak;
  const streak = s && (s.lastDate === today || s.lastDate === nyDate(now, -1)) ? s.days : 0;
  return { daily, weekly: view(WEEKLY, 'week', week.done), streak, best: s?.best ?? 0, doneToday: daily.filter((m) => m.done).length };
}

export function achievementsView(p: Progress | null, publicIds: string[] = []) {
  const at: Record<string, number> = { ...(p?.achievements ?? {}) };
  for (const id of publicIds) if (!at[id]) at[id] = 1; // unlocked on another device: no time known
  const unlocked = ACHIEVEMENTS.filter((a) => at[a.id]).sort((a, b) => at[b.id]! - at[a.id]!);
  return { unlocked, next: ACHIEVEMENTS.filter((a) => !at[a.id]).slice(0, 3), total: ACHIEVEMENTS.length };
}
