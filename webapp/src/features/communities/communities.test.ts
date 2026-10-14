import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVE_DAYS, nextTier, parseCommunity, STATES, thisWeek, TIERS } from './communities';

const py = readFileSync(resolve(__dirname, '../../../../functions/main.py'), 'utf8');

describe('communities', () => {
  it('match the server tables in functions/main.py', () => {
    const tiers = py.match(/^FOUNDER_TIERS = \[(.+?)\]$/ms)?.[1] ?? '';
    expect(tiers.replace(/\s+/g, ' ')).toBe(TIERS.map(([n, tok, title]) => `(${n}, ${tok}, "${title}")`).join(', '));
    expect(py).toMatch(new RegExp(`^FOUNDER_ACTIVE_DAYS = ${ACTIVE_DAYS}$`, 'm'));
    const block = py.match(/^US_STATES = \{(.+?)\n\}/ms)?.[1] ?? '';
    const server = Object.fromEntries([...block.matchAll(/"([A-Z]{2})": "([^"]+)"/g)].map((m) => [m[1], m[2]]));
    expect(server).toEqual(STATES);
  });

  it('uses the same ISO week key as the server (_week_key)', () => {
    expect(thisWeek(Date.UTC(2026, 9, 14, 16))).toBe('w202642');
    expect(thisWeek(Date.UTC(2027, 0, 1, 16))).toBe('w202653');
  });

  it('parses a community and finds the next milestone', () => {
    const c = parseCommunity('zelos-clan-ct', { name: 'Zelos Clan', state: 'CT', members: 7, counted: 6, xp: 1200, rewarded: [5], weeks: { w202642: 3, bad: 9 }, title: 'Founder' });
    expect(c).toMatchObject({ name: 'Zelos Clan', members: 7, counted: 6, rewarded: [5], weeks: { w202642: 3 }, title: 'Founder', founderName: 'a trader' });
    expect(nextTier(6)?.[0]).toBe(10);
    expect(nextTier(100)).toBeNull();
  });
});
