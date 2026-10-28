/**
 * The Dashboard's 4 pages (Phase 6, F14): Trading · Profile · Market · Strategies.
 * The page lives in the address (?p=market), so a reload or a shared link keeps it.
 *
 * Phone swipe: a quick sideways finger move changes page, but never when it starts
 * - near the screen edge (the iPhone back gesture lives there),
 * - on a chart, a form field or a row that scrolls sideways (those need the swipe),
 * - or when the move is mostly up or down (that's scrolling).
 */
import type { MessageKey } from '../../lib/i18n';

export const PAGES = ['trading', 'profile', 'market', 'strategies'] as const;
export type DashPage = (typeof PAGES)[number];
export const PAGE_LABEL: Record<DashPage, MessageKey> = {
  trading: 'dash.page.trading',
  profile: 'dash.page.profile',
  market: 'dash.page.market',
  strategies: 'dash.page.strategies',
};

export const pageFrom = (p: string | null): DashPage => PAGES.find((x) => x === p) ?? 'trading';

/** The page one step left (-1) or right (+1), or null at either end. */
export function stepPage(page: DashPage, by: -1 | 1): DashPage | null {
  return PAGES[PAGES.indexOf(page) + by] ?? null;
}

export const EDGE = 24; // px from either side where the OS back/forward gesture starts
const MIN_DX = 60;
const MAX_MS = 700;

/** Which way a finished touch move turns the page: +1 next, -1 previous, 0 none. */
export function swipeDirection(m: { x0: number; y0: number; x1: number; y1: number; ms: number; width: number }): -1 | 0 | 1 {
  const dx = m.x1 - m.x0;
  const dy = m.y1 - m.y0;
  if (m.x0 < EDGE || m.x0 > m.width - EDGE) return 0;
  if (m.ms > MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dx) < 2 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1; // finger moves left → the next page comes in from the right
}

/** True when a touch starting on this element belongs to something that needs sideways moves. */
export function swipeBlocked(target: Element | null): boolean {
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el.matches('input, textarea, select, canvas, [role="slider"], [data-noswipe], [role="img"]')) return true;
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const o = getComputedStyle(el).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
  }
  return false;
}
