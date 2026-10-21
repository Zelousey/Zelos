/**
 * Trading 101 chapters (owner 2026-10-21): 1 The basics, then Charts & volume, Short-term
 * trading, Long-term investing and Options, each added in its own PR. A chapter is a path of
 * short lessons; a lesson is a few animated scenes (see Scene.tsx), one quick check, and a
 * "Try it" link into the app. Each lesson pays 10 XP once (xp_award "lesson"); each chapter's
 * quiz pays 50 XP once and unlocks the next chapter (learn_quiz, graded on the server, so
 * people who already know the basics can test out). Lesson ids and quiz answers are mirrored
 * in functions/learn.py; the questions are in quizzes.json.
 *
 * Lessons done are kept on users/{uid}.learnDone (your own doc); chapters passed on
 * users/{uid}.learnPassed (written only by the server).
 */
import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import { callFunction, db } from '../../lib/firebase';
import quizzes from './quizzes.json';
import type { Art } from './Scene';

export type Step = { art: Art; title: string; text: string; tip?: string };
export type Check = { q: string; opts: string[]; right: number; why: string[]; art?: Art };
export type Lesson = { id: string; title: string; sub: string; minutes: number; steps: Step[]; check: Check; tryIt: { label: string; to: string } };
export type QuizQuestion = { q: string; opts: string[]; why: string };
export type Chapter = { id: string; n: number; title: string; sub: string; lessons: Lesson[]; quiz: QuizQuestion[]; pass: number };

export const LESSON_XP = 10;
export const CHAPTER_XP = 50;

