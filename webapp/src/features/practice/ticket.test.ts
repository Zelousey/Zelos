import { describe, expect, it } from 'vitest';
import { t } from '../../lib/i18n';
import { checkTicket, maxShares, type TicketInput } from './ticket';

const base: TicketInput = { side: 'buy', type: 'market', qty: '10', limit: '', stop: '', tif: 'day', bracketOn: false, sl: '', tp: '' };
const msg = (k: string, v?: Record<string, string | number>) => t(k as never, v);

describe('order ticket checks', () => {
  it('a valid market buy becomes a clean request', () => {
    const c = checkTicket('AAPL', base, 100, 5000, 0, msg);
    expect(c.ok).toBe(true);
    expect(c.request).toEqual({ sym: 'AAPL', side: 'buy', type: 'market', qty: 10, tif: 'day' });
    expect(c.cost).toBe(1000);
  });
  it('whole shares and buying power', () => {
    expect(checkTicket('AAPL', { ...base, qty: '1.5' }, 100, 5000, 0, msg).errors.qty).toMatch(/whole number/);
    expect(checkTicket('AAPL', { ...base, qty: '60' }, 100, 5000, 0, msg).errors.qty).toMatch(/buying power/);
  });
  it('sells are limited to sellable shares', () => {
    expect(checkTicket('AAPL', { ...base, side: 'sell', qty: '8' }, 100, 0, 5, msg).errors.qty).toMatch(/up to 5/);
  });
  it('limit/stop need prices; bracket must straddle the entry', () => {
    expect(checkTicket('AAPL', { ...base, type: 'limit' }, 100, 5000, 0, msg).errors.limit).toBeDefined();
    const c = checkTicket('AAPL', { ...base, type: 'limit', limit: '95', bracketOn: true, sl: '96', tp: '94' }, 100, 5000, 0, msg);
    expect(c.errors.sl).toMatch(/below/);
    expect(c.errors.tp).toMatch(/above/);
    const good = checkTicket('AAPL', { ...base, type: 'limit', limit: '95', bracketOn: true, sl: '90', tp: '105' }, 100, 5000, 0, msg);
    expect(good.request?.bracket).toEqual({ sl: 90, tp: 105 });
    expect([good.risk, good.reward]).toEqual([50, 100]);
  });
  it('bracket is ignored on sells', () => {
    expect(checkTicket('AAPL', { ...base, side: 'sell', qty: '1', bracketOn: true, sl: '1' }, 100, 0, 5, msg).request?.bracket).toBeUndefined();
  });
  it('max shares', () => {
    expect(maxShares(1000, 30)).toBe(33);
    expect(maxShares(1000, null)).toBe(0);
  });
});
