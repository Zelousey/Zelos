/**
 * New Trading 101 lessons for chapters 8-10 (owner 2026-11-14): Advanced stock trading, Advanced
 * options trading (stock + options together, and runner contracts) and The mental game, which is
 * always open.
 */
import type { Lesson } from './chapters';
import { big, chart, check, lesson } from './kit';

// ------------------------------------------------------------------ 8. Advanced stock trading
export const AS_ENTRIES: Lesson = lesson(
  'as-entries',
  'Advanced entries and exits',
  'Pullbacks, retests and partial exits',
  [
    { art: chart([30, 45, 60, 52, 61, 70, 66, 80], { lines: [{ y: 60, label: 'OLD RESISTANCE = NEW SUPPORT', tone: 'gold', dash: true }], marks: [{ i: 3, label: 'RETEST ENTRY', tone: 'up', above: false }], tone: 'up' }), title: 'Enter on the retest', text: 'After a breakout, price often comes back to test the old resistance as support. Entering there gives a tighter stop than buying the first spike.' },
    { art: big('SELL ⅓ · ⅓ · ⅓', 'SCALING OUT'), title: 'Exit in pieces', text: 'Selling in parts at different targets locks in some profit early and lets the rest run.' },
    { art: chart([40, 50, 60, 70, 80, 76], { lines: [{ y: 66, label: 'TRAILING STOP', tone: 'gold', dash: true }], tone: 'up' }), title: 'Trailing stops', text: 'A trailing stop follows the price up at a set distance, so it locks in more as the trade works and sells only when the trend breaks.' },
  ],
  check('Why do traders often buy a retest of a breakout level?', ['A tighter, clearer stop just below the level', 'Retests always go up', 'It avoids all risk'], 0, 'Buying near the level gives a close, logical stop. It still can fail.'),
  { label: 'Practice on a chart', to: '/markets/SPY' },
);

export const AS_RISK: Lesson = lesson(
  'as-risk',
  'Advanced risk management',
  'Daily limits and correlation',
  [
    { art: big('STOP AT −3% FOR THE DAY', 'A DAILY LOSS LIMIT'), title: 'A daily loss limit', text: 'Pick a loss for the day after which you stop trading. Bad days happen; this keeps one from turning into a disaster.' },
    { art: big('5 CHIP STOCKS = 1 BET', 'CORRELATION'), title: 'Correlation', text: 'Stocks in the same industry tend to move together. Five similar positions risk far more than they look.' },
    { art: big('TOTAL OPEN RISK ≤ 6%', ''), title: 'Count the total', text: 'Add up what you’d lose if every open trade hit its stop. Keeping that total small protects the account from a bad week.' },
  ],
  check('Why can five tech stocks be riskier than they look?', ['They often move together, like one big position', 'Tech stocks never move', 'Five is always too many'], 0, 'Correlated positions rise and fall together, so the risk adds up.'),
  { label: 'Review your account', to: '/dashboard' },
);

export const AS_COMBINE: Lesson = lesson(
  'as-combine',
  'Combining signals',
  'Confluence, and its limits',
  [
    { art: big('LEVEL + TREND + VOLUME + MOMENTUM', 'CONFLUENCE'), title: 'Confluence', text: 'The strongest setups have several independent reasons lining up: a key level, the main trend, volume and momentum all pointing the same way.' },
    { art: { k: 'zoom', tf: 'D' }, title: 'Multiple timeframes', text: 'Check the daily trend before trading a 15-minute setup. Trading with the bigger trend usually works better than fighting it.' },
    { art: big('STILL NOT CERTAIN', ''), title: 'Better odds, not certainty', text: 'Even perfect-looking setups fail. Confluence improves the odds; your stop and size handle the rest.' },
  ],
  check('What does checking the daily chart before a 15-minute trade help with?', ['Trading with the bigger trend', 'Guaranteeing a win', 'Nothing'], 0, 'The bigger trend gives context; trading with it usually improves the odds.'),
  { label: 'Compare timeframes', to: '/markets/AAPL' },
);

