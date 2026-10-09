/**
 * The leaderboard's time windows, keyed exactly like the server (functions/practice.py
 * week_key / month_key / SEASONS) and the website (zelos-progress.js): ISO week "w2026_41",
 * month "m2026_10", season "s1". All in New York days.
 */
export type Season = { id: string; name: string; title: string; start: string; end: string };
export const SEASONS: Season[] = [
  { id: 's1', name: 'Season 1', title: 'Agentic Trading Championship', start: '2026-09-27', end: '2026-12-31' },
  { id: 's2', name: 'Season 2', title: 'Winter Breakout', start: '2027-01-01', end: '2027-03-31' },
];

export function nyToday(now = Date.now()): string {
  return new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/** ISO 8601 week, like Python's date.isocalendar(). */
export function weekKey(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow + 3); // the Thursday of this week decides the year
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `w${year}_${String(week).padStart(2, '0')}`;
}
export const monthKey = (day: string) => `m${day.slice(0, 4)}_${day.slice(5, 7)}`;
export const seasonFor = (day: string) => SEASONS.find((s) => day >= s.start && day <= s.end) ?? null;
