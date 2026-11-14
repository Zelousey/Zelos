/**
 * New Trading 101 lessons for chapters 6 and 7 (owner 2026-11-14): options basics, then managing
 * options contracts. Runner contracts are kept for Advanced options trading (chapter 9).
 */
import type { Lesson } from './chapters';
import { big, chart, check, lesson } from './kit';

// ------------------------------------------------------------------ 6. Options basics
export const OPT_WHAT: Lesson = lesson(
  'opt-what',
  'What an option is',
  'A contract, not a share',
  [
    { art: big('THE RIGHT, NOT THE DUTY', ''), title: 'A right to buy or sell', text: 'An option is a contract that gives you the right, but not the obligation, to buy or sell a stock at a set price until a set date.' },
    { art: big('1 CONTRACT = 100 SHARES', ''), title: 'One contract, 100 shares', text: 'Each contract covers 100 shares. A price of $2.50 means $2.50 a share, so one contract costs $250.' },
    { art: big('DERIVED FROM THE STOCK', 'THE “UNDERLYING”'), title: 'It follows the stock', text: 'An option’s value comes from its stock, called the underlying. When the stock moves, the option moves too, usually by much more in percentage terms.' },
  ],
  check('An option shows a price of $3.00. What does one contract cost?', ['$3', '$30', '$300'], 2, 'One contract covers 100 shares: $3.00 × 100 = $300.'),
  { label: 'See an options chain', to: '/options' },
);

export const OPT_CALL: Lesson = lesson(
  'opt-call',
  'Calls: betting it goes up',
  'Buying a call',
  [
    { art: chart([40, 45, 52, 60, 70, 78], { lines: [{ y: 52, label: 'STRIKE $100', tone: 'gold', dash: true }], tone: 'up', title: 'CALL GAINS AS THE STOCK RISES' }), title: 'A call gains when the stock rises', text: 'A call gives you the right to buy at the strike price. The further the stock rises above the strike, the more the call is worth.' },
    { art: big('MAX LOSS = WHAT YOU PAID', ''), title: 'Your risk is the premium', text: 'If you buy a call for $200 and the stock never rises enough, the most you can lose is the $200 you paid.' },
    { art: big('STOCK +5% → CALL +40%?', 'LEVERAGE'), title: 'Bigger moves, both ways', text: 'Because a call costs much less than 100 shares, a small move in the stock can be a big percentage move in the call, up or down.' },
  ],
  check('You buy a call. You make money when the stock…', ['Rises enough', 'Falls', 'Stays perfectly still'], 0, 'A call gains value when the stock rises, especially above the strike.'),
  { label: 'Look at calls', to: '/options' },
);

export const OPT_PUT: Lesson = lesson(
  'opt-put',
  'Puts: betting it goes down',
  'Buying a put',
  [
    { art: chart([78, 70, 62, 54, 46, 38], { lines: [{ y: 62, label: 'STRIKE $100', tone: 'gold', dash: true }], tone: 'dn', title: 'PUT GAINS AS THE STOCK FALLS' }), title: 'A put gains when the stock falls', text: 'A put gives you the right to sell at the strike price. The further the stock falls below the strike, the more the put is worth.' },
    { art: big('BEARISH, WITH LIMITED RISK', ''), title: 'A defined-risk bearish bet', text: 'Buying a put lets you profit from a drop while risking only what you paid for it.' },
    { art: big('ALSO USED AS INSURANCE', ''), title: 'Protection too', text: 'People who own a stock sometimes buy puts to protect it from a fall. That comes up again in Advanced options trading.' },
  ],
  check('You buy a put on a stock. Which helps you most?', ['The stock rising sharply', 'The stock falling well below the strike', 'Nothing happening'], 1, 'Puts gain value as the stock falls below the strike.'),
  { label: 'Look at puts', to: '/options' },
);

