import { describe, expect, it } from 'vitest';
import { nextUpdate } from './UpdateTimer';

const at = (hhmmss: string) => Date.parse(`2026-11-16T${hhmmss}Z`);
describe('nextUpdate', () => {
  it('every minute: the next minute plus the fetch time', () => {
    const n = nextUpdate(at('15:00:30'), 1);
    expect(new Date(n.at).toISOString()).toBe('2026-11-16T15:01:20.000Z');
    expect(n.left).toBe(50_000);
  });
  it('every 15 minutes: from 9:31, so at :01, :16, :31 and :46', () => {
    expect(new Date(nextUpdate(at('15:07:00'), 15).at).toISOString()).toBe('2026-11-16T15:16:20.000Z');
    expect(new Date(nextUpdate(at('15:16:10'), 15).at).toISOString()).toBe('2026-11-16T15:16:20.000Z');
    expect(new Date(nextUpdate(at('15:16:30'), 15).at).toISOString()).toBe('2026-11-16T15:31:20.000Z');
  });
});
