import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appPathFor } from './DrillPage';
import { dailyId, embedPath, GAME_IDS, isGame, parseScores } from './training';

const read = (p: string) => readFileSync(resolve(__dirname, '../../../..', p), 'utf8');

describe('Training Ground', () => {
  it('has a board for every game the database rules allow, and a page for each', () => {
    const rules = read('database.rules.json');
    for (const id of GAME_IDS) {
      expect(rules).toContain(`$game === '${id}'`);
      expect(read(`games/${id}.html`)).toContain('zelos-embed.js');
    }
    expect(read('games/daily-challenge.html')).toContain('zelos-embed.js');
  });
  it('daily board ids follow New York days like the website', () => {
    expect(dailyId(Date.parse('2026-10-10T03:30:00Z'))).toBe('daily-2026-10-09'); // 11:30 pm ET
    expect(dailyId(Date.parse('2026-10-10T04:30:00Z'))).toBe('daily-2026-10-10');
    expect(read('games/zelos-chart-engine.js')).toContain("timeZone: 'America/New_York'");
    expect(embedPath('stop-drill')).toBe('games/stop-drill.html?embed=1');
  });
  it('reads scores best first and drops junk', () => {
    const rows = parseScores({ a: { name: 'Al', score: 50, ts: 2, uid: 'u1' }, b: { name: 'Bo', score: 90, ts: 1, uid: 'u2' }, c: { name: 'x', score: 'lots' }, d: { score: -1 }, e: { name: '', score: 50, ts: 1, uid: 'u3' } });
    expect(rows.map((r) => `${r.name}:${r.score}`)).toEqual(['Bo:90', 'Player:50', 'Al:50']);
  });
  it('links clicked inside a drill come back to the app', () => {
    expect(appPathFor('/arcade.html')).toBe('/training');
    expect(appPathFor('/leaderboard.html#stop-drill')).toBe('/training?tab=boards');
    expect(appPathFor('/games/grade-the-setup.html')).toBe('/training/grade-the-setup');
    expect(appPathFor('/games/evil.html')).toBeNull();
    expect(appPathFor('/learn/what-is-reward-to-risk-ratio.html')).toBeNull();
    expect(isGame('daily-challenge') && !isGame('zzz')).toBe(true);
  });
});