const BASICS: Lesson[] = [
  {
    id: 'stocks',
    title: 'What is a stock?',
    sub: 'Own a tiny piece of a company',
    minutes: 2,
    steps: [
      { art: { k: 'shop' }, title: 'Meet a company', text: 'Sunny Lemonade sells lemonade and makes money. Big companies like Apple or Nike work the same way, just much bigger.' },
      { art: { k: 'shares' }, title: 'Cut it into pieces', text: 'A company can be split into tiny pieces called shares. A stock is just a share of a company.' },
      { art: { k: 'shares', pick: true }, title: 'Buy one share', text: 'Buy one share for $10 and you own a small piece of Sunny Lemonade. Your portfolio is the list of everything you own.' },
      { art: { k: 'move', dir: 'up', from: 10, to: 12, label: 'SUNNY LEMONADE · 1 share' }, title: 'When it does well, the price goes up', text: 'A hot summer, lots of lemonade sold. More people want shares, so the price rises from $10 to $12. Your share is now worth $2 more.' },
      {
        art: { k: 'move', dir: 'down', from: 10, to: 8, label: 'SUNNY LEMONADE · 1 share' },
        title: 'It can go down too',
        text: 'A rainy month, fewer sales. Fewer people want shares and the price drops to $8. That’s why traders plan how much they could lose.',
        tip: 'In Zelos it’s always practice money, so this is the safe place to learn it.',
      },
    ],
    check: {
      art: { k: 'big', top: '$10 → $13', bottom: 'QUICK CHECK' },
      q: 'You buy 1 share at $10. The price goes up to $13. How much did you make?',
      opts: ['$3', '$13', '$10'],
      right: 0,
      why: ['Right. You paid $10 and it’s worth $13, so you’re up $3.', 'Not quite. $13 is what the share is worth now. You paid $10, so you made $3.', 'Not quite. $10 is what you paid. It’s worth $13 now, so you made $3.'],
    },
    tryIt: { label: 'Look at real stocks', to: '/markets' },
  },
  {
    id: 'prices',
    title: 'Why prices move',
    sub: 'Buyers, sellers and news',
    minutes: 2,
    steps: [
      { art: { k: 'scale', heavy: 'buyers' }, title: 'More buyers: the price goes up', text: 'A price is just what someone will pay right now. When more people want to buy than sell, buyers have to offer more, and the price climbs.' },
      { art: { k: 'scale', heavy: 'sellers' }, title: 'More sellers: the price goes down', text: 'When more people want to sell than buy, sellers have to accept less, and the price falls.' },
      { art: { k: 'news', head: 'Apple sells a record number of iPhones', good: true }, title: 'Good news brings buyers', text: 'Strong sales, a hit product or a big deal make people want to own the company, so more buyers show up.' },
      { art: { k: 'news', head: 'Company misses its sales goal', good: false }, title: 'Bad news brings sellers', text: 'Weak sales or a problem make owners want out, so more sellers show up and the price drops.' },
      { art: { k: 'clock' }, title: 'It moves all day', text: 'US stocks trade Monday to Friday, 9:30 am to 4:00 pm New York time. Prices change every second while the market is open.', tip: 'In Zelos, prices update every minute during the market day.' },
    ],
    check: {
      art: { k: 'news', head: 'Sales twice as big as expected', good: true },
      q: 'A company reports sales twice as big as expected. What usually happens to its stock?',
      opts: ['More people want it, so the price tends to rise', 'The price has to fall', 'Nothing, news never matters'],
      right: 0,
      why: ['Right. Good surprises bring buyers, and buyers push the price up. (Nothing is guaranteed, though.)', 'Not quite. Good news usually brings buyers, which pushes the price up.', 'Not quite. News is one of the biggest reasons prices move.'],
    },
    tryIt: { label: 'See today’s biggest movers', to: '/markets' },
  },
  {
    id: 'practice-money',
    title: 'Your $10,000 practice money',
    sub: 'Virtual money, real prices',
    minutes: 2,
    steps: [
      { art: { k: 'wallet' }, title: 'You start with $10,000', text: 'Every Zelos player gets $10,000 of virtual money. It isn’t real money: you can’t lose any, and you can’t cash it out.' },
      { art: { k: 'move', dir: 'up', from: 330, to: 334, label: 'AAPL · real price' }, title: 'Real prices', text: 'The prices are real, from the real stock market. So what you learn here works the same way out there.' },
      { art: { k: 'split', cash: 7000, stocks: 3000 }, title: 'Cash + stocks = your account', text: 'Buy $3,000 of stock and you have $7,000 of cash left. Your account value is the two added together, and it moves as the prices move.' },
      { art: { k: 'big', top: '+$420', bottom: 'TOTAL P&L', tone: 'up' }, title: 'P&L means profit and loss', text: 'Your P&L shows how much you’re up or down. Green is up, red is down. It’s at the top of your Dashboard.', tip: 'If your account ever drops below $2,500, you can reset it back to $10,000.' },
    ],
    check: {
      art: { k: 'split', cash: 7000, stocks: 3000, hide: true },
      q: 'You have $10,000 and buy $3,000 of stock. How much cash is left?',
      opts: ['$10,000', '$3,000', '$7,000'],
      right: 2,
      why: ['Not quite. Buying uses cash: $10,000 − $3,000 leaves $7,000.', 'Not quite. $3,000 is what you spent on the stock. You have $7,000 of cash left.', 'Right. $10,000 − $3,000 = $7,000 of cash, plus $3,000 of stock.'],
    },
    tryIt: { label: 'Open your account', to: '/dashboard' },
  },
  {
    id: 'charts',
    title: 'Reading a chart',
    sub: 'Green and red candles',
    minutes: 3,
    steps: [
      { art: { k: 'candle', up: true }, title: 'One candle = one period', text: 'Each candle shows one stretch of time, like a day or 15 minutes. The thick body runs from where the price opened to where it closed. The thin lines show the highest and lowest it went.' },
      { art: { k: 'candle', up: false }, title: 'Green up, red down', text: 'Green: the price closed higher than it opened. Red: it closed lower.' },
      { art: { k: 'candles' }, title: 'Many candles make a trend', text: 'Line them up and you see the story. Higher highs and higher lows mean an uptrend: buyers are in control.' },
      { art: { k: 'averages' }, title: 'The blue and yellow lines', text: 'These smooth lines are moving averages: the average price of the last 20 candles (blue) and the last 50 (yellow). Price above a rising line usually means the trend is up.', tip: 'Turn them on or off with Indicators under any chart.' },
      { art: { k: 'volume' }, title: 'Volume: how much traded', text: 'The bars under the candles show how many shares changed hands. A big move on big volume means lots of people agree with it.' },
    ],
    check: {
      art: { k: 'candle', up: false, plain: true },
      q: 'A red candle means…',
      opts: ['The company is losing money', 'The price closed higher than it opened', 'The price closed lower than it opened'],
      right: 2,
      why: ['Not quite. A candle is only about the price in that period, not the company’s profits.', 'Not quite. That’s a green candle. Red means it closed lower.', 'Right. Red means it ended that period lower than it started.'],
    },
    tryIt: { label: 'Open a chart', to: '/markets/SPY' },
  },
  {
    id: 'buy-sell',
    title: 'Buying and selling',
    sub: 'Your first trade, step by step',
    minutes: 3,
    steps: [
      { art: { k: 'ticket' }, title: 'The trade ticket', text: 'Tap Buy on any chart. Pick how many shares, check the cost, and review. A market order buys right away at the next price.' },
      { art: { k: 'big', top: '10 × $5 = $50', bottom: 'YOUR PROFIT', tone: 'up' }, title: 'Profit = move × shares', text: 'Buy 10 shares at $50. The price rises to $55: each share made $5, so you’re up 10 × $5 = $50.' },
      { art: { k: 'big', top: 'Unrealized → Realized', bottom: 'SELLING LOCKS IT IN' }, title: 'It’s only locked in when you sell', text: 'Until you sell, your gain or loss can still change. That’s called unrealized. Selling makes it realized: it’s yours.' },
      { art: { k: 'big', top: 'Limit $48', bottom: 'WAITS FOR YOUR PRICE' }, title: 'Orders that wait', text: 'A limit order only buys at your price or lower, so it may wait. A stop order kicks in once the price reaches your level. Start with market orders; try the others later.' },
    ],
    check: {
      art: { k: 'big', top: '$50 → $45', bottom: '10 SHARES' },
      q: 'You buy 10 shares at $50 and the price falls to $45. Where are you?',
      opts: ['Down $50', 'Down $5', 'Up $45'],
      right: 0,
      why: ['Right. Each share is down $5, and you have 10: 10 × $5 = $50 down.', 'Not quite. $5 is the drop for one share. You have 10, so you’re down $50.', 'Not quite. The price fell, so you’re down: 10 × $5 = $50.'],
    },
    tryIt: { label: 'Make your first trade', to: '/markets/AAPL' },
  },
  {
    id: 'stops',
    title: 'Stop-loss: your safety net',
    sub: 'Limit how much you can lose',
    minutes: 2,
    steps: [
      { art: { k: 'stop' }, title: 'A stop-loss sells for you', text: 'Pick a price below where you bought. If the stock falls to it, Zelos sells for you, even if the app is closed.' },
      { art: { k: 'big', top: '$100 → stop $95', bottom: 'RISK: $5 A SHARE', tone: 'down' }, title: 'Decide where you’re wrong', text: 'Buy at $100 with a stop at $95 and the most you plan to lose is $5 a share. Good traders pick this before they buy.' },
      { art: { k: 'big', top: '−$5, not −$30', bottom: 'A SMALL LOSS BEATS A BIG ONE', tone: 'down' }, title: 'Small losses keep you in the game', text: 'Everyone has losing trades. A stop-loss keeps a bad one small, so one mistake can’t wipe out your account.', tip: 'Fast drops can fill a little below your stop. It still saves you from much worse.' },
    ],
    check: {
      art: { k: 'stop', plain: true },
      q: 'You buy at $100 with a stop-loss at $95. The price drops to $90. What happened?',
      opts: ['Nothing, you still own it', 'Your shares were sold around $95', 'Zelos bought more shares'],
      right: 1,
      why: ['Not quite. The price went through your stop at $95, so it sold.', 'Right. When it hit $95 your stop sold the shares, so you didn’t ride it down to $90.', 'Not quite. A stop-loss sells; it never buys more.'],
    },
    tryIt: { label: 'Try it on a trade', to: '/markets/NVDA' },
  },
  {
    id: 'take-profit',
    title: 'Take-profit',
    sub: 'Lock in a win automatically',
    minutes: 2,
    steps: [
      { art: { k: 'target' }, title: 'A take-profit sells at your target', text: 'Pick a price above where you bought. When the stock rises to it, Zelos sells and the gain is yours.' },
      { art: { k: 'rr' }, title: 'Risk $5 to make $10', text: 'Buy at $100, stop at $95, target at $110. You risk $5 to try to make $10. That’s a 2-to-1 reward to risk.' },
      { art: { k: 'big', top: 'Stop + Target', bottom: 'ONE TICK ON THE TICKET' }, title: 'Use both together', text: 'On the trade ticket, tick “Stop-loss + Take-profit” and drag the red and green lines on the chart. Whichever is hit first closes the trade.' },
    ],
    check: {
      art: { k: 'rr', plain: true },
      q: 'You risk $5 a share to try to make $10 a share. What is your reward to risk?',
      opts: ['1 to 2', '2 to 1', '10 to 1'],
      right: 1,
      why: ['Not quite. The reward ($10) is twice the risk ($5): 2 to 1.', 'Right. $10 of reward for $5 of risk is 2 to 1.', 'Not quite. $10 ÷ $5 = 2, so it’s 2 to 1.'],
    },
    tryIt: { label: 'Set a stop and a target', to: '/markets/MSFT' },
  },
  {
    id: 'battles',
    title: 'Battles with friends',
    sub: 'Same money, best trader wins',
    minutes: 2,
    steps: [
      { art: { k: 'race' }, title: 'A trading race', text: 'Everyone in a battle starts with the same virtual cash. Whoever grows it by the biggest % wins.' },
      { art: { k: 'big', top: '1 day · 1 week', bottom: 'PICK A LENGTH, SEND THE LINK' }, title: 'Start one in seconds', text: 'Pick how long it runs, send the link to friends, and start when they join. Trades fill at real prices while the market is open.' },
      { art: { k: 'big', top: '+ tokens + XP', bottom: 'WINNERS EARN', tone: 'up' }, title: 'Winners earn tokens and XP', text: 'Top finishers earn tokens and XP. It’s all virtual: no real money is ever in play.', tip: 'Start with a Quick battle: classic rules, nothing extra to set up.' },
    ],
    check: {
      art: { k: 'race', plain: true },
      q: 'Who wins a battle?',
      opts: ['Whoever makes the most trades', 'Whoever grows their account by the biggest %', 'Whoever starts first'],
      right: 1,
      why: ['Not quite. The number of trades doesn’t matter, only the % gain.', 'Right. Same starting cash for everyone; the biggest % gain wins.', 'Not quite. Everyone starts together; the biggest % gain wins.'],
    },
    tryIt: { label: 'Battle a friend', to: '/invite' },
  },
];

