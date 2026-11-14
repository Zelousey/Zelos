/**
 * New Trading 101 lessons for chapters 1-3 (owner 2026-11-14): stock trading fundamentals;
 * positions, entries, exits and risk; reading charts, managing trades and P&L. The original
 * lessons (stocks, prices, buy-sell, stops…) are reused in their new chapters, not rewritten.
 */
import type { Lesson } from './chapters';
import { big, chart, check, lesson } from './kit';

// ------------------------------------------------------------------ 1. Stock trading fundamentals
export const MARKET_WORKS: Lesson = lesson(
  'market-works',
  'How the stock market works',
  'Buyers and sellers, matched in a split second',
  [
    { art: { k: 'scale', heavy: 'buyers' }, title: 'A giant marketplace', text: 'The stock market is where people who want to buy shares meet people who want to sell them. Exchanges like the New York Stock Exchange and Nasdaq match them up, millions of times a day.' },
    { art: big('BID $99.98 · ASK $100.02', 'BUYERS · SELLERS'), title: 'Bid and ask', text: 'The bid is the best price a buyer is offering right now. The ask is the best price a seller will take. A trade happens when they meet. The small gap between them is called the spread.' },
    { art: { k: 'session' }, title: 'Open and closed', text: 'Regular trading runs 9:30 am to 4:00 pm New York time on weekdays. Outside those hours prices barely move or jump in big steps, and on market holidays nothing trades at all.' },
    { art: big('LAST $100.00', 'THE PRICE YOU SEE'), title: 'The price is the last trade', text: 'The price on a chart is simply the last price someone actually traded at. Nobody sets it: it comes from buyers and sellers agreeing, trade after trade.' },
  ],
  check('Who decides a stock’s price?', ['The company sets it each morning', 'Buyers and sellers agreeing on trades', 'The government'], 1, 'The price is just the last trade, so it comes from buyers and sellers meeting in the market.'),
  { label: 'See live prices', to: '/markets' },
);

export const ORDER_TYPES: Lesson = lesson(
  'order-types',
  'Market orders vs limit orders',
  'Fast, or at your price',
  [
    { art: { k: 'ticket' }, title: 'A market order: now', text: 'A market order buys or sells right away at the best price available. It’s fast and almost always fills, but you don’t control the exact price, which matters most when prices are jumping.' },
    { art: chart([40, 46, 52, 48, 44, 41, 39, 43, 50], { lines: [{ y: 41, label: 'YOUR LIMIT $41', tone: 'up', dash: true }], marks: [{ i: 5, label: 'FILLS HERE', tone: 'up', above: false }] }), title: 'A limit order: your price or better', text: 'A limit buy only fills at your price or lower; a limit sell only at your price or higher. You control the price, but if the stock never gets there, the order just waits and may never fill.' },
    { art: big('SPEED vs PRICE', 'PICK ONE'), title: 'Which one when?', text: 'Want in or out right now? Market order. Have a price in mind and happy to wait? Limit order. Many traders use limits to avoid paying more than they planned.', tip: 'In Zelos, orders fill on the next price update, and day orders that never fill are cancelled at the close.' },
  ],
  check('You want to buy, but only if the price drops to $50. Which order?', ['A market order', 'A limit order at $50', 'Wait and do nothing'], 1, 'A limit buy at $50 only fills at $50 or lower, so you never pay more than you planned.'),
  { label: 'Open a trade ticket', to: '/practice/trade/AAPL' },
);

