/** Plain-language status line for prices: open/closed, how fresh, where they come from. */
import { formatMarketTime, formatRelative } from '../lib/format';
import type { QuotesDoc } from './markets';

/** "2026-11-07" -> "Nov 7" */
function formatDay(d: string): string {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const nyDay = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
/** "4:06 PM EST" today, "Fri 4:06 PM EST" from an earlier day */
function whenShown(at: number, now: number): string {
  const day = nyDay(at) === nyDay(now) ? '' : new Date(at).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' }) + ' ';
  return day + formatMarketTime(at);
}

/** Errors that are ours to fix (the key, the plan); anything else is the data provider not answering. */
const SETUP_ERRORS = new Set(['auth', 'quota', 'missing-key']);

/** outage: the data provider isn't answering (owner 2026-11-23, a Marketstack outage): say so plainly,
 *  show which prices are on screen, and that the server keeps retrying every minute. */
export function marketStatus(q: QuotesDoc | null, now = Date.now()): { open: boolean; text: string; stale: boolean; outage?: boolean } {
  if (!q) return { open: false, text: 'Prices loading…', stale: false };
  const at = q.updatedAt ? Date.parse(q.updatedAt) : NaN;
  const src = /marketstack/i.test(q.source) ? 'Marketstack' : q.source ? q.source.toUpperCase() : 'Zelos';
  const fast = q.every === 1 ? 'every minute' : q.every ? `every ${q.every} min` : null;
  const delay = !fast ? 'delayed' : q.everySlow && q.everySlow !== q.every ? `day trading ${fast}, long-term every ${q.everySlow} min` : `updates ${fast}`;
  if (q.paused?.reason === 'cycle' && q.paused.until)
    return { open: false, text: `Live prices paused until ${formatDay(q.paused.until)} (data plan limit) · showing last prices`, stale: true };
  if (q.paused) return { open: false, text: 'Live prices paused for today (data plan limit) · showing last prices', stale: true };
  if (q.error && q.error !== 'null' && SETUP_ERRORS.has(q.error)) return { open: false, text: `Live prices paused · showing last prices (${src})`, stale: true };
  if (q.error && q.error !== 'null')
    return {
      open: false,
      text: `Prices delayed: ${src} ${q.error === 'stale-feed' ? "isn't sending new prices" : "isn't responding"} right now. ${Number.isFinite(at) ? `Showing prices from ${whenShown(at, now)}. ` : ''}We retry every minute and they'll update on their own.`,
      stale: true,
      outage: true,
    };
  if (q.marketOpen && Number.isFinite(at)) {
    // stale after three missed updates (5 minutes at the least)
    const stale = now - at > Math.max(5, 3 * (q.every || 15)) * 60 * 1000;
    return { open: true, text: `Market open · updated ${formatRelative(at, now)} · ${delay} · ${src}`, stale };
  }
  return { open: false, text: Number.isFinite(at) ? `Market closed · prices as of ${formatMarketTime(at)} · ${src}` : `Market closed · ${src}`, stale: false };
}