export const OPT_STRIKE_EXP: Lesson = lesson(
  'opt-strike-exp',
  'Strike prices and expiration dates',
  'The two numbers that define a contract',
  [
    { art: big('AAPL $335 CALL 11/20', 'STOCK · STRIKE · TYPE · DATE'), title: 'Reading a contract name', text: 'Stock, strike price, call or put, and expiration date. “AAPL $335 Call 11/20” is the right to buy Apple at $335 until November 20.' },
    { art: chart([50, 52, 55, 53, 58, 62], { lines: [{ y: 58, label: 'STRIKE', tone: 'gold', dash: true }] }), title: 'The strike', text: 'The strike is the price in the contract. Strikes near today’s price cost more and move more; strikes far away are cheaper and need a bigger move.' },
    { art: { k: 'clock' }, title: 'The expiration', text: 'After expiration the contract is finished. In Zelos you can choose weekly and monthly dates, or “Today” for a contract that ends at today’s 4:00 PM close.' },
  ],
  check('In “NVDA $200 Put 12/4”, what is $200?', ['The price of the contract', 'The strike price', 'The number of shares'], 1, '$200 is the strike: the price the put lets you sell at, until December 4.'),
  { label: 'Pick a contract', to: '/options' },
);

export const OPT_PREMIUM: Lesson = lesson(
  'opt-premium',
  'The premium',
  'What you pay for a contract',
  [
    { art: big('PREMIUM = PRICE', '$2.40 × 100 = $240'), title: 'Price of the contract', text: 'The premium is what you pay to buy an option, quoted per share. Multiply by 100 for one contract.' },
    { art: big('INTRINSIC + TIME VALUE', ''), title: 'Two parts', text: 'Intrinsic value is how much it’s already in the money. Time value is the extra people pay for the chance it moves further before expiring.' },
    { art: big('BID · ASK', 'BUY HIGHER, SELL LOWER'), title: 'Mind the spread', text: 'You buy at the ask and sell at the bid. That small gap is a cost on every round trip.' },
  ],
  check('A $100 call costs $3 while the stock is at $101. How much is intrinsic value?', ['$1', '$3', '$101'], 0, 'It’s $1 in the money ($101 − $100). The other $2 is time value.'),
  { label: 'See bid and ask', to: '/options' },
);

export const OPT_MONEYNESS: Lesson = lesson(
  'opt-moneyness',
  'In, at and out of the money',
  'Where the stock is versus the strike',
  [
    { art: chart([40, 45, 52, 58, 64, 70], { lines: [{ y: 52, label: 'STRIKE', tone: 'gold', dash: true }], marks: [{ i: 5, label: 'CALL: IN THE MONEY', tone: 'up' }], tone: 'up' }), title: 'In the money', text: 'A call is in the money when the stock is above the strike; a put when it’s below. It has intrinsic value.' },
    { art: big('STOCK ≈ STRIKE', 'AT THE MONEY'), title: 'At the money', text: 'The stock is right around the strike. These contracts react strongly to every move.' },
    { art: chart([60, 56, 52, 50, 48, 46], { lines: [{ y: 66, label: 'STRIKE', tone: 'gold', dash: true }], marks: [{ i: 5, label: 'CALL: OUT OF THE MONEY', tone: 'dn', above: false }], tone: 'dn' }), title: 'Out of the money', text: 'A call is out of the money when the stock is below the strike. It’s all time value, cheaper, and becomes worthless at expiration if it stays there.' },
  ],
  check('The stock is at $90. A $100 call is…', ['In the money', 'At the money', 'Out of the money'], 2, 'For a call, the stock needs to be above the strike to be in the money. At $90 it’s $10 out of the money.'),
  { label: 'See the chain', to: '/options' },
);

