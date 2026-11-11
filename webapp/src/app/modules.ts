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

/** Sidebar groups (2026-11-11): the old 12-item "Play" list is split into Compete and Learn. */
export type ModuleGroup = 'main' | 'compete' | 'learn' | 'account';

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

  // owner 2026-10-20: Practice is merged into the Dashboard and options trade from the Buy/Sell
  // ticket, so neither has a menu entry; /practice/trade/:sym (the ticket) and /options/:sym (the
  // full option chain, one tap from the ticket) stay as routes
  { id: 'practice', path: 'practice', label: 'nav.practice', icon: 'practice', group: 'compete', parent: 'dashboard', nav: false, load: () => import('../features/practice/PracticeModule') },
  // the War zone (the Trade War realm, docs/WAR_DESIGN.md): hidden until all of War is built (owner
  // 2026-10-29), so a route only; the server lets only admins in for now, anyone else gets Not found
  { id: 'war', path: 'war', label: 'nav.war', icon: 'war', group: 'compete', parent: 'trade-war', nav: false, load: () => import('../features/war/WarModule') },
  { id: 'battles', path: 'battles', label: 'nav.battles', icon: 'flag', group: 'compete', parent: 'trade-war', load: () => import('../features/battles/BattlesModule') },
  { id: 'options', path: 'options', label: 'nav.options', icon: 'options', group: 'compete', parent: 'markets', nav: false, load: () => import('../features/options/OptionsModule') },
  { id: 'invite', path: 'invite', label: 'nav.invite', icon: 'invite', group: 'compete', load: () => import('../features/invites/InviteModule').then((m) => ({ default: m.InviteMakeModule })) },
  // an invite link someone shared: /i/<code>
  { id: 'invite-link', path: 'i', label: 'nav.invite', icon: 'invite', group: 'compete', parent: 'invite', nav: false, load: () => import('../features/invites/InviteModule') },
  { id: 'welcome', path: 'welcome', label: 'nav.welcome', icon: 'profile', group: 'account', nav: false, load: () => import('../features/welcome/WelcomePage') },
  { id: 'strategies', path: 'strategies', label: 'nav.strategies', icon: 'radar', group: 'compete', parent: 'trade-war', load: () => import('../features/strategies/StrategiesModule') },
  { id: 'leaderboard', path: 'leaderboard', label: 'nav.leaderboard', icon: 'trophy', group: 'compete', parent: 'trade-war', load: () => import('../features/leaderboard/LeaderboardPage') },
  { id: 'coach', path: 'coach', label: 'nav.coach', icon: 'clipboard', group: 'compete', load: () => import('../features/coach/CoachModule') },
  { id: 'communities', path: 'communities', label: 'nav.communities', icon: 'chat', group: 'compete', parent: 'social', load: () => import('../features/communities/CommunitiesModule') },
  { id: 'social', path: 'social', label: 'nav.social', icon: 'social', group: 'compete', load: () => import('../features/social/SocialModule') },
  { id: 'missions', path: 'missions', label: 'nav.missions', icon: 'missions', group: 'learn', load: () => import('../features/missions/MissionsPage') },
  { id: 'learn', path: 'learn', label: 'nav.learn', icon: 'learn', group: 'learn', load: () => import('../features/learn/LearnModule') },
  // Hall of Minds (owner 2026-10-22): history's great minds, what a trader can take from them
  { id: 'minds', path: 'minds', label: 'nav.minds', icon: 'landmark', group: 'learn', load: () => import('../features/minds/MindsModule') },
  { id: 'quiz', path: 'quiz', label: 'nav.quiz', icon: 'learn', group: 'learn', parent: 'learn', nav: false, load: () => import('../features/learn/QuizPage') },
  { id: 'training', path: 'training', label: 'nav.training', icon: 'arcade', group: 'learn', load: () => import('../features/training/TrainingModule') },
  // the old name: /arcade/... -> /training/...
  { id: 'arcade', path: 'arcade', label: 'nav.training', icon: 'arcade', group: 'learn', parent: 'training', nav: false, load: () => import('../features/training/ArcadeRedirect') },

  { id: 'profile', path: 'profile', label: 'nav.profile', icon: 'profile', group: 'account', load: () => import('../features/profile/ProfileModule') },
  // the Token Store (owner list D, 2026-10-27): tap the token chip in the top bar
  { id: 'tokens', path: 'tokens', label: 'nav.tokens', icon: 'profile', group: 'account', nav: false, load: () => import('../features/tokens/TokenStorePage') },
  { id: 'settings', path: 'settings', label: 'nav.settings', icon: 'settings', group: 'account', load: () => import('../features/settings/SettingsPage') },
  // Help & feedback (Phase 8, owner 2026-10-28: feedback is saved in the app)
  { id: 'help', path: 'help', label: 'nav.help', icon: 'help', group: 'account', load: () => import('../features/help/HelpModule') },

  // Routes without a nav entry: /charts opens the last symbol you looked at in Market.
  { id: 'charts', path: 'charts', label: 'nav.charts', icon: 'chart', group: 'main', parent: 'markets', nav: false, load: () => import('../features/charts/ChartsRedirect') },
];

export const GROUP_LABEL: Record<Exclude<ModuleGroup, 'main'>, MessageKey> = {
  compete: 'nav.group.compete',
  learn: 'nav.group.learn',
  account: 'nav.group.account',
};

export const GROUP_ORDER: ModuleGroup[] = ['main', 'compete', 'learn', 'account'];

/** The order inside the Compete group: play first, then people (anything not listed keeps its place after these). */
const NAV_ORDER = ['dashboard', 'markets', 'trade-war', 'alerts', 'news', 'battles', 'leaderboard', 'strategies', 'social', 'communities', 'coach', 'invite'];

export const DEFAULT_PATH = 'dashboard';

export function moduleById(id: string): AppModule | undefined {
  return MODULES.find((m) => m.id === id);
}

export function tabModules(): AppModule[] {
  return MODULES.filter((m) => m.tab != null).sort((a, b) => (a.tab ?? 0) - (b.tab ?? 0));
}

/** Modules listed in navigation (the sidebar, the ☰ menu). */
export function navModules(): AppModule[] {
  const at = (m: AppModule) => { const i = NAV_ORDER.indexOf(m.id); return i < 0 ? NAV_ORDER.length : i; };
  return MODULES.filter((m) => m.nav !== false).sort((a, b) => at(a) - at(b));
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
