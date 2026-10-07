/**
 * The module registry: every area of Zelos, in one table.
 *
 * Navigation (desktop sidebar, phone tab bar, the "More" sheet) and the router are both
 * generated from this list, so adding a module means adding one entry here.
 *
 * status
 *   ready    built in the app (has `load`)
 *   classic  still lives on the classic site; the app shows a hand-off screen to `classicPath`
 *   planned  not built anywhere yet
 * As each module moves into the app, flip it to `ready` and give it a `load`.
 *
 * Product separations (PROJECT_STATE.md §9): Practice (solo virtual account), Real Trading
 * (your own broker's trades, logged) and Trade War (competitive matches) are separate
 * modules and never share balances.
 */
import type { ComponentType } from 'react';
import type { MessageKey } from '../lib/i18n';
import type { IconName } from '../ui/Icon';

export type ModuleGroup = 'main' | 'trade' | 'signals' | 'compete' | 'account';
export type ModuleStatus = 'ready' | 'classic' | 'planned';

export type AppModule = {
  id: string;
  /** route path relative to /app/ (no leading slash) */
  path: string;
  label: MessageKey;
  icon: IconName;
  group: ModuleGroup;
  status: ModuleStatus;
  /** classic-site page (relative to the site root) while status is 'classic' */
  classicPath?: string;
  /** position in the phone tab bar (1-4); modules without one go in "More" */
  tab?: number;
  /** lazy screen component, required when status is 'ready' */
  load?: () => Promise<{ default: ComponentType }>;
};

export const MODULES: AppModule[] = [
  { id: 'dashboard', path: 'dashboard', label: 'nav.dashboard', icon: 'dashboard', group: 'main', status: 'ready', classicPath: 'dashboard.html', tab: 1, load: () => import('../features/dashboard/DashboardPage') },
  { id: 'markets', path: 'markets', label: 'nav.markets', icon: 'markets', group: 'main', status: 'ready', tab: 2, load: () => import('../features/markets/MarketsModule') },
  { id: 'charts', path: 'charts', label: 'nav.charts', icon: 'chart', group: 'main', status: 'ready', load: () => import('../features/charts/ChartsRedirect') },

  { id: 'practice', path: 'practice', label: 'nav.practice', icon: 'practice', group: 'trade', status: 'ready', tab: 3, load: () => import('../features/practice/PracticeModule') },
  { id: 'real', path: 'real', label: 'nav.real', icon: 'real', group: 'trade', status: 'classic', classicPath: 'real/index.html' },
  { id: 'trade-war', path: 'trade-war', label: 'nav.tradeWar', icon: 'war', group: 'trade', status: 'classic', classicPath: 'practice/war.html' },

  { id: 'alerts', path: 'alerts', label: 'nav.alerts', icon: 'alerts', group: 'signals', status: 'classic', classicPath: 'alert-history.html', tab: 4 },
  { id: 'options', path: 'options', label: 'nav.options', icon: 'options', group: 'signals', status: 'classic', classicPath: 'options-scanner.html' },
  { id: 'crypto', path: 'crypto', label: 'nav.crypto', icon: 'crypto', group: 'signals', status: 'planned' },

  { id: 'social', path: 'social', label: 'nav.social', icon: 'social', group: 'compete', status: 'classic', classicPath: 'practice/squads.html' },
  { id: 'missions', path: 'missions', label: 'nav.missions', icon: 'missions', group: 'compete', status: 'classic', classicPath: 'practice/index.html?tab=progress' },
  { id: 'arcade', path: 'arcade', label: 'nav.arcade', icon: 'arcade', group: 'compete', status: 'classic', classicPath: 'arcade.html' },

  { id: 'profile', path: 'profile', label: 'nav.profile', icon: 'profile', group: 'account', status: 'classic', classicPath: 'practice/profile.html' },
  { id: 'settings', path: 'settings', label: 'nav.settings', icon: 'settings', group: 'account', status: 'ready', load: () => import('../features/settings/SettingsPage') },
];

export const GROUP_LABEL: Record<Exclude<ModuleGroup, 'main'>, MessageKey> = {
  trade: 'nav.group.trade',
  signals: 'nav.group.signals',
  compete: 'nav.group.compete',
  account: 'nav.group.account',
};

export const GROUP_ORDER: ModuleGroup[] = ['main', 'trade', 'signals', 'compete', 'account'];

export const DEFAULT_PATH = 'dashboard';

export function moduleById(id: string): AppModule | undefined {
  return MODULES.find((m) => m.id === id);
}

export function tabModules(): AppModule[] {
  return MODULES.filter((m) => m.tab != null).sort((a, b) => (a.tab ?? 0) - (b.tab ?? 0));
}

export function moreModules(): AppModule[] {
  return MODULES.filter((m) => m.tab == null);
}

/** The module a URL path belongs to (first path segment after /app/). */
export function moduleForPath(pathname: string): AppModule | undefined {
  const seg = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  return MODULES.find((m) => m.path === seg);
}
