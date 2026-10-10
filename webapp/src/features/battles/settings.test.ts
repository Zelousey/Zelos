import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUYIN_TIERS, buyInLock, DRAFT_PICKS, LMS_OPTS, WHALE_CAPS, WHALE_SHIELDS, cutOptions, DEFAULT_SETTINGS, fitDays, optionsOn, settingsError, toPayload, type Settings } from './settings';

describe('battle settings', () => {
  it('locks bigger buy-ins by XP like TW_BUYIN_TIERS', () => {
    expect(buyInLock(1000, 0)).toBeNull();
    expect(buyInLock(5000, 149)).toEqual({ level: 3, xp: 150, name: 'Gold' });
    expect(buyInLock(5000, 150)).toBeNull();
    expect(buyInLock(10000, 150)).toEqual({ level: 5, xp: 1000, name: 'Diamond' });
    expect(buyInLock(10000, 1000)).toBeNull();
    expect(buyInLock(20000, 5000)).toBeNull();
  });

  it('sends nothing extra for a classic match', () => {
    expect(toPayload(DEFAULT_SETTINGS)).toEqual({});
    expect(settingsError(DEFAULT_SETTINGS, 3)).toBeNull();
  });

  it('sends the server shapes for Last Man Standing and every option', () => {
    const s: Settings = { mode: 'lms', lms: { floorPct: 10, maxLossPct: 0, maxLosses: 5, cutHours: 24 }, draftPicks: 3, whaleCap: 50, whaleShields: 2, storms: 'often', bounties: true, stops: true };
    expect(toPayload(s)).toEqual({ lms: { floorPct: 10, maxLosses: 5, cutHours: 24 }, modes: { draftPicks: 3, whaleCap: 50, whaleShields: 2, storms: 'often', bounties: true, stops: true } });
    expect(optionsOn(s)).toBe(5);
    expect(toPayload({ ...s, whaleCap: 0 }).modes).not.toHaveProperty('whaleShields');
  });

  it('needs a rule for Last Man Standing and cuts shorter than the battle', () => {
    const lms: Settings = { ...DEFAULT_SETTINGS, mode: 'lms', lms: { floorPct: 0, maxLossPct: 0, maxLosses: 0, cutHours: 0 } };
    expect(settingsError(lms, 3)).toBe('bs.lms.none');
    expect(settingsError({ ...lms, lms: { ...lms.lms, cutHours: 24 } }, 1)).toBe('bs.lms.cutTooLong');
    expect(cutOptions(1)).toEqual([6, 12]);
    expect(cutOptions(3)).toEqual([6, 12, 24, 48]);
    expect(fitDays({ ...lms, lms: { ...lms.lms, cutHours: 24 } }, 1).lms.cutHours).toBe(0);
    expect(fitDays({ ...lms, lms: { ...lms.lms, cutHours: 12 } }, 1).lms.cutHours).toBe(12);
  });

  it('matches the server tables in functions/main.py', () => {
    const py = readFileSync(resolve(__dirname, '../../../../functions/main.py'), 'utf8');
    const line = (name: string) => py.match(new RegExp(`^${name} = (.+)$`, 'm'))?.[1] ?? '';
    const tiers = BUYIN_TIERS.map(([cap, level, xp, name]) => `(${cap}, ${level}, ${xp}, "${name}")`).join(', ');
    expect(line('TW_BUYIN_TIERS')).toBe(`(${tiers})`);
    const tuple = (a: number[]) => `(${a.join(', ')})`;
    expect(line('TW_LMS_OPTS')).toBe(`{${Object.entries(LMS_OPTS).map(([k, v]) => `"${k}": ${tuple(v)}`).join(', ')}}`);
    expect(line('TW_MODE_OPTS')).toBe(`{"draftPicks": ${tuple(DRAFT_PICKS)}, "whaleCap": ${tuple(WHALE_CAPS)}, "whaleShields": ${tuple(WHALE_SHIELDS)}, "storms": ("rare", "often")}`);
  });
});
