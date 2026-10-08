import { readJSON, readString, writeString } from '../../lib/storage';
import { SYMBOL_RE } from '../../data/markets';

const KEY = 'zelosAppLastSymbol';
const RECENT_KEY = 'zelosAppRecentSymbols';
export function lastSymbol(): string {
  const v = readString(KEY);
  return v && SYMBOL_RE.test(v) ? v : 'SPY';
}
/** The last few symbols charted, newest first (for the chart's switcher and previews). */
export function recentSymbols(): string[] {
  const v = readJSON<unknown>(RECENT_KEY, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && SYMBOL_RE.test(x)).slice(0, 8) : [];
}
export function rememberSymbol(sym: string): void {
  if (!SYMBOL_RE.test(sym)) return;
  writeString(KEY, sym);
  writeString(RECENT_KEY, JSON.stringify([sym, ...recentSymbols().filter((x) => x !== sym)].slice(0, 8)));
}
