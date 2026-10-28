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
    sub: 'Buyers, sellers, news and market hours',
    minutes: 3,
    steps: [
      { art: { k: 'scale', heavy: 'buyers' }, title: 'More buyers: the price goes up', text: 'A price is just what someone will pay right now. When more people want to buy than sell, buyers have to offer more, and the price climbs.' },
      { art: { k: 'scale', heavy: 'sellers' }, title: 'More sellers: the price goes down', text: 'When more people want to sell than buy, sellers have to accept less, and the price falls.' },
      { art: { k: 'news', head: 'Apple sells a record number of iPhones', good: true }, title: 'Good news brings buyers', text: 'Strong sales, a hit product or a big deal make people want to own the company, so more buyers show up.' },
      { art: { k: 'news', head: 'Company misses its sales goal', good: false }, title: 'Bad news brings sellers', text: 'Weak sales or a problem make owners want out, so more sellers show up and the price drops.' },
      { art: { k: 'clock' }, title: 'It moves all day', text: 'US stocks trade Monday to Friday, 9:30 am to 4:00 pm New York time. Prices change every second while the market is open.', tip: 'In Zelos, prices update every minute during the market day.' },
      { art: { k: 'session' }, title: 'Before and after the bell', text: 'Some trading also happens before the open (pre-market, from 4:00 am) and after the close (after-hours, until 8:00 pm). Fewer people trade then, so prices can jump more and buying or selling can cost you more.', tip: 'In Zelos, orders fill during regular hours: 9:30 am to 4:00 pm New York time.' },
      { art: { k: 'world' }, title: 'The world takes turns', text: 'Markets open around the globe one after another: Tokyo first (evening in New York), then London (early morning New York time), then New York. What happens overnight often sets the mood for the US open, and big news after the close can make a stock open far from where it closed. That jump is called a gap.' },
      { art: { k: 'big', top: 'ET', bottom: 'NEW YORK TIME' }, title: 'Mind the clock', text: 'US market times are always New York time (ET). If you live somewhere else, convert them to your own time. Clocks change for daylight saving in March and November, and Europe changes on different dates, so for a few weeks a year London and New York are 4 hours apart instead of 5.', tip: 'Zelos shows times in New York time, like "prices as of 4:10 PM EDT".' },
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

const CHARTS: Lesson[] = [
  {
    id: 'timeframes',
    title: 'Timeframes',
    sub: 'Zoom in, zoom out',
    minutes: 2,
    steps: [
      { art: { k: 'zoom', tf: '15m' }, title: 'Each candle is a slice of time', text: 'On a 15-minute chart, each candle is 15 minutes of trading. On a daily chart, each candle is a whole day.' },
      { art: { k: 'zoom', tf: 'D' }, title: 'Same stock, different story', text: 'Zoomed in, a stock can look like it’s crashing. Zoom out to daily and that drop may be a tiny dip in a strong uptrend.' },
      { art: { k: 'zoom', tf: 'W' }, title: 'Start wide, then zoom in', text: 'Look at the daily or weekly chart first to see the big picture. Then use a shorter timeframe to pick your moment.', tip: 'Switch timeframes with the buttons above any chart.' },
    ],
    check: {
      art: { k: 'zoom', tf: '1H' },
      q: 'On a 1-hour chart, each candle shows…',
      opts: ['One hour of trading', 'One day of trading', 'One trade'],
      right: 0,
      why: ['Right. The timeframe is how long each candle lasts: here, one hour.', 'Not quite. That’s a daily chart. On a 1-hour chart each candle is one hour.', 'Not quite. One candle sums up every trade in its hour.'],
    },
    tryIt: { label: 'Try different timeframes', to: '/markets/SPY' },
  },
  {
    id: 'trends',
    title: 'Trends',
    sub: 'Up, down or sideways',
    minutes: 2,
    steps: [
      { art: { k: 'trend', dir: 'up' }, title: 'Uptrend', text: 'Each high is higher than the last, and each low is higher too. Buyers are in control.' },
      { art: { k: 'trend', dir: 'down' }, title: 'Downtrend', text: 'Lower highs and lower lows. Sellers are in control. Buying here is swimming against the current.' },
      { art: { k: 'trend', dir: 'side' }, title: 'Sideways', text: 'The price bounces between the same high and low. Nobody is winning yet. Many traders wait for it to break out.', tip: '“The trend is your friend.” Trading with it is usually easier than fighting it.' },
    ],
    check: {
      art: { k: 'trend', dir: 'down', plain: true },
      q: 'Lower highs and lower lows mean…',
      opts: ['An uptrend', 'A downtrend', 'Nothing at all'],
      right: 1,
      why: ['Not quite. An uptrend makes higher highs and higher lows.', 'Right. Each bounce tops out lower and each dip goes lower: sellers are winning.', 'Not quite. It’s one of the clearest signs on a chart: a downtrend.'],
    },
    tryIt: { label: 'Spot the trend', to: '/markets/AAPL' },
  },
  {
    id: 'support-resistance',
    title: 'Support & resistance',
    sub: 'Floors and ceilings',
    minutes: 3,
    steps: [
      { art: { k: 'levels', mode: 'bounce' }, title: 'Floors and ceilings', text: 'Support is a price where the stock keeps bouncing up, like a floor. Resistance is where it keeps getting stuck, like a ceiling.' },
      { art: { k: 'levels', mode: 'break' }, title: 'Breakouts', text: 'When the price pushes through a ceiling, buyers have won that fight. The old ceiling often turns into the new floor.' },
      { art: { k: 'big', top: 'Stop below support', bottom: 'A SMART PLACE FOR A STOP' }, title: 'Use them for your plan', text: 'Buying near support gives you a clear place for a stop-loss: just below the floor. If the floor breaks, you were wrong, and you’re out with a small loss.' },
    ],
    check: {
      art: { k: 'levels', mode: 'bounce', plain: true },
      q: 'A price where a stock keeps bouncing back up is called…',
      opts: ['Resistance', 'Volume', 'Support'],
      right: 2,
      why: ['Not quite. Resistance is the ceiling it keeps getting stuck under.', 'Not quite. Volume is how many shares traded.', 'Right. Support is the floor where buyers keep stepping in.'],
    },
    tryIt: { label: 'Find support on a chart', to: '/markets/MSFT' },
  },
  {
    id: 'moving-averages',
    title: 'Moving averages',
    sub: 'The smooth lines',
    minutes: 2,
    steps: [
      { art: { k: 'averages' }, title: 'The average of recent prices', text: 'A 20-day moving average is the average close of the last 20 days. It smooths out the noise so the trend is easier to see.' },
      { art: { k: 'cross' }, title: 'Fast line crosses the slow line', text: 'When the faster 20 line crosses above the slower 50 line, the trend may be turning up. Crossing below can mean it’s turning down.' },
      { art: { k: 'big', top: 'Signs, not promises', bottom: 'AVERAGES LAG BEHIND THE PRICE' }, title: 'They’re always a bit late', text: 'Averages are built from past prices, so they react after the move has started. Use them to confirm a trend, not to predict one.' },
    ],
    check: {
      art: { k: 'cross', plain: true },
      q: 'The 20-day average crosses above the 50-day. That suggests…',
      opts: ['The trend may be turning up', 'The stock will surely go up', 'The company is shutting down'],
      right: 0,
      why: ['Right. It’s a sign the recent price is gaining strength. A sign, not a promise.', 'Not quite. No signal is sure. It only suggests the trend may be turning up.', 'Not quite. A moving average is only about the price, not the company’s plans.'],
    },
    tryIt: { label: 'Turn on the averages', to: '/markets/NVDA' },
  },
  {
    id: 'volume',
    title: 'Volume',
    sub: 'How many people agree',
    minutes: 2,
    steps: [
      { art: { k: 'volume' }, title: 'Volume = shares traded', text: 'The bars under the chart show how many shares changed hands in each candle. Tall bar, lots of trading.' },
      { art: { k: 'volspike' }, title: 'Big move, big volume', text: 'A breakout on a huge volume bar means lots of traders are behind it. That move is more likely to stick.' },
      { art: { k: 'big', top: 'Big move, tiny volume?', bottom: 'BE CAREFUL', tone: 'down' }, title: 'Quiet moves are weaker', text: 'If the price jumps but volume is low, few people are behind it. It can fade just as fast.' },
    ],
    check: {
      art: { k: 'volspike', plain: true },
      q: 'A stock breaks above resistance on very high volume. That usually means…',
      opts: ['Nobody cares about the move', 'Lots of traders are behind the move', 'The chart is broken'],
      right: 1,
      why: ['Not quite. High volume means lots of people are trading it.', 'Right. Big volume shows strong agreement, so the breakout is more believable.', 'Not quite. High volume is normal on big news or breakouts.'],
    },
    tryIt: { label: 'Look at the volume', to: '/markets/TSLA' },
  },
  {
    id: 'candle-shapes',
    title: 'Candle shapes',
    sub: 'What one candle can tell you',
    minutes: 3,
    steps: [
      { art: { k: 'shapes' }, title: 'Shapes tell a story', text: 'The size of a candle’s body and wicks shows who won the fight between buyers and sellers in that period.' },
      { art: { k: 'shapes', focus: 0 }, title: 'Long lower wick', text: 'Sellers pushed the price way down, but buyers pushed it back up before the close. Near support, that’s a good sign.' },
      { art: { k: 'shapes', focus: 1 }, title: 'Doji: undecided', text: 'It opened and closed at almost the same price. Nobody won. After a long trend, it can mean the trend is getting tired.' },
      { art: { k: 'shapes', focus: 2 }, title: 'Big body: a strong move', text: 'A big body with small wicks means one side was in control the whole time. A big red one means sellers took charge.' },
    ],
    check: {
      art: { k: 'shapes', focus: 1 },
      q: 'A candle that opens and closes at nearly the same price is a…',
      opts: ['Big body', 'Long lower wick', 'Doji'],
      right: 2,
      why: ['Not quite. A big body means the price moved a lot from open to close.', 'Not quite. That one has a long tail below, where buyers pushed back.', 'Right. A doji means buyers and sellers ended up even: undecided.'],
    },
    tryIt: { label: 'Find a doji', to: '/markets/AMZN' },
  },
  {
    id: 'rsi',
    title: 'RSI',
    sub: 'Has it moved too far, too fast?',
    minutes: 3,
    steps: [
      { art: { k: 'rsi', zone: 'mid' }, title: 'A score from 0 to 100', text: 'RSI measures how fast the price has been moving up or down lately. Most of the time it sits between 30 and 70.' },
      { art: { k: 'rsi', zone: 'over' }, title: 'Above 70: overbought', text: 'The price has run up fast. It might be due for a rest or a pullback, but strong stocks can stay above 70 for a while.' },
      { art: { k: 'rsi', zone: 'under' }, title: 'Below 30: oversold', text: 'The price has dropped fast. It might bounce soon, but falling stocks can keep falling.', tip: 'RSI works best together with the trend and support, never on its own.' },
    ],
    check: {
      art: { k: 'rsi', zone: 'over' },
      q: 'A stock’s RSI is 82. That means…',
      opts: ['It has run up fast and may be due for a rest', 'It is about to crash for sure', 'It is cheap right now'],
      right: 0,
      why: ['Right. Above 70 is overbought: it moved up fast, so a rest is more likely. Not certain.', 'Not quite. RSI never promises anything. Strong stocks can stay high for a while.', 'Not quite. A high RSI means it rose fast, not that it’s cheap.'],
    },
    tryIt: { label: 'Turn on RSI', to: '/markets/SPY' },
  },
  {
    id: 'chart-checklist',
    title: 'Your chart checklist',
    sub: 'Put it all together',
    minutes: 2,
    steps: [
      { art: { k: 'checklist' }, title: 'Four questions before you buy', text: 'Which way is the trend? Where are support and resistance? Is volume backing the move? Where does my stop go?' },
      { art: { k: 'big', top: '3 of 4 say yes?', bottom: 'THEN IT’S WORTH A LOOK', tone: 'up' }, title: 'Look for agreement', text: 'One signal alone is weak. When the trend, the levels and the volume all point the same way, the odds are better.' },
      { art: { k: 'big', top: 'No clear answer?', bottom: 'SKIP IT. THERE’S ALWAYS ANOTHER' }, title: 'It’s fine to wait', text: 'If the chart is messy, don’t trade it. Waiting costs nothing; a bad trade does.' },
    ],
    check: {
      art: { k: 'checklist' },
      q: 'The trend is down, the price just broke support, and volume is high. Should you buy?',
      opts: ['Yes, it’s cheaper now', 'Probably not: the chart says sellers are winning', 'Yes, high volume is always good'],
      right: 1,
      why: ['Not quite. Cheaper can get cheaper. Every signal here points down.', 'Right. A downtrend, broken support and heavy selling all agree: wait.', 'Not quite. High volume makes the move stronger, and here the move is down.'],
    },
    tryIt: { label: 'Check a chart', to: '/markets/AAPL' },
  },
];

export const CHAPTERS: Chapter[] = [
  { id: 'basics', n: 1, title: 'The basics', sub: 'Stocks, prices, charts, your first trade and staying safe.', lessons: BASICS, quiz: quizzes.basics, pass: 4 },
  { id: 'charts', n: 2, title: 'Charts & volume', sub: 'Timeframes, trends, support, averages, volume, candle shapes and RSI.', lessons: CHARTS, quiz: quizzes.charts, pass: 4 },
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

export type QuizResult = { right: number; total: number; passed: boolean; need: number; results: { ok: boolean; answer: number }[]; xp: number; charged?: number; retakeAt?: number };
/** retakeNow: pay RETAKE_COST tokens to retake within 12 hours of a fail (the server checks and charges). */
export const gradeQuiz = (chapter: string, answers: number[], retakeNow = false) =>
  callFunction<{ chapter: string; answers: number[]; retakeNow?: boolean }, QuizResult>('learn_quiz', retakeNow ? { chapter, answers, retakeNow } : { chapter, answers });
/** Retakes (owner 2026-10-23): free 12 hours after a fail, or 10 tokens now. Shown price; the server charges. */
export const RETAKE_COST = 10;
export const RETAKE_WAIT_MS = 12 * 3600_000;
/** When a free retake opens, or null if the quiz is free now (mirrors functions/learn.py retake_at). */
export function retakeAt(chapter: string, failed: Record<string, number>, passed: Record<string, number>, now: number): number | null {
  const last = failed[chapter];
  if (passed[chapter] || typeof last !== 'number') return null;
  return last + RETAKE_WAIT_MS > now ? last + RETAKE_WAIT_MS : null;
}