export const BUYING_POWER: Lesson = lesson(
  'buying-power',
  'Buying power',
  'What you can actually spend',
  [
    { art: { k: 'wallet' }, title: 'Cash you can use', text: 'Buying power is the money available for new trades. In a simple cash account it’s your cash, minus anything already set aside for orders waiting to fill.' },
    { art: { k: 'split', cash: 6000, stocks: 4000 }, title: 'Orders hold money aside', text: 'Place a $1,000 limit buy that hasn’t filled yet and that $1,000 is held for it. Your cash still shows, but you can’t spend the same money twice.' },
    { art: big('$10,000 ≠ $10,000 TO SPEND', 'ACCOUNT VALUE vs BUYING POWER'), title: 'Not the same as account value', text: 'Your account value counts the stocks you own. Buying power only counts what you can spend. Own $9,000 of stock in a $10,000 account and you can only buy about $1,000 more.' },
  ],
  check('Your account is worth $10,000: $8,000 in stocks and $2,000 cash, with no orders waiting. Your buying power is about…', ['$10,000', '$8,000', '$2,000'], 2, 'Buying power is the cash you can spend: $2,000. The $8,000 is already in stocks.'),
  { label: 'See your buying power', to: '/dashboard' },
);

export const PORTFOLIO_WORDS: Lesson = lesson(
  'portfolio-words',
  'Portfolio words',
  'Position, shares, average cost, P&L',
  [
    { art: { k: 'shares', pick: true }, title: 'A position', text: 'A position is how much you own of one stock. Own 10 shares of Apple and you have a 10-share Apple position. Your portfolio is all your positions plus your cash.' },
    { art: big('AVG $102.50', '10 @ $100 + 10 @ $105'), title: 'Average cost', text: 'Buy 10 shares at $100 and 10 more at $105, and your average cost is $102.50. Your profit or loss is measured from that average.' },
    { art: big('+$75.00 · +3.7%', 'OPEN P&L', 'up'), title: 'Market value and P&L', text: 'Market value is shares × today’s price. Open P&L is how far that is above or below what you paid. Both move with the price until you sell.' },
  ],
  check('You bought 5 shares at $20 and 5 at $30. What is your average cost?', ['$20', '$25', '$30'], 1, '10 shares cost $250 in total, so the average is $25 a share.'),
  { label: 'See your positions', to: '/dashboard' },
);

export const WHAT_MOVES: Lesson = lesson(
  'what-moves',
  'What makes stocks move',
  'Earnings, news, the economy and the crowd',
  [
    { art: { k: 'news', head: 'Earnings beat: sales up 30%', good: true }, title: 'Earnings', text: 'Four times a year companies report their sales and profits. Better than expected often sends a stock up; worse than expected often sends it down, sometimes sharply.' },
    { art: { k: 'world' }, title: 'The whole market', text: 'Interest rates, inflation, jobs reports and world events move many stocks at once. On a big down day for the market, even great companies often fall.' },
    { art: { k: 'scale', heavy: 'sellers' }, title: 'The crowd', text: 'Fear and excitement move prices too. A stock can rise or fall for days just because more people want in or out, even with no news at all.' },
    { art: big('UP OR DOWN', 'NOTHING IS CERTAIN'), title: 'It can always go either way', text: 'Even good news can drop a stock if people expected even better. Nobody knows for sure where a price goes next, which is why every trade needs a plan for being wrong.' },
  ],
  check('A company beats its earnings estimate, but the stock falls. How can that happen?', ['It can’t; good news always lifts a stock', 'People expected even more, so they sold', 'The exchange made an error'], 1, 'Prices reflect expectations. If traders hoped for more, even a beat can disappoint.'),
  { label: 'See upcoming earnings', to: '/dashboard' },
);

