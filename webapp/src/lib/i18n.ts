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

  'markets.search': 'Search stocks',
  'markets.searchPlaceholder': 'Symbol or company',
  'markets.all': 'All',
  'markets.empty': 'No stocks match “{q}”.',
  'markets.scope': 'The Zelos stock list ({count} stocks and ETFs). Crypto is paused.',
  'markets.unknown.title': 'No data for {sym}',
  'markets.unknown.body': "{sym} isn't in the Zelos stock list, so there are no prices or charts for it yet.",
  'markets.backToMarkets': 'Back to Markets',
  'chart.timeframe': 'Timeframe',
  'chart.range': 'Range',
  'chart.style': 'Chart style',
  'chart.line': 'Line',
  'chart.candles': 'Candles',
  'chart.label': '{sym} {tf} price chart',
  'chart.noIntraday': 'Intraday bars build up during market hours (9:30 am to 4:00 pm ET) and keep the last 5 sessions. Daily and weekly charts are available any time.',
  'chart.noData': 'No price history for {sym} yet.',
  'chart.table.show': 'Show data table',
  'chart.table.hide': 'Hide data table',
  'chart.table.caption': 'Last {count} bars, {tf}',
  'stats.title': 'Today',
  'stats.open': 'Open',
  'stats.high': 'High',
  'stats.low': 'Low',
  'stats.prevClose': 'Prev close',
  'stats.volume': 'Volume',
  'stats.updated': 'Updated',
  'trade.practice': 'Practice trade',
  'trade.practiceHint': 'Virtual $10,000 account. No real money.',
  'col.date': 'Date',
  'col.open': 'Open',
  'col.high': 'High',
  'col.low': 'Low',
  'col.close': 'Close',
  'col.volume': 'Volume',

  'dash.indexes': 'Market indexes',
  'dash.indexesNote': 'Shown through the ETFs that track them.',
  'dash.movers': 'Top movers',
  'dash.movers.gainers': 'Gainers',
  'dash.movers.losers': 'Losers',
  'dash.movers.actives': 'Most active',
  'dash.movers.scope': 'Among the Zelos stock list.',
  'dash.movers.empty': 'Movers show up after the first prices of the session.',
  'dash.sectors': 'Sectors today',
  'dash.sectors.empty': 'Sector moves show up during the session.',
  'dash.watchlist': 'Watchlist',
  'dash.watchlist.signedOut': 'Sign in to see your watchlist here.',
  'dash.watchlist.empty': 'Your watchlist is empty. Add stocks from the classic dashboard for now.',
  'dash.practice': 'Practice account',
  'dash.practice.body': 'Trade the Zelos stock list with a virtual $10,000. No real money.',
  'dash.practice.open': 'Open Practice',
  'dash.allMarkets': 'All markets',

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
