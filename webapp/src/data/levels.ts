/**
 * XP levels. Same thresholds, names, titles and colours as the classic zelos-levels.js and
 * the server's functions/practice.py LEVELS; levels.test.ts fails if they drift apart.
 * XP itself is server-owned (users/{uid}.xp); this only turns it into a level for display.
 */
export type Level = { level: number; xp: number; name: string; title: string; colors: [string, string, string] };

export const LEVELS: Level[] = [
  { level: 0, xp: 0, name: 'Getting started', title: 'New trader', colors: ['#3a3f4a', '#23262d', '#8a909c'] },
  { level: 1, xp: 10, name: 'Bronze', title: 'Chart Reader', colors: ['#d08a52', '#7a4722', '#ffd9b3'] },
  { level: 2, xp: 50, name: 'Silver', title: 'Setup Hunter', colors: ['#e3e8ef', '#8a95a5', '#ffffff'] },
  { level: 3, xp: 150, name: 'Gold', title: 'Risk Manager', colors: ['#ffd45c', '#b07a12', '#fff4c7'] },
  { level: 4, xp: 400, name: 'Platinum', title: 'Strategist', colors: ['#7fb0ff', '#2a58c9', '#e6f0ff'] },
  { level: 5, xp: 1000, name: 'Diamond', title: 'Agentic Trader', colors: ['#b9a8ff', '#5b3fd6', '#f1ecff'] },
  { level: 6, xp: 2000, name: 'Master', title: 'Market Master', colors: ['#ff8a5c', '#b8361a', '#ffe1d3'] },
  { level: 7, xp: 3500, name: 'Elite', title: 'Elite Operator', colors: ['#4fe0c1', '#0f8a74', '#dcfff6'] },
  { level: 8, xp: 6000, name: 'Legend', title: 'Trading Legend', colors: ['#ff6fb5', '#a11d62', '#ffe0f0'] },
  { level: 9, xp: 10000, name: 'Titan', title: 'Titan of Tape', colors: ['#ffe27a', '#8a6a00', '#fffbe6'] },
  { level: 10, xp: 16000, name: 'Zelos', title: 'Zelos Champion', colors: ['#9fd3ff', '#1c4f9c', '#ffffff'] },
];

/** The level for an XP total, the next one (null at the top) and progress towards it (0–1). */
export function levelFor(xp: number): { level: Level; next: Level | null; progress: number; toNext: number } {
  const x = Math.max(0, Number.isFinite(xp) ? xp : 0);
  let level = LEVELS[0]!;
  for (const l of LEVELS) if (x >= l.xp) level = l;
  const next = LEVELS.find((l) => l.xp > x) ?? null;
  return { level, next, progress: next ? (x - level.xp) / (next.xp - level.xp) : 1, toNext: next ? next.xp - x : 0 };
}
