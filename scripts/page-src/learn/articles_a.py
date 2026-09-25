# Learn articles, part 1. Each body is plain HTML (h2/p/ul/ol/table).
# Keep claims general and educational: no promises, no personalized advice.

ARTICLES = [
{
 'slug': 'what-is-a-pullback-trading-strategy',
 'title': 'What Is a Pullback Trading Strategy?',
 'seo_title': 'What Is a Pullback Trading Strategy? Rules, Examples & Mistakes | Zelos',
 'desc': 'A pullback strategy buys a stock that is already trending up after a short, orderly dip. Here are the rules that separate a healthy pullback from a breakdown.',
 'strategy': 'swing',
 'game': ('grade-the-setup', 'Grade real pullback setups against the checklist'),
 'body': '''
<p class="lede">A pullback trading strategy buys a stock that is already in an uptrend, during a short and orderly dip, instead of chasing it after a big green day. The bet is simple: the trend is more likely to continue than to reverse, and waiting for the dip gets you a better price and a tighter stop.</p>

<h2>The idea in one picture</h2>
<p>Strong stocks rarely go up in a straight line. They run for a week or two, rest for a few days, then run again. The rest is the pullback. Price drifts back toward a level where buyers stepped in before, usually a rising moving average or the top of an old range, and then turns up.</p>
<p>A pullback trader tries to buy near the end of that rest, with a stop just below the low of the dip. If the trend resumes, the reward is the move back to (and past) the recent high. If the dip keeps going, the stop limits the damage to a small, planned amount.</p>

<h2>What makes a pullback "healthy"</h2>
<p>Most of the work is telling a normal rest apart from the start of a real decline. These are the checks that matter most:</p>
<ol>
<li><b>An established uptrend.</b> Price above a rising 50-day moving average is a common, objective definition. If the 50-day is flat or falling, there is no trend to rejoin.</li>
<li><b>A dip to support.</b> The pullback stops near a level that has meaning: the rising 20-day average, a prior breakout level, or the last swing low. Within about 3% of the 20-day average is a typical rule.</li>
<li><b>Lighter volume on the way down.</b> Heavy selling on the dip means real distribution. Quiet, low-volume red days usually mean holders are simply not in a hurry to sell.</li>
<li><b>A shallow depth.</b> Pullbacks that give back a third to a half of the prior run are normal. Giving back the whole move is a warning.</li>
<li><b>Room to the upside.</b> The distance back to the recent high should be at least about twice the distance to your stop. Otherwise the trade isn't worth the risk even if the read is right.</li>
</ol>

<h2>Where the entry, stop and target go</h2>
<table>
<tr><th>Piece</th><th>Common rule</th><th>Why</th></tr>
<tr><td>Entry</td><td>Near support, or when price turns back up (a higher close, or a break of the prior day's high)</td><td>Buying the turn confirms buyers are back instead of guessing the exact bottom</td></tr>
<tr><td>Stop</td><td>Just under the pullback's swing low, often with a small buffer of a fraction of the average daily range</td><td>If price takes out the low of the dip, the "orderly rest" idea is wrong</td></tr>
<tr><td>Target</td><td>The recent high first; a trailing stop or second target beyond it</td><td>The prior high is where the trend has to prove itself again</td></tr>
</table>

<h2>A worked example</h2>
<p>Say a stock ran from $80 to $100 over three weeks, and its 50-day average is rising through $88. It drifts back over five quiet sessions to $93, right at its rising 20-day average, and the lowest low of the dip is $91.50.</p>
<ul>
<li>Entry: $93 when it turns up</li>
<li>Stop: $91 (just under the dip's low)</li>
<li>Target: $100 (the recent high)</li>
<li>Risk is $2 a share, reward is $7: a 3.5:1 reward-to-risk ratio</li>
</ul>
<p>Even if only four in ten of trades like this worked, the math can still come out ahead, which is the whole reason for insisting on the ratio.</p>

<h2>Common mistakes</h2>
<ul>
<li><b>Buying dips in stocks that aren't trending.</b> A falling stock that bounces is not a pullback; it is a falling stock.</li>
<li><b>Putting the stop inside the noise.</b> A stop a few cents under yesterday's low gets hit by ordinary volatility. Put it where the idea is proven wrong.</li>
<li><b>Ignoring the market.</b> Pullbacks work best when the broader market is also trending up. In a falling market, even good charts fail more often.</li>
<li><b>Averaging down.</b> If the stop is hit, the setup failed. Adding more is how small losses become large ones.</li>
</ul>

<h2>How Zelos uses it</h2>
<p>Swing Trader is a rule-based version of this exact process. It scans the market for pullbacks, bull flags and breakout retests, scores each one on trend, support, volume, reward-to-risk and relative strength, and only publishes an alert when a setup clears the bar. Every alert lists the entry, stop, target and ratio, and the full history of outcomes is public on the <a href="../alert-history.html">alert history</a> page.</p>
''',
 'faq': [
  ('Is a pullback the same as a reversal?', 'No. A pullback is a temporary move against the trend that ends with the trend resuming. A reversal is the trend actually changing direction. The practical difference shows up at support: pullbacks hold it, reversals break it, usually on heavier volume.'),
  ('How deep should a pullback be?', 'There is no fixed number, but many traders look for a retracement of roughly a third to a half of the prior swing, ending near a rising moving average or prior breakout level. A pullback that erases the whole prior run is no longer a pullback in a strong trend.'),
  ('What timeframe is a pullback strategy?', 'On daily charts it is a swing trading strategy, with trades usually lasting from a few days to a few weeks. The same logic works on intraday or weekly charts with the timeframe adjusted.'),
 ],
 'related': ['how-to-identify-a-bull-flag', 'how-to-find-stocks-near-support', 'what-is-reward-to-risk-ratio', 'how-to-use-stop-losses-in-swing-trading'],
},
{
 'slug': 'how-to-trade-breakouts',
 'title': 'How to Trade Breakouts',
 'seo_title': 'How to Trade Breakouts: Entry, Stop & Volume Rules That Filter Fakeouts | Zelos',
 'desc': 'A step-by-step guide to trading stock breakouts: finding a real base, confirming the break with volume, where to put the stop, and how to avoid false breakouts.',
 'strategy': 'breakout',
 'game': ('chart-replay', 'Practice breakout entries bar by bar in Chart Replay'),
 'body': '''
<p class="lede">A breakout trade buys a stock as it moves above a price level that has capped it several times before. When it works, the stock leaves a tight range and trends. When it fails, it pokes above the level and falls straight back in. Most of breakout trading is learning to tell those apart.</p>

<h2>Step 1: Find a real base</h2>
<p>A breakout needs something to break out of. Look for a stock that has spent several weeks moving sideways in a range, with a clear ceiling that price has tested more than once. The best bases have two features:</p>
<ul>
<li><b>Tightening.</b> The swings inside the range get smaller as it matures. Wide, sloppy ranges produce sloppy breakouts.</li>
<li><b>Higher lows.</b> Each dip inside the base stops a little higher than the last. That's the shape of an ascending triangle, and it tells you buyers keep stepping in earlier.</li>
</ul>
<p>Context matters too. Bases that form after a prior uptrend, with price above a rising 50-day average, tend to resolve upward more often than bases that form in the middle of a downtrend.</p>

<h2>Step 2: Wait for the break, then for the hold</h2>
<p>The trigger is price moving above resistance. The mistake is treating the first tick above it as confirmation. Two filters remove a lot of false breakouts:</p>
<ol>
<li><b>Volume.</b> A genuine breakout usually comes on volume well above average, often 1.5 times the 20-day average or more. Breakouts on light volume are easy to reverse because there is little real demand behind them.</li>
<li><b>The close.</b> Where the stock finishes the day matters more than where it traded intraday. A close well above resistance is stronger than a spike that fades back to the level by 4 p.m.</li>
</ol>

<h2>Step 3: Place the stop where the breakout fails</h2>
<p>A breakout idea is wrong once price is clearly back inside the old range. Common stop placements are just below the breakout level (tight) or below the last higher low inside the base (wider, but gives the trade room). Both are logical; the choice mostly changes your position size. What doesn't work is a stop placed at an arbitrary percentage that has nothing to do with the chart.</p>

<h2>Step 4: Plan the target before you enter</h2>
<p>A classic way to project a target is the "measured move": take the height of the base and add it to the breakout level. A stock that ranged between $40 and $50 and breaks $50 has a measured-move target near $60. Compare that distance with your stop distance. If the reward isn't at least about twice the risk, skip it.</p>

<h2>Breakout checklist</h2>
<table>
<tr><th>Check</th><th>Good sign</th><th>Warning sign</th></tr>
<tr><td>Base</td><td>Several weeks, tightening, higher lows</td><td>Wide, choppy, or only a few days old</td></tr>
<tr><td>Trend</td><td>Above a rising 50-day average</td><td>Below a falling 50-day average</td></tr>
<tr><td>Volume on the break</td><td>1.5&times; the 20-day average or more</td><td>Below average</td></tr>
<tr><td>Close</td><td>Near the high of the day, above the level</td><td>Back at or below the level</td></tr>
<tr><td>Reward:risk</td><td>2:1 or better to the measured move</td><td>Target barely above the stop distance</td></tr>
</table>

<h2>Why breakouts fail</h2>
<p>Many breakouts fail, and that's normal. Stops just above a well-known resistance level attract buy orders, so price often spikes through, triggers them, and then runs out of buyers. The filters above don't eliminate failures; they tilt the odds and keep each failure small. Some traders wait for the <a href="what-is-a-breakout-retest.html">retest</a> instead, trading a slightly worse price for more confirmation.</p>

<h2>How Zelos uses it</h2>
<p>Breakout Rider screens for stocks consolidating under clear resistance, then throws out anything that spiked through without holding. It scores base tightness, resistance strength, volume on the break, reward-to-risk and relative strength, and publishes one alert when a setup clears the bar.</p>
''',
 'faq': [
  ('What volume confirms a breakout?', 'A common rule of thumb is volume at least 1.5 times the 20-day average on the breakout day. It is not a guarantee, but breakouts on below-average volume fail noticeably more often.'),
  ('Should I buy the breakout or wait for a pullback?', 'Both are valid. Buying the break gets you in early but risks more false breakouts. Waiting for a retest of the old resistance gives more confirmation at the cost of sometimes missing strong moves that never come back.'),
  ('What is a false breakout?', 'A move above resistance that quickly reverses back into the range, often within a day or two. Light volume and a weak close are the most common warning signs.'),
 ],
 'related': ['what-is-a-breakout-retest', 'how-to-find-stocks-before-a-breakout', 'how-to-identify-a-bull-flag', 'what-is-reward-to-risk-ratio'],
},
{
 'slug': 'how-to-identify-a-bull-flag',
 'title': 'How to Identify a Bull Flag',
 'seo_title': 'How to Identify a Bull Flag Pattern (and When Not to Trade One) | Zelos',
 'desc': 'A bull flag is a sharp rally followed by a short, orderly drift lower. Learn the pole, the flag, the volume signature, and how to set entries and stops.',
 'strategy': 'swing',
 'game': ('grade-the-setup', 'Spot flags and pullbacks on real charts'),
 'body': '''
<p class="lede">A bull flag is a continuation pattern: a strong, fast rally (the pole) followed by a short, orderly drift sideways or slightly down (the flag). It shows buyers pausing, not leaving. When price breaks out of the top of the flag, the prior rally often continues.</p>

<h2>The two parts</h2>
<h3>The pole</h3>
<p>The pole is a sharp move up over a handful of sessions, usually on strong volume. It needs to be steep. A slow grind higher doesn't create the same imbalance between buyers and sellers, so it doesn't produce the same follow-through.</p>
<h3>The flag</h3>
<p>The flag is the rest. Price moves in a tight, slightly downward-sloping channel, or sideways, for roughly one to three weeks on a daily chart. The key features:</p>
<ul>
<li><b>Shallow.</b> It typically retraces less than half of the pole. A deep flag is really just a failed rally.</li>
<li><b>Tight.</b> Daily ranges shrink compared with the pole.</li>
<li><b>Quiet.</b> Volume falls during the flag. Heavy selling inside the flag is the single biggest red flag.</li>
</ul>

<h2>How to trade it</h2>
<ol>
<li><b>Entry.</b> A break above the upper edge of the flag, ideally with volume picking up. Some traders enter on a close above the flag high to avoid intraday head-fakes.</li>
<li><b>Stop.</b> Below the low of the flag. If price falls through the bottom of the rest, the pattern has failed.</li>
<li><b>Target.</b> The traditional measured move adds the length of the pole to the breakout point. A more conservative first target is the high of the pole itself.</li>
</ol>

<h2>Bull flag vs. other patterns</h2>
<table>
<tr><th>Pattern</th><th>How it differs</th></tr>
<tr><td>Bull pennant</td><td>Same idea, but the rest forms a small symmetrical triangle instead of a channel</td></tr>
<tr><td>Pullback to a moving average</td><td>Slower and deeper; the rest usually ends at the 20-day or 50-day average rather than forming a tight channel</td></tr>
<tr><td>Flat base</td><td>Longer (several weeks), with no steep pole before it</td></tr>
<tr><td>Bear flag</td><td>The mirror image: a sharp drop, then a weak drift up, then continuation lower</td></tr>
</table>

<h2>When not to trade one</h2>
<ul>
<li>The pole came on news that has already been fully priced, and the flag is drifting down on rising volume.</li>
<li>The flag has lasted so long that it is really a new range.</li>
<li>The broader market is breaking down. Flags are continuation patterns, and they depend on the trend continuing.</li>
<li>The measured target is too close to justify the stop. Even a clean flag isn't worth taking at 1:1.</li>
</ul>

<h2>How Zelos uses it</h2>
<p>Bull flags are one of the three pattern families Swing Trader looks for, alongside moving-average pullbacks and breakout retests. The pattern alone isn't enough to publish an alert; the setup still has to score well on trend, support, volume, reward-to-risk and relative strength.</p>
''',
 'faq': [
  ('How long does a bull flag last?', 'On a daily chart, typically about one to three weeks. Much longer than that and it tends to behave like a new base or range rather than a flag.'),
  ('Is a bull flag bullish?', 'It is a bullish continuation pattern, meaning it suggests the prior uptrend is more likely to continue than reverse. It still fails regularly, which is why the stop below the flag matters.'),
  ('What volume should a bull flag have?', 'High volume on the pole and noticeably lower volume during the flag. A pickup in volume on the breakout from the flag is a good confirmation sign.'),
 ],
 'related': ['what-is-a-pullback-trading-strategy', 'how-to-trade-breakouts', 'best-indicators-for-swing-trading', 'how-to-use-stop-losses-in-swing-trading'],
},
{
 'slug': 'what-is-a-breakout-retest',
 'title': 'What Is a Breakout Retest?',
 'seo_title': 'What Is a Breakout Retest? How Old Resistance Becomes Support | Zelos',
 'desc': 'A breakout retest is when price breaks above resistance, pulls back to that level, and holds it as support. Here is how to trade it and what failure looks like.',
 'strategy': 'swing',
 'game': ('stop-drill', 'Practice stop placement under a retest level'),
 'body': '''
<p class="lede">A breakout retest happens when a stock breaks above a resistance level, pulls back to that same level a few days later, and holds it. The old ceiling becomes the new floor. For traders who don't like buying the initial breakout, the retest offers a second, better-defined entry.</p>

<h2>Why old resistance turns into support</h2>
<p>Resistance exists because sellers kept showing up at a certain price. Once price breaks through and stays there, a few things change. Traders who sold too early want back in at that price. People who bought the breakout defend their entry. Short sellers who were betting on the ceiling cover. All of that tends to create demand right at the old level.</p>

<h2>What a clean retest looks like</h2>
<ol>
<li>A breakout above well-tested resistance, ideally on above-average volume.</li>
<li>A pullback over a few sessions back toward the breakout level, on lighter volume than the breakout.</li>
<li>Price holds at or slightly above the level, often with a small reversal candle (a higher close after an intraday dip).</li>
<li>The next leg higher starts from there.</li>
</ol>

<h2>Trading the retest</h2>
<table>
<tr><th>Piece</th><th>Common approach</th></tr>
<tr><td>Entry</td><td>As price bounces off the old resistance level, for example a close back above the prior day's high</td></tr>
<tr><td>Stop</td><td>Below the retest low, or clearly back inside the old range. If price closes well below the breakout level, the breakout has failed.</td></tr>
<tr><td>Target</td><td>The post-breakout high first, then a measured move (height of the base added to the breakout level)</td></tr>
</table>
<p>Because the entry sits close to a well-defined level, the stop is often tighter than it would be on the original breakout, which improves the reward-to-risk ratio.</p>

<h2>Retest vs. failed breakout</h2>
<p>The two look identical for the first day or two. The difference is what happens at the level:</p>
<ul>
<li><b>Retest:</b> volume dries up on the pullback, price stalls at the level, buyers step in.</li>
<li><b>Failure:</b> price slices through the level on rising volume and closes back inside the range. That's a signal to step aside, not to buy more.</li>
</ul>

<h2>The trade-off</h2>
<p>Not every breakout comes back to retest. The strongest ones often run without looking back, so a retest-only approach will miss some big winners. In exchange, it filters out a lot of breakouts that were never real. Neither approach is right or wrong; they fit different temperaments.</p>

<h2>How Zelos uses it</h2>
<p>Breakout retests are one of the three pattern families Swing Trader screens for. A retest that holds on light volume, in a stock with a rising 50-day average and good relative strength, is the kind of setup that tends to score well.</p>
''',
 'faq': [
  ('How long after a breakout does a retest happen?', 'Often within a few days to two weeks on a daily chart, though there is no fixed window. Some breakouts never retest at all.'),
  ('Does price have to touch the exact level?', 'No. Levels are zones, not exact prices. A retest that holds slightly above the old resistance, or dips just below intraday and closes back above, is still a retest.'),
  ('Is a retest safer than buying the breakout?', 'It usually offers more confirmation and a tighter stop, but it will miss breakouts that never come back. It changes the kind of risk more than it removes risk.'),
 ],
 'related': ['how-to-trade-breakouts', 'how-to-find-stocks-near-support', 'what-is-a-pullback-trading-strategy', 'how-to-use-stop-losses-in-swing-trading'],
},
{
 'slug': 'how-to-find-stocks-near-support',
 'title': 'How to Find Stocks Near Support',
 'seo_title': 'How to Find Stocks Near Support: 4 Methods and a Screener Recipe | Zelos',
 'desc': 'Support is a price zone where buyers have repeatedly stepped in. Learn four practical ways to find it, how to screen for stocks near it, and how to tell if it will hold.',
 'strategy': 'swing',
 'game': ('stop-drill', 'Practice finding the swing low on real charts'),
 'body': '''
<p class="lede">Support is a price zone where a stock has repeatedly stopped falling because buyers stepped in. Finding stocks that are sitting right on support is useful because it gives you a logical place to buy and, more importantly, a logical place for your stop just below.</p>

<h2>Four ways to find support</h2>
<h3>1. Prior swing lows</h3>
<p>The most basic support is the low of a recent dip. If a stock bounced from $42 twice in the last two months, $42 matters. The more times a level has held, and the more recent those tests, the more attention it gets.</p>
<h3>2. Old resistance</h3>
<p>A level that capped the stock before and was then broken often acts as support on the way back down. This is the logic behind the <a href="what-is-a-breakout-retest.html">breakout retest</a>.</p>
<h3>3. Rising moving averages</h3>
<p>In trending stocks, the 20-day and 50-day moving averages act as dynamic support because so many traders watch them. The key word is rising: a moving average only acts as support while the trend it measures is intact.</p>
<h3>4. High-volume price zones</h3>
<p>Prices where a lot of shares changed hands (visible with a volume-by-price or volume profile tool) tend to matter later, because many holders have a cost basis there.</p>

<h2>A simple screener recipe</h2>
<p>Most stock screeners can't draw support lines, but you can approximate "near support in an uptrend" with a few filters:</p>
<ul>
<li>Price above the 50-day moving average</li>
<li>50-day moving average higher than it was 10 days ago</li>
<li>Price within 3% of the 20-day moving average</li>
<li>Price at least 3% below its 10-day high (so it has actually pulled back)</li>
<li>Average volume high enough that the stock is liquid</li>
</ul>
<p>That list gives you candidates, not trades. You still need to look at each chart and ask whether the level is real.</p>

<h2>Will the support hold?</h2>
<table>
<tr><th>More likely to hold</th><th>More likely to break</th></tr>
<tr><td>Price drifts into it on falling volume</td><td>Price crashes into it on heavy volume</td></tr>
<tr><td>The broader trend is up</td><td>The stock is making lower highs</td></tr>
<tr><td>The market is healthy</td><td>The whole market is selling off</td></tr>
<tr><td>The level has held before and is recent</td><td>The level has been tested many times already and each bounce is weaker</td></tr>
</table>

<h2>Using support for your stop</h2>
<p>Support is most valuable as a stop location. Put the stop a little below the zone, not exactly on it, because levels are fuzzy and price often undercuts them briefly. A buffer of a fraction of the stock's average daily range is a common approach. If price closes clearly through support, the reason for the trade is gone.</p>

<h2>How Zelos uses it</h2>
<p>Support is one of the scored components in Swing Trader. A setup sitting on a rising moving average or a prior breakout level, with a stop that can go just below it, scores better than one floating in the middle of nowhere.</p>
''',
 'faq': [
  ('What is the difference between support and resistance?', 'Support is a zone below price where buying has tended to stop declines. Resistance is a zone above price where selling has tended to stop advances. A broken level often switches roles.'),
  ('Is the 200-day moving average support?', 'It is widely watched, so it often acts as support in long-term uptrends. For swing trading on daily charts, the 20-day and 50-day averages tend to be more relevant.'),
  ('Can a screener find support levels automatically?', 'Screeners can approximate it with moving-average and distance-from-high filters. Actual support levels still need a look at the chart, or a scanner that computes swing lows directly.'),
 ],
 'related': ['what-is-a-pullback-trading-strategy', 'what-is-a-breakout-retest', 'how-to-use-stop-losses-in-swing-trading', 'best-indicators-for-swing-trading'],
},
{
 'slug': 'how-to-scan-stocks-for-momentum',
 'title': 'How to Scan Stocks for Momentum',
 'seo_title': 'How to Scan Stocks for Momentum: Filters, Relative Strength & Pitfalls | Zelos',
 'desc': 'Momentum scanning finds stocks that are outperforming. Here are the filters that work (relative strength, trend, volume), a sample scan, and the traps to avoid.',
 'strategy': 'breakout',
 'game': ('chart-replay', 'Trade momentum names bar by bar in Chart Replay'),
 'body': '''
<p class="lede">Momentum is the tendency of stocks that have been going up to keep going up, at least for a while. A momentum scan is a set of filters that surfaces those leaders. The hard part isn't finding stocks that went up; it's finding the ones still worth buying.</p>

<h2>The core momentum filters</h2>
<ol>
<li><b>Relative strength.</b> How the stock performed compared with the market over the same period. A stock up 12% while the S&amp;P 500 is up 2% has strong relative strength. Comparing 1-month, 3-month and 6-month returns against an index like SPY is a simple version.</li>
<li><b>Trend structure.</b> Price above its 20-day and 50-day moving averages, with the 50-day above the 200-day. This keeps you in stocks where the momentum is a trend, not a one-day pop.</li>
<li><b>Near highs.</b> Leaders tend to trade within 10 to 15% of their 52-week high. Stocks far below their highs have supply overhead from people waiting to break even.</li>
<li><b>Volume.</b> Average daily volume high enough to trade easily, and ideally rising volume on up days.</li>
</ol>

<h2>A sample scan</h2>
<table>
<tr><th>Filter</th><th>Setting</th></tr>
<tr><td>Average daily volume</td><td>Above 1 million shares</td></tr>
<tr><td>Price</td><td>Above $10</td></tr>
<tr><td>Price vs. 50-day average</td><td>Above</td></tr>
<tr><td>50-day vs. 200-day average</td><td>Above</td></tr>
<tr><td>3-month performance vs. SPY</td><td>Better by 10 percentage points or more</td></tr>
<tr><td>Distance from 52-week high</td><td>Within 15%</td></tr>
</table>
<p>This returns a list of strong stocks. It doesn't return entries. That's the next step.</p>

<h2>From momentum list to trade</h2>
<p>Buying a stock just because it's strong usually means buying it extended, far above any support, where the nearest logical stop is a long way down. Momentum traders typically wait for one of two things:</p>
<ul>
<li><b>A rest.</b> A <a href="how-to-identify-a-bull-flag.html">flag</a> or a <a href="what-is-a-pullback-trading-strategy.html">pullback</a> to a rising moving average, which gives a nearby stop.</li>
<li><b>A breakout.</b> A move out of a tight base, which gives a clear level for the stop.</li>
</ul>

<h2>Pitfalls</h2>
<ul>
<li><b>Chasing gaps.</b> A stock up 20% on earnings shows up on every momentum scan that morning. That's usually the worst time to buy.</li>
<li><b>Ignoring regime.</b> Momentum works best in trending markets and can reverse violently when the market turns. When leaders start breaking their 50-day averages together, that's a signal about the market, not just the stocks.</li>
<li><b>Over-filtering.</b> Stack too many conditions and the scan returns nothing, or only returns names you'd have found anyway.</li>
</ul>

<h2>How Zelos uses it</h2>
<p>Relative strength is one of the five scored components in both Swing Trader and Breakout Rider. The scan finds strong stocks first, then waits for them to form a setup with a defined stop, instead of publishing whatever went up the most yesterday.</p>
''',
 'faq': [
  ('What is a good relative strength number?', 'There is no universal threshold. A common approach is to rank stocks by their return versus an index over several periods and focus on the top 10 to 20%.'),
  ('Does momentum investing work?', 'Momentum is one of the most studied effects in finance and has historically shown up across many markets, but it goes through sharp drawdowns, especially at market turning points. Past behavior is not a guarantee.'),
  ('What timeframe should a momentum scan use?', 'Swing traders often combine 1-month, 3-month and 6-month performance. Shorter windows catch new leaders sooner but produce more noise.'),
 ],
 'related': ['how-to-find-stocks-before-a-breakout', 'best-indicators-for-swing-trading', 'how-does-an-ai-stock-scanner-work', 'how-to-trade-breakouts'],
},
{
 'slug': 'best-indicators-for-swing-trading',
 'title': 'The Best Indicators for Swing Trading',
 'seo_title': 'Best Indicators for Swing Trading (and the Ones You Can Skip) | Zelos',
 'desc': 'A practical shortlist of swing trading indicators: moving averages, volume, ATR, relative strength and RSI. What each measures, how to use it, and why fewer is better.',
 'strategy': 'swing',
 'game': ('grade-the-setup', 'Use these indicators on real charts'),
 'body': '''
<p class="lede">You don't need a screen full of indicators to swing trade. Most useful ones fall into four jobs: defining the trend, measuring participation, sizing the stop, and comparing strength. Pick one tool per job and learn it well.</p>

<h2>1. Moving averages: is there a trend?</h2>
<p>The 20-day and 50-day simple moving averages are the workhorses. The 50-day defines the intermediate trend (price above a rising 50-day is an uptrend), and the 20-day acts as the first support level in strong trends. The 200-day matters for the bigger picture.</p>
<p><b>Use it for:</b> deciding whether to look for longs at all, and where a pullback might stop.<br><b>Watch out:</b> moving averages lag. They confirm trends; they don't predict turns.</p>

<h2>2. Volume: is anyone behind the move?</h2>
<p>Volume compared with its own 20-day average tells you how much conviction is behind a move. Breakouts on 1.5&times; average volume or more are more trustworthy; pullbacks on below-average volume are healthier.</p>
<p><b>Use it for:</b> confirming breakouts and judging pullbacks.<br><b>Watch out:</b> volume spikes around earnings and index rebalancing days can distort the average.</p>

<h2>3. ATR: how much does this stock normally move?</h2>
<p>Average True Range measures the typical daily range, including gaps. A stock with a $4 ATR moves about $4 on an ordinary day, so a stop $0.50 away is inside the noise.</p>
<p><b>Use it for:</b> placing stops outside normal fluctuation and comparing volatility across stocks.<br><b>Watch out:</b> ATR says how far, not which direction.</p>

<h2>4. Relative strength: is this a leader?</h2>
<p>Not the RSI oscillator: this is the stock's performance compared with the market. Stocks outperforming the S&amp;P 500 during pullbacks tend to lead on the next leg up.</p>
<p><b>Use it for:</b> choosing between two otherwise similar setups.</p>

<h2>Optional: RSI</h2>
<p>The Relative Strength Index is a momentum oscillator from 0 to 100. Swing traders use it less as "overbought/oversold" and more as a pullback gauge: in an uptrend, RSI dipping into the 40s and turning up often lines up with a pullback ending. Strong stocks can stay "overbought" above 70 for weeks, so selling just because RSI is high is a common mistake.</p>

<h2>What you can skip</h2>
<p>Stacking several oscillators (RSI, Stochastics, CCI, Williams %R) mostly measures the same thing several times. Adding more indicators tends to create conflicting signals and more reasons to hesitate, not better trades.</p>

<h2>Quick reference</h2>
<table>
<tr><th>Job</th><th>Indicator</th><th>Typical rule</th></tr>
<tr><td>Trend</td><td>50-day SMA</td><td>Price above, and the average rising</td></tr>
<tr><td>Support</td><td>20-day SMA, swing lows</td><td>Pullback ends within ~3% of the level</td></tr>
<tr><td>Participation</td><td>Volume vs. 20-day average</td><td>Heavier on breakouts, lighter on pullbacks</td></tr>
<tr><td>Stop sizing</td><td>ATR (14)</td><td>Stop beyond normal daily noise</td></tr>
<tr><td>Leadership</td><td>Return vs. SPY</td><td>Outperforming over 1&ndash;3 months</td></tr>
</table>

<h2>How Zelos uses them</h2>
<p>Zelos deliberately sticks to standard, objective indicators rather than a black box. Swing Trader's score is built from trend, support, volume, reward-to-risk and relative strength, the same jobs listed above.</p>
''',
 'faq': [
  ('What is the single best indicator for swing trading?', 'If you only used one, the 50-day moving average (and whether price is above it and it is rising) does the most important job: keeping you on the right side of the trend.'),
  ('Should I use EMA or SMA?', 'Exponential moving averages react faster; simple ones are smoother. For daily swing trading the difference is small. Consistency matters more than the choice.'),
  ('Is RSI useful for swing trading?', 'It can help time the end of pullbacks in uptrends, but it works poorly as a standalone overbought/oversold signal in trending stocks.'),
 ],
 'related': ['what-is-a-pullback-trading-strategy', 'how-to-scan-stocks-for-momentum', 'how-to-use-stop-losses-in-swing-trading', 'how-to-find-stocks-near-support'],
},
]
