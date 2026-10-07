import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CATEGORIES, latestDate, NEWS, readSeen, useNewsUnseen } from './news';

describe('Zelos News', () => {
  beforeEach(() => localStorage.clear());

  it('posts are well-formed, newest first, unique, with one featured post', () => {
    expect(new Set(NEWS.map((p) => p.id)).size).toBe(NEWS.length);
    for (const p of NEWS) {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(CATEGORIES).toContain(p.category);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.body.length).toBeGreaterThan(0);
      if (p.link) expect(p.link.to).toMatch(/^\/[a-z]/);
    }
    expect([...NEWS].sort((a, b) => b.date.localeCompare(a.date)).map((p) => p.id)).toEqual(NEWS.map((p) => p.id));
    expect(NEWS.filter((p) => p.featured).length).toBe(1);
  });

  it('never describes Zelos as a brokerage or real trading', () => {
    for (const p of NEWS) expect([p.title, ...p.body].join(' ')).not.toMatch(/brokerage account|execute (real )?trades|deposit/i);
  });

  it('shows the unseen dot until News is visited, then clears it', () => {
    const { result, rerender } = renderHook(({ path }) => useNewsUnseen(path), { initialProps: { path: '/dashboard' } });
    expect(result.current).toBe(true);
    rerender({ path: '/news' });
    expect(result.current).toBe(false);
    expect(readSeen()).toBe(latestDate());
    rerender({ path: '/dashboard' });
    expect(result.current).toBe(false);
  });
});
