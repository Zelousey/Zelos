/** Plain-language status line for prices: open/closed, how fresh, where they come from. */
import { formatMarketTime, formatRelative } from '../lib/format';
import type { QuotesDoc } from './markets';

/** "2026-11-07" -> "Nov 7" */
function formatDay(d: string): string {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function marketStatus(q: QuotesDoc | null, now = Date.now()): { open: boolean; text: string; stale: boolean } {
  if (!q) return { open: false, text: 'Prices loading…', stale: false };
  const at = q.updatedAt ? Date.parse(q.updatedAt) : NaN;
  const src = /marketstack/i.test(q.source) ? 'Marketstack' : q.source ? q.source.toUpperCase() : 'Zelos';
  const fast = q.every === 1 ? 'every minute' : q.every ? `every ${q.every} min` : null;
  const delay = !fast ? 'delayed' : q.everySlow && q.everySlow !== q.every ? `day trading ${fast}, long-term every ${q.everySlow} min` : `updates ${fast}`;
  if (q.paused?.reason === 'cycle' && q.paused.until)
    return { open: false, text: `Live prices paused until ${formatDay(q.paused.until)} (data plan limit) · showing last prices`, stale: true };
  if (q.paused) return { open: false, text: 'Live prices paused for today (data plan limit) · showing last prices', stale: true };
  if (q.error && q.error !== 'null') return { open: false, text: `Live prices paused · showing last prices (${src})`, stale: true };
  if (q.marketOpen && Number.isFinite(at)) {
    // stale after three missed updates (5 minutes at the least)
    const stale = now - at > Math.max(5, 3 * (q.every || 15)) * 60 * 1000;
    return { open: true, text: `Market open · updated ${formatRelative(at, now)} · ${delay} · ${src}`, stale };
  }
  return { open: false, text: Number.isFinite(at) ? `Market closed · prices as of ${formatMarketTime(at)} · ${src}` : `Market closed · ${src}`, stale: false };
}