export const TRADING_WORDS: Lesson = lesson(
  'trading-words',
  'Trading words you’ll hear',
  'Bull, bear, ticker, volatility',
  [
    { art: { k: 'trend', dir: 'up' }, title: 'Bulls and bears', text: 'A bull expects prices to rise; a bear expects them to fall. A bull market is a long stretch of rising prices, a bear market a long stretch of falling ones.' },
    { art: big('AAPL · NVDA · SPY', 'TICKERS'), title: 'Tickers', text: 'Every stock has a short code called a ticker: AAPL is Apple, NVDA is NVIDIA. SPY and QQQ are funds that hold whole groups of big US companies.' },
    { art: chart([50, 70, 35, 80, 30, 75, 40, 65, 45]), title: 'Volatility', text: 'Volatility is how much and how fast a price swings. Volatile stocks can make or lose money quickly, so they need smaller positions and more care.' },
  ],
  check('Someone says they’re “bearish” on a stock. They expect it to…', ['Rise', 'Fall', 'Stay exactly the same'], 1, 'Bears expect prices to fall; bulls expect them to rise.'),
  { label: 'Browse the market', to: '/markets' },
);

// ------------------------------------------------------------------ 2. Positions, entries, exits & risk
export const POSITION: Lesson = lesson(
  'position',
  'What a position is',
  'Everything you hold in one stock',
  [
    { art: { k: 'shares', pick: true }, title: 'Open a position', text: 'The moment a buy fills, you have a position: a number of shares at an average price. From then on, every move in the stock changes your account.' },
    { art: big('LONG 10 AAPL @ $330', 'AN OPEN POSITION'), title: 'Long means you own it', text: 'Owning shares is being “long”: you make money if the price rises. In Zelos every stock position is long, so you profit when it goes up and lose when it goes down.' },
    { art: big('CLOSED', 'SOLD = DONE'), title: 'Close it to finish', text: 'Selling all your shares closes the position and turns the open P&L into a real result. Selling some leaves a smaller position open.' },
  ],
  check('You own 20 shares and sell 5. What is left?', ['Nothing, the position is closed', 'A 15-share position', 'A 25-share position'], 1, 'Selling part of a position leaves the rest open: 20 − 5 = 15 shares.'),
  { label: 'See your positions', to: '/dashboard' },
);

export const ENTRY: Lesson = lesson(
  'entry',
  'Planning an entry',
  'Where and why you get in',
  [
    { art: chart([30, 42, 55, 50, 45, 47, 58, 66, 74], { lines: [{ y: 45, label: 'SUPPORT', tone: 'up', dash: true }], marks: [{ i: 4, label: 'ENTRY NEAR SUPPORT', tone: 'up', above: false }], tone: 'up' }), title: 'Have a reason', text: 'A good entry has a reason you can say out loud: “it bounced off support”, “it broke above resistance on big volume”. “It’s going up” isn’t a reason; it’s a hope.' },
    { art: big('ENTRY · STOP · TARGET', 'DECIDE BEFORE YOU BUY'), title: 'Know your three prices', text: 'Before you buy, write down your entry price, where you’ll get out if you’re wrong (stop) and where you’ll take profit (target). If you can’t, the trade isn’t ready.' },
    { art: chart([30, 40, 52, 64, 78, 88, 92], { marks: [{ i: 6, label: 'CHASING', tone: 'dn' }], tone: 'up' }), title: 'Don’t chase', text: 'Buying after a stock has already run far makes your stop farther away and your risk bigger. Waiting for a pullback or a clear setup usually gives a better price.' },
  ],
  check('Which is the best reason to enter a trade?', ['It went up a lot today, so it must keep going', 'It bounced off a support level you were watching, and you know where you’d get out', 'A friend said so'], 1, 'A planned level plus a known exit is a real reason. The others are hopes.'),
  { label: 'Practice on a chart', to: '/markets/SPY' },
);

