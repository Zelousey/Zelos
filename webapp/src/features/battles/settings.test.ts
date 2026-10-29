import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUYIN_TIERS, buyInLock, DRAFT_PICKS, LMS_OPTS, WHALE_CAPS, WHALE_SHIELDS, cutOptions, DEFAULT_SETTINGS, DRAFT_SECS, fitDays, optionsOn, RULESETS, applyRuleset, settingsError, settingsOf, toPayload, type Settings } from './settings';

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
    const s: Settings = { mode: 'lms', lms: { floorPct: 10, maxLossPct: 0, maxLosses: 5, cutHours: 24 }, draftPicks: 3, draftSecs: 45, whaleCap: 50, whaleShields: 2, storms: 'often', bounties: true, stops: true };
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
    expect(line('TW_RULESETS')).toBe(`(${RULESETS.map((r) => `"${r}"`).join(', ')})`);
    expect(line('TW_LMS_OPTS')).toBe(`{${Object.entries(LMS_OPTS).map(([k, v]) => `"${k}": ${tuple(v)}`).join(', ')}}`);
    expect(line('TW_MODE_OPTS')).toBe(`{"draftPicks": ${tuple(DRAFT_PICKS)}, "draftSecs": ${tuple(DRAFT_SECS)}, "whaleCap": ${tuple(WHALE_CAPS)}, "whaleShields": ${tuple(WHALE_SHIELDS)}, "storms": ("rare", "often")}`);
  });

  it('a rematch copies a finished battle\'s settings back into the form (Phase 9)', () => {
    expect(settingsOf(null, {})).toEqual(DEFAULT_SETTINGS);
    const s: Settings = { ...DEFAULT_SETTINGS, mode: 'lms', lms: { floorPct: 10, maxLossPct: 0, maxLosses: 3, cutHours: 12 }, draftPicks: 3, whaleCap: 50, whaleShields: 2, storms: 'rare', bounties: true, stops: true };
    // as the server stores it (tw_validate_lms / tw_validate_modes) and the app reads it back
    const p = toPayload(s);
    const modes = { draft: { picks: p.modes!.draftPicks! }, whale: { capPct: p.modes!.whaleCap!, shields: p.modes!.whaleShields! }, storms: p.modes!.storms, bounties: true, stops: true };
    expect(settingsOf(p.lms ?? null, modes)).toEqual(s);
    expect(toPayload(settingsOf(p.lms ?? null, modes))).toEqual(p);
  });

  it('squad rulesets fix the mode and the draft; the pick timer is sent only when changed (Phase 10)', () => {
    const lms: Settings = { ...DEFAULT_SETTINGS, mode: 'lms', storms: 'rare' };
    expect(applyRuleset(lms, 'ffa')).toEqual({ ...lms, mode: 'classic', draftPicks: 0 });
    expect(applyRuleset(lms, 'draft')).toEqual({ ...lms, mode: 'classic', draftPicks: 3 });
    expect(applyRuleset({ ...DEFAULT_SETTINGS, draftPicks: 5 }, 'draft').draftPicks).toBe(5);
    expect(toPayload(applyRuleset(DEFAULT_SETTINGS, 'draft'))).toEqual({ modes: { draftPicks: 3 } });
    expect(toPayload({ ...applyRuleset(DEFAULT_SETTINGS, 'draft'), draftSecs: 30 })).toEqual({ modes: { draftPicks: 3, draftSecs: 30 } });
    expect(settingsOf(null, { draft: { picks: 3, secs: 60 } }).draftSecs).toBe(60);
    // Last Man Standing (10b): the mode is on, the draft off, and a floor if no rule was set
    expect(applyRuleset({ ...DEFAULT_SETTINGS, draftPicks: 3 }, 'lms')).toMatchObject({ mode: 'lms', draftPicks: 0, lms: DEFAULT_SETTINGS.lms });
    const kept = { ...DEFAULT_SETTINGS, lms: { floorPct: 0, maxLossPct: 5, maxLosses: 0, cutHours: 0 } };
    expect(applyRuleset(kept, 'lms').lms).toEqual(kept.lms);
  });
});