export const AS_SCALING: Lesson = lesson(
  'as-scaling',
  'Scaling into positions',
  'Adding to winners, not losers',
  [
    { art: chart([40, 48, 55, 52, 62, 70, 78], { marks: [{ i: 1, label: 'START SMALL', tone: 'acc' }, { i: 4, label: 'ADD AS IT WORKS', tone: 'up' }], tone: 'up' }), title: 'Add when it proves itself', text: 'Start with part of your size and add only when the trade moves your way, moving the stop up as you do.' },
    { art: big('DON’T AVERAGE DOWN BLINDLY', ''), title: 'Averaging down', text: 'Buying more of a loser lowers your average but raises your risk on an idea that’s already failing. Many big losses start this way.' },
    { art: big('TOTAL RISK STAYS FIXED', ''), title: 'Keep the risk the same', text: 'When you add, the total amount you could lose should still match your plan.' },
  ],
  check('Which is the safer way to add to a position?', ['Add as it moves in your favour, raising the stop', 'Keep buying as it falls', 'Remove the stop and add'], 0, 'Adding to strength with a rising stop keeps risk under control.'),
  { label: 'Try it in Solo', to: '/dashboard' },
);

export const AS_HEDGING: Lesson = lesson(
  'as-hedging',
  'Hedging concepts',
  'Reducing risk on purpose',
  [
    { art: big('LONG STOCKS + SHORT-TERM PROTECTION', ''), title: 'What a hedge is', text: 'A hedge is a second position meant to gain if your main one loses, cushioning the blow.' },
    { art: big('LESS DOWNSIDE · LESS UPSIDE', ''), title: 'It costs something', text: 'Hedges usually cost money or cap your gains. You give up some upside for protection.' },
    { art: big('INDEX FUNDS · PUTS', 'COMMON TOOLS'), title: 'Common hedges', text: 'Traders hedge with index funds that move against their holdings, or with put options. Advanced options trading covers protective puts.' },
  ],
  check('What is the trade-off of a hedge?', ['Less downside, but usually some cost or less upside', 'Only more profit', 'No trade-off'], 0, 'Protection costs something: money, upside, or both.'),
  { label: 'Open the next chapter', to: '/learn/adv-options' },
);

export const AS_PORTFOLIO: Lesson = lesson(
  'as-portfolio',
  'Managing a portfolio',
  'The whole account, not single trades',
  [
    { art: { k: 'split', cash: 3000, stocks: 7000 }, title: 'Keep some cash', text: 'Cash is a position too: it lets you act on new setups and cushions drops.' },
    { art: big('REVIEW WEEKLY', 'WHAT WORKED · WHAT DIDN’T'), title: 'Keep a journal', text: 'Write down why you entered and exited. Patterns in your own mistakes are the fastest way to improve.' },
    { art: big('PROCESS > ONE TRADE', ''), title: 'Think in hundreds of trades', text: 'One trade is noise. Your edge shows over many trades, so judge your process, not a single result.' },
  ],
  check('Why keep a trading journal?', ['To spot your own repeated mistakes', 'It’s required by the exchange', 'To avoid ever losing'], 0, 'Reviewing your reasons and results shows what to repeat and what to stop doing.'),
  { label: 'See your activity', to: '/dashboard' },
);

// ------------------------------------------------------------------ 9. Advanced options trading
export const AO_COMBINE: Lesson = lesson(
  'ao-combine',
  'Combining stocks and options',
  'How one position offsets another',
  [
    { art: big('100 SHARES + 1 OPTION', 'TWO POSITIONS, ONE PLAN'), title: 'Two positions working together', text: 'Traders sometimes pair 100 shares with one option contract to shape their risk: limit the downside, earn some income, or both.' },
    { art: big('ONE OFFSETS THE OTHER', ''), title: 'Offsetting', text: 'When the stock falls, a put rises. When the stock rises, a sold call can limit how much you keep. The pair behaves differently from either alone.' },
    { art: big('NEW RISKS COME WITH IT', ''), title: 'Nothing is free', text: 'Each combination reduces some risks and adds others: costs, capped gains or an obligation. None is a guaranteed safe bet.' },
  ],
  check('Pairing shares with an option usually…', ['Changes the risk: some reduced, some added', 'Removes all risk', 'Doubles the profit'], 0, 'Combinations reshape risk; they don’t remove it.'),
  { label: 'Review Options basics', to: '/learn/options' },
);