export const CHAPTERS: Chapter[] = [
  { id: 'basics', n: 1, title: 'The basics', sub: 'Stocks, prices, charts, your first trade and staying safe.', lessons: BASICS, quiz: quizzes.basics, pass: 4 },
];

export const chapterById = (id: string) => CHAPTERS.find((c) => c.id === id) ?? null;
export const ALL_LESSONS = CHAPTERS.flatMap((c) => c.lessons);
/** Old one-page lessons (before chapters) → their new place. */
export const OLD_LESSON: Record<string, string> = { stocks: 'basics/stocks', 'buy-sell': 'basics/buy-sell', orders: 'basics/buy-sell', stops: 'basics/stops', charts: 'basics/charts', battles: 'basics/battles' };

export type ChapterState = { unlocked: boolean; passed: boolean; done: number; total: number; next: Lesson | null; complete: boolean };

/** Where you are in a chapter: open once the chapter before it is passed (chapter 1 always);
 *  lessons open one after another, all of them once the chapter's quiz is passed. */
export function chapterState(c: Chapter, learnDone: string[], learnPassed: Record<string, number>): ChapterState {
  const i = CHAPTERS.indexOf(c);
  const prev = i > 0 ? CHAPTERS[i - 1]! : null;
  const passed = !!learnPassed[c.id];
  const unlocked = !prev || !!learnPassed[prev.id] || passed;
  const done = c.lessons.filter((l) => learnDone.includes(l.id)).length;
  return { unlocked, passed, done, total: c.lessons.length, next: c.lessons.find((l) => !learnDone.includes(l.id)) ?? null, complete: done === c.lessons.length };
}

/** A lesson opens when the one before it is done (or the chapter's quiz is passed). */
export function lessonOpen(c: Chapter, idx: number, learnDone: string[], passed: boolean): boolean {
  return passed || idx === 0 || learnDone.includes(c.lessons[idx - 1]!.id);
}

export const markLesson = (uid: string, id: string) => setDoc(doc(db(), 'users', uid), { learnDone: arrayUnion(id) }, { merge: true });
export const lessonXp = (id: string) => callFunction<{ type: string; refId: string }, { awarded?: boolean }>('xp_award', { type: 'lesson', refId: id });

export type QuizResult = { right: number; total: number; passed: boolean; need: number; results: { ok: boolean; answer: number }[]; xp: number };
export const gradeQuiz = (chapter: string, answers: number[]) => callFunction<{ chapter: string; answers: number[] }, QuizResult>('learn_quiz', { chapter, answers });
