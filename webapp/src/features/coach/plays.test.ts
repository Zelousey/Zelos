import { describe, expect, it } from 'vitest';
import { parsePlay, parseShape } from './plays';

describe('coach plays', () => {
  it('reads drawings and drops broken ones', () => {
    expect(parseShape({ k: 'line', c: 'green', pts: [{ d: '2026-09-01', p: 220 }, { d: '2026-10-01', p: 231 }] })).toEqual({ k: 'line', c: 'green', pts: [{ d: '2026-09-01', p: 220 }, { d: '2026-10-01', p: 231 }] });
    expect(parseShape({ k: 'hline', c: 'pink', pts: [{ d: '2026-10-01', p: 225 }], text: 'stop' })).toEqual({ k: 'hline', c: 'blue', pts: [{ d: '2026-10-01', p: 225 }], text: 'stop' });
    expect(parseShape({ k: 'line', pts: [{ d: '2026-09-01', p: 1 }] })).toBeNull(); // a line needs two points
    expect(parseShape({ k: 'circle', pts: [] })).toBeNull();
    expect(parseShape({ k: 'text', pts: [{ d: '2026-09-01', p: -1 }] })).toBeNull();
  });
  it('reads a play with its comments', () => {
    const p = parsePlay('p1', { sym: 'AAPL', tf: 'D', title: 'Buy the retest', note: 'n', from: 'c1', fromName: 'Ada', at: 5, shapes: [{ k: 'hline', pts: [{ d: '2026-10-01', p: 1 }] }, { k: 'bad' }], comments: [{ from: 's1', fromName: 'Bo', role: 'student', text: 'ok', at: 6 }, { text: 3 }] });
    expect(p?.shapes).toHaveLength(1);
    expect(p?.comments).toEqual([{ from: 's1', fromName: 'Bo', role: 'student', text: 'ok', at: 6 }]);
    expect(parsePlay('p2', { sym: 'AAPL', tf: '1y' })).toBeNull();
  });
});