export const AO_PROTECTIVE_PUT: Lesson = lesson(
  'ao-protective-put',
  'Protective puts',
  'Insurance for shares you own',
  [
    { art: chart([70, 66, 58, 48, 40, 36], { lines: [{ y: 55, label: 'PUT STRIKE: YOUR FLOOR', tone: 'up', dash: true }], tone: 'dn' }), title: 'A floor under your shares', text: 'Own 100 shares and buy a put: if the stock falls below the strike, the put gains and offsets the losses below that level.' },
    { art: big('THE PUT COSTS MONEY', 'LIKE AN INSURANCE PREMIUM'), title: 'The cost', text: 'If the stock rises or stays flat, the put may expire worthless. That premium is the price of the protection.' },
    { art: big('FOR A TIME, NOT FOREVER', ''), title: 'It expires', text: 'The protection lasts only until expiration. After that you’re unprotected unless you buy another.' },
  ],
  check('What does a protective put do?', ['Limits losses below the strike, for a cost', 'Guarantees a profit', 'Doubles your gains'], 0, 'It acts like insurance: protection below the strike, paid for with the premium.'),
  { label: 'See puts', to: '/options' },
);

export const AO_COVERED_CALL: Lesson = lesson(
  'ao-covered-call',
  'Covered calls',
  'Income, with a cap',
  [
    { art: big('OWN 100 · SELL 1 CALL', 'COLLECT THE PREMIUM'), title: 'How it works', text: 'Own 100 shares and sell someone else a call on them. You collect the premium as income.' },
    { art: chart([40, 48, 56, 64, 74, 84], { lines: [{ y: 64, label: 'CALL STRIKE: YOUR CAP', tone: 'gold', dash: true }], tone: 'up' }), title: 'The catch: a cap', text: 'If the stock rises above the strike, your shares can be called away at that price. You miss the gains above it.' },
    { art: big('STILL OWN THE DOWNSIDE', ''), title: 'Not protection', text: 'The premium only cushions a fall a little. If the stock drops a lot, you still lose on the shares. Zelos only lets you buy options, so this is for understanding.' },
  ],
  check('What is the main trade-off of a covered call?', ['Income now, but gains above the strike are capped', 'Unlimited profit', 'Full protection from losses'], 0, 'You’re paid now, but give up the upside above the strike, and still carry the downside.'),
  { label: 'Back to options', to: '/options' },
);

export const AO_CASH_SECURED: Lesson = lesson(
  'ao-cash-secured',
  'Cash-secured puts',
  'Getting paid to wait for a price',
  [
    { art: big('SELL A PUT · HOLD THE CASH', ''), title: 'How it works', text: 'Sell a put and keep enough cash to buy 100 shares at the strike. You collect the premium now.' },
    { art: chart([60, 56, 50, 45, 42], { lines: [{ y: 45, label: 'STRIKE: YOU MAY HAVE TO BUY', tone: 'gold', dash: true }], tone: 'dn' }), title: 'If it falls', text: 'If the stock drops below the strike, you must buy the shares at the strike, even if the price keeps falling.' },
    { art: big('ONLY ON STOCKS YOU’D OWN', ''), title: 'When people use it', text: 'Traders use it on stocks they’d happily own at that price. The risk is owning a falling stock. Zelos doesn’t offer selling options; this is for understanding.' },
  ],
  check('The stock falls well below your sold put’s strike. You…', ['Must buy the shares at the strike', 'Keep the premium with no other effect', 'Lose nothing'], 0, 'Selling a put means you may have to buy at the strike, even in a big drop.'),
  { label: 'Back to options', to: '/options' },
);

export const AO_HEDGE: Lesson = lesson(
  'ao-hedge',
  'Hedging with options',
  'Exposure across positions',
  [
    { art: big('LONG STOCK + PUT = LESS EXPOSURE', ''), title: 'Measuring exposure', text: 'Add up what all your positions do if the stock moves $1. Shares move $1 each; options move by their delta. That total is your exposure.' },
    { art: big('HEDGE = REDUCE, NOT REMOVE', ''), title: 'Partial hedges', text: 'Most hedges reduce exposure rather than remove it, so you can still lose, just less.' },
    { art: big('REVIEW AS THINGS CHANGE', ''), title: 'Hedges drift', text: 'As prices and time change, an option’s effect changes too. A hedge that fit last week may not fit today.' },
  ],
  check('A hedge with options usually…', ['Reduces exposure but doesn’t remove all risk', 'Makes losses impossible', 'Increases exposure'], 0, 'Hedges cut exposure; they rarely remove it completely.'),
  { label: 'See your options', to: '/options' },
);