export const OPT_PRICING: Lesson = lesson(
  'opt-pricing',
  'What moves an option’s price',
  'The stock, time and volatility',
  [
    { art: { k: 'move', dir: 'up', from: 2, to: 3.4, label: 'CALL · STOCK +2%' }, title: 'The stock', text: 'The biggest driver: calls rise as the stock rises, puts rise as it falls. At-the-money contracts move about half as many dollars as the stock, but far more in percentage.' },
    { art: { k: 'clock' }, title: 'Time', text: 'Every day that passes, some time value melts away. With the stock unchanged, an option slowly loses value, faster as expiration gets close.' },
    { art: chart([40, 70, 30, 80, 25, 75]), title: 'Volatility', text: 'When a stock swings more, its options cost more, because big moves are more likely. When things calm down, option prices can fall even if the stock doesn’t move.' },
  ],
  check('A stock doesn’t move for a week. What usually happens to an option on it?', ['It gains value', 'It loses some value to time', 'Nothing at all'], 1, 'Time value melts away each day, so with no move the option is usually worth less.'),
  { label: 'Estimate a contract’s P&L', to: '/options' },
);

export const OPT_VS_STOCK: Lesson = lesson(
  'opt-vs-stock',
  'Options vs owning the stock',
  'Same idea, very different risk',
  [
    { art: big('STOCK: NO EXPIRY', 'OPTION: A DEADLINE'), title: 'Time is on the stock’s side', text: 'Shares can be held for years. An option has a deadline: you need the move to happen before it expires.' },
    { art: big('STOCK −10% · CALL −60%', 'SAME DAY'), title: 'Bigger swings', text: 'A 10% drop in a stock can wipe out most of a call’s value. Options amplify moves in both directions.' },
    { art: big('LESS MONEY, MORE RISK PER $', ''), title: 'Cheap isn’t safe', text: 'An option costs less than 100 shares, but the money in it is much more likely to be lost. Size option trades smaller than stock trades.' },
  ],
  check('Which is true about options compared with shares?', ['Options never lose value', 'Options expire, and their value can swing much more', 'Options are always cheaper and safer'], 1, 'Options have deadlines and amplified moves. Cheaper doesn’t mean safer.'),
  { label: 'Compare on a ticket', to: '/practice/trade/AAPL?mode=options' },
);

export const OPT_RISK: Lesson = lesson(
  'opt-risk',
  'Options can expire worthless',
  'The risk to understand first',
  [
    { art: { k: 'move', dir: 'down', from: 2.5, to: 0, label: 'CALL AT EXPIRATION · OUT OF THE MONEY' }, title: 'Worth $0 at the end', text: 'If an option is out of the money at expiration, it expires worthless. You lose everything you paid for it.' },
    { art: big('−100% IS COMMON', ''), title: 'It happens a lot', text: 'Many short-dated, out-of-the-money options expire worthless. Buying them is a low-probability bet, even when it feels cheap.' },
    { art: big('ONLY WHAT YOU CAN LOSE', ''), title: 'Size accordingly', text: 'Put into an option only what you’re fine losing entirely, and keep option trades a small part of the account.' },
  ],
  check('Your call is out of the money at expiration. What is it worth?', ['What you paid', 'Nothing', 'Half of what you paid'], 1, 'An out-of-the-money option is worth nothing at expiration.'),
  { label: 'See your options', to: '/options' },
);

// ------------------------------------------------------------------ 7. Managing options contracts
export const OM_PERFORMANCE: Lesson = lesson(
  'om-performance',
  'Reading an option position',
  'Percent, dollars and the stock behind it',
  [
    { art: big('+$180 · +45%', '2 CONTRACTS · PAID $2.00 · NOW $2.90', 'up'), title: 'Track the percent', text: 'Paid $2.00, now worth $2.90: up 45%. Zelos can notify you when an option is up or down 20, 50, 80 or 100% since you opened it.' },
    { art: chart([40, 44, 48, 52, 50, 56], { title: 'WATCH THE STOCK, NOT ONLY THE OPTION' }), title: 'Watch the stock too', text: 'Open the position to see the stock’s chart, the contract’s chart and your contracts together. The stock is what drives the option.' },
    { art: big('$ × 100 × CONTRACTS', 'YOUR REAL MONEY'), title: 'Dollars matter', text: 'A 45% gain on 1 contract at $0.20 is $9. On 5 contracts at $4.00 it’s $900. Look at both the percent and the dollars.' },
  ],
  check('You paid $1.50 and the option is now $3.00. You’re up…', ['50%', '100%', '150%'], 1, '$3.00 is double $1.50, so you’re up 100%.'),
  { label: 'Open your option positions', to: '/options' },
);

