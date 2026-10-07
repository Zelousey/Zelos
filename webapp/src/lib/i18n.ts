/**
 * User-facing text.
 *
 * Not a full translation system yet: one English catalogue and a tiny `t()` with
 * {placeholders}. The point is that screens never hard-code sentences, so adding a
 * language later means adding a catalogue, not touching every component.
 */
const en = {
  'app.name': 'Zelos',
  'nav.dashboard': 'Dashboard',
  'nav.markets': 'Markets',
  'nav.charts': 'Charts',
  'nav.practice': 'Practice',
  'nav.real': 'Real Trading',
  'nav.tradeWar': 'Trade War',
  'nav.options': 'Options',
  'nav.crypto': 'Crypto',
  'nav.alerts': 'Alerts',
  'nav.social': 'Social',
  'nav.profile': 'Profile',
  'nav.missions': 'Missions & XP',
  'nav.arcade': 'Arcade',
  'nav.settings': 'Settings',
  'nav.more': 'More',
  'nav.group.trade': 'Trade',
  'nav.group.signals': 'Signals',
  'nav.group.compete': 'Compete & learn',
  'nav.group.account': 'Account',
  'nav.collapse': 'Collapse sidebar',
  'nav.expand': 'Expand sidebar',
  'nav.main': 'Main',

  'auth.signIn': 'Sign in',
  'auth.signOut': 'Sign out',
  'auth.signInWithGoogle': 'Continue with Google',
  'auth.guest': 'Guest',
  'auth.signInFailed': "Couldn't sign in. Try again.",

  'notifications.title': 'Notifications',
  'notifications.open': 'Open notifications',
  'notifications.unread': '{count} unread',
  'notifications.empty': "You're all caught up.",
  'notifications.signedOut': 'Sign in to see challenges, battle updates and fills.',

  'state.loading': 'Loading…',
  'state.error.title': 'Something went wrong',
  'state.error.body': "This part of Zelos couldn't load. Your account and data are safe.",
  'state.retry': 'Try again',
  'state.offline': "You're offline. Showing the last data we had.",

  'module.classic.title': '{name} is moving into the app',
  'module.classic.body': "This part of Zelos still runs on the classic site while we rebuild it here. Everything you have there is unchanged.",
  'module.classic.open': 'Open {name}',
  'module.planned.title': '{name} is coming soon',
  'module.planned.body': "We're building this part of Zelos next.",

  'notFound.title': 'Page not found',
  'notFound.body': "That page doesn't exist in the app.",
  'notFound.home': 'Go to Dashboard',

  'settings.theme': 'Theme',
  'settings.theme.black': 'Black',
  'settings.theme.blue': 'Blue',
  'settings.theme.white': 'White',
  'settings.theme.help': 'Applies to the app and the classic site on this device.',
  'settings.account': 'Account',
  'settings.manageAccount': 'Manage account, notifications and deletion',

  'common.close': 'Close',
  'common.back': 'Back',
  'common.menu': 'Menu',
} as const;

export type MessageKey = keyof typeof en;
type Vars = Record<string, string | number>;

const catalogues: Record<string, Record<MessageKey, string>> = { en };
let current = 'en';

export function setLanguage(lang: string): void {
  if (catalogues[lang]) current = lang;
}

export function t(key: MessageKey, vars?: Vars): string {
  const raw = catalogues[current]?.[key] ?? en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}