export const EXIT_PLAN: Lesson = lesson(
  'exit-plan',
  'Planning your exit',
  'Decide how it ends before it starts',
  [
    { art: { k: 'rr' }, title: 'Two exits', text: 'Every trade ends one of two ways: at your target with a profit, or at your stop with a small, planned loss. Decide both before you buy, while you’re calm.' },
    { art: chart([50, 56, 62, 70, 66, 60, 54, 49], { lines: [{ y: 70, label: 'TARGET', tone: 'up', dash: true }], marks: [{ i: 3, label: 'SAID SELL HERE…', tone: 'up' }, { i: 7, label: '…HELD, GAVE IT BACK', tone: 'dn', above: false }] }), title: 'Stick to it', text: 'The hardest part isn’t the plan, it’s following it. Hitting your target and then hoping for more is how many winning trades turn into losers.' },
    { art: big('PLAN · ACT · REVIEW', ''), title: 'Change the plan only for a reason', text: 'It’s fine to adjust when something real changes, like a new level or news. It’s not fine to move your stop further away just because the trade is losing.' },
  ],
  check('Your trade hits your planned target. What does a disciplined trader usually do?', ['Sell as planned, or at least some of it', 'Move the target higher and hope', 'Remove the stop-loss'], 0, 'Following the plan locks in the result. Hoping for more is how winners turn into losers.'),
  { label: 'Set a target on a ticket', to: '/practice/trade/AAPL' },
);

export const STOP_LIMITS: Lesson = lesson(
  'stop-limits',
  'What a stop-loss can’t do',
  'Gaps, wiggles and slippage',
  [
    { art: chart([60, 62, 58, 61, 59, 34, 32, 36], { lines: [{ y: 52, label: 'YOUR STOP $52', tone: 'dn', dash: true }], marks: [{ i: 5, label: 'GAPPED TO $34', tone: 'dn', above: false }] }), title: 'Gaps jump past it', text: 'If bad news comes out overnight, a stock can open far below your stop. The stop then sells at the next available price, which can be much worse than the level you picked.' },
    { art: chart([50, 47, 52, 46, 41, 49, 58, 66], { lines: [{ y: 43, label: 'STOP TOO TIGHT', tone: 'dn', dash: true }], marks: [{ i: 4, label: 'STOPPED OUT', tone: 'dn', above: false }] }), title: 'Too tight gets shaken out', text: 'Normal wiggles can hit a stop that sits too close, and then the stock carries on in your direction without you. Put stops where you’re actually wrong, like below support, not just a few cents away.' },
    { art: big('A SAFETY NET, NOT A GUARANTEE', ''), title: 'Still worth using', text: 'Stops don’t promise an exact price, but they stop a small loss from quietly becoming a huge one. Pair them with sensible position sizes.' },
  ],
  check('Your stop is at $52. Bad news overnight and the stock opens at $34. What happens?', ['You sell at exactly $52', 'Your stop sells at the next available price, around $34', 'The trade is cancelled'], 1, 'A stop becomes an order to sell at the next price available. After a gap, that can be far below your stop.'),
  { label: 'Add a stop on a ticket', to: '/practice/trade/AAPL' },
);

export const RISK_REWARD: Lesson = lesson(
  'risk-reward',
  'Risk versus reward',
  'Is the trade worth taking?',
  [
    { art: { k: 'rr' }, title: 'Measure both sides', text: 'Risk is entry minus stop; reward is target minus entry. Buy at $100, stop at $95, target at $115: risk $5 to make $15, a 3-to-1 reward-to-risk.' },
    { art: big('WIN 40% · STILL PROFIT', 'WITH 2:1 OR BETTER', 'up'), title: 'You don’t need to win every time', text: 'With 2-to-1 trades you can be wrong more often than right and still come out ahead. With 1-to-3 trades you need to be right almost always.' },
    { art: big('SKIP IT', 'RISK $5 TO MAKE $2'), title: 'Pass on bad deals', text: 'If the nearest sensible target is closer than your stop, the trade isn’t worth it. Skipping is a decision too.' },
  ],
  check('Entry $50, stop $48, target $56. What is the reward-to-risk?', ['1 to 1', '3 to 1', '6 to 1'], 1, 'Risk is $2 (50 − 48), reward is $6 (56 − 50): 6 ÷ 2 = 3 to 1.'),
  { label: 'Plan one on a chart', to: '/markets/AAPL' },
);