export const OM_DECAY: Lesson = lesson(
  'om-decay',
  'Time decay',
  'The clock is always running',
  [
    { art: chart([90, 86, 82, 77, 70, 60, 45, 25, 5], { tone: 'dn', title: 'TIME VALUE MELTING' }), title: 'Faster near the end', text: 'Time value melts slowly at first and then quickly in the last days. A contract expiring “Today” loses value by the minute.' },
    { art: big('RIGHT IDEA, TOO LATE', 'STILL A LOSS'), title: 'Being right too slowly', text: 'You can be right about the direction and still lose money if the move comes after most of the time value has gone.' },
    { art: big('GIVE IT TIME', 'OR MOVE FAST'), title: 'What traders do about it', text: 'Choose expirations with enough time for your idea, and don’t hold a short-dated contract while waiting “just in case”.' },
  ],
  check('When does time decay hurt an option the fastest?', ['Months before expiration', 'In the last days before expiration', 'It never changes'], 1, 'Decay speeds up sharply near expiration.'),
  { label: 'Compare expirations', to: '/options' },
);

export const OM_IV: Lesson = lesson(
  'om-iv',
  'Implied volatility',
  'How big a move the price expects',
  [
    { art: big('HIGH IV = PRICEY OPTIONS', ''), title: 'The expected swing', text: 'Implied volatility is the size of the move that option prices expect. When traders expect big swings, options get more expensive.' },
    { art: { k: 'news', head: 'Earnings tonight', good: true }, title: 'Before big news', text: 'Before earnings, IV is usually high. Right after the news, it often drops sharply, and option prices fall with it, even when the stock moves your way.' },
    { art: big('THE “IV CRUSH”', ''), title: 'Why it matters', text: 'Paying high IV means you need a bigger move to profit. Knowing that helps you avoid overpaying for a contract.' },
  ],
  check('After an earnings report, IV falls a lot. What usually happens to option prices?', ['They rise', 'They fall', 'They stay the same'], 1, 'Lower implied volatility means cheaper options: the “IV crush”.'),
  { label: 'See volatility in the chain', to: '/options' },
);

export const OM_EXPIRY: Lesson = lesson(
  'om-expiry',
  'Managing expiration',
  'Don’t let the date sneak up on you',
  [
    { art: { k: 'clock' }, title: 'Know your date', text: 'Every position has a deadline. Check how many days are left; your options list shows when each one expires.' },
    { art: big('CLOSE BEFORE THE LAST DAY', 'A COMMON HABIT'), title: 'Close or roll early', text: 'Many traders close or replace contracts before the final days, when decay and price swings are harshest.' },
    { art: big('IN ZELOS', 'EXPIRED = PAID OUT AT INTRINSIC'), title: 'What happens at expiration here', text: 'In Zelos, contracts still open at the close on their expiration day are settled automatically at what they’re worth in the money, or $0.' },
  ],
  check('Why do many traders close options before the last day?', ['Decay and swings are harshest at the end', 'It’s required by law', 'Options can’t be sold on their last day'], 0, 'The final days carry the fastest decay and the wildest swings.'),
  { label: 'Check your expirations', to: '/options' },
);

