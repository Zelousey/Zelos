/**
 * The Zelos stock list (names and groups), bundled from data/practice-universe.json, the
 * single source of truth the classic site and the price functions also use. Bundling it
 * means the app (and later the native app) never needs a network request for names.
 * Crypto is excluded while crypto data is paused (no licensed source).
 */
import raw from '../../../data/practice-universe.json';

export type Instrument = { sym: string; name: string; group: string };

const PAUSED_GROUPS = new Set(['Crypto']);

export const UNIVERSE: Instrument[] = (raw.symbols as { sym: string; name?: string; group?: string }[])
  .map((s) => ({ sym: s.sym.toUpperCase(), name: s.name ?? s.sym, group: s.group ?? '' }))
  .filter((s) => !PAUSED_GROUPS.has(s.group));

const BY_SYM = new Map(UNIVERSE.map((s) => [s.sym, s]));

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