export const SIZING: Lesson = lesson(
  'sizing',
  'Position sizing',
  'How many shares?',
  [
    { art: big('RISK 1-2%', 'OF THE ACCOUNT PER TRADE'), title: 'Start from the risk', text: 'Many traders risk only 1 to 2% of their account on one trade. On $10,000 that’s $100 to $200: the most this trade should lose if it hits the stop.' },
    { art: big('$100 ÷ $5 = 20 SHARES', 'RISK ÷ RISK PER SHARE'), title: 'Then work out the shares', text: 'Risk $100 with a stop $5 below your entry? Buy 20 shares. A wider stop means fewer shares, a tighter stop allows more, and the dollar risk stays the same.' },
    { art: { k: 'split', cash: 8000, stocks: 2000 }, title: 'Size keeps you in the game', text: 'Small, steady sizes mean a string of losses only dents the account. One oversized trade can do more damage than ten small mistakes.' },
  ],
  check('You’ll risk $150. Entry $60, stop $57. How many shares?', ['50', '25', '150'], 0, 'The risk per share is $3, so $150 ÷ $3 = 50 shares.'),
  { label: 'Try a sized trade', to: '/practice/trade/AAPL' },
);

export const ONE_BASKET: Lesson = lesson(
  'one-basket',
  'Never risk everything on one trade',
  'Why “all in” ends accounts',
  [
    { art: { k: 'move', dir: 'down', from: 10000, to: 5000, label: 'ALL IN · ONE STOCK' }, title: 'One bad day', text: 'Put everything into one stock and a single 50% drop halves your account. Spread across ten positions, the same drop in one costs about 5%.' },
    { art: big('−50% NEEDS +100%', 'TO GET BACK'), title: 'Losses are hard to undo', text: 'Lose 50% and you need a 100% gain just to get back to where you started. Avoiding big losses matters more than chasing big wins.' },
    { art: big('SURVIVE FIRST', ''), title: 'Stay in the game', text: 'Good traders think about how much they could lose before how much they could make. Staying in the game long enough to get good is the real goal.' },
  ],
  check('An account falls 50%. What gain does it need to get back to even?', ['50%', '100%', '25%'], 1, 'From $5,000 back to $10,000 is a 100% gain. Big losses are much harder to undo than they look.'),
  { label: 'Check your positions', to: '/dashboard' },
);

export const EMOTIONS_PLAN: Lesson = lesson(
  'emotions-plan',
  'Trading without your emotions in charge',
  'Fear, greed and the plan',
  [
    { art: big('FEAR · GREED', 'THE TWO LOUDEST VOICES'), title: 'Two strong feelings', text: 'Fear makes you sell too early or freeze when you should cut a loss. Greed makes you hold too long or bet too big. Both are normal; the plan is there to outvote them.' },
    { art: { k: 'checklist' }, title: 'Rules decided while calm', text: 'Write simple rules before the market opens: how much you’ll risk, when you’ll stop for the day, what setups you trade. Follow them when your feelings say otherwise.' },
    { art: big('BREATHE', 'STEP AWAY IF IT’S TOO MUCH'), title: 'Take a pause', text: 'If you feel angry, desperate or overexcited, that’s the moment to stop placing trades. There’s a whole chapter on this: The mental game.' },
  ],
  check('You just lost three trades in a row and feel angry. What’s the best move?', ['Double your size to win it back fast', 'Take a break and come back to your plan', 'Remove your stop-losses'], 1, 'Angry trading usually makes it worse. A pause protects you and your account.'),
  { label: 'Open The mental game', to: '/learn/mind' },
);

