/**
 * New Trading 101 lessons for chapters 4 and 5 (owner 2026-11-14): indicators, forecasts and
 * alerts; chart patterns, each drawn as a price path with its levels, the breakout and how it fails.
 */
import type { Lesson } from './chapters';
import { big, chart, check, lesson } from './kit';

// ------------------------------------------------------------------ 4. Indicators, forecasts & alerts
export const INDICATORS_WHAT: Lesson = lesson(
  'indicators-what',
  'What indicators are',
  'Math on price and volume',
  [
    { art: { k: 'averages' }, title: 'Formulas drawn on a chart', text: 'An indicator is a calculation from past prices or volume, drawn on or under the chart: moving averages, RSI, MACD and many more. They summarise what already happened.' },
    { art: big('TREND · MOMENTUM · VOLUME', 'WHAT THEY HELP WITH'), title: 'Why traders use them', text: 'They help answer simple questions faster: is it trending? Is the move strong or tiring? Are many people taking part?' },
    { art: big('LOOKS BACK, NOT AHEAD', ''), title: 'Not a crystal ball', text: 'Every indicator is built from the past, so it lags. It can point to likely behaviour, never promise the future.' },
  ],
  check('Indicators are calculated from…', ['Future prices', 'Past prices and volume', 'Analyst opinions'], 1, 'Indicators are formulas on past prices and volume, so they describe what already happened.'),
  { label: 'Open Indicators on a chart', to: '/markets/SPY' },
);

export const MACD: Lesson = lesson(
  'macd',
  'MACD',
  'Momentum from two averages',
  [
    { art: { k: 'cross' }, title: 'Two averages, one line', text: 'MACD is the gap between a fast (12-day) and a slow (26-day) average. When the fast one pulls away above the slow one, upward momentum is building.' },
    { art: chart([40, 44, 50, 57, 62, 64, 63, 59], { lines: [{ y: 55, label: 'SIGNAL LINE', tone: 'gold', dash: true }], marks: [{ i: 2, label: 'CROSSES UP', tone: 'up', above: false }, { i: 7, label: 'CROSSES DOWN', tone: 'dn' }] }), title: 'The signal line', text: 'A slower signal line is drawn on top. MACD crossing above it is often read as bullish, crossing below as bearish.' },
    { art: chart([40, 60, 45, 70, 50, 72], { title: 'FALSE SIGNALS IN A CHOP' }), title: 'Weak in sideways markets', text: 'When price just chops sideways, MACD crosses back and forth and gives many false signals. It works best when there is a real trend.' },
  ],
  check('MACD crossing above its signal line is usually read as…', ['Bullish: momentum turning up', 'Bearish', 'A guarantee the price will rise'], 0, 'It’s a bullish momentum sign, but like every indicator it can be wrong.'),
  { label: 'Turn on MACD', to: '/markets/AAPL' },
);

export const VOLUME_TOOLS: Lesson = lesson(
  'volume-tools',
  'Volume indicators',
  'Is the crowd behind the move?',
  [
    { art: { k: 'volspike' }, title: 'Volume confirms', text: 'A breakout on two or three times the usual volume shows many traders agree. The same breakout on thin volume is easier to fail.' },
    { art: big('VWAP · OBV', 'TWO COMMON TOOLS'), title: 'VWAP and OBV', text: 'VWAP is the average price paid today, weighted by volume; day traders watch whether price is above or below it. OBV adds volume on up days and subtracts it on down days to show buying or selling pressure.' },
    { art: chart([40, 50, 60, 70, 76, 80], { title: 'PRICE UP, VOLUME FADING', tone: 'up' }), title: 'Fading volume', text: 'Price climbing while volume shrinks can mean fewer buyers are left. It’s a warning to tighten your plan, not an automatic sell.' },
  ],
  check('A stock breaks above resistance on very low volume. That breakout is…', ['Stronger than usual', 'More likely to fail than one on heavy volume', 'Guaranteed to work'], 1, 'Heavy volume shows broad agreement. Thin-volume breakouts fail more often.'),
  { label: 'Look at volume on a chart', to: '/markets/NVDA' },
);