export const AO_RUNNER: Lesson = lesson(
  'ao-runner',
  'Runner contracts',
  'Take profit, let one run',
  [
    { art: big('BUY 4 CONTRACTS', 'THE START'), title: 'Start with several', text: 'A trader buys 4 contracts at $2.00 ($800). The trade works and they’re now worth $4.00 each ($1,600).' },
    { art: chart([30, 42, 55, 68, 80, 88, 95], { marks: [{ i: 3, label: 'SELL 3 (+$600)', tone: 'up' }, { i: 6, label: 'RUNNER STILL OPEN', tone: 'gold' }], tone: 'up' }), title: 'Sell most, keep a runner', text: 'They sell 3 at $4.00, banking $600 of profit, and keep 1 contract open: the runner. It can keep gaining if the move continues.' },
    { art: big('THE RUNNER CAN STILL GO TO $0', ''), title: 'Not risk-free', text: 'The runner can still fall or expire worthless. Selling the others already locked in a profit, so the overall trade stays positive, but the runner’s own value can still be lost.' },
  ],
  check('After selling 3 of 4 profitable contracts, the 1 left open is…', ['Completely risk-free', 'A runner that can still lose its value', 'Automatically sold at expiry for a profit'], 1, 'Banking profit on the others reduces the trade’s risk, but the runner can still fall to zero.'),
  { label: 'Keep 1 as a runner', to: '/options' },
);

export const AO_RUNNER_PLAN: Lesson = lesson(
  'ao-runner-plan',
  'Managing a runner',
  'Rules for the contract you keep',
  [
    { art: chart([60, 66, 72, 78, 74, 70, 64], { lines: [{ y: 70, label: 'RUNNER EXIT RULE', tone: 'gold', dash: true }], marks: [{ i: 6, label: 'SOLD ON THE RULE', tone: 'dn', above: false }] }), title: 'Give it an exit too', text: 'Decide when the runner goes: a level on the stock, a percentage of the gain given back, or a date before expiration.' },
    { art: big('KEEP 1 AS A RUNNER', 'ONE TAP IN ZELOS'), title: 'In Zelos', text: 'When you hold 2 or more contracts, Sell offers “Keep 1 as a runner”: it sells all but one for you.' },
    { art: big('SIZE THE RUNNER SMALL', ''), title: 'Keep it a small piece', text: 'A runner should be the smaller part of the position, so locking in profit on the rest really reduces your risk.' },
  ],
  check('Why give a runner its own exit rule?', ['So it doesn’t ride all the way back to a loss', 'Runners can’t lose', 'It’s required'], 0, 'Without a rule, a runner can give back far more than planned.'),
  { label: 'Open your options', to: '/options' },
);

// ------------------------------------------------------------------ 10. The mental game (always open)
export const MG_REVENGE: Lesson = lesson(
  'mg-revenge',
  'Revenge trading',
  'Chasing yesterday’s losses',
  [
    { art: big('“I HAVE TO WIN IT BACK”', ''), title: 'What it is', text: 'After a loss, the urge to win it back right now can be strong. Bigger, faster, less-planned trades follow, and losses often grow.' },
    { art: { k: 'move', dir: 'down', from: 10000, to: 7400, label: 'THREE REVENGE TRADES' }, title: 'How it snowballs', text: 'Trying to recover yesterday’s loss in one go usually means taking risks you’d never take when calm.' },
    { art: big('TODAY IS A NEW DAY', ''), title: 'What helps', text: 'Each day starts fresh. Stick to your normal size and your plan; the goal is good trades, not getting back to a number.' },
  ],
  check('You lost $500 yesterday. A healthy approach today is…', ['Trade double size to recover it fast', 'Trade your normal plan and size', 'Take every setup you see'], 1, 'Trying to win it back quickly is revenge trading. Normal size and the plan protect you.'),
  { label: 'See your plan', to: '/learn/risk' },
);

export const MG_FOMO: Lesson = lesson(
  'mg-fomo',
  'Fear of missing out',
  'When everyone else seems to be winning',
  [
    { art: chart([30, 42, 58, 76, 90, 70, 55], { marks: [{ i: 4, label: 'BOUGHT ON FOMO', tone: 'dn' }], tone: 'dn' }), title: 'Chasing the move', text: 'Seeing a stock soar makes you want in at any price. FOMO buys often come near the top, right before a pullback.' },
    { art: big('THERE’S ALWAYS ANOTHER TRADE', ''), title: 'Missing one is fine', text: 'Markets offer new setups every day. Missing a move costs nothing; chasing a bad entry can cost a lot.' },
    { art: big('WAIT FOR YOUR SETUP', ''), title: 'What helps', text: 'Write down the setups you trade. If the move doesn’t fit, let it go.' },
  ],
  check('A stock is up 40% today and you feel you must buy now. That feeling is…', ['A reliable buy signal', 'FOMO: a reason to slow down', 'Proof it will keep rising'], 1, 'FOMO pushes late, poorly planned entries. Slow down and check your plan.'),
  { label: 'Review entries', to: '/learn/risk/entry' },
);

