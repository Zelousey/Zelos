/**
 * The chart mode (owner 2026-11-10): Day Trading or Long Term. One choice for the whole app,
 * remembered on this device (the same key Market used for its trading-style tabs), so Market,
 * the Full Chart and Change Symbol always agree.
 *
 * Every stock on the Zelos list belongs to one mode (data/practice-universe.json "fast": day
 * trading stocks get prices every minute, long-term ones every 15 minutes, to stay inside the
 * Marketstack plan). A symbol is "compatible" with a mode when it is on that mode's list.
 */
import { useSyncExternalStore } from 'react';
import { readString, writeString } from '../lib/storage';
import type { Timeframe } from '../features/charts/series';
import { INDEX_ETFS, instrument, UNIVERSE, type Instrument } from './universe';

export type Mode = 'fast' | 'slow';
export const MODE_KEY = 'zelosAppMarketSpeed';
const EVENT = 'zelos-mode';
const EXPLAINED_KEY = 'zelosModeExplained';

export const readMode = (): Mode => (readString(MODE_KEY) === 'slow' ? 'slow' : 'fast');

export function setMode(m: Mode): void {
  if (readMode() === m) return;
  writeString(MODE_KEY, m);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === MODE_KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** The current mode, updated everywhere at once when any screen changes it. */
export function useMode(): [Mode, (m: Mode) => void] {
  const mode = useSyncExternalStore(subscribe, readMode, () => 'fast' as Mode);
  return [mode, setMode];
}

/** The mode a symbol belongs to (undefined: not on the list). */
export const modeOf = (sym: string): Mode | undefined => {
  const i = instrument(sym);
  return i ? (i.fast ? 'fast' : 'slow') : undefined;
};

export const compatible = (sym: string, mode: Mode): boolean => modeOf(sym) === mode;

/** The symbol to show instead when `sym` isn't in `mode`: an index fund of that mode for a fund,
 * otherwise a stock from the same group, otherwise the mode's first index fund or stock. */
export function fallbackSymbol(sym: string, mode: Mode): string {
  const list: Instrument[] = UNIVERSE.filter((i) => (i.fast ? 'fast' : 'slow') === mode);
  const inst = instrument(sym);
  const index = INDEX_ETFS.map((x) => x.sym).find((x) => compatible(x, mode));
  if (inst?.group === 'ETF' && index) return index;
  const sameGroup = inst ? list.find((i) => i.group === inst.group) : undefined;
  return sameGroup?.sym ?? index ?? list[0]?.sym ?? sym;
}

/** Timeframes each mode shows, and the one it opens on. */
export const MODE_TFS: Record<Mode, Timeframe[]> = { fast: ['5m', '15m', '1h'], slow: ['D', 'W'] };
export const MODE_DEFAULT_TF: Record<Mode, Timeframe> = { fast: '15m', slow: 'D' };

/** The short explanation is shown the first time someone switches modes. */
export const modeExplained = (): boolean => readString(EXPLAINED_KEY) === '1';
export const markModeExplained = (): void => writeString(EXPLAINED_KEY, '1');
