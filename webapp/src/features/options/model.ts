/**
 * The options price model, the same numbers as the server (functions/options.py) and the
 * website (practice/practice-options.js). There is no options data on any plan we have, so
 * prices are MODELED: Black-Scholes on the stock's price, with each stock's volatility from
 * markets/optionVols (published by the server from the last 20 daily closes). What you see
 * here is what the server fills at; the server re-prices every order itself.
 */
import { useLiveDoc } from '../../data/liveDoc';
import { UNIVERSE } from '../../data/universe';

export const RATE = 0.04;
export const DEFAULT_VOL = 0.4;
export const STRIKE_COUNT = 31;
export const MAX_CONTRACTS = 100;
export type Kind = 'call' | 'put';
export type Contract = { u: string; kind: Kind; strike: number; exp: string };
export type OptionQuote = { mid: number; bid: number; ask: number; delta: number; dte: number };

export function ncdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export function bs(kind: Kind, S: number, K: number, T: number, sigma: number, r = RATE): { price: number; delta: number } {
  if (T <= 0 || sigma <= 0) return { price: Math.max(0, kind === 'call' ? S - K : K - S), delta: kind === 'call' ? (S > K ? 1 : 0) : S < K ? -1 : 0 };
  const sq = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / sq;
  const d2 = d1 - sq;
  if (kind === 'call') return { price: S * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2), delta: ncdf(d1) };
  return { price: K * Math.exp(-r * T) * ncdf(-d2) - S * ncdf(-d1), delta: ncdf(d1) - 1 };
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** The next 6 weekly Fridays plus the next monthly (3rd-Friday) ones, as YYYY-MM-DD. */
export function expirations(today: string): string[] {
  const out: string[] = [];
  const d = new Date(today + 'T12:00:00Z');
  const f = new Date(d);
  f.setUTCDate(f.getUTCDate() + ((5 - f.getUTCDay() + 7) % 7 || 7));
  for (let k = 0; k < 6; k++) {
    out.push(ymd(f));
    f.setUTCDate(f.getUTCDate() + 7);
  }
  for (let m = 0; m < 5; m++) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, 1, 12));
    x.setUTCDate(1 + ((5 - x.getUTCDay() + 7) % 7) + 14);
    const s = ymd(x);
    if (s > today && !out.includes(s)) out.push(s);
  }
  return out.sort();
}

export const daysTo = (exp: string, today: string) => Math.round((Date.parse(exp + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 864e5);
export const strikeStep = (S: number) => (S < 25 ? 0.5 : S < 60 ? 1 : S < 150 ? 2.5 : S < 400 ? 5 : S < 1000 ? 10 : 25);

/** The strikes the server accepts around the stock's price. */
export function strikes(S: number, count = STRIKE_COUNT): number[] {
  const st = strikeStep(S);
  const atm = Math.round(S / st) * st;
  const half = Math.floor(count / 2);
  const out: number[] = [];
  for (let k = -half; k <= half; k++) {
    const x = +(atm + k * st).toFixed(2);
    if (x > 0) out.push(x);
  }
  return out;
}

const YEAR_MS = 365 * 864e5;
export const TODAY_CUTOFF_MIN = 30; // no new "Today" buys in the last 30 minutes (functions/options.py)

/** New York's offset from UTC on a day, e.g. '-05:00'. */
function nyOffset(day: string): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(new Date(day + 'T17:00:00Z')).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-5';
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  return m ? `${m[1]}${m[2]!.padStart(2, '0')}:${m[3] ?? '00'}` : '-05:00';
}
/** 4:00 pm New York on a day, in ms (the server also knows early closes; it decides fills). */
export const closeMs = (day: string) => Date.parse(`${day}T16:00:00${nyOffset(day)}`);
const nyMinutes = (ms: number) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
};

/**
 * The expirations you can buy now: "Today" (owner 2026-11-14) on a trading day until 30 minutes
 * before the close, then the weekly and monthly ones. marketOpen (from markets/quotes) keeps Today
 * off on a holiday; the server checks again.
 */