export const COMBINE: Lesson = lesson(
  'combine',
  'Combining indicators',
  'Two that agree beat five that argue',
  [
    { art: big('TREND + MOMENTUM', 'A GOOD PAIR'), title: 'Different jobs', text: 'Pair tools that measure different things: a moving average for the trend and RSI or MACD for momentum. When both agree, the signal is stronger.' },
    { art: big('5 TOOLS = SAME DATA ×5', ''), title: 'Too many is noise', text: 'Many indicators are built from the same prices, so stacking five of them repeats the same information and adds confusion. A clean chart is easier to read.' },
    { art: { k: 'checklist' }, title: 'Keep a short checklist', text: 'Trend direction, a level, momentum, volume. If they line up, the setup is worth a look. If they fight, wait.' },
  ],
  check('What’s the problem with adding many indicators that all use price?', ['They repeat the same information and clutter the chart', 'They make signals certain', 'There is no problem'], 0, 'Most indicators come from the same prices, so more of them mostly adds noise.'),
  { label: 'Tidy your chart', to: '/markets/SPY' },
);

export const FORECASTS: Lesson = lesson(
  'forecasts',
  'Forecasts and price targets',
  'Educated guesses, not promises',
  [
    { art: big('TARGET $250', 'ANALYST · 12 MONTHS'), title: 'What an analyst target is', text: 'Analysts at banks publish price targets: where they think a stock will be in about a year. They’re based on models of future sales and profits.' },
    { art: chart([50, 55, 52, 48, 44, 46], { lines: [{ y: 80, label: 'TARGET', tone: 'up', dash: true }], tone: 'dn' }), title: 'Often wrong', text: 'Targets change all the time and are frequently missed, in both directions. Different analysts often disagree by a lot.' },
    { art: big('ONE INPUT AMONG MANY', ''), title: 'How to use them', text: 'Treat a forecast as one piece of context next to the chart, the trend and your own plan. Never buy only because a target is higher.' },
  ],
  check('An analyst raises a stock’s target to $300. That means…', ['The stock will reach $300', 'One analyst estimates it could; it may not', 'You should buy immediately'], 1, 'A target is an estimate, not a promise. Use it as context, not a trigger.'),
  { label: 'See research on a stock', to: '/markets/AAPL' },
);

export const ALERTS_WHY: Lesson = lesson(
  'alerts-why',
  'Price alerts: let the chart call you',
  'Watch without staring',
  [
    { art: chart([60, 55, 50, 46, 44, 47], { lines: [{ y: 44, label: 'ALERT $200', tone: 'gold', dash: true }], marks: [{ i: 4, label: 'PING!', tone: 'gold', above: false }] }), title: 'A note to yourself', text: 'A price alert tells you when a stock reaches a level you care about. Want Apple at $200? Set an alert at $200 and get on with your day.' },
    { art: { k: 'clock' }, title: 'No more staring', text: 'Watching every tick is tiring and leads to impulsive trades. Alerts let you check in only when something you planned for actually happens.' },
    { art: big('SUPPORT · RESISTANCE · TARGETS', 'GOOD PLACES FOR ALERTS'), title: 'Where to put them', text: 'Near support where you might buy, near resistance where you might take profit, or at a level that would prove you wrong.' },
  ],
  check('You’d like to buy Apple near $200 but want to look at the chart first. What fits best?', ['A market order now', 'A price alert at $200', 'Nothing'], 1, 'An alert lets you watch a level without committing, then decide when it gets there.'),
  { label: 'Draw an alert on a chart', to: '/markets/AAPL' },
);

