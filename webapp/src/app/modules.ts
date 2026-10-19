/**
 * The module registry: every area of Zelos Trade War, in one table.
 *
 * Navigation (desktop sidebar, phone tab bar, the ☰ menu) and the router are generated from
 * this list, so adding a module means adding one entry here.
 *
 * Every module is built in the app: nothing unfinished or handed off to the website is listed
 * (owner 2026-10-09; App Store guideline 2.1).
 *
 * Information architecture (owner, 2026-10-07):
 *   phone tab bar   Dashboard | Market | Trade War | Alerts | News
 *   top bar         Profile | Notifications (bell) | ☰ menu (everything else)
 *   Practice (the solo $10,000 virtual account) lives inside Trade War (`parent`).
 *   Alerts = Zelos trade-signal alerts; invites, challenges and friend requests go to the bell.
 *   The app is a simulated trading competition: there is no real-trading module in the app.
 *   (The classic site keeps its Real Trade Journal page; the app doesn't link to it.)
 */
import type { ComponentType } from 'react';
import type { MessageKey } from '../lib/i18n';
import type { IconName } from '../ui/Icon';

export type ModuleGroup = 'main' | 'play' | 'signals' | 'account';

export type AppModule = {
  id: string;
  /** route path relative to /app/ (no leading slash) */
  path: string;
  label: MessageKey;
  icon: IconName;
  group: ModuleGroup;
  /** position in the phone tab bar (1-5); modules without one go in the ☰ menu */
  tab?: number;
  /** the tab/nav entry this screen belongs under (it highlights that entry) */
  parent?: string;
  /** false: a route only (reached from other screens), never listed in navigation */
  nav?: false;
  /** lazy screen component */
  load: () => Promise<{ default: ComponentType }>;
};

export const MODULES: AppModule[] = [
  { id: 'dashboard', path: 'dashboard', label: 'nav.dashboard', icon: 'dashboard', group: 'main', tab: 1, load: () => import('../features/dashboard/DashboardPage') },
  { id: 'markets', path: 'markets', label: 'nav.market', icon: 'markets', group: 'main', tab: 2, load: () => import('../features/markets/MarketsModule') },
  { id: 'trade-war', path: 'trade-war', label: 'nav.tradeWar', icon: 'war', group: 'main', tab: 3, load: () => import('../features/tradewar/TradeWarPage') },
  { id: 'alerts', path: 'alerts', label: 'nav.alerts', icon: 'signal', group: 'main', tab: 4, load: () => import('../features/alerts/AlertsModule') },
  { id: 'news', path: 'news', label: 'nav.news', icon: 'news', group: 'main', tab: 5, load: () => import('../features/news/NewsModule') },

  { id: 'practice', path: 'practice', label: 'nav.practice', icon: 'practice', group: 'play', parent: 'trade-war', load: () => import('../features/practice/PracticeModule') },
  { id: 'battles', path: 'battles', label: 'nav.battles', icon: 'war', group: 'play', parent: 'trade-war', load: () => import('../features/battles/BattlesModule') },
  { id: 'options', path: 'options', label: 'nav.options', icon: 'options', group: 'play', parent: 'trade-war', load: () => import('../features/options/OptionsModule') },
  { id: 'invite', path: 'invite', label: 'nav.invite', icon: 'invite', group: 'play', load: () => import('../features/invites/InviteModule').then((m) => ({ default: m.InviteMakeModule })) },
  // an invite link someone shared: /i/<code>
  { id: 'invite-link', path: 'i', label: 'nav.invite', icon: 'invite', group: 'play', parent: 'invite', nav: false, load: () => import('../features/invites/InviteModule') },
  { id: 'welcome', path: 'welcome', label: 'nav.welcome', icon: 'profile', group: 'account', nav: false, load: () => import('../features/welcome/WelcomePage') },
  { id: 'strategies', path: 'strategies', label: 'nav.strategies', icon: 'signal', group: 'play', parent: 'trade-war', load: () => import('../features/strategies/StrategiesModule') },
  { id: 'leaderboard', path: 'leaderboard', label: 'nav.leaderboard', icon: 'markets', group: 'play', parent: 'trade-war', load: () => import('../features/leaderboard/LeaderboardPage') },
  { id: 'coach', path: 'coach', label: 'nav.coach', icon: 'missions', group: 'play', load: () => import('../features/coach/CoachModule') },
  { id: 'communities', path: 'communities', label: 'nav.communities', icon: 'social', group: 'play', parent: 'social', load: () => import('../features/communities/CommunitiesModule') },
  { id: 'social', path: 'social', label: 'nav.social', icon: 'social', group: 'play', load: () => import('../features/social/SocialModule') },
  { id: 'missions', path: 'missions', label: 'nav.missions', icon: 'missions', group: 'play', load: () => import('../features/missions/MissionsPage') },
  { id: 'learn', path: 'learn', label: 'nav.learn', icon: 'learn', group: 'play', load: () => import('../features/learn/LearnModule') },
  { id: 'quiz', path: 'quiz', label: 'nav.quiz', icon: 'learn', group: 'play', parent: 'learn', nav: false, load: () => import('../features/learn/QuizPage') },
  { id: 'training', path: 'training', label: 'nav.training', icon: 'arcade', group: 'play', load: () => import('../features/training/TrainingModule') },
  // the old name: /arcade/... -> /training/...
  { id: 'arcade', path: 'arcade', label: 'nav.training', icon: 'arcade', group: 'play', parent: 'training', nav: false, load: () => import('../features/training/ArcadeRedirect') },

  { id: 'profile', path: 'profile', label: 'nav.profile', icon: 'profile', group: 'account', load: () => import('../features/profile/ProfileModule') },
  { id: 'settings', path: 'settings', label: 'nav.settings', icon: 'settings', group: 'account', load: () => import('../features/settings/SettingsPage') },

  // Routes without a nav entry: /charts opens the last symbol you looked at in Market.
  { id: 'charts', path: 'charts', label: 'nav.charts', icon: 'chart', group: 'main', parent: 'markets', nav: false, load: () => import('../features/charts/ChartsRedirect') },
];

export const GROUP_LABEL: Record<Exclude<ModuleGroup, 'main'>, MessageKey> = {
  play: 'nav.group.play',
  signals: 'nav.group.signals',
  account: 'nav.group.account',
};

export const GROUP_ORDER: ModuleGroup[] = ['main', 'play', 'signals', 'account'];

export const DEFAULT_PATH = 'dashboard';

export function moduleById(id: string): AppModule | undefined {
  return MODULES.find((m) => m.id === id);
}

export function tabModules(): AppModule[] {
  return MODULES.filter((m) => m.tab != null).sort((a, b) => (a.tab ?? 0) - (b.tab ?? 0));
}

/** Modules listed in navigation (the sidebar, the ☰ menu). */
export function navModules(): AppModule[] {
  return MODULES.filter((m) => m.nav !== false);
}

/** Everything in the ☰ menu: listed modules that aren't tabs. */
export function menuModules(): AppModule[] {
  return navModules().filter((m) => m.tab == null);
}

/** The nav entry to highlight for a module: itself, or the entry it lives under. */
export function navOwner(m: AppModule | undefined): string | undefined {
  return m?.parent ?? m?.id;
}

/** The module a URL path belongs to (first path segment after /app/). */
export function moduleForPath(pathname: string): AppModule | undefined {
  const seg = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  return MODULES.find((m) => m.path === seg);
}
