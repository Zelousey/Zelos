import { readString, writeString } from '../../lib/storage';
import { SYMBOL_RE } from '../../data/markets';

const KEY = 'zelosAppLastSymbol';
export function lastSymbol(): string {
  const v = readString(KEY);
  return v && SYMBOL_RE.test(v) ? v : 'SPY';
}
export function rememberSymbol(sym: string): void {
  if (SYMBOL_RE.test(sym)) writeString(KEY, sym);
}