export const ALERT_VS_ORDER: Lesson = lesson(
  'alert-vs-order',
  'An alert is not an order',
  'Notify vs execute',
  [
    { art: big('ALERT = TELLS YOU', 'ORDER = DOES IT'), title: 'The difference', text: 'An alert only tells you the price got there; nothing is bought or sold. A limit order actually executes at that price if it’s reached.' },
    { art: chart([60, 52, 45, 40, 52, 66], { lines: [{ y: 45, label: '$200', tone: 'gold', dash: true }], marks: [{ i: 3, label: 'DROPPED ON BAD NEWS', tone: 'dn', above: false }] }), title: 'Why choose an alert', text: 'Maybe it reaches $200 because of bad news. With an alert you can look first and decide; an order would have bought automatically.' },
    { art: big('USE BOTH', ''), title: 'Why choose an order', text: 'If you’re sure about the price and won’t be around to act, a limit order makes sure it happens. Many traders use alerts to plan and orders to execute.' },
  ],
  check('Your $200 alert on Apple goes off. Do you own Apple now?', ['Yes, at $200', 'No, an alert only notifies you', 'Only if the market is open'], 1, 'Alerts never trade. You still choose whether to place an order.'),
  { label: 'Alerts in Zelos', to: '/alerts' },
);

// ------------------------------------------------------------------ 5. Chart patterns
const P = (title: string) => ({ title });

export const PAT_HS: Lesson = lesson(
  'pat-hs',
  'Head and shoulders',
  'A top that often ends an uptrend',
  [
    { art: chart([20, 45, 35, 70, 35, 50, 34, 18], { lines: [{ y: 35, label: 'NECKLINE', tone: 'gold', dash: true }], marks: [{ i: 1, label: 'SHOULDER' }, { i: 3, label: 'HEAD' }, { i: 5, label: 'SHOULDER' }], ...P('HEAD AND SHOULDERS') }), title: 'What it looks like', text: 'Three peaks: a left shoulder, a higher head, then a lower right shoulder. The lows between them form the neckline.' },
    { art: chart([20, 45, 35, 70, 35, 50, 34, 18], { lines: [{ y: 35, label: 'NECKLINE', tone: 'gold', dash: true }], marks: [{ i: 7, label: 'BREAKS BELOW: BEARISH', tone: 'dn', above: false }], tone: 'dn' }), title: 'The signal', text: 'Buyers failed to make a new high on the right shoulder. A close below the neckline is the usual confirmation that the uptrend may be over.' },
    { art: chart([20, 45, 35, 70, 35, 50, 34, 55, 68], { lines: [{ y: 35, label: 'NECKLINE HELD', tone: 'gold', dash: true }], marks: [{ i: 8, label: 'FAILED PATTERN', tone: 'up' }], tone: 'up' }), title: 'It can fail', text: 'If the neckline holds and price climbs back above the right shoulder, the pattern has failed. That’s why traders wait for the break.' },
  ],
  check('In a head and shoulders, what usually confirms it?', ['The head forming', 'A close below the neckline', 'Any red candle'], 1, 'The break of the neckline is the confirmation. Before that it’s only a possible pattern.'),
  { label: 'Draw a pattern on a chart', to: '/markets/SPY' },
);

export const PAT_IHS: Lesson = lesson(
  'pat-ihs',
  'Inverse head and shoulders',
  'The bottom version',
  [
    { art: chart([80, 55, 65, 30, 65, 50, 66, 82], { lines: [{ y: 65, label: 'NECKLINE', tone: 'gold', dash: true }], marks: [{ i: 1, label: 'SHOULDER', above: false }, { i: 3, label: 'HEAD', above: false }, { i: 5, label: 'SHOULDER', above: false }], ...P('INVERSE HEAD AND SHOULDERS') }), title: 'Upside down', text: 'Three lows: a shoulder, a deeper head, then a higher shoulder. It often appears after a downtrend.' },
    { art: chart([80, 55, 65, 30, 65, 50, 66, 82], { lines: [{ y: 65, label: 'NECKLINE', tone: 'gold', dash: true }], marks: [{ i: 7, label: 'BREAKOUT: BULLISH', tone: 'up' }], tone: 'up' }), title: 'Bullish when it breaks', text: 'Sellers couldn’t push to a new low on the right shoulder. A close above the neckline, ideally on rising volume, is the usual bullish confirmation.' },
    { art: big('WAIT FOR THE BREAK', 'THEN PLAN THE STOP'), title: 'A common plan', text: 'Traders often enter on the neckline break with a stop below the right shoulder. If price falls back under the neckline, the idea is in trouble.' },
  ],
  check('An inverse head and shoulders breaking above its neckline is usually read as…', ['Bullish', 'Bearish', 'Meaningless'], 0, 'It’s the bottoming version of the pattern, so a breakout is read as bullish.'),
  { label: 'Practice on a chart', to: '/markets/QQQ' },
);

