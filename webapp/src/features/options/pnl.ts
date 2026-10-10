/**
 * Estimated profit/loss for a long call or put (the Robinhood-style "what if" chart): what the
 * position would be worth if the stock were at price S on a given day, using the same modeled
 * price as the server (model.ts). On or after expiration it's the intrinsic value. Estimates
 * only: the real price is set by the server when you sell.
 */
import { addDays } from './dates';
import { intrinsic, quote, type Kind } from './model';

export type Leg = { kind: Kind; strike: number; exp: string };

/** Value per share of one contract on `day` with the stock at S. */
export function valueOn(c: Leg, S: number, day: string, vol: number): number {
  if (day >= c.exp) return intrinsic(c, S);
  return quote(c.kind, S, c.strike, c.exp, day, vol).mid;
}

/** P&L in dollars for `qty` contracts bought at `paid` a share. */
export const pnlOn = (c: Leg, paid: number, qty: number, S: number, day: string, vol: number) => (valueOn(c, S, day, vol) - paid) * 100 * qty;

/** Stock price at expiration where the trade breaks even. */
export const breakeven = (c: Leg, paid: number) => (c.kind === 'call' ? c.strike + paid : c.strike - paid);

/** Price range for the chart: ±30% around the stock, widened to show the strike and breakeven. */
export function priceRange(S: number, c: Leg, paid: number): [number, number] {
  const be = breakeven(c, paid);
  const lo = Math.max(0.01, Math.min(S * 0.7, c.strike * 0.9, be * 0.9));
  const hi = Math.max(S * 1.3, c.strike * 1.1, be * 1.1);
  return [lo, hi];
}

export type Point = { S: number; pnl: number };

export function curve(c: Leg, paid: number, qty: number, day: string, vol: number, range: [number, number], n = 96): Point[] {
  const [lo, hi] = range;
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const S = lo + ((hi - lo) * i) / n;
    out.push({ S, pnl: pnlOn(c, paid, qty, S, day, vol) });
  }
  return out;
}

/** The days you can pick on the date slider: today .. expiration. */
export function dayChoices(today: string, exp: string): string[] {
  const out: string[] = [];
  for (let d = today; d <= exp && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out.length ? out : [exp];
}
