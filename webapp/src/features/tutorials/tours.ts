/**
 * Every guided tour in the app (Phase 8, F20), in one place so Help can list and replay them.
 * A step points at a [data-tour="..."] element or a CSS selector on the tour's screen (or is a
 * centred card). Tours only point; they never press anything.
 *
 * Page tours (owner 2026-11-12): one per section, opened by PageTours the first time a new player
 * visits that page, and offered now and then by a small "Need help?" note (less often for players
 * who've been around). **When a screen gets a new control, add a step for it here** (owner: "any
 * new elements that are added, we also add them to the hints"). Steps whose target isn't on the
 * screen (signed out, an empty list, a phone layout) are left out when the tour opens.
 */
import type { MessageKey } from '../../lib/i18n';
import type { TourStep } from '../../ui';

/** match: the page this tour belongs to (router path, without /app); a page tour opens there by itself. */
export type TourDef = { id: string; title: MessageKey; body: MessageKey; replay: string; steps: TourStep[]; match?: RegExp };

/** F21: the first trade, on the Solo trade ticket. The last step says Place order is still yours. */
export const FIRST_TRADE_TOUR: TourDef = {
  id: 'first-trade',
  title: 'tour.firstTrade',
  body: 'tour.firstTrade.body',
  replay: '/practice/trade/AAPL?tour=first-trade',
  steps: [
    { target: 'side', title: 'tour.ft.side', body: 'tour.ft.side.body' },
    { target: 'type', title: 'tour.ft.type', body: 'tour.ft.type.body' },
    { target: 'qty', title: 'tour.ft.qty', body: 'tour.ft.qty.body' },
    { target: 'review', title: 'tour.ft.review', body: 'tour.ft.review.body' },
  ],
};

