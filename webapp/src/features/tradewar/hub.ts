/**
 * The Trade War hub (Phase 5): its sections and where the Trade War tab opens.
 *
 * The tab opens, in this order (N2):
 *   A. Solo, when Solo was the last Trade War section you used in this tab (2 hours);
 *   B. the Overview, when you're in a battle that hasn't finished (lobby, draft or running);
 *   C. otherwise the mode picker (Solo / Battle; Battle then offers Duel or Squad).
 * The simulated Trade War zone, War and Chaos stay out until they're built (owner 2026-10-28).
 */
import type { MessageKey } from '../../lib/i18n';

export type Section = 'overview' | 'solo' | 'battle' | 'leaderboards' | 'strategies';

export const SECTIONS: { id: Section; label: MessageKey; to: string }[] = [
  { id: 'overview', label: 'hub.overview', to: '/trade-war/overview' },
  { id: 'solo', label: 'hub.solo', to: '/trade-war/solo' },
  { id: 'battle', label: 'hub.battle', to: '/battles' },
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
  if (p === '/leaderboard') return 'leaderboards';
  if (p === '/strategies') return 'strategies';
  return null;
}

export type Start = 'solo' | 'overview' | 'modes' | 'wait';

/** Where the Trade War tab opens. `active` is null while your battles are still loading. */
export function pickStart({ soloSession, active }: { soloSession: boolean; active: number | null }): Start {
  if (soloSession) return 'solo';
  if (active === null) return 'wait';
  return active > 0 ? 'overview' : 'modes';
}

const KEY = 'zelosTradeWarSection';
const TTL = 2 * 3600_000;

/** Remember the Trade War section you're on (this tab only). */
export function noteSection(section: Section, now = Date.now()) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ section, at: now }));
  } catch {
    /* storage unavailable: the tab just won't reopen Solo */
  }
}

/** True when Solo was the last section used in this tab, within 2 hours. */
export function inSoloSession(now = Date.now()): boolean {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null') as { section?: unknown; at?: unknown } | null;
    return !!v && v.section === 'solo' && typeof v.at === 'number' && now - v.at >= 0 && now - v.at < TTL;
  } catch {
    return false;
  }
}
