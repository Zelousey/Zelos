import { describe, expect, it } from 'vitest';
import { pageFrom, stepPage, swipeBlocked, swipeDirection } from './pages';

describe('Dashboard pages', () => {
  it('reads the page from the address, Trading by default', () => {
    expect(pageFrom(null)).toBe('trading');
    expect(pageFrom('market')).toBe('market');
    expect(pageFrom('nope')).toBe('trading');
  });
  it('steps left and right and stops at the ends', () => {
    expect(stepPage('trading', 1)).toBe('profile');
    expect(stepPage('strategies', -1)).toBe('market');
    expect(stepPage('trading', -1)).toBe(null);
    expect(stepPage('strategies', 1)).toBe(null);
  });
});

describe('swipeDirection', () => {
  const m = (x0: number, x1: number, dy = 0, ms = 200) => swipeDirection({ x0, y0: 300, x1, y1: 300 + dy, ms, width: 390 });
  it('a quick sideways swipe turns the page', () => {
    expect(m(300, 150)).toBe(1); // finger left → next page
    expect(m(100, 260)).toBe(-1);
  });
  it('ignores short, slow, mostly vertical and edge swipes', () => {
    expect(m(300, 260)).toBe(0); // too short
    expect(m(300, 150, 0, 900)).toBe(0); // too slow
    expect(m(300, 150, 120)).toBe(0); // scrolling down
    expect(m(10, 200)).toBe(0); // the OS back gesture edge
    expect(m(380, 200)).toBe(0); // the right edge
  });
});

describe('swipeBlocked', () => {
  it('blocks charts, fields and marked areas', () => {
    document.body.innerHTML = '<div id="a"><div role="img"><span id="in"></span></div><input id="f"/><div data-noswipe><b id="n"></b></div><p id="ok"></p></div>';
    expect(swipeBlocked(document.getElementById('in'))).toBe(true);
    expect(swipeBlocked(document.getElementById('f'))).toBe(true);
    expect(swipeBlocked(document.getElementById('n'))).toBe(true);
    expect(swipeBlocked(document.getElementById('ok'))).toBe(false);
  });
});
