/**
 * The Zelos stock list (names and groups), bundled from data/practice-universe.json, the
 * single source of truth the classic site and the price functions also use. Bundling it
 * means the app (and later the native app) never needs a network request for names.
 * Crypto is excluded while crypto data is paused (no licensed source).
 */
import raw from '../../../data/practice-universe.json';
import retiredRaw from '../../../data/retired-symbols.json';

/** fast: a day-trading stock, priced every minute; the others (long-term) every 15 minutes, to
 * stay inside the Marketstack plan (owner, 2026-10-22). retired: taken off the list; anyone
 * still holding it can only sell, at the next closing price. */
export type Instrument = { sym: string; name: string; group: string; fast: boolean; retired?: boolean };

const PAUSED_GROUPS = new Set(['Crypto']);
type Row = { sym: string; name?: string; group?: string; fast?: boolean };

export const UNIVERSE: Instrument[] = (raw.symbols as Row[])
  .map((s) => ({ sym: s.sym.toUpperCase(), name: s.name ?? s.sym, group: s.group ?? '', fast: s.fast === true }))
  .filter((s) => !PAUSED_GROUPS.has(s.group));

const BY_SYM = new Map(UNIVERSE.map((s) => [s.sym, s]));

export const RETIRED: Instrument[] = (retiredRaw.symbols as Row[])
  .map((s) => ({ sym: s.sym.toUpperCase(), name: s.name ?? s.sym, group: s.group ?? '', fast: false, retired: true }))
  .filter((s) => !BY_SYM.has(s.sym));

const RETIRED_BY_SYM = new Map(RETIRED.map((s) => [s.sym, s]));

/** A removed stock (for positions people still hold), or undefined. */
export function retiredInstrument(sym: string): Instrument | undefined {
  return RETIRED_BY_SYM.get(sym.toUpperCase());
}

/** The day-trading stocks (every minute) or the long-term ones (every 15 minutes). */
export function bySpeed(fast: boolean): Instrument[] {
  return UNIVERSE.filter((s) => s.fast === fast);
}

/** ETFs that stand in for the indexes (index values themselves need an index-data licence). */
export const INDEX_ETFS: { sym: string; label: string }[] = [
  { sym: 'SPY', label: 'S&P 500' },
  { sym: 'QQQ', label: 'Nasdaq 100' },
  { sym: 'DIA', label: 'Dow' },
];

export function instrument(sym: string): Instrument | undefined {
  return BY_SYM.get(sym.toUpperCase());
}

export function groups(): string[] {
  return [...new Set(UNIVERSE.map((s) => s.group))].filter(Boolean);
}

export function searchUniverse(q: string): Instrument[] {
  const needle = q.trim().toUpperCase();
  if (!needle) return UNIVERSE;
  return UNIVERSE.filter((s) => s.sym.startsWith(needle) || s.name.toUpperCase().includes(needle));
}
