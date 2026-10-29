import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chartBars, COMPANIES, parseBars, parseProfile, parseQuotes, SECTORS, warEquity } from './war';

describe('War zone', () => {
  it('lists the same made-up companies and sectors as the server (functions/warmarket.py)', () => {
    const py = readFileSync(resolve(__dirname, '../../../../functions/warmarket.py'), 'utf8');
    const rows = [...py.matchAll(/\("([A-Z]{5})", "([^"]+)", "([a-z]+)", [\d.]+, [\d.]+\)/g)].map((m) => ({ sym: m[1], name: m[2], sector: m[3] }));
    expect(rows).toEqual(COMPANIES);
    const block = py.slice(py.indexOf('SECTORS = ('), py.indexOf('# (sym, name'));
    const secs = [...block.matchAll(/\("([a-z]+)", "([A-Za-z]+)"\)/g)].map((m) => [m[1], m[2]]);
    expect(secs).toEqual(SECTORS.map(([a, b]) => [a, b]));
  });
  it('groups 5-minute bars into chart bars, moving the last with the newest price', () => {
    const M = 60000;
    const raw = parseBars({ bars: [0, 5, 10, 15, 20].map((m, i) => ({ t: m * M, o: 10 + i, h: 12 + i, l: 9 + i, c: 11 + i })).concat([{ t: 'x' } as never]) });
    const out = chartBars(raw, 15, 30);
    expect(out).toHaveLength(2);
    expect(out[0]!.slice(1)).toEqual([10, 14, 9, 13, 0]);
    expect(out[1]!.slice(1)).toEqual([13, 30, 12, 30, 0]);
    expect(out[0]![0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
  it('reads the War profile and values it at War zone prices', () => {
    const p = parseProfile({ start: 100000, cash: 98000, positions: { NIMBC: { qty: 10, avg: 200 }, AAPL: { qty: 5, avg: 1 }, VOLTX: { qty: 0, avg: 1 } }, chart: [{ t: 1, eq: 100000 }, [2, 3]], trades: 1 });
    expect(p.positions).toEqual([{ sym: 'NIMBC', qty: 10, avg: 200 }]);
    expect(p.chart).toEqual([{ t: 1, eq: 100000 }]);
    const q = parseQuotes({ updatedAt: 5, prices: { NIMBC: { p: 210, ref: 200 }, FAKE: { p: 1 } } });
    expect(Object.keys(q.prices)).toEqual(['NIMBC']);
    expect(warEquity(p, q.prices)).toBe(100100);
    expect(warEquity(p, {})).toBe(100000); // no price: valued at cost
  });
});
