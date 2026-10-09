/**
 * Training Ground (owner 2026-10-09; was "Arcade"): drills on real historical charts that train
 * spotting setups, placing stops and setting targets. The drills themselves are the website's
 * pages in games/ (shown inside the app with ?embed=1, see games/zelos-embed.js); their top
 * scores live in the Realtime Database at scores/<gameId> (leaderboard.js, database.rules.json),
 * which the app reads here.
 */
import { useEffect, useState } from 'react';
import { rtdb } from '../../lib/firebase';

export type Skill = 'setups' | 'stops' | 'targets' | 'discipline';
export type Drill = { id: string; name: string; icon: string; tag: string; desc: string; skills: Skill[]; learn: string[]; tone: 'accent' | 'gold' | 'violet' };

export const DRILLS: Drill[] = [
  {
    id: 'chart-replay', name: 'Chart Replay', icon: '📈', tag: 'Simulator · 60 bars', tone: 'accent', skills: ['setups', 'stops', 'targets', 'discipline'],
    desc: 'A hidden ticker, 60 bars you haven’t seen. Trade it bar by bar with a $10,000 practice account. Every trade needs a stop, and you’re scored on R-multiples and discipline.',
    learn: ['Wait for a real setup before you enter', 'Put a stop on every trade', 'Let winners reach the target, cut losers at the stop'],
  },
  {
    id: 'grade-the-setup', name: 'Grade the Setup', icon: '✅', tag: 'Drill · 8 rounds', tone: 'gold', skills: ['setups', 'targets'],
    desc: 'Run the four-point swing checklist (trend, support, volume, reward:risk) on a real chart, make the call, then see what happened next.',
    learn: ['Check trend, support and volume', 'Measure reward against risk before you buy', 'Skip setups that fail the checklist'],
  },
  {
    id: 'stop-drill', name: 'Where’s the Stop?', icon: '🛑', tag: 'Drill · 8 rounds', tone: 'violet', skills: ['stops'],
    desc: 'You’re long at the close. Tap where your stop-loss belongs. Too tight gets shaken out; too wide wastes your size. Graded on structure, not luck.',
    learn: ['Place stops under real support, not a random %', 'Avoid stops so tight that noise takes you out', 'See how stop distance sets your position size'],
  },
  {
    id: 'setup-spotter', name: 'Setup Spotter', icon: '🐂', tag: 'Quick practice', tone: 'accent', skills: ['setups'],
    desc: 'A chart flashes up: real setup or noise? Call it before the clock runs out.',
    learn: ['Recognise pullbacks, flags and breakouts fast', 'Tell a clean setup from noise'],
  },
];
export const FUN = [
  { id: 'bull-run', name: 'Bull Run', icon: '🏃' },
  { id: 'buy-the-dip', name: 'Buy the Dip', icon: '🛒' },
];
export const SKILLS: Skill[] = ['setups', 'stops', 'targets', 'discipline'];

/** Every game the database rules allow a board for (database.rules.json). */
export const GAME_IDS = [...DRILLS.map((d) => d.id), ...FUN.map((f) => f.id)];
export const drill = (id: string) => DRILLS.find((d) => d.id === id) ?? null;
export const isGame = (id: string) => GAME_IDS.includes(id) || id === 'daily-challenge';

/** Today's Daily Challenge board id: daily-YYYY-MM-DD in New York time (same as the website). */
export const dailyId = (now = Date.now()) => `daily-${new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })}`;

/** The drill page shown inside the app (the website page without its menu). */
export const embedPath = (id: string) => `games/${id}.html?embed=1`;

export type Score = { key: string; name: string; score: number; ts: number; uid: string };
export function parseScores(v: unknown): Score[] {
  if (!v || typeof v !== 'object') return [];
  return Object.entries(v as Record<string, unknown>)
    .flatMap(([key, r]) => {
      if (!r || typeof r !== 'object') return [];
      const x = r as Record<string, unknown>;
      if (typeof x.score !== 'number' || !Number.isFinite(x.score) || x.score <= 0) return [];
      return [{ key, name: typeof x.name === 'string' && x.name.trim() ? x.name.slice(0, 20) : 'Player', score: Math.round(x.score), ts: typeof x.ts === 'number' ? x.ts : 0, uid: typeof x.uid === 'string' ? x.uid : '' }];
    })
    .sort((a, b) => b.score - a.score || a.ts - b.ts);
}

/** Live top scores for one game. */
export function useTopScores(gameId: string | null, n = 10): Score[] | null | 'error' {
  const [state, setState] = useState<{ id: string; rows: Score[] | 'error' } | null>(null);
  useEffect(() => {
    if (!gameId) return;
    let off: (() => void) | null = null;
    let live = true;
    Promise.all([rtdb(), import('firebase/database')])
      .then(([db, m]) => {
        if (!live) return;
        off = m.onValue(
          m.query(m.ref(db, `scores/${gameId}`), m.orderByChild('score'), m.limitToLast(n)),
          (snap) => setState({ id: gameId, rows: parseScores(snap.val()).slice(0, n) }),
          () => setState({ id: gameId, rows: 'error' }),
        );
      })
      .catch(() => live && setState({ id: gameId, rows: 'error' }));
    return () => {
      live = false;
      off?.();
    };
  }, [gameId, n]);
  return gameId && state?.id === gameId ? state.rows : null;
}
