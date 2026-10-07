/**
 * Order-ticket checks in the browser: the same rules the server applies
 * (functions/practice.py validate_order), so mistakes show up before you press Place.
 * The server checks everything again with its own prices; this is only for feedback.
 */
import type { OrderRequest } from './actions';

export type TicketInput = { side: 'buy' | 'sell'; type: 'market' | 'limit' | 'stop'; qty: string; limit: string; stop: string; tif: 'day' | 'gtc'; bracketOn: boolean; sl: string; tp: string };
export type TicketCheck = { ok: boolean; errors: Partial<Record<'qty' | 'limit' | 'stop' | 'sl' | 'tp', string>>; entry: number | null; cost: number | null; request: OrderRequest | null; risk: number | null; reward: number | null };

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

export function checkTicket(sym: string, t: TicketInput, last: number | null, buyingPower: number, sellable: number, msg: (k: string, v?: Record<string, string | number>) => string): TicketCheck {
  const errors: TicketCheck['errors'] = {};
  const qty = num(t.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 100000) errors.qty = msg('trade.err.qty');
  const limit = num(t.limit);
  const stop = num(t.stop);
  if (t.type === 'limit' && !(limit > 0)) errors.limit = msg('trade.err.price');
  if (t.type === 'stop' && !(stop > 0)) errors.stop = msg('trade.err.price');
  const entry = t.type === 'limit' ? (limit > 0 ? limit : null) : t.type === 'stop' ? (stop > 0 ? stop : null) : last;
  const cost = entry != null && Number.isInteger(qty) ? entry * qty : null;
  if (!errors.qty) {
    if (t.side === 'buy' && cost != null && cost > buyingPower + 0.005) errors.qty = msg('trade.err.bp', { bp: buyingPower.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) });
    if (t.side === 'sell' && qty > sellable) errors.qty = msg('trade.err.shares', { qty: sellable });
  }
  let sl: number | undefined;
  let tp: number | undefined;
  if (t.side === 'buy' && t.bracketOn) {
    const s = num(t.sl);
    const p = num(t.tp);
    if (t.sl.trim() !== '') {
      if (!(s > 0) || (entry != null && s >= entry)) errors.sl = msg('trade.err.sl');
      else sl = s;
    }
    if (t.tp.trim() !== '') {
      if (!(p > 0) || (entry != null && p <= entry)) errors.tp = msg('trade.err.tp');
      else tp = p;
    }
  }
  const ok = Object.keys(errors).length === 0 && entry != null;
  const request: OrderRequest | null = ok
    ? {
        sym,
        side: t.side,
        type: t.type,
        qty,
        tif: t.tif,
        ...(t.type === 'limit' ? { limit } : {}),
        ...(t.type === 'stop' ? { stop } : {}),
        ...(sl != null || tp != null ? { bracket: { ...(sl != null ? { sl } : {}), ...(tp != null ? { tp } : {}) } } : {}),
      }
    : null;
  const risk = sl != null && entry != null && Number.isInteger(qty) ? (entry - sl) * qty : null;
  const reward = tp != null && entry != null && Number.isInteger(qty) ? (tp - entry) * qty : null;
  return { ok, errors, entry, cost, request, risk, reward };
}

/** Whole shares you can afford at a price. */
export function maxShares(buyingPower: number, price: number | null): number {
  return price && price > 0 ? Math.max(0, Math.floor(buyingPower / price)) : 0;
}