export const MG_OVERCONFIDENCE: Lesson = lesson(
  'mg-overconfidence',
  'After a big win',
  'Overconfidence',
  [
    { art: big('+$2,000 · “I CAN’T LOSE”', '', 'up'), title: 'The high', text: 'A big win feels great and can make you feel unbeatable. That’s when people double their size or skip their rules.' },
    { art: { k: 'move', dir: 'down', from: 12000, to: 9500, label: 'THE NEXT WEEK' }, title: 'Giving it back', text: 'Larger bets after a win often hand the profit straight back to the market.' },
    { art: big('SAME SIZE, SAME RULES', ''), title: 'What helps', text: 'Celebrate, then keep trading exactly as before. Luck and skill look the same over one trade.' },
  ],
  check('After your best week ever, a sensible move is…', ['Keep the same size and rules', 'Triple your size', 'Stop using stops'], 0, 'A good streak isn’t a reason to change what worked. Keep the same size and rules.'),
  { label: 'See your account', to: '/dashboard' },
);

export const MG_LOSSES: Lesson = lesson(
  'mg-losses',
  'Losses are part of trading',
  'Staying steady when it goes wrong',
  [
    { art: big('EVEN THE BEST LOSE OFTEN', ''), title: 'Everyone loses', text: 'Many professional traders are wrong close to half the time. What matters is that losses stay small and wins are bigger.' },
    { art: big('A LOSS ≠ A MISTAKE', 'IF YOU FOLLOWED THE PLAN'), title: 'Judge the decision, not the result', text: 'A well-planned trade that hits its stop was a good decision with a bad outcome. Breaking your rules is the real mistake, even if it worked.' },
    { art: big('BE KIND TO YOURSELF', ''), title: 'Don’t spiral', text: 'Feeling discouraged is normal. Take a step back, review calmly, and come back when you’re ready.' },
  ],
  check('You followed your plan and the trade hit its stop. Was that a mistake?', ['Yes, every loss is a mistake', 'No, a planned small loss is part of trading', 'Only if it was a big stock'], 1, 'Following the plan and taking a small loss is good trading, even though it lost.'),
  { label: 'Review your activity', to: '/dashboard' },
);

export const MG_OVERTRADING: Lesson = lesson(
  'mg-overtrading',
  'Overtrading',
  'More trades isn’t more profit',
  [
    { art: big('20 TRADES BEFORE LUNCH', ''), title: 'Trading for the feeling', text: 'Trading out of boredom or excitement leads to weak setups and many small losses that add up.' },
    { art: big('QUALITY OVER QUANTITY', ''), title: 'Fewer, better trades', text: 'Most good traders wait a lot. A day with no trades can be a good day.' },
    { art: big('MAX 3 TRADES A DAY?', 'SET A LIMIT'), title: 'What helps', text: 'Set a daily trade limit and stop once you reach it.' },
  ],
  check('Which is more likely to help your results?', ['Taking every move you see', 'Fewer trades that fit your plan', 'Trading whenever you’re bored'], 1, 'Selective trading avoids the slow bleed of weak setups.'),
  { label: 'Grade setups instead', to: '/training' },
);

export const MG_DISCIPLINE: Lesson = lesson(
  'mg-discipline',
  'Discipline and the blown-up account',
  'Protect the account first',
  [
    { art: { k: 'move', dir: 'down', from: 10000, to: 400, label: 'ONE “ALL-IN” DAY' }, title: 'How accounts blow up', text: 'Not one bad trade, but a string of rule-breaking: no stops, bigger and bigger bets, trying to fix it all at once.' },
    { art: { k: 'checklist' }, title: 'A few rules you never break', text: 'Always a stop. Never more than your set risk per trade. Stop after your daily loss limit. Simple rules, kept every time.' },
    { art: big('THE ACCOUNT IS YOUR TOOL', ''), title: 'Protect it', text: 'Without money left there are no more trades. Protecting the account comes before any single opportunity.' },
  ],
  check('What usually blows up an account?', ['One careful, planned trade', 'A series of broken rules and oversized bets', 'Using stop-losses'], 1, 'Accounts usually blow up through repeated rule-breaking and oversized bets.'),
  { label: 'Read the risk chapter', to: '/learn/risk' },
);

