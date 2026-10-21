import { describe, expect, it } from 'vitest';
import { t } from '../lib/i18n';
import { DEFAULT_PATH, menuModules, MODULES, moduleForPath, navModules, navOwner, tabModules } from './modules';

describe('module registry', () => {
  it('has unique ids and paths', () => {
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.path)).size).toBe(MODULES.length);
  });
  it('covers every area in the app plan', () => {
    for (const id of ['dashboard', 'markets', 'charts', 'practice', 'trade-war', 'news', 'options', 'alerts', 'social', 'profile', 'missions', 'training', 'arcade', 'settings']) expect(MODULES.some((m) => m.id === id)).toBe(true);
  });
  it('every module is built in the app and labelled', () => {
    for (const m of MODULES) {
      expect(m.load, m.id).toBeTypeOf('function');
      expect(t(m.label)).not.toBe(m.label);
    }
  });
  it('phone tab bar is Dashboard | Market | Trade War | Alerts | News; the menu holds the rest', () => {
    expect(tabModules().map((m) => m.id)).toEqual(['dashboard', 'markets', 'trade-war', 'alerts', 'news']);
    expect(tabModules().length + menuModules().length).toBe(navModules().length);
    expect(menuModules().some((m) => m.tab != null)).toBe(false);
  });
  it('has no real-trading module: the app is simulated trading only', () => {
    for (const m of MODULES) {
      expect(m.id).not.toMatch(/real|broker/i);
      expect(t(m.label)).not.toMatch(/real trading|broker/i);
    }
  });
  it('Practice lives in the Dashboard and Options in Market (routes, not nav entries); Charts is a route under Market', () => {
    expect(navOwner(MODULES.find((m) => m.id === 'practice'))).toBe('dashboard');
    expect(navOwner(MODULES.find((m) => m.id === 'options'))).toBe('markets');
    expect(navModules().some((m) => m.id === 'practice' || m.id === 'options')).toBe(false);
    expect(navOwner(MODULES.find((m) => m.id === 'charts'))).toBe('markets');
    expect(navModules().some((m) => m.id === 'charts')).toBe(false);
    for (const m of MODULES) if (m.parent) expect(MODULES.some((p) => p.id === m.parent), m.id).toBe(true);
  });
  it('maps paths to modules', () => {
    expect(moduleForPath('/markets/AAPL')?.id).toBe('markets');
    expect(moduleForPath('/nope')).toBeUndefined();
    expect(MODULES.some((m) => m.path === DEFAULT_PATH)).toBe(true);
  });
});