export function listedExpirations(today: string, nowMs: number, marketOpen: boolean): string[] {
  const wd = new Date(today + 'T12:00:00Z').getUTCDay();
  const m = nyMinutes(nowMs);
  const ok = wd >= 1 && wd <= 5 && m < 16 * 60 - TODAY_CUTOFF_MIN && (marketOpen || m < 9 * 60 + 30);
  return ok ? [today, ...expirations(today)] : expirations(today);
}

/** Model quote per share: mid, bid, ask (4% spread, 2c-50c, at least 1c) and delta. A contract
 *  that expires today is priced on the minutes left until the close when nowMs is given. */
export function quote(kind: Kind, S: number, K: number, exp: string, today: string, sigma: number, nowMs?: number): OptionQuote {
  const dte = Math.max(0, daysTo(exp, today));
  const T = dte === 0 && nowMs != null ? Math.max(closeMs(exp) - nowMs, 60_000) / YEAR_MS : Math.max(dte, 0.5) / 365;
  const q = bs(kind, S, K, T, sigma);
  const mid = Math.max(0.01, q.price);
  const spread = Math.max(0.02, Math.min(0.5, mid * 0.04));
  return { mid: r2(mid), bid: r2(Math.max(0.01, mid - spread / 2)), ask: r2(mid + spread / 2), delta: q.delta, dte };
}

/** AAPL|20261120|C|25000: underlying | expiry | C/P | strike in cents (the server's key). */
export const contractId = (c: Contract) => `${c.u}|${c.exp.replace(/-/g, '')}|${c.kind === 'call' ? 'C' : 'P'}|${Math.round(c.strike * 100)}`;

const CONTRACT_RE = /^([A-Z][A-Z0-9.-]{0,9})\|(\d{4})(\d{2})(\d{2})\|([CP])\|(\d{1,9})$/;
export function parseContract(id: string): Contract | null {
  const m = CONTRACT_RE.exec(id);
  return m ? { u: m[1]!, exp: `${m[2]}-${m[3]}-${m[4]}`, kind: m[5] === 'C' ? 'call' : 'put', strike: Number(m[6]) / 100 } : null;
}

export const label = (c: Contract) => `${c.u} $${+c.strike} ${c.kind === 'call' ? 'Call' : 'Put'} ${c.exp.slice(5).replace('-', '/')}`;
export const intrinsic = (c: Pick<Contract, 'kind' | 'strike'>, S: number) => Math.max(0, c.kind === 'call' ? S - c.strike : c.strike - S);

/** Mark value per share at the model mid; intrinsic once expired; cost when there's no price. */
export function markValue(c: Contract & { avg: number }, S: number | undefined, vol: number, today: string, nowMs: number = Date.now()): number {
  if (S == null) return c.avg;
  if (c.exp < today || (c.exp === today && nowMs >= closeMs(today))) return intrinsic(c, S);
  return quote(c.kind, S, c.strike, c.exp, today, vol, c.exp === today ? nowMs : undefined).mid;
}

/** Options are on the day-trading stocks only, priced every minute (owner 2026-11-14). */
export const OPTION_STOCKS = UNIVERSE.filter((i) => i.fast).map((i) => i.sym); // the same list as the server's FAST_SYMBOLS
export const optionable = (sym: string) => OPTION_STOCKS.includes(sym);

export type Vols = Record<string, number>;
export const volFor = (vols: Vols | null | undefined, u: string) => vols?.[u] ?? DEFAULT_VOL;

export function parseVols(d: Record<string, unknown>): { day: string; vols: Vols } {
  const vols: Vols = {};
  for (const [k, v] of Object.entries((d.vols as Record<string, unknown>) ?? {})) if (typeof v === 'number' && Number.isFinite(v) && v > 0) vols[k] = v;
  return { day: typeof d.day === 'string' ? d.day : '', vols };
}

export const useOptionVols = () => useLiveDoc('markets/optionVols', parseVols);

/** Just the vols map (null while loading or before the server has published one). */
export function useVolMap(): Vols | null {
  const v = useOptionVols();
  return v.status === 'ready' ? v.data.vols : null;
}