// ------------------------------------------------------------------ 3. Charts, managing trades & P&L
export const PNL_REAL: Lesson = lesson(
  'pnl-real',
  'Realized vs unrealized P&L',
  'On paper, or in the bank',
  [
    { art: big('+$120 OPEN', 'UNREALIZED', 'up'), title: 'Unrealized: still moving', text: 'While you hold a position, its profit or loss is unrealized: it changes with every price move and can disappear.' },
    { art: big('+$120 BANKED', 'REALIZED', 'up'), title: 'Realized: locked in', text: 'Sell, and the result becomes realized: it’s now cash and won’t change. Your realized P&L is the sum of every trade you’ve closed.' },
    { art: chart([50, 58, 66, 72, 64, 55, 47], { marks: [{ i: 3, label: '+$220 ON PAPER', tone: 'up' }, { i: 6, label: '−$30 WHEN SOLD', tone: 'dn', above: false }] }), title: 'Paper profits can vanish', text: 'A big open gain feels like money, but it isn’t yours until you sell. That’s why traders take some profit at their targets.' },
  ],
  check('You’re up $200 on a stock you still hold. That $200 is…', ['Realized: it’s safe', 'Unrealized: it can still change', 'Already in your cash'], 1, 'Until you sell, the gain is unrealized and moves with the price.'),
  { label: 'See your P&L', to: '/dashboard' },
);

export const PNL_PERCENT: Lesson = lesson(
  'pnl-percent',
  'Percent gains and losses',
  'Dollars vs percent',
  [
    { art: big('$5 ON $50 = 10%', '', 'up'), title: 'Percent compares fairly', text: 'A $5 gain on a $50 stock is 10%; the same $5 on a $500 stock is 1%. Percent tells you how well the trade did, whatever the price.' },
    { art: big('−20% THEN +20% = −4%', 'NOT EVEN'), title: 'Ups and downs don’t cancel', text: '$100 down 20% is $80. Up 20% from $80 is $96, not $100. Percentages work from where you are now, so losses hurt more than equal gains help.' },
    { art: big('ACCOUNT +1.2% TODAY', 'THE NUMBER THAT MATTERS', 'up'), title: 'Watch the account percent', text: 'A stock up 30% matters little if it’s a tiny slice of your account. Your account’s percent change is the real score, and it’s what battles rank by.' },
  ],
  check('A stock falls 20%, then rises 20%. Compared with where it started, it is…', ['Back to even', 'Down 4%', 'Up 4%'], 1, '100 → 80 → 96. A 20% gain on the smaller number doesn’t make up the 20% loss.'),
  { label: 'See your account', to: '/dashboard' },
);

export const ACCOUNT_EFFECT: Lesson = lesson(
  'account-effect',
  'How positions move your account',
  'Size decides the impact',
  [
    { art: { k: 'split', cash: 2000, stocks: 8000 }, title: 'Weight matters', text: 'A position worth 40% of your account that moves 5% changes the account by 2%. A position worth 2% that moves 5% changes it by 0.1%.' },
    { art: big('NVDA +$84 · TSLA −$31', 'WHAT’S MOVING YOUR ACCOUNT'), title: 'See the contributors', text: 'Your Dashboard shows which positions are adding to today’s change and which are dragging. Big positions usually explain most of the move.' },
    { art: big('ALL TECH = ONE BIG BET', ''), title: 'Similar stocks move together', text: 'Five tech stocks often rise and fall together, so they can behave like one big position. Owning different kinds of companies spreads the risk.' },
  ],
  check('Which affects your account more: a 10% move in a position worth 50% of it, or a 30% move in one worth 2%?', ['The 10% move in the big one (5% of the account)', 'The 30% move in the small one', 'They’re the same'], 0, '10% × 50% = 5% of the account; 30% × 2% = 0.6%. Size decides the impact.'),
  { label: 'What’s moving your account', to: '/dashboard' },
);