export const PAT_DOUBLE: Lesson = lesson(
  'pat-double',
  'Double tops and double bottoms',
  'Two tries at the same level',
  [
    { art: chart([25, 50, 75, 55, 74, 52, 30], { lines: [{ y: 75, label: 'SAME HIGH TWICE', tone: 'dn', dash: true }, { y: 52, label: 'CONFIRMS BELOW', tone: 'gold', dash: true }], marks: [{ i: 2, label: 'TOP 1' }, { i: 4, label: 'TOP 2' }], tone: 'dn' }), title: 'Double top', text: 'Price hits the same high twice and fails. Falling below the low between the peaks confirms it, which is bearish.' },
    { art: chart([75, 50, 25, 45, 26, 48, 70], { lines: [{ y: 25, label: 'SAME LOW TWICE', tone: 'up', dash: true }, { y: 48, label: 'CONFIRMS ABOVE', tone: 'gold', dash: true }], marks: [{ i: 2, label: 'BOTTOM 1', above: false }, { i: 4, label: 'BOTTOM 2', above: false }], tone: 'up' }), title: 'Double bottom', text: 'Price drops to the same low twice and holds. Rising above the high between them confirms it, which is bullish.' },
    { art: chart([25, 50, 75, 55, 74, 56, 85], { lines: [{ y: 75, label: 'BROKE THROUGH', tone: 'up', dash: true }], tone: 'up' }), title: 'Not until it confirms', text: 'Two touches alone are just a range. If price instead breaks through the double top, the pattern has failed, and that can be bullish.' },
  ],
  check('A double bottom is confirmed when price…', ['Touches the low a second time', 'Rises above the high between the two lows', 'Goes sideways'], 1, 'The confirmation is the break above the middle high; the second touch alone isn’t enough.'),
  { label: 'Look for one on a chart', to: '/markets/AAPL' },
);

export const PAT_TRIPLE: Lesson = lesson(
  'pat-triple',
  'Triple tops and bottoms',
  'Three tries, same idea',
  [
    { art: chart([30, 70, 50, 71, 49, 70, 48, 28], { lines: [{ y: 70, label: 'RESISTANCE ×3', tone: 'dn', dash: true }, { y: 48, label: 'SUPPORT', tone: 'gold', dash: true }], tone: 'dn' }), title: 'Triple top', text: 'Three failed attempts at the same high. A break below the support underneath is read as bearish.' },
    { art: chart([70, 30, 50, 29, 51, 30, 52, 74], { lines: [{ y: 30, label: 'SUPPORT ×3', tone: 'up', dash: true }, { y: 52, label: 'RESISTANCE', tone: 'gold', dash: true }], tone: 'up' }), title: 'Triple bottom', text: 'Three holds at the same low. A break above the resistance on top is read as bullish.' },
    { art: big('MORE TOUCHES = MORE ATTENTION', ''), title: 'Why it matters', text: 'Every touch shows more traders defending that level, so a break of it can bring a stronger move. But levels do give way eventually, sometimes sooner than expected.' },
  ],
  check('A triple bottom breaks above its resistance. Traders usually read that as…', ['Bullish', 'Bearish', 'A sign to remove all stops'], 0, 'It shows sellers failed three times and buyers finally took over, a bullish read.'),
  { label: 'Draw levels on a chart', to: '/markets/MSFT' },
);