export const MG_MONEY: Lesson = lesson(
  'mg-money',
  'A healthy relationship with money',
  'Realistic expectations',
  [
    { art: big('GET RICH QUICK?', 'RARELY'), title: 'Realistic goals', text: 'Steady, modest gains over a long time are what good trading looks like. Promises of doubling an account fast are usually how people lose it.' },
    { art: big('NOT ATTACHED TO ONE TRADE', ''), title: 'Don’t fall in love', text: 'A stock isn’t a team to support. When the trade stops working, letting it go is part of the job.' },
    { art: big('MONEY ≠ YOUR WORTH', ''), title: 'Keep perspective', text: 'Wins and losses aren’t a measure of you as a person. Keep your life, sleep and relationships first.' },
  ],
  check('Which expectation is healthier?', ['Double my account every month', 'Steady improvement and small, controlled losses', 'Never lose money'], 1, 'Realistic goals reduce pressure and the urge to take wild risks.'),
  { label: 'Hall of Minds', to: '/minds' },
);

export const MG_BREAKS: Lesson = lesson(
  'mg-breaks',
  'Breaks and a fresh start',
  'When it gets too much',
  [
    { art: big('PAUSE', 'IT’S ALLOWED'), title: 'Step away', text: 'Feeling overwhelmed, angry or anxious is a sign to stop. Close the app, take a walk, come back later or tomorrow.' },
    { art: { k: 'session' }, title: 'Start each day clear', text: 'Before the open, look at your plan, not at yesterday’s P&L. Each session is a new set of decisions.' },
    { art: big('TALK TO SOMEONE', ''), title: 'You’re not alone', text: 'If money stress is affecting you, talk to someone you trust. Your wellbeing matters more than any trade.' },
  ],
  check('You feel anxious and keep checking prices. A good step is…', ['Take a break from the screen', 'Place more trades to feel in control', 'Turn off all stops'], 0, 'A pause lets the feeling settle so you can decide calmly.'),
  { label: 'Notification settings', to: '/alerts?tab=notify' },
);

export const MG_COLORS: Lesson = lesson(
  'mg-colors',
  'Colours and emotion',
  'Calmer charts',
  [
    { art: big('RED = ALARM?', ''), title: 'Colours carry feelings', text: 'Bright red and green can make every move feel urgent. For some people, a sea of red makes losses feel heavier than they are.' },
    { art: big('BLUE / ORANGE · CALMER TONES', ''), title: 'Change them if it helps', text: 'Many traders switch to softer or different colours to take some heat out of the screen. In Zelos you can pick chart colours in Settings.' },
    { art: big('SAME NUMBERS, LESS STRESS', ''), title: 'It’s still the same data', text: 'Changing colours doesn’t hide anything; it just makes it easier to read the numbers calmly.' },
  ],
  check('Why might a trader change their chart colours?', ['To make price moves feel less alarming', 'To change the prices', 'To hide losses from the account'], 0, 'Calmer colours can help some people read the same data with less emotion.'),
  { label: 'Pick chart colours', to: '/settings' },
);

export const MG_VIRTUAL_REAL: Lesson = lesson(
  'mg-virtual-real',
  'Virtual money and real money',
  'What practice can and can’t teach',
  [
    { art: { k: 'wallet' }, title: 'A place to practise', text: 'Zelos uses virtual money so you can practise discipline, planning and risk without real losses.' },
    { art: big('SIM WINS ≠ REAL WINS', ''), title: 'Real money feels different', text: 'With real money, fear and greed are much stronger. Doing well in a simulator doesn’t guarantee doing well in real markets.' },
    { art: big('REAL LOSSES CAN HURT', 'TAKE CARE'), title: 'Look after yourself', text: 'Real financial losses can affect mental health. If you ever trade real money, start small, risk only what you can afford to lose, and keep the habits you built here.' },
  ],
  check('You’re doing great in Zelos. What’s true about real trading?', ['Success here guarantees success there', 'Real money brings stronger emotions; start small and keep your rules', 'Real trading is easier'], 1, 'Practice builds habits, but real money is emotionally harder. Start small and keep the same rules.'),
  { label: 'Keep practising', to: '/dashboard' },
);
