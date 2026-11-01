/**
 * The Trade War hub (Phase 5): its sections. The Trade War tab always opens the hub page with the
 * three modes on top (owner 2026-11-01: Solo, Battle and War Zone, never a guess); War Zone shows
 * to admins only until War opens.
 */
import type { MessageKey } from '../../lib/i18n';

export type Section = 'overview' | 'solo' | 'battle' | 'war' | 'leaderboards' | 'strategies';

export const SECTIONS: { id: Section; label: MessageKey; to: string }[] = [
  { id: 'overview', label: 'hub.overview', to: '/trade-war/overview' },
  { id: 'solo', label: 'hub.solo', to: '/trade-war/solo' },
  { id: 'battle', label: 'hub.battle', to: '/battles' },
  { id: 'war', label: 'hub.war', to: '/war' }, // admins only until War opens (TradeWarNav)
  { id: 'leaderboards', label: 'hub.leaderboards', to: '/leaderboard' },
  { id: 'strategies', label: 'hub.strategies', to: '/strategies' },
];

/** The section a path belongs to, or null outside the hub. */
export function sectionFor(pathname: string): Section | null {
  const p = pathname.replace(/\/+$/, '');
  if (p === '/trade-war' || p === '/trade-war/overview') return 'overview';
  if (p === '/trade-war/solo') return 'solo';
  if (p === '/battles') return 'battle';
  if (p === '/social') return 'battle'; // squads are part of Battle (owner 2026-10-28)
  if (p === '/war') return 'war';
  if (p === '/leaderboard') return 'leaderboards';
  if (p === '/strategies') return 'strategies';
  return null;
}
