/** Plain-language status line for prices: open/closed, how fresh, where they come from. */
import { formatMarketTime, formatRelative } from '../lib/format';
import type { QuotesDoc } from './markets';

export function marketStatus(q: QuotesDoc | null, now = Date.now()): { open: boolean; text: string; stale: boolean } {
  if (!q) return { open: false, text: 'Prices loading…', stale: false };
  const at = q.updatedAt ? Date.parse(q.updatedAt) : NaN;
  const src = /marketstack/i.test(q.source) ? 'Marketstack' : q.source ? q.source.toUpperCase() : 'Zelos';
  const delay = q.every ? `updates every ${q.every} min` : 'delayed';
  if (q.error && q.error !== 'null') return { open: false, text: `Live prices paused · showing last prices (${src})`, stale: true };
  if (q.marketOpen && Number.isFinite(at)) {
    const stale = now - at > 45 * 60 * 1000;
    return { open: true, text: `Market open · updated ${formatRelative(at, now)} · ${delay} · ${src}`, stale };
  }
  return { open: false, text: Number.isFinite(at) ? `Market closed · prices as of ${formatMarketTime(at)} · ${src}` : `Market closed · ${src}`, stale: false };
}
