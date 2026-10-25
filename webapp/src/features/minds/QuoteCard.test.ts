import { describe, expect, it } from 'vitest';
import { cardDue, localDay } from './QuoteCard';

const DAY = 86_400_000;
const now = new Date(2026, 9, 25, 12, 0).getTime();

describe('the Hall of Minds quote card', () => {
  it('is due after 3 days away from the Hall of Minds', () => {
    expect(cardDue(now, String(now - 3 * DAY), null)).toBe(true);
    expect(cardDue(now, String(now - 3 * DAY + 60_000), null)).toBe(false);
  });
  it('shows at most once a day', () => {
    expect(cardDue(now, String(now - 5 * DAY), localDay(now))).toBe(false);
    expect(cardDue(now, String(now - 5 * DAY), localDay(now - DAY))).toBe(true);
  });
  it('waits when nothing is recorded yet (a first app open starts the count)', () => {
    expect(cardDue(now, null, null)).toBe(false);
    expect(cardDue(now, 'junk', null)).toBe(false);
  });
  it('names the local day', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });
});
