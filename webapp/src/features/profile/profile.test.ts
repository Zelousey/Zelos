import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeLink } from '../../shell/NotificationsSheet';
import { parseRanked } from '../dashboard/social';
import { parseDetail } from './detail';
import { BIO_MAX, cleanBio, groupEarned, isWarGroup, LOOK_BADGES, LOOK_BANNERS, LOOK_COLORS, parseLooks, parseRecord, PHOTO_MAX, SHRINK_STEPS, UID_RE } from './profile';

const root = resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('profile', () => {
  it('reads the Trade War numbers the server publishes (functions/practice.py build_profile)', () => {
    const d = parseDetail({
      equity: 12000, start: 10000, peakEquity: 12500, resets: 1, resetHistory: [{ day: '2026-10-01', equityBefore: 8000 }, { day: 'bad', equityBefore: 1 }],
      wins: 4, losses: 2, realized: 900.5, avgWin: 300, avgLoss: -150, winStreakBest: 3, virtualTrades: 9, streak: 5, since: 1_700_000_000_000,
      bestTrades: [{ sym: 'NVDA', label: 'NVDA', invested: 1000, pnl: 250, pct: 25, entry: 100, exit: 125, openDay: '2026-10-01', closeDay: '2026-10-03' }, { sym: '<script>' }],
      mostTraded: [{ sym: 'AAPL', trades: 3, pnl: -20 }], topStocks: [{ sym: 'NVDA', pnl: 250 }],
    });
    expect(d.resetHistory).toEqual([{ day: '2026-10-01', equityBefore: 8000 }]);
    expect(d.bestTrades[0]).toMatchObject({ sym: 'NVDA', pnl: 250, entry: 100, closeDay: '2026-10-03' });
    expect(d.bestTrades[1]?.sym).toBe('script'); // markup characters stripped
    expect(d).toMatchObject({ wins: 4, losses: 2, virtualTrades: 9, streak: 5, peakEquity: 12500, mostTraded: [{ sym: 'AAPL', trades: 3, pnl: -20 }] });
    // missing fields fall back like the website
    expect(parseDetail({ equity: 9000, trades: 2 })).toMatchObject({ start: 10000, peakEquity: 9000, virtualTrades: 2, bestTrades: [], since: null });
    expect(parseRanked('u1', { equity: 11000, wins: 1 })?.detail?.wins).toBe(1);
  });
  it('reads the match record and the profile looks', () => {
    const r = parseRecord({ played: 3, wins: 1, losses: 2, surrenders: 1, recent: [{ w: 'abcdefgh1234', name: 'Fri fight', rank: 1, of: 4, pnlPct: 3.2 }, { w: '../x', name: 'bad' }] });
    expect(r.recent).toEqual([{ w: 'abcdefgh1234', name: 'Fri fight', rank: 1, of: 4, pnlPct: 3.2, surrendered: false }]);
    expect(parseLooks({ color: 'gold', badge: 'rocket', banner: 'ocean', founder: { title: 'Founder', tier: 10, name: 'Ohio' } })).toMatchObject({ color: '#f2c14e', prism: false, badge: '🚀', founder: { title: 'Founder', icon: '⭐', of: 'Ohio' } });
    expect(parseLooks({ color: 'rainbow', badge: 'nope', banner: 'url(evil)' })).toMatchObject({ color: null, prism: true, badge: null, banner: null });
  });
  it('profile looks match the website (zelos-tokens.js LOOKS)', () => {
    const js = read('zelos-tokens.js');
    for (const [k, v] of Object.entries(LOOK_COLORS)) expect(js).toContain(`${k}: '${v}'`);
    for (const [k, v] of Object.entries(LOOK_BADGES)) expect(js).toContain(`${k}: '${v}'`);
    for (const [k, v] of Object.entries(LOOK_BANNERS)) expect(js).toContain(`${k}: '${v}'`);
  });
  it('the editor keeps the website’s and the rules’ limits', () => {
    const js = read('zelos-profile.js');
    expect(js).toContain(`[[${SHRINK_STEPS.map(([a, b]) => `${a}, ${b}`).join('], [')}]]`);
    expect(js).toContain(`url.length <= ${PHOTO_MAX}`);
    const rules = read('firestore.rules');
    expect(rules).toContain('v.size() <= 20000');
    expect(rules).toContain(`size() <= ${BIO_MAX}`);
    expect(cleanBio('  Swing <b>trader</b>\n\nfrom  Ohio ')).toBe('Swing btrader/b from Ohio');
    expect(cleanBio('x'.repeat(300))).toHaveLength(BIO_MAX);
  });
  it('groups earned achievements like the website', () => {
    const g = groupEarned(['club-12k', 'first-trade', 'squad-up', 'first-win', 'nope', 'first-trade']);
    expect(g.map((x) => [x.group, x.items.map((a) => a.id)])).toEqual([
      ['Milestones', ['club-12k']],
      ['Trading', ['first-trade', 'first-win']],
      ['Social', ['squad-up']],
    ]);
    expect(isWarGroup('Trading') && isWarGroup('Seasons') && !isWarGroup('Social')).toBe(true);
  });
  it('friend notifications open the profile in the app', () => {
    expect(safeLink('practice/profile.html?u=AbCdEf123456XYZ')).toEqual({ app: '/profile/AbCdEf123456XYZ' });
    expect(safeLink('practice/profile.html?u=x')).toEqual({ href: '/practice/profile.html?u=x' });
    expect(UID_RE.test('AbCdEf123456XYZ') && !UID_RE.test('../etc')).toBe(true);
  });
});