export const MANAGE_TRADE: Lesson = lesson(
  'manage-trade',
  'Managing an open trade',
  'Check in without fiddling',
  [
    { art: chart([40, 46, 52, 50, 58, 64, 70], { lines: [{ y: 40, label: 'FIRST STOP', tone: 'dn', dash: true }, { y: 52, label: 'STOP RAISED', tone: 'gold', dash: true }], tone: 'up' }), title: 'Raise the stop as it works', text: 'When a trade moves well in your favour, some traders move the stop up, for example to their entry price, so a winner can’t turn into a loser.' },
    { art: { k: 'clock' }, title: 'Check at set times', text: 'Staring at every tick leads to snap decisions. Check your trades at set times, or set alerts at the prices that matter and let them call you.' },
    { art: big('NEVER LOWER A STOP', 'ON A LOSING TRADE'), title: 'One rule to keep', text: 'Moving a stop further away because the trade is losing turns a planned small loss into an unplanned big one.' },
  ],
  check('Your trade is well in profit. Which is a common way to protect it?', ['Move the stop up toward your entry', 'Remove the stop', 'Buy twice as many shares'], 0, 'Raising the stop protects part of the gain while still letting the trade run.'),
  { label: 'Set a price alert', to: '/markets/AAPL' },
);

export const RECONSIDER: Lesson = lesson(
  'reconsider',
  'When to rethink a trade',
  'The reason changed, so the trade might too',
  [
    { art: chart([60, 62, 58, 52, 44, 41, 39], { lines: [{ y: 50, label: 'SUPPORT BROKE', tone: 'dn', dash: true }], marks: [{ i: 4, label: 'THE REASON IS GONE', tone: 'dn', above: false }], tone: 'dn' }), title: 'Your reason broke', text: 'You bought because it held support, and now support has broken on heavy volume. The reason for the trade is gone, even if your stop hasn’t been hit yet.' },
    { art: { k: 'news', head: 'Company cuts its forecast', good: false }, title: 'Big news', text: 'Unexpected news, like an earnings surprise, changes the picture. It’s fine to reassess instead of blindly waiting.' },
    { art: big('“IT’LL COME BACK”', 'IS NOT A PLAN'), title: 'Hope isn’t a reason to hold', text: 'If you wouldn’t buy it today at this price for a clear reason, ask yourself why you’re still holding it.' },
  ],
  check('You bought because a stock held support. It breaks down hard through that level. What does that suggest?', ['The trade’s reason no longer holds; reassess', 'Buy more, it’s cheaper now', 'Nothing has changed'], 0, 'When the reason for a trade disappears, it’s time to reassess, not to hope.'),
  { label: 'Review your positions', to: '/dashboard' },
);

export const UP_NOT_PROFIT: Lesson = lesson(
  'up-not-profit',
  'A stock going up isn’t always profit',
  'It depends where you bought',
  [
    { art: chart([80, 70, 58, 50, 54, 60], { lines: [{ y: 80, label: 'YOU BOUGHT HERE', tone: 'gold', dash: true }], marks: [{ i: 5, label: 'UP TODAY, STILL DOWN OVERALL', tone: 'gold' }] }), title: 'Up today, down overall', text: 'A stock can be up 5% today while you’re still down overall, because you bought higher. Your result depends on your average cost, not today’s move.' },
    { art: big('+3% STOCK · −0.5% ACCOUNT', ''), title: 'Other positions count too', text: 'One green stock doesn’t mean a green account. If your other positions fall more, the account is still down for the day.' },
    { art: big('CHECK YOUR P&L', 'NOT JUST THE TICKER'), title: 'Look at your own numbers', text: 'The market’s headline move and your own P&L are different things. Always check the open P&L on your position and the account’s change.' },
  ],
  check('A stock is up 4% today. You bought it at $120 and it’s now $100. Are you in profit?', ['Yes, it’s up today', 'No, you’re still $20 a share below your cost', 'You can’t tell'], 1, 'Profit is measured from your cost. At $100 you’re still down $20 a share, even on a green day.'),
  { label: 'See your positions', to: '/dashboard' },
);