export const PAT_TRIANGLES: Lesson = lesson(
  'pat-triangles',
  'Triangles',
  'Ascending, descending and symmetrical',
  [
    { art: chart([30, 70, 42, 70, 52, 70, 60, 70, 86], { lines: [{ y: 70, label: 'FLAT TOP', tone: 'gold', dash: true }], marks: [{ i: 8, label: 'BREAKOUT', tone: 'up' }], tone: 'up', ...P('ASCENDING') }), title: 'Ascending: rising lows', text: 'A flat ceiling with higher and higher lows. Buyers keep stepping in earlier, so it often breaks up.' },
    { art: chart([70, 30, 58, 30, 48, 30, 40, 30, 14], { lines: [{ y: 30, label: 'FLAT FLOOR', tone: 'gold', dash: true }], marks: [{ i: 8, label: 'BREAKDOWN', tone: 'dn', above: false }], tone: 'dn', ...P('DESCENDING') }), title: 'Descending: falling highs', text: 'A flat floor with lower and lower highs. Sellers keep pressing, so it often breaks down.' },
    { art: chart([20, 80, 30, 70, 40, 60, 48, 54, 50], { ...P('SYMMETRICAL') }), title: 'Symmetrical: squeezing', text: 'Lower highs and higher lows squeeze together. It can break either way, so traders wait for the breakout and its volume before choosing a side.' },
  ],
  check('Which triangle has a flat top and rising lows?', ['Ascending', 'Descending', 'Symmetrical'], 0, 'An ascending triangle has a flat ceiling and higher lows, and is often read as bullish.'),
  { label: 'Spot one on a chart', to: '/markets/NVDA' },
);

export const PAT_FLAGS: Lesson = lesson(
  'pat-flags',
  'Bull flags and bear flags',
  'A pause in a strong move',
  [
    { art: chart([20, 40, 62, 80, 76, 72, 74, 70, 72, 92], { marks: [{ i: 3, label: 'POLE', tone: 'up' }, { i: 6, label: 'FLAG', above: false }, { i: 9, label: 'CONTINUES', tone: 'up' }], tone: 'up', ...P('BULL FLAG') }), title: 'Bull flag', text: 'A sharp rise (the pole), then a small, gentle drift down or sideways (the flag). A break above the flag often continues the move up.' },
    { art: chart([80, 60, 40, 22, 26, 30, 28, 32, 28, 10], { marks: [{ i: 3, label: 'POLE', tone: 'dn', above: false }, { i: 6, label: 'FLAG' }, { i: 9, label: 'CONTINUES', tone: 'dn', above: false }], tone: 'dn', ...P('BEAR FLAG') }), title: 'Bear flag', text: 'A sharp drop, then a small drift up. A break below the flag often continues the move down.' },
    { art: big('SHORT, ORDERLY, LIGHT VOLUME', 'A HEALTHY FLAG'), title: 'What a good flag looks like', text: 'The flag should be short and tidy, on lighter volume than the pole. A deep, messy pullback is less a flag and more a change of trend.' },
  ],
  check('A bull flag is a…', ['Pause after a sharp rise that often continues upward', 'Sign of a crash', 'Pattern that only forms on weekends'], 0, 'A bull flag is a brief pause in a strong uptrend; a break above it often continues the move.'),
  { label: 'Find a flag on a chart', to: '/markets/AMD' },
);

export const PAT_WEDGES: Lesson = lesson(
  'pat-wedges',
  'Wedges',
  'Slanted and squeezing',
  [
    { art: chart([20, 40, 32, 52, 46, 60, 56, 64, 40], { marks: [{ i: 8, label: 'BREAKS DOWN', tone: 'dn', above: false }], tone: 'dn', ...P('RISING WEDGE') }), title: 'Rising wedge', text: 'Price climbs, but each push is smaller and the lines converge. It shows buyers tiring and is often read as bearish when it breaks down.' },
    { art: chart([80, 60, 68, 48, 54, 40, 44, 36, 62], { marks: [{ i: 8, label: 'BREAKS UP', tone: 'up' }], tone: 'up', ...P('FALLING WEDGE') }), title: 'Falling wedge', text: 'Price falls, but each drop is smaller and the lines converge. It’s often read as bullish when it breaks up.' },
    { art: big('LOSING STEAM', 'WHAT A WEDGE SHOWS'), title: 'The idea', text: 'A wedge shows the current move losing strength. As always, the break is the signal, and wedges can run longer than expected.' },
  ],
  check('A rising wedge is usually read as…', ['Bullish', 'Bearish when it breaks down', 'Neutral forever'], 1, 'Rising wedges show buyers tiring; a break down is the usual bearish confirmation.'),
  { label: 'Practice drawing one', to: '/markets/META' },
);

