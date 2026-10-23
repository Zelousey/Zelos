import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { boostLeft, nextTier, parseXpEvent, REFERRAL_TIERS, referralTier, STREAK_REWARDS } from './missions';

const read = (p: string) => readFileSync(resolve(__dirname, '../../../..', p), 'utf8');

describe('missions & XP', () => {
  it('streak rewards and referral tiers match the server and the website', () => {
    expect(read('functions/xp.py')).toContain(`STREAK_REWARDS = {${STREAK_REWARDS.map(([d, x]) => `${d}: ${x}`).join(', ')}}`);
    expect(read('zelos-social.js')).toContain(`var TIERS = [${[...REFERRAL_TIERS].reverse().map((x) => `[${x.at}, '${x.name}', '${x.icon}']`).join(', ')}];`);
    expect([0, 1, 2, 3, 9, 10, 24, 25, 99].map((n) => referralTier(n)?.name ?? null)).toEqual([null, 'Bronze', 'Bronze', 'Silver', 'Silver', 'Gold', 'Gold', 'Diamond', 'Diamond']);
    expect(nextTier(4)?.at).toBe(10);
    expect(nextTier(30)).toBeNull();
  });
  it('reads the XP ledger, skipping anything that paid nothing', () => {
    expect(parseXpEvent('a', { label: 'Mission', xp: 10, source: 'missions', createdAt: Timestamp.fromMillis(5000) })).toEqual({ id: 'a', label: 'Mission', xp: 10, source: 'missions', at: 5000 });
    expect(parseXpEvent('b', { label: 'x', xp: 0 })).toBeNull();
    expect(parseXpEvent('c', { label: 'x', xp: 'lots' })).toBeNull();
  });
});

describe('XP booster countdown', () => {
  it('shows hours and minutes left, or nothing once it ends', () => {
    const now = 1_760_000_000_000;
    expect(boostLeft(now + 24 * 3600_000, now)).toBe('24h 0m');
    expect(boostLeft(now + 90 * 60_000 + 30_000, now)).toBe('1h 30m');
    expect(boostLeft(now + 20_000, now)).toBe('1m');
    expect(boostLeft(now - 1, now)).toBeNull();
    expect(boostLeft(null, now)).toBeNull();
  });
});
