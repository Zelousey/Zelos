import { describe, expect, it } from 'vitest';
import { t } from '../lib/i18n';
import { DEFAULT_PATH, MODULES, moduleForPath, moreModules, tabModules } from './modules';

describe('module registry', () => {
  it('has unique ids and paths', () => {
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.path)).size).toBe(MODULES.length);
  });
  it('covers every area in the app plan', () => {
    for (const id of ['dashboard', 'markets', 'charts', 'practice', 'real', 'trade-war', 'options', 'crypto', 'alerts', 'social', 'profile', 'missions', 'arcade', 'settings']) expect(MODULES.some((m) => m.id === id)).toBe(true);
  });
  it('every module is consistent with its status', () => {
    for (const m of MODULES) {
      if (m.status === 'ready') expect(m.load, m.id).toBeTypeOf('function');
      if (m.status === 'classic') expect(m.classicPath, m.id).toMatch(/^[a-z0-9][\w\-./?=&]*$/);
      expect(t(m.label)).not.toBe(m.label);
    }
  });
  it('phone tab bar has exactly four tabs plus More, and More holds the rest', () => {
    expect(tabModules().map((m) => m.tab)).toEqual([1, 2, 3, 4]);
    expect(tabModules().length + moreModules().length).toBe(MODULES.length);
  });
  it('keeps Practice, Real Trading and Trade War as separate modules', () => {
    const ids = MODULES.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['practice', 'real', 'trade-war']));
  });
  it('maps paths to modules', () => {
    expect(moduleForPath('/markets/AAPL')?.id).toBe('markets');
    expect(moduleForPath('/nope')).toBeUndefined();
    expect(MODULES.some((m) => m.path === DEFAULT_PATH)).toBe(true);
  });
});
