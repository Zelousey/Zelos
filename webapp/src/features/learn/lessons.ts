/**
 * Trading 101: short lessons for people new to trading (owner 2026-10-15). Plain words, one
 * idea each, and a "Try it" link into the app where you can do it with virtual money.
 * Done lessons are kept on users/{uid}.learnDone (your own doc).
 */
import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export type Lesson = { id: string; title: string; minutes: number; body: string[]; tip?: string; tryIt: { label: string; to: string } };

export const LESSONS: Lesson[] = [
  {
    id: 'stocks',
    title: 'What is a stock?',
    minutes: 1,
    body: [
      'A share of stock is a tiny piece of a company. Own one share of Apple and you own a sliver of Apple.',
      'The price changes all day while the market is open, as people buy and sell. More buyers push it up; more sellers push it down.',
      'In Zelos you trade real stocks at real prices, but with virtual money. Nothing you do here costs real money.',
    ],
    tip: 'The US market is open Monday to Friday, 9:30 am to 4:00 pm New York time.',
    tryIt: { label: 'Look at the market', to: '/markets' },
  },
  {
    id: 'buy-sell',
    title: 'Buying, selling and profit',
    minutes: 2,
    body: [
      'You buy shares hoping the price goes up, then sell them later. Your profit is how much the price moved times how many shares you own.',
      'Example: buy 10 shares at $50 ($500). The price rises to $55. Now they’re worth $550: you’re up $50. If it falls to $45 you’re down $50.',
      'Until you sell, that gain or loss is “unrealized”: it can still change. Selling locks it in.',
    ],
    tip: 'P&L means profit and loss. Green is up, red is down.',
    tryIt: { label: 'Make your first trade', to: '/markets/AAPL' },
  },
  {
    id: 'orders',
    title: 'Market, limit and stop orders',
    minutes: 2,
    body: [
      'Market order: buy or sell right away at the current price. Simple, and the best choice for your first trades.',
      'Limit order: only buy at your price or lower (or sell at your price or higher). It waits until the price gets there, and may never fill.',
      'Stop order: becomes a market order once the price reaches your level. Traders use it to get in when a stock breaks out, or to get out when it falls.',
      '“Good for” decides how long a waiting order lives: Today (cancelled at the close) or Until cancelled.',
    ],
    tryIt: { label: 'Open the trade ticket', to: '/markets/MSFT' },
  },
  {
    id: 'stops',
    title: 'Stop-loss and take-profit',
    minutes: 2,
    body: [
      'A stop-loss sells for you if the price falls to a level you pick, so one bad trade can’t hurt too much.',
      'A take-profit sells for you when the price rises to your target, so you keep the gain.',
      'Example: buy at $100, stop-loss at $95, take-profit at $110. You risk $5 a share to try to make $10: a 2-to-1 reward to risk.',
      'Good traders decide where they’re wrong before they buy. That’s what the stop-loss is.',
    ],
    tip: 'On the trade ticket, tick “Stop-loss + Take-profit” and drag the red and green lines on the chart.',
    tryIt: { label: 'Try it on a trade', to: '/markets/NVDA' },
  },
  {
    id: 'charts',
    title: 'Reading a chart',
    minutes: 2,
    body: [
      'Each candle shows one period (a day, or 5 minutes): where the price opened, the highest and lowest it went, and where it closed.',
      'Green candle: it closed higher than it opened. Red: it closed lower.',
      'Moving averages (the smooth lines) show the trend. Price above a rising average usually means buyers are in control.',
    ],
    tryIt: { label: 'Open a chart', to: '/markets/SPY' },
  },
  {
    id: 'battles',
    title: 'How battles with friends work',
    minutes: 1,
    body: [
      'A battle is a trading contest. Everyone starts with the same virtual cash, and whoever grows it by the biggest % wins.',
      'Pick a length (a day or a week), send the link, and start once your friends have joined. Trades fill at real prices while the market is open.',
      'Winners earn tokens and XP. It’s all virtual: no real money is ever in play.',
    ],
    tip: 'Start with a Quick battle: classic rules, nothing extra to set up.',
    tryIt: { label: 'Battle a friend', to: '/invite' },
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id) ?? null;

export const markLesson = (uid: string, id: string) => setDoc(doc(db(), 'users', uid), { learnDone: arrayUnion(id) }, { merge: true });

/** The first lesson not done yet (null when all are). */
export const nextLesson = (done: string[]) => LESSONS.find((l) => !done.includes(l.id)) ?? null;
