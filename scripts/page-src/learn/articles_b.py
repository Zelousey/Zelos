# Learn articles, part 2.

ARTICLES = [
{
 'slug': 'how-to-find-stocks-before-a-breakout',
 'title': 'How to Find Stocks Before a Breakout',
 'seo_title': 'How to Find Stocks Before They Break Out: Bases, Tightening & Volume Dry-Up | Zelos',
 'desc': 'Stocks usually telegraph breakouts with a tightening base, higher lows, and volume drying up under resistance. Here is how to spot those signs and build a watchlist.',
 'strategy': 'breakout',
 'game': ('grade-the-setup', 'Train your eye on real chart structure'),
 'body': '''
<p class="lede">Nobody can predict exactly when a stock will break out. But stocks that are about to break out often look similar beforehand: a tightening range, higher lows, and quiet volume right under a clear ceiling. The goal isn't to guess the day; it's to have the stock on your watchlist with the level marked before it happens.</p>

<h2>Sign 1: A clear, tested ceiling</h2>
<p>You want a resistance level that price has tagged at least two or three times over several weeks. A clean, horizontal level is easier to trade because everyone can see it, and the breakout above it is unambiguous.</p>

<h2>Sign 2: Volatility contraction</h2>
<p>Each pullback inside the base gets shallower. For example: a 15% dip, then 8%, then 4%. That shrinking range means sellers are running out of stock to sell at lower prices. Traders call this a volatility contraction or a tightening base. A falling ATR while price holds near highs is a simple way to measure it.</p>

<h2>Sign 3: Higher lows</h2>
<p>If the ceiling is flat and the lows are rising, you get an ascending triangle. Buyers are willing to pay a little more on each dip, and the space between support and resistance keeps narrowing until something gives.</p>

<h2>Sign 4: Volume drying up</h2>
<p>In the final days before a breakout, volume often falls well below average. It sounds backwards, but it means there is little selling pressure left in the range. The breakout itself should then come with a sharp increase in volume.</p>

<h2>Sign 5: Strength against the market</h2>
<p>A stock that holds near its highs while the market pulls back is showing relative strength. When the market turns up, those are often the first names to break out.</p>

<h2>Building a pre-breakout watchlist</h2>
<ol>
<li>Start with a momentum list: stocks above rising 50-day averages, within about 10% of their highs.</li>
<li>Keep only those that have moved sideways for at least three weeks.</li>
<li>Mark the resistance level on each chart and set a price alert just above it.</li>
<li>Prefer bases where the most recent pullback is the smallest and volume is quiet.</li>
<li>When an alert fires, check volume and the close before acting. See <a href="how-to-trade-breakouts.html">how to trade breakouts</a>.</li>
</ol>

<h2>What doesn't count</h2>
<ul>
<li>A stock that has already run 30% in a week isn't "before a breakout"; it's after one.</li>
<li>A wide, sloppy range where the swings are getting bigger is a sign of disagreement, not coiling.</li>
<li>A base under a falling 50-day average is more often a pause in a downtrend.</li>
</ul>

<h2>How Zelos uses it</h2>
<p>Breakout Rider screens for exactly this structure: stocks consolidating in a tight range under clear resistance. It scores base tightness and resistance strength before the break, then volume and follow-through on the break itself.</p>
''',
 'faq': [
  ('Can you predict a breakout?', 'Not the exact timing or outcome. You can identify stocks whose structure (tight base, higher lows, quiet volume under resistance) has historically preceded breakouts, and be ready with a plan.'),
  ('What is a volatility contraction pattern?', 'A base in which each successive pullback is smaller than the last, showing supply drying up. It is a popular way to describe the tightening that often precedes breakouts.'),
  ('How long should a base be?', 'For swing trading on daily charts, bases of about three weeks to a few months are typical. Very short bases are less reliable.'),
 ],
 'related': ['how-to-trade-breakouts', 'what-is-a-breakout-retest', 'how-to-scan-stocks-for-momentum', 'how-to-identify-a-bull-flag'],
},
{
 'slug': 'how-does-an-ai-stock-scanner-work',
 'title': 'How Does an AI Stock Scanner Work?',
 'seo_title': 'How Does an AI Stock Scanner Work? Rules, Scoring & What AI Actually Adds | Zelos',
 'desc': 'An AI stock scanner pulls market data, applies screening rules, scores setups and explains the result. Here is what each step does, where AI helps, and what it cannot do.',
 'strategy': 'swing',
 'game': ('grade-the-setup', 'Run the same checklist yourself on real charts'),
 'body': '''
<p class="lede">"AI stock scanner" covers a lot of different products. Some are traditional screeners with a chatbot on top; some are black-box prediction models. A useful way to understand any of them is to break the process into steps and ask which steps are rules, which are models, and which are explained.</p>

<h2>The five steps of a scan</h2>
<ol>
<li><b>Data.</b> Prices, volume, and sometimes fundamentals, news and options data, pulled for a universe of stocks. Quality and freshness of this data limit everything downstream.</li>
<li><b>Filtering.</b> Hard rules remove stocks that can't qualify: too illiquid, too cheap, no trend, earnings tomorrow.</li>
<li><b>Pattern detection.</b> Finding specific structures such as pullbacks to a moving average, flags, or bases under resistance. This can be pure rules (price within 3% of the 20-day average) or a trained model that recognizes shapes.</li>
<li><b>Scoring.</b> Each candidate is graded on several factors and ranked. The scoring can be a transparent points system or a model's probability output.</li>
<li><b>Output.</b> An alert or a list, ideally with the entry, stop, target and the reasons it qualified.</li>
</ol>

<h2>Where AI actually helps</h2>
<ul>
<li><b>Running the process on its own.</b> An AI agent can run the scan on a schedule, apply every rule every time, and publish the result without a person clicking through charts. Consistency is a real edge; humans skip steps when they're tired or excited.</li>
<li><b>Explaining.</b> Language models are good at turning a score into a plain-language explanation: why this setup, what would invalidate it, what to watch.</li>
<li><b>Reading unstructured data.</b> Summarizing news or filings that a numeric screener can't read.</li>
</ul>

<h2>What AI can't do</h2>
<ul>
<li>It can't know the future. Every scan, AI or not, is identifying setups with historically favorable odds, not certainties.</li>
<li>A model trained on past price patterns can find relationships that don't hold going forward. The more complex and opaque the model, the harder that is to check.</li>
<li>It can't fix bad data or a bad rule set. If the rules are loose, a smarter wrapper just produces confident-sounding noise faster.</li>
</ul>

<h2>Questions to ask any AI scanner</h2>
<table>
<tr><th>Question</th><th>Why it matters</th></tr>
<tr><td>What are the rules?</td><td>If nobody can tell you, you can't judge when it should work</td></tr>
<tr><td>Is there a public track record, including losers?</td><td>Cherry-picked winners are easy to show</td></tr>
<tr><td>Does every alert include a stop?</td><td>A signal with no exit plan isn't a trade plan</td></tr>
<tr><td>Does it touch your account?</td><td>Tools that place orders carry very different risks from tools that publish information</td></tr>
</table>

<h2>How Zelos works</h2>
<p>Zelos is an agent that applies a fixed, written rule set on a schedule: standard indicators, a points-based score out of 80, and a published alert only when a setup clears the bar. It never connects to a brokerage account or places orders. Every alert and its outcome is listed on the <a href="../alert-history.html">alert history</a> page, and the <a href="../ai-knowledge-catalog.html">knowledge catalog</a> documents the scoring.</p>
''',
 'faq': [
  ('Are AI stock scanners accurate?', 'Accuracy depends on the rules and data behind them, not the label. Look for a public, complete track record and clear rules before trusting any scanner.'),
  ('Is an AI stock scanner the same as an AI trading bot?', 'No. A scanner finds and publishes setups; a trading bot places orders in an account. Zelos is a scanner and never places orders.'),
  ('Do AI scanners use machine learning?', 'Some do, some are rule-based systems run by an AI agent. Rule-based systems are easier to understand and audit; machine-learning models can capture more complex patterns but are harder to verify.'),
 ],
 'related': ['ai-stock-screener-vs-traditional-screener', 'how-to-scan-stocks-for-momentum', 'best-indicators-for-swing-trading', 'what-is-an-options-scanner'],
},
{
 'slug': 'ai-stock-screener-vs-traditional-screener',
 'title': 'AI Stock Screener vs. Traditional Stock Screener',
 'seo_title': 'AI Stock Screener vs Traditional Stock Screener: Real Differences | Zelos',
 'desc': 'A side-by-side comparison of AI stock screeners and traditional filter-based screeners: how each works, what each is good at, and how to pick.',
 'strategy': 'swing',
 'game': ('chart-replay', 'Test your own judgment in Chart Replay'),
 'body': '''
<p class="lede">A traditional stock screener filters a list of stocks by conditions you set. An AI stock screener adds some combination of automation, pattern recognition, ranking and plain-language explanation. The right choice depends on whether your bottleneck is finding candidates or doing the analysis consistently.</p>

<h2>The comparison</h2>
<table>
<tr><th></th><th>Traditional screener</th><th>AI screener</th></tr>
<tr><td>Input</td><td>Filters you choose (price, volume, P/E, moving averages)</td><td>A goal or strategy, sometimes in plain language</td></tr>
<tr><td>Output</td><td>A list of matches, unranked or sorted by one column</td><td>Ranked setups, often with entry, stop and reasoning</td></tr>
<tr><td>Patterns</td><td>Only what can be written as a filter</td><td>Can detect chart structures (bases, flags) directly</td></tr>
<tr><td>Consistency</td><td>As consistent as the person reviewing the list</td><td>Applies the same process every run</td></tr>
<tr><td>Transparency</td><td>Fully transparent: you set every rule</td><td>Varies widely: from written rules to black boxes</td></tr>
<tr><td>Effort</td><td>You review every chart</td><td>Reviewing a shortlist with explanations</td></tr>
</table>

<h2>When a traditional screener is enough</h2>
<p>If you enjoy chart work, have time every day, and mostly need a list of candidates, a free screener with a few good filters is hard to beat. A setup like "above a rising 50-day average, within 3% of the 20-day, volume above one million" gets you a manageable list. The analysis is still yours.</p>

<h2>When an AI screener helps</h2>
<ul>
<li>You want the full process (filter, pattern, score, plan) done the same way every day, including on days you're busy.</li>
<li>You want the stop and target defined up front, not after you've fallen for a chart.</li>
<li>You want to understand why something qualified, in words.</li>
</ul>

<h2>Red flags in either</h2>
<ul>
<li>Backtests with no out-of-sample or live results.</li>
<li>"Accuracy" claims without a list of every signal and outcome.</li>
<li>Signals with no stop-loss.</li>
<li>For AI tools: no explanation of what the model is actually doing.</li>
</ul>

<h2>A middle path</h2>
<p>Many traders use both: a traditional screener to explore ideas, and a rule-based automated scan to enforce discipline on the setups they actually trade. The key is knowing the rules either way. Try applying a checklist yourself in <a href="../games/grade-the-setup.html">Grade the Setup</a> and you'll quickly see how much consistency matters.</p>

<h2>Where Zelos fits</h2>
<p>Zelos sits at the transparent end of the AI category: an agent running a fixed, documented rule set built from standard indicators, publishing one alert when something qualifies, with a public record of every outcome. It doesn't connect to your account and doesn't place trades.</p>
''',
 'faq': [
  ('Are AI stock screeners better than traditional screeners?', 'Not automatically. They can save time and enforce consistency, but a transparent traditional screen with good rules beats an opaque AI tool with loose ones.'),
  ('Are there free AI stock screeners?', 'Some brokers and charting sites include AI features for free, usually as a layer over a traditional screener. Automated, scheduled scanning with published alerts is more often a paid product.'),
  ('Can I build my own AI screener?', 'Yes. The simplest version is a written rule set plus an agent or script that runs it on a schedule and reports matches with reasoning.'),
 ],
 'related': ['how-does-an-ai-stock-scanner-work', 'how-to-scan-stocks-for-momentum', 'best-indicators-for-swing-trading', 'what-is-an-options-scanner'],
},
{
 'slug': 'what-is-reward-to-risk-ratio',
 'title': 'What Is the Reward-to-Risk Ratio?',
 'seo_title': 'What Is the Reward-to-Risk Ratio? Formula, Examples & Win-Rate Math | Zelos',
 'desc': 'The reward-to-risk ratio compares what a trade could make with what it could lose. Learn the formula, why 2:1 is a common minimum, and how it connects to win rate.',
 'strategy': 'swing',
 'game': ('chart-replay', 'Practice planning R:R in Chart Replay'),
 'body': '''
<p class="lede">The reward-to-risk ratio (also written R:R, or risk-reward) compares how much a trade could make if it reaches its target with how much it would lose if it hits its stop. It's decided before you enter, and it's one of the few things in trading you fully control.</p>

<h2>The formula</h2>
<p><b>Reward-to-risk = (target &minus; entry) &divide; (entry &minus; stop)</b> for a long trade.</p>
<p>Example: buy at $50, stop at $48, target at $56. Risk is $2, reward is $6, so the ratio is 3:1.</p>

<h2>Why it matters: the win-rate math</h2>
<p>The ratio sets how often you need to be right to break even (before costs):</p>
<table>
<tr><th>Reward:risk</th><th>Break-even win rate</th></tr>
<tr><td>1:1</td><td>50%</td></tr>
<tr><td>1.5:1</td><td>40%</td></tr>
<tr><td>2:1</td><td>33%</td></tr>
<tr><td>3:1</td><td>25%</td></tr>
</table>
<p>The break-even win rate is 1 &divide; (1 + ratio). A trader taking 2:1 trades who wins 45% of the time is profitable; one taking 1:1 trades with the same hit rate is not. That's why many strategies set 2:1 as a minimum.</p>

<h2>Thinking in R</h2>
<p>Traders often describe results in "R," one unit of planned risk. If you risk $200 per trade, a +2R trade makes $400 and a &minus;1R trade loses $200. Measuring in R makes results comparable across different stocks and position sizes, and it exposes problems quickly: if your average loss is &minus;1.6R, you're letting stops slip.</p>

<h2>The catch</h2>
<p>A high ratio is easy to manufacture on paper by placing the stop very tight or the target very far away. Both make the ratio look better and the trade worse:</p>
<ul>
<li>A stop inside normal daily noise gets hit more often, so the real win rate collapses.</li>
<li>A target beyond any realistic level rarely gets reached.</li>
</ul>
<p>The ratio only means something when the stop sits where the setup is actually invalidated and the target sits at a level price has a real reason to reach, like a prior high.</p>

<h2>From ratio to position size</h2>
<p>R:R tells you whether a trade is worth taking; position size tells you how much. A common approach is fixed-fractional sizing: decide what fraction of your account you'll risk per trade (many use 0.5&ndash;2%), then divide that dollar amount by the distance to your stop. That's general math, not advice for your situation.</p>

<h2>How Zelos uses it</h2>
<p>Reward-to-risk is a scored component of every Zelos strategy, and every alert shows its entry, stop, target and ratio. You can practice building trades with a planned ratio in <a href="../games/chart-replay.html">Chart Replay</a>, which scores you in R.</p>
''',
 'faq': [
  ('What is a good reward-to-risk ratio?', 'Many swing traders use 2:1 as a minimum, which means you break even winning only a third of the time. What is good ultimately depends on your real win rate with realistic stops and targets.'),
  ('Is risk-reward the same as reward-to-risk?', 'They describe the same comparison written in opposite orders. A 1:3 risk-reward is the same as a 3:1 reward-to-risk.'),
  ('Should I ever take a trade under 1:1?', 'Only if the strategy has a genuinely high win rate. For most swing setups, trades under about 1.5:1 require being right too often to be worth it.'),
 ],
 'related': ['how-to-use-stop-losses-in-swing-trading', 'what-is-a-pullback-trading-strategy', 'how-to-trade-breakouts', 'best-indicators-for-swing-trading'],
},
{
 'slug': 'how-to-use-stop-losses-in-swing-trading',
 'title': 'How to Use Stop-Losses in Swing Trading',
 'seo_title': 'How to Use Stop-Losses in Swing Trading: Placement, Sizing & Gaps | Zelos',
 'desc': 'Where to put a stop-loss on a swing trade, how to size around it, why stops get hit by noise, and how gaps and trailing stops change the picture.',
 'strategy': 'swing',
 'game': ('stop-drill', 'Place stops on real charts in Where\'s the Stop?'),
 'body': '''
<p class="lede">A stop-loss is the price at which you accept a trade idea was wrong and exit. In swing trading it does two jobs: it caps the loss on any single trade, and it tells you how big the position can be. Getting the placement right matters more than almost any entry trick.</p>

<h2>Rule 1: Put the stop where the idea is wrong</h2>
<p>A good stop isn't a round number or a fixed percentage. It's a level that, if broken, means the setup no longer exists:</p>
<ul>
<li>For a <a href="what-is-a-pullback-trading-strategy.html">pullback</a>: just below the swing low of the dip.</li>
<li>For a <a href="how-to-trade-breakouts.html">breakout</a>: back inside the old range, below the breakout level or the last higher low in the base.</li>
<li>For a <a href="how-to-identify-a-bull-flag.html">bull flag</a>: below the low of the flag.</li>
</ul>

<h2>Rule 2: Stay outside the noise</h2>
<p>Every stock wiggles. The Average True Range (ATR) tells you how much on a normal day. A stop closer than about one ATR to your entry is likely to get hit by ordinary movement even if you're right about direction. Adding a small buffer below the structural level (a fraction of ATR) helps, because levels get undercut briefly all the time.</p>

<h2>Rule 3: Size the position from the stop</h2>
<p>Decide the dollar amount you're willing to lose if the stop is hit, then work backward:</p>
<p><b>Shares = dollar risk &divide; (entry &minus; stop)</b></p>
<p>With $200 of risk, an entry at $50 and a stop at $47, that's about 66 shares. A wider stop means fewer shares, not more risk. This is why placing the stop by structure doesn't make the trade riskier; it just changes the size.</p>

<h2>Rule 4: Never widen it</h2>
<p>Moving a stop further away once price approaches it turns a planned small loss into an unplanned big one. Tightening a stop as the trade works is fine. Widening it is the most common way traders blow up an otherwise sound approach.</p>

<h2>Gaps: when stops don't fill at your price</h2>
<p>A stop order becomes a market order when triggered. If a stock closes at $50 with a stop at $48 and opens the next morning at $44 on bad news, the fill will be near $44. Swing traders hold overnight, so gap risk is part of the job. Ways to manage it: avoid holding through earnings, keep position sizes modest, and expect the occasional loss bigger than 1R.</p>

<h2>Trailing stops</h2>
<p>Once a trade moves in your favor, you can raise the stop to lock in part of the gain: to break-even after a 1R move, or under each new higher swing low. Trailing too tightly gets you shaken out of good trends; trailing by structure (swing lows, or a rising moving average) gives the trade room.</p>

<h2>Checklist</h2>
<table>
<tr><th>Question</th><th>Good answer</th></tr>
<tr><td>Why is the stop there?</td><td>Below the level that invalidates the setup</td></tr>
<tr><td>Is it outside normal noise?</td><td>At least about one ATR from entry</td></tr>
<tr><td>Is the position sized to it?</td><td>Hitting it costs only the planned dollar risk</td></tr>
<tr><td>Is there room for a target?</td><td>Target at least about 2&times; the stop distance</td></tr>
</table>

<h2>How Zelos uses it</h2>
<p>Every Zelos alert includes a stop, and the alert history records whether each alert hit its target or its stop. Practice placement on real charts in <a href="../games/stop-drill.html">Where's the Stop?</a></p>
''',
 'faq': [
  ('What percentage should a stop-loss be?', 'A fixed percentage ignores the chart and the stock\'s volatility. It is better to place the stop by structure and then size the position so that hitting it costs a fixed, acceptable amount.'),
  ('Should I use a stop-loss order or a mental stop?', 'A resting stop order executes even if you are away, which is why many swing traders prefer it. Mental stops rely on discipline at exactly the moment it is hardest.'),
  ('Why do my stops always get hit before the stock goes up?', 'Usually because they are inside normal daily noise or placed exactly at an obvious level. Placing stops a buffer below real structure and at least about one ATR away usually helps.'),
 ],
 'related': ['what-is-reward-to-risk-ratio', 'how-to-find-stocks-near-support', 'best-indicators-for-swing-trading', 'what-is-a-pullback-trading-strategy'],
},
{
 'slug': 'how-to-find-options-with-30-45-dte',
 'title': 'How to Find Options With 30–45 DTE',
 'seo_title': 'How to Find Options With 30–45 DTE (and Why Swing Traders Use That Window) | Zelos',
 'desc': 'DTE means days to expiration. Here is why many swing traders buy calls and puts 30 to 45 days out, how to find those contracts in an option chain, and what to check.',
 'strategy': 'options',
 'game': None,
 'body': '''
<p class="lede">DTE stands for days to expiration: how many calendar days are left before an option contract expires. Many swing traders who buy calls or puts look at the 30&ndash;45 DTE window because it balances cost against time decay for trades expected to last a few days to a few weeks.</p>

<h2>Why 30&ndash;45 days</h2>
<p>An option's time value shrinks as expiration approaches, and the shrinkage (theta decay) speeds up in the final weeks. That creates a trade-off:</p>
<table>
<tr><th>Expiration</th><th>Cost</th><th>Time decay</th><th>Fit for a 1&ndash;3 week swing</th></tr>
<tr><td>Weekly / under 14 DTE</td><td>Cheapest</td><td>Fastest; the clock is the enemy</td><td>Poor: small delays can wipe out the premium</td></tr>
<tr><td>30&ndash;45 DTE</td><td>Moderate</td><td>Moderate</td><td>Good: room for the move, exit before decay accelerates</td></tr>
<tr><td>90+ DTE</td><td>Most expensive</td><td>Slow</td><td>Workable, but more capital for the same move</td></tr>
</table>
<p>The idea is to buy enough time that the thesis can play out, then exit well before the last two or three weeks, when decay is steepest.</p>

<h2>Finding them in an option chain</h2>
<ol>
<li>Open the option chain for the stock and look at the list of expiration dates.</li>
<li>Count calendar days from today to each date and pick the one that falls between 30 and 45 days. Standard monthly options expire on the third Friday of the month, so there's usually at least one in range.</li>
<li>Choose calls for a bullish view, puts for a bearish one.</li>
<li>Pick a strike. Near the money (at-the-money or roughly one strike out) is a common middle ground between cost and responsiveness.</li>
</ol>

<h2>What to check before choosing a contract</h2>
<ul>
<li><b>Liquidity.</b> Open interest in at least the hundreds and meaningful daily volume.</li>
<li><b>Bid-ask spread.</b> A wide spread is a hidden cost you pay on the way in and again on the way out. Tight spreads relative to the option's price are a sign of a healthy market.</li>
<li><b>Implied volatility.</b> If IV is unusually high, you're paying a lot for the option. That often happens before earnings, and it can drop sharply afterward (IV crush) even if the stock moves your way.</li>
<li><b>Earnings date.</b> Know whether an earnings report falls inside your holding period.</li>
<li><b>Delta.</b> Roughly how much the option moves for a $1 move in the stock. Near-the-money options usually have deltas around 0.4&ndash;0.6.</li>
</ul>

<h2>Risks to understand</h2>
<p>A long call or put can lose its entire premium, even if the stock eventually moves in your direction, if the move comes too late or is too small. Options also carry risks that stocks don't, including time decay and volatility changes. Review the Options Disclosure Document from your broker before trading them.</p>

<h2>How Zelos uses it</h2>
<p>Options Scanner takes directional setups that clear Zelos's equity rules and expresses them as a single long call or put, using the 30&ndash;45 DTE window and a strike near the money. It never uses spreads, short options, 0DTE or weeklies, and it never places orders.</p>
''',
 'faq': [
  ('What does DTE mean in options?', 'Days to expiration: the number of calendar days until the option contract expires.'),
  ('Why not buy weekly options?', 'Weekly options are cheap but lose time value very quickly. For trades expected to take a week or more, small delays in the move can erase most of the premium.'),
  ('When should I exit a 30–45 DTE option?', 'Many traders plan to exit on their target, their stop on the underlying, or with around 14–21 days left, whichever comes first, to avoid the steepest part of time decay. That is a common convention, not a rule.'),
 ],
 'related': ['what-is-an-options-scanner', 'what-is-reward-to-risk-ratio', 'how-to-trade-breakouts', 'how-does-an-ai-stock-scanner-work'],
},
{
 'slug': 'what-is-an-options-scanner',
 'title': 'What Is an Options Scanner?',
 'seo_title': 'What Is an Options Scanner? Types, Filters & How to Use One | Zelos',
 'desc': 'An options scanner filters thousands of option contracts or underlying setups to find trade candidates. Learn the main types, useful filters, and common traps.',
 'strategy': 'options',
 'game': None,
 'body': '''
<p class="lede">An options scanner searches across thousands of option contracts, or the stocks underneath them, and returns the ones that match a set of conditions. Because a single stock can have hundreds of contracts across strikes and expirations, some kind of filtering is almost required.</p>

<h2>Three kinds of options scanners</h2>
<table>
<tr><th>Type</th><th>What it looks for</th><th>Good for</th></tr>
<tr><td>Flow scanners</td><td>Unusual volume or large trades in specific contracts</td><td>Seeing where big money may be positioning (with plenty of noise)</td></tr>
<tr><td>Volatility scanners</td><td>High or low implied volatility, IV rank, IV vs. historical volatility</td><td>Deciding whether options are expensive or cheap; premium-selling strategies</td></tr>
<tr><td>Setup-first scanners</td><td>A directional chart setup in the stock, then a matching contract</td><td>Swing traders who want the option to express a chart-based view</td></tr>
</table>

<h2>Useful filters</h2>
<ul>
<li><b>Liquidity:</b> open interest and volume thresholds, and a maximum bid-ask spread as a percentage of the option price.</li>
<li><b>Expiration window:</b> for example, <a href="how-to-find-options-with-30-45-dte.html">30&ndash;45 days to expiration</a>.</li>
<li><b>Moneyness or delta:</b> at-the-money, one strike out, or a delta range.</li>
<li><b>Implied volatility:</b> IV rank or percentile to avoid overpaying.</li>
<li><b>Events:</b> exclude contracts whose life spans an earnings date, if you want to avoid IV crush.</li>
</ul>

<h2>Traps</h2>
<ul>
<li><b>Unusual activity isn't a signal by itself.</b> A large call purchase might be a hedge, one leg of a spread, or a closing trade. Flow scanners can't always tell.</li>
<li><b>Cheap isn't the same as good value.</b> Far out-of-the-money options look inexpensive but need a large move to pay off.</li>
<li><b>Ignoring the underlying.</b> An option is a bet on the stock. If the stock's setup is weak, the contract selection doesn't save it.</li>
</ul>

<h2>Setup-first: a worked flow</h2>
<ol>
<li>Scan stocks for a clean directional setup (for example, a pullback holding in an uptrend).</li>
<li>Define the thesis on the stock: entry, stop and target on the chart.</li>
<li>Pick an expiration that gives the thesis time (30&ndash;45 DTE for a multi-week swing).</li>
<li>Pick a liquid strike near the money.</li>
<li>Plan the exit on the underlying's stop and target, not just the option's price.</li>
</ol>

<h2>How Zelos uses it</h2>
<p>Options Scanner is a setup-first scanner. It starts from the same directional screens as Swing Trader and Breakout Rider, and only when a setup clears the bar does it translate it into a single long call or put idea with a 30&ndash;45 DTE window. No spreads, no short options, no 0DTE, no weeklies, and it never connects to an account.</p>
''',
 'faq': [
  ('What is the best options scanner?', 'It depends on your approach. Flow scanners suit people tracking large trades, volatility scanners suit premium sellers, and setup-first scanners suit swing traders who start from the chart.'),
  ('Do options scanners work for beginners?', 'They can narrow the choices, but options carry risks beyond stocks, including losing the full premium. Understanding expiration, implied volatility and liquidity comes first.'),
  ('What is unusual options activity?', 'Volume in a contract that is large relative to its usual volume or open interest. It can hint at positioning, but it has many innocent explanations.'),
 ],
 'related': ['how-to-find-options-with-30-45-dte', 'how-does-an-ai-stock-scanner-work', 'ai-stock-screener-vs-traditional-screener', 'what-is-reward-to-risk-ratio'],
},
]
