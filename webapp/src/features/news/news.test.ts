import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// no Firestore in unit tests: live queries stay "loading"; the bundled posts still count
vi.mock('../../data/liveQuery', () => ({ useLiveQuery: () => ({ status: 'loading' }) }));
vi.mock('../../data/liveDoc', () => ({ useLiveDoc: () => ({ status: 'loading' }) }));
vi.mock('../../lib/firebase', () => ({ db: () => ({}), callFunction: vi.fn() }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), query: vi.fn(), orderBy: vi.fn(), limit: vi.fn() }));

const { BUNDLED, SECTIONS, parseOfficial, parsePost, readSeen, useNewsUnseen } = await import('./news');

describe('Zelos News', () => {
  beforeEach(() => localStorage.clear());

  it('bundled posts are well-formed with one featured post', () => {
    expect(new Set(BUNDLED.map((p) => p.id)).size).toBe(BUNDLED.length);
    for (const p of BUNDLED) {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(SECTIONS).toContain(p.section);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.body.length).toBeGreaterThan(0);
      if (p.link) expect(p.link.to).toMatch(/^\/[a-z]/);
    }
    expect(BUNDLED.filter((p) => p.featured).length).toBe(1);
  });

  it('never describes Zelos as a brokerage or real trading', () => {
    for (const p of BUNDLED) expect([p.title, ...p.body].join(' ')).not.toMatch(/brokerage account|execute (real )?trades|deposit/i);
  });

  it('reads posts from Firestore defensively', () => {
    const p = parsePost('a1', { section: 'tradewar', date: '2026-10-08', title: 'Season 2', body: ['One', 'Two'], featured: true, createdAt: 5, link: { to: '/trade-war', label: 'Go' } });
    expect(p).toMatchObject({ id: 'a1', section: 'tradewar', title: 'Season 2', body: ['One', 'Two'], featured: true, stamp: 5, link: { to: '/trade-war', label: 'Go' } });
    expect(parsePost('x', { section: 'gossip', date: '2026-10-08', title: 't' })).toBeNull();
    expect(parsePost('x', { section: 'zelos', date: 'today', title: 't' })).toBeNull();
    // unsafe links are dropped, the post stays
    expect(parsePost('x', { section: 'zelos', date: '2026-10-08', title: 't', link: { to: 'javascript:alert(1)' } })?.link).toBeUndefined();
    expect(parsePost('x', { section: 'zelos', date: '2026-10-08', title: 't', link: { to: '//evil.com' } })?.link).toBeUndefined();
    // a voices post needs an https link to the original
    expect(parsePost('v', { section: 'voices', date: '2026-10-08', title: 'Why', voice: { platform: 'x', url: 'http://x.com/1', author: 'A', quote: 'q' } })).toBeNull();
    expect(parsePost('v', { section: 'voices', date: '2026-10-08', title: 'Why', voice: { platform: 'x', url: 'https://x.com/a/status/1', author: 'A', quote: 'q' } })?.voice).toMatchObject({ author: 'A', postedAt: '2026-10-08' });
  });

  it('official items: only Fed and SEC links, valid symbols', () => {
    const items = parseOfficial({
      items: [
        { id: '1', kind: 'fed', source: 'Federal Reserve', title: 'FOMC', detail: '', url: 'https://www.federalreserve.gov/x.htm', at: 2 },
        { id: '2', kind: 'filing', source: 'SEC filing', title: 'AAPL: new 8-K filing', detail: '2.02', url: 'https://www.sec.gov/x', at: 1, sym: 'AAPL', form: '8-K' },
        { id: '3', kind: 'filing', title: 'bad host', url: 'https://evil.com/sec.gov/x', at: 1 },
        { id: '4', kind: 'filing', title: 'bad sym', url: 'https://www.sec.gov/y', at: 1, sym: '<b>' },
        { id: '5', kind: 'tweet', url: 'https://www.sec.gov/z', at: 1 },
      ],
    });
    expect(items.map((i) => i.id)).toEqual(['1', '2', '4']);
    expect(items[2]!.sym).toBeUndefined();
    expect(parseOfficial({})).toEqual([]);
  });

  it('shows the unseen dot until News is visited, then clears it', () => {
    const { result, rerender } = renderHook(({ path }) => useNewsUnseen(path), { initialProps: { path: '/dashboard' } });
    expect(result.current).toBe(true);
    rerender({ path: '/news' });
    expect(result.current).toBe(false);
    expect(readSeen()).toBe(Math.max(...BUNDLED.map((p) => p.stamp)));
    rerender({ path: '/dashboard' });
    expect(result.current).toBe(false);
  });
});