export const OM_PROFITS_LOSSES: Lesson = lesson(
  'om-profits-losses',
  'Taking profits and cutting losses on options',
  'Faster moves need firmer rules',
  [
    { art: chart([30, 45, 62, 80, 60, 40, 25], { marks: [{ i: 3, label: '+100%', tone: 'up' }, { i: 6, label: '−20% AN HOUR LATER', tone: 'dn', above: false }] }), title: 'Winners can vanish fast', text: 'A profitable option can turn into a losing one within hours. Decide in advance at what gain you’ll take some profit.' },
    { art: big('CUT AT −30% / −50%', 'PICK A RULE'), title: 'A loss limit', text: 'Many option traders set a maximum loss per position, like 30 or 50%, rather than riding it to zero.' },
    { art: big('THE STOCK BROKE YOUR LEVEL?', 'THEN THE IDEA IS WRONG'), title: 'Watch the stock’s level', text: 'If the stock breaks the level your idea depended on, the option trade is wrong too, whatever its percentage says.' },
  ],
  check('Your option is up 100% before lunch. Why might you take some profit?', ['Options can give gains back very quickly', 'You’re not allowed to hold winners', 'It will definitely keep rising'], 0, 'Option gains can disappear fast, so many traders lock some in at planned levels.'),
  { label: 'Sell some contracts', to: '/options' },
);

export const OM_CONTRACTS: Lesson = lesson(
  'om-contracts',
  'Selling contracts one at a time',
  'Managing a multi-contract position',
  [
    { art: big('SELL 1 OF 3', ''), title: 'You don’t have to sell all', text: 'With several contracts, you can sell some and keep the rest. In Zelos, Sell lets you pick how many.' },
    { art: big('LOCK SOME · KEEP SOME', ''), title: 'Why sell part', text: 'Selling part locks in a real gain while still letting the rest benefit if the move continues.' },
    { art: big('MORE CONTRACTS = MORE RISK', ''), title: 'Size still matters', text: 'Ten contracts move ten times as many dollars as one. Buy only as many as fit your plan for losing.' },
  ],
  check('You hold 4 contracts and sell 1. What happens?', ['All 4 are closed', '1 is sold; 3 stay open', 'You buy 1 more'], 1, 'Selling some contracts closes only those; the rest stay open.'),
  { label: 'Open your options', to: '/options' },
);

export const OM_OVERLAP: Lesson = lesson(
  'om-overlap',
  'Overlapping and opposing positions',
  'When positions work against each other',
  [
    { art: big('CALL + PUT, SAME STOCK', 'ONE GAINS, ONE LOSES'), title: 'Bets that cancel', text: 'Holding a call and a put on the same stock means one gains when the other loses. Without a clear reason, you’re mostly paying for both to decay.' },
    { art: big('3 CALLS, 3 DATES', 'SAME BET ×3'), title: 'Stacking the same idea', text: 'Several calls on the same stock at different strikes or dates are really one large bet. They’ll all lose together if you’re wrong.' },
    { art: { k: 'checklist' }, title: 'Know your total exposure', text: 'Before adding a contract, ask what all your positions on that stock do together if it rises or falls 5%.' },
  ],
  check('You hold a call and a put on the same stock, same size. If the stock rises…', ['Both gain', 'The call gains and the put loses', 'Both lose'], 1, 'Calls gain on rises and puts lose, so they partly cancel.'),
  { label: 'Review your positions', to: '/options' },
);

export const OM_REVERSAL: Lesson = lesson(
  'om-reversal',
  'Why a winning option can turn',
  'Leverage works both ways',
  [
    { art: chart([30, 50, 72, 85, 70, 52, 38], { marks: [{ i: 3, label: 'PEAK', tone: 'up' }], tone: 'dn' }), title: 'A small pullback, a big drop', text: 'If the stock pulls back 3%, a short-dated option can lose 30% or more of its value.' },
    { art: big('DECAY + PULLBACK', 'A DOUBLE HIT'), title: 'Two forces at once', text: 'Time decay keeps working while the stock pauses or pulls back, so the option can fall even on a quiet day.' },
    { art: big('PLAN THE EXIT', 'BEFORE THE ENTRY'), title: 'What helps', text: 'A planned profit target, a loss limit and a smaller size keep a winner from becoming a painful loser.' },
  ],
  check('A stock dips 3% after a big run. Your short-dated call could…', ['Lose a much bigger percentage than 3%', 'Gain value', 'Not change'], 0, 'Options amplify moves, so a small dip can be a large percentage loss.'),
  { label: 'See your options', to: '/options' },
);
