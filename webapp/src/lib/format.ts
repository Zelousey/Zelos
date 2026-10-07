/**
 * Number, money, percent and date formatting.
 *
 * Everything goes through Intl with an explicit locale and currency, so nothing assumes
 * US formats. Today the app passes 'en-US' / 'USD' (US-listed market data); when we add
 * localization only these defaults change, not every call site.
 */
export const DEFAULT_LOCALE = 'en-US';
export const DEFAULT_CURRENCY = 'USD';
export const MARKET_TIME_ZONE = 'America/New_York';

const cache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

const DASH = '—';
const ok = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/** $1,234.56 */
export function formatMoney(n: number | null | undefined, opts: { currency?: string; locale?: string; digits?: number } = {}): string {
  if (!ok(n)) return DASH;
  const digits = opts.digits ?? 2;
  return nf(opts.locale ?? DEFAULT_LOCALE, {
    style: 'currency',
    currency: opts.currency ?? DEFAULT_CURRENCY,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** 1,234.56 (a price without the currency sign, e.g. in tables) */
export function formatPrice(n: number | null | undefined, locale = DEFAULT_LOCALE): string {
  if (!ok(n)) return DASH;
  const digits = Math.abs(n) < 1 ? 4 : 2;
  return nf(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** +1.23% (input is a percent number, e.g. 1.23) */
export function formatPercent(n: number | null | undefined, opts: { locale?: string; signed?: boolean; digits?: number } = {}): string {
  if (!ok(n)) return DASH;
  const digits = opts.digits ?? 2;
  return nf(opts.locale ?? DEFAULT_LOCALE, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: opts.signed === false ? 'auto' : 'exceptZero',
  }).format(n / 100);
}

/** +$12.30 / −$4.00 */
export function formatSignedMoney(n: number | null | undefined, opts: { currency?: string; locale?: string } = {}): string {
  if (!ok(n)) return DASH;
  return nf(opts.locale ?? DEFAULT_LOCALE, {
    style: 'currency',
    currency: opts.currency ?? DEFAULT_CURRENCY,
    signDisplay: 'exceptZero',
  }).format(n);
}

/** 1.2M, 3.4B */
export function formatCompact(n: number | null | undefined, locale = DEFAULT_LOCALE): string {
  if (!ok(n)) return DASH;
  return nf(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** "4:05 PM ET"-style market time, in the market's own time zone. */
export function formatMarketTime(date: Date | number | null | undefined, locale = DEFAULT_LOCALE): string {
  if (date == null) return DASH;
  const d = typeof date === 'number' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return DASH;
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: MARKET_TIME_ZONE, timeZoneName: 'short' }).format(d);
}

/** "Oct 7" / "Oct 7, 2025" */
export function formatDate(date: Date | number | string | null | undefined, opts: { locale?: string; year?: boolean } = {}): string {
  if (date == null) return DASH;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return DASH;
  return new Intl.DateTimeFormat(opts.locale ?? DEFAULT_LOCALE, { month: 'short', day: 'numeric', year: opts.year ? 'numeric' : undefined }).format(d);
}

/** "2 min ago" */
export function formatRelative(from: number, now = Date.now(), locale = DEFAULT_LOCALE): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const s = Math.round((from - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(s, 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

/** 'up' | 'down' | 'flat' for colouring a change. */
export function direction(n: number | null | undefined): 'up' | 'down' | 'flat' {
  if (!ok(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}
