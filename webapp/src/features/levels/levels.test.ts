import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COIN_URL } from '../tokens/coin';
import { tierOf } from './LevelBadge';
import { levelToCelebrate } from './LevelUp';

const read = (p: string) => readFileSync(resolve(__dirname, '../../../..', p), 'utf8');

describe('level badges, level-up and tokens', () => {
  it('frames change at the same levels as the website', () => {
    expect(read('zelos-levels.js')).toContain('function tier(n) { return n >= 10 ? 5 : n >= 8 ? 4 : n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0; }');
    expect([0, 1, 2, 3, 4, 5, 7, 8, 9, 10].map(tierOf)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });
  it('celebrates a new level once, never on a first visit', () => {
    expect(levelToCelebrate(450, null)).toBeNull(); // first time on this device
    expect(levelToCelebrate(450, '2')?.level).toBe(4); // 400+ XP = Platinum
    expect(levelToCelebrate(450, '4')).toBeNull();
    expect(levelToCelebrate(5, '0')).toBeNull(); // still level 0
  });
  it('uses the website’s Z token image', () => {
    expect(read('zelos-tokens.js')).toContain(`--zt-coin:url("${COIN_URL.replace(/'/g, "\\'")}")`);
  });
});