export const PAT_CUP: Lesson = lesson(
  'pat-cup',
  'Cup and handle',
  'A rounded base, then a small dip',
  [
    { art: chart([70, 55, 42, 35, 34, 38, 48, 62, 70, 64, 62, 66, 84], { lines: [{ y: 70, label: 'RIM', tone: 'gold', dash: true }], marks: [{ i: 4, label: 'CUP', above: false }, { i: 10, label: 'HANDLE', above: false }, { i: 12, label: 'BREAKOUT', tone: 'up' }], tone: 'up', ...P('CUP AND HANDLE') }), title: 'What it looks like', text: 'A smooth, rounded U-shaped base back up to the old high (the cup), a small pullback (the handle), then a push through the rim.' },
    { art: big('ROUNDED, NOT V', 'SLOW AND STEADY BASE'), title: 'What traders look for', text: 'A rounded bottom shows sellers gradually giving up. A shallow handle on light volume and a breakout on strong volume make it more convincing.' },
    { art: chart([70, 55, 42, 35, 34, 38, 48, 62, 70, 64, 50, 40], { lines: [{ y: 70, label: 'RIM', tone: 'gold', dash: true }], marks: [{ i: 11, label: 'HANDLE TOO DEEP', tone: 'dn', above: false }], tone: 'dn' }), title: 'When it fails', text: 'If the handle drops deep into the cup, or the breakout fades back under the rim, the pattern has failed.' },
  ],
  check('In a cup and handle, the breakout is through…', ['The bottom of the cup', 'The rim (the old high)', 'The handle’s low'], 1, 'The bullish signal is the push through the rim after the handle.'),
  { label: 'Look for a base', to: '/markets/AMZN' },
);

export const PAT_CONFIRM: Lesson = lesson(
  'pat-confirm',
  'Confirmation, breakouts and failed patterns',
  'Patterns are odds, not promises',
  [
    { art: chart([40, 60, 45, 60, 50, 60, 64, 70], { lines: [{ y: 60, label: 'LEVEL', tone: 'gold', dash: true }], marks: [{ i: 6, label: 'CLOSE ABOVE + VOLUME', tone: 'up' }], tone: 'up' }), title: 'Confirmation', text: 'Most traders wait for a close beyond the key level, often with higher volume, before treating a pattern as real. Acting early catches more moves but also more failures.' },
    { art: chart([40, 60, 45, 60, 52, 64, 55, 46], { lines: [{ y: 60, label: 'LEVEL', tone: 'gold', dash: true }], marks: [{ i: 5, label: 'BREAKOUT…', tone: 'up' }, { i: 7, label: '…FAILED', tone: 'dn', above: false }], tone: 'dn' }), title: 'False breakouts', text: 'Price pokes through a level and snaps back: a false breakout. A stop just on the other side of the level keeps the damage small.' },
    { art: big('PLAN · STOP · SIZE', 'EVEN FOR “PERFECT” PATTERNS'), title: 'Always have a plan', text: 'No pattern works every time. Treat each one as a setup with an entry, a stop and a size, never as a sure thing.' },
  ],
  check('A breakout pushes above resistance, then quickly falls back below it. That’s called…', ['A confirmed breakout', 'A false breakout', 'A dividend'], 1, 'When price breaks a level and snaps back, it’s a false breakout. A stop limits the cost.'),
  { label: 'Grade some setups', to: '/training' },
);