/** One tour per section of the app. */
export const PAGE_TOURS: TourDef[] = [
  {
    id: 'page-dashboard',
    title: 'tour.pg.dashboard',
    body: 'tour.pg.dashboard.body',
    replay: '/dashboard?tour=page-dashboard',
    match: /^\/(dashboard|practice)?\/?$/,
    steps: [
    { title: 'tour.pg.dashboard.0', body: 'tour.pg.dashboard.0.body' },
    { sel: 'nav[aria-label=\'Dashboard pages\']', title: 'tour.pg.dashboard.1', body: 'tour.pg.dashboard.1.body' },
    { sel: 'h2', text: 'Solo · Your practice account', up: 'section', title: 'tour.pg.dashboard.2', body: 'tour.pg.dashboard.2.body' },
    { sel: 'h2', text: 'Solo · Positions', up: 'section', title: 'tour.pg.dashboard.3', body: 'tour.pg.dashboard.3.body' },
    { sel: 'h2', text: 'First steps', up: 'section', title: 'tour.pg.dashboard.4', body: 'tour.pg.dashboard.4.body' },
    { sel: 'h2', text: 'Battle · Your battles', up: 'section', title: 'tour.pg.dashboard.5', body: 'tour.pg.dashboard.5.body' },
    { sel: 'input[aria-label=\'Symbol search\']', title: 'tour.pg.dashboard.6', body: 'tour.pg.dashboard.6.body' },
    ],
  },
  {
    id: 'page-market',
    title: 'tour.pg.market',
    body: 'tour.pg.market.body',
    replay: '/markets?tour=page-market',
    match: /^\/markets\/?$/,
    steps: [
    { title: 'tour.pg.market.0', body: 'tour.pg.market.0.body' },
    { sel: '[role=radiogroup][aria-label=\'Chart mode\']', title: 'tour.pg.market.1', body: 'tour.pg.market.1.body' },
    { sel: 'h2', text: 'US indexes', up: 'section', title: 'tour.pg.market.2', body: 'tour.pg.market.2.body' },
    { sel: 'aside[aria-label=\'Search, watchlist and sectors\']', title: 'tour.pg.market.3', body: 'tour.pg.market.3.body' },
    { sel: 'section[aria-label=\'Charts at a glance\']', title: 'tour.pg.market.4', body: 'tour.pg.market.4.body' },
    ],
  },
  {
    id: 'page-stock',
    title: 'tour.pg.stock',
    body: 'tour.pg.stock.body',
    replay: '/markets/AAPL?tour=page-stock',
    match: /^\/markets\/[^/]+\/?$/,
    steps: [
    { title: 'tour.pg.stock.0', body: 'tour.pg.stock.0.body' },
    { sel: '[aria-label=\'Change symbol\']', title: 'tour.pg.stock.1', body: 'tour.pg.stock.1.body' },
    { sel: '[role=toolbar][aria-label=\'Chart tools\']', title: 'tour.pg.stock.2', body: 'tour.pg.stock.2.body' },
    { sel: 'canvas[role=img]', title: 'tour.pg.stock.3', body: 'tour.pg.stock.3.body' },
    { sel: '[role=tablist][aria-label=\'Range\']', up: 'div', title: 'tour.pg.stock.4', body: 'tour.pg.stock.4.body' },
    { sel: 'a[aria-label^=\'Buy \']', title: 'tour.pg.stock.5', body: 'tour.pg.stock.5.body' },
    ],
  },
  {
    id: 'page-tradewar',
    title: 'tour.pg.tradewar',
    body: 'tour.pg.tradewar.body',
    replay: '/trade-war?tour=page-tradewar',
    match: /^\/trade-war\/?$/,
    steps: [
    { title: 'tour.pg.tradewar.0', body: 'tour.pg.tradewar.0.body' },
    { sel: 'nav[aria-label=\'Trade War sections\']', title: 'tour.pg.tradewar.1', body: 'tour.pg.tradewar.1.body' },
    { sel: 'h2', text: 'How do you want to play?', up: 'section', title: 'tour.pg.tradewar.2', body: 'tour.pg.tradewar.2.body' },
    { sel: 'h2', text: 'Your open matches', up: 'section', title: 'tour.pg.tradewar.3', body: 'tour.pg.tradewar.3.body' },
    { sel: 'aside[aria-label=\'Leaderboard and strategies\']', title: 'tour.pg.tradewar.4', body: 'tour.pg.tradewar.4.body' },
    ],
  },
  {
    id: 'page-battles',
    title: 'tour.pg.battles',
    body: 'tour.pg.battles.body',
    replay: '/battles?tour=page-battles',
    match: /^\/battles\/?$/,
    steps: [
    { title: 'tour.pg.battles.0', body: 'tour.pg.battles.0.body' },
    { sel: 'h2', text: 'How do you want to battle?', up: 'section', title: 'tour.pg.battles.1', body: 'tour.pg.battles.1.body' },
    { title: 'tour.pg.battles.2', body: 'tour.pg.battles.2.body' },
    { title: 'tour.pg.battles.3', body: 'tour.pg.battles.3.body' },
    ],
  },
  {
    id: 'page-strategies',
    title: 'tour.pg.strategies',
    body: 'tour.pg.strategies.body',
    replay: '/strategies?tour=page-strategies',
    match: /^\/strategies\/?$/,
    steps: [
    { title: 'tour.pg.strategies.0', body: 'tour.pg.strategies.0.body' },
    { sel: 'div[role=img]', up: 'section', title: 'tour.pg.strategies.1', body: 'tour.pg.strategies.1.body' },
    { sel: 'button', text: 'Get tokens', title: 'tour.pg.strategies.2', body: 'tour.pg.strategies.2.body' },
    ],
  },
  {
    id: 'page-coach',
    title: 'tour.pg.coach',
    body: 'tour.pg.coach.body',
    replay: '/coach?tour=page-coach',
    match: /^\/coach\/?$/,
    steps: [
    { title: 'tour.pg.coach.0', body: 'tour.pg.coach.0.body' },
    { sel: 'h2', text: 'My coach', up: 'section', title: 'tour.pg.coach.1', body: 'tour.pg.coach.1.body' },
    { sel: 'h2', text: 'My students', up: 'section', title: 'tour.pg.coach.2', body: 'tour.pg.coach.2.body' },
    ],
  },
  {
    id: 'page-training',
    title: 'tour.pg.training',
    body: 'tour.pg.training.body',
    replay: '/training?tour=page-training',
    match: /^\/training\/?$/,
    steps: [
    { title: 'tour.pg.training.0', body: 'tour.pg.training.0.body' },
    { sel: '[role=group][aria-label=\'Train a skill\']', title: 'tour.pg.training.1', body: 'tour.pg.training.1.body' },
    { sel: 'h2', text: 'Chart Replay', up: 'article, li, section', title: 'tour.pg.training.2', body: 'tour.pg.training.2.body' },
    { sel: '[role=tab]', text: 'Leaderboards', title: 'tour.pg.training.3', body: 'tour.pg.training.3.body' },
    ],
  },
  {
    id: 'page-learn',
    title: 'tour.pg.learn',
    body: 'tour.pg.learn.body',
    replay: '/learn?tour=page-learn',
    match: /^\/learn\/?$/,
    steps: [
    { title: 'tour.pg.learn.0', body: 'tour.pg.learn.0.body' },
    { sel: 'a[href$=\'/quiz?next=/learn\']', title: 'tour.pg.learn.1', body: 'tour.pg.learn.1.body' },
    { sel: 'ul[aria-label=\'Trading 101 books\']', title: 'tour.pg.learn.2', body: 'tour.pg.learn.2.body' },
    ],
  },
  {
    id: 'page-minds',
    title: 'tour.pg.minds',
    body: 'tour.pg.minds.body',
    replay: '/minds?tour=page-minds',
    match: /^\/minds\/?$/,
    steps: [
    { title: 'tour.pg.minds.0', body: 'tour.pg.minds.0.body' },
    { sel: '[role=tablist][aria-label=\'Show\']', title: 'tour.pg.minds.1', body: 'tour.pg.minds.1.body' },
    { sel: 'ul[aria-label=\'Hall of Minds\']', title: 'tour.pg.minds.2', body: 'tour.pg.minds.2.body' },
    ],
  },
  {
    id: 'page-alerts',
    title: 'tour.pg.alerts',
    body: 'tour.pg.alerts.body',
    replay: '/alerts?tour=page-alerts',
    match: /^\/alerts\/?$/,
    steps: [
    { title: 'tour.pg.alerts.0', body: 'tour.pg.alerts.0.body' },
    { sel: '[role=tablist][aria-label=\'Alerts\']', title: 'tour.pg.alerts.1', body: 'tour.pg.alerts.1.body' },
    { sel: '[role=tablist][aria-label=\'Strategy\']', title: 'tour.pg.alerts.2', body: 'tour.pg.alerts.2.body' },
    { sel: 'h2', text: 'Track record', up: 'section', title: 'tour.pg.alerts.3', body: 'tour.pg.alerts.3.body' },
    ],
  },
  {
    id: 'page-missions',
    title: 'tour.pg.missions',
    body: 'tour.pg.missions.body',
    replay: '/missions?tour=page-missions',
    match: /^\/missions\/?$/,
    steps: [
    { title: 'tour.pg.missions.0', body: 'tour.pg.missions.0.body' },
    { sel: '[role=progressbar][aria-label=\'Progress to the next level\']', up: 'section', title: 'tour.pg.missions.1', body: 'tour.pg.missions.1.body' },
    { sel: 'h2', text: 'Daily missions', up: 'section', title: 'tour.pg.missions.2', body: 'tour.pg.missions.2.body' },
    { sel: 'h2', text: 'Achievements', up: 'section', title: 'tour.pg.missions.3', body: 'tour.pg.missions.3.body' },
    ],
  },
  {
    id: 'page-leaderboard',
    title: 'tour.pg.leaderboard',
    body: 'tour.pg.leaderboard.body',
    replay: '/leaderboard?tour=page-leaderboard',
    match: /^\/leaderboard\/?$/,
    steps: [
    { title: 'tour.pg.leaderboard.0', body: 'tour.pg.leaderboard.0.body' },
    { sel: '[role=tablist][aria-label=\'Leaderboard\']', title: 'tour.pg.leaderboard.1', body: 'tour.pg.leaderboard.1.body' },
    { sel: 'h2', text: 'Biggest accounts', up: 'section', title: 'tour.pg.leaderboard.2', body: 'tour.pg.leaderboard.2.body' },
    ],
  },
  {
    id: 'page-social',
    title: 'tour.pg.social',
    body: 'tour.pg.social.body',
    replay: '/social?tour=page-social',
    match: /^\/social\/?$/,
    steps: [
    { title: 'tour.pg.social.0', body: 'tour.pg.social.0.body' },
    { sel: '[role=tablist][aria-label=\'Squads & friends\']', title: 'tour.pg.social.1', body: 'tour.pg.social.1.body' },
    { sel: 'h2', text: 'Create a squad', up: 'section', title: 'tour.pg.social.2', body: 'tour.pg.social.2.body' },
    { sel: 'h2', text: 'Join with a room code', up: 'section', title: 'tour.pg.social.3', body: 'tour.pg.social.3.body' },
    ],
  },
  {
    id: 'page-news',
    title: 'tour.pg.news',
    body: 'tour.pg.news.body',
    replay: '/news?tour=page-news',
    match: /^\/news\/?$/,
    steps: [
    { title: 'tour.pg.news.0', body: 'tour.pg.news.0.body' },
    { sel: '[role=group][aria-label=\'Filter news\']', title: 'tour.pg.news.1', body: 'tour.pg.news.1.body' },
    { sel: 'article', title: 'tour.pg.news.2', body: 'tour.pg.news.2.body' },
    ],
  },
];

export const TOURS: TourDef[] = [FIRST_TRADE_TOUR, ...PAGE_TOURS];
