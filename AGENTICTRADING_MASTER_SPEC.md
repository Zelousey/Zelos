# AgenticTrading.info — Master Spec

The checklist below is the **source of truth**. Do not rewrite, reorder, remove,
downgrade or reinterpret it. Progress is tracked in `AGENTICTRADING_PROGRESS.md`.

## GLOBAL IMPLEMENTATION RULES

**Ground rules**
- Treat the checklist as the SOURCE OF TRUTH. Do not rewrite, reorder, remove, downgrade, reinterpret, or change the priority list.
- Do not remove existing requirements because they seem redundant.
- Do not add unrequested features unless they are needed for security, reliability, accessibility, legal compliance, or to implement an existing requirement.
- **Practice Mode must NOT be reintroduced.**
- Preserve existing working functionality and mobile layout/functionality wherever it works.
- Do not unnecessarily rewrite working systems.

**Process**
- Work in small verified phases. Only implement the current phase; never the whole checklist in one pass.
- **Phase 1 is the mandatory FMP/live chart fix.** Do not move past Phase 1 until the actual Trade War chart is confirmed working through the paid FMP API.
- After each major phase: run appropriate tests, verify actual functionality, update `AGENTICTRADING_PROGRESS.md`, report files changed / tests / blockers.
- Wait for the owner's instruction before beginning each major phase. Do not automatically continue.

**Safety / scope**
- Do not refactor unrelated code, create abstractions for hypothetical future features, or create unnecessary files.
- Do not rewrite working systems simply to make them "cleaner."
- Inspect an important existing system before changing it.
- Do not make destructive or hard-to-reverse changes without clearly identifying them.
- Keep changes as small and targeted as reasonably possible.

**Testing**
- Test before moving to the next major phase. Compiling is not "complete"; verify the actual user-facing behavior.
- Keep progress reports concise: actions, files changed, tests, deployment status, blockers.

**Security**
- Never expose API keys, secrets, passwords, tokens, or credentials. Never hardcode private API keys into frontend code.
- Do not ask for an API key that is already configured. Use the existing secret/environment-variable architecture (Firebase Secret Manager).
- Do not weaken Firebase/Firestore rules to make a feature work.
- Tokens, XP, Trade War balances, rewards, rankings, and permissions must be validated server-side. Do not trust client values for anything security-sensitive.
- Audit authentication, authorization, Firestore rules, Storage rules, admin routes, exposed secrets, logs, and production error messages. Test security changes carefully.

**Market data**
- FMP is the active paid provider for the required quote path. `FMP_API_KEY` stays secret.
- `FINNHUB_API_KEY` remains intact as a separate secret/fallback unless explicitly changed later.
- Neither key is ever exposed to frontend users.

**Trade War**
- Trade War and Real Trading remain separate systems. Trade War is virtual-money competition; balances remain virtual.
- Preserve equal configured starting capital. Never connect Trade War virtual balances to real money.

**Motion / animation**
- Premium trading platform feel: smooth, purposeful transitions that communicate navigation, state changes, trading actions, competition, XP progression, achievements, and important events — never decoration.
- Consistent timing, easing, spacing, and transition behavior. Performance first; animations never delay trading or navigation.
- Respect reduced-motion settings. Professional dark/blue/white/black visual language; no bubbly, childish, generic-AI, or excessive game-style animation.
- Build progressively; do not replace the whole UI with an animation framework. Audit existing screens first, then create reusable motion patterns only where they add real value.

**Compliance / user safety**
- Cookies: audit the current implementation; show consent only where legally required given the site's actual cookie/tracking use; never remove legally required consent; distinguish necessary vs analytics/advertising; make no unverified legal claims.
- Terms of Service: review and flag outdated/inconsistent/missing/problematic areas for human/legal review; do not silently rewrite legal terms as though approved.
- Comments/reactions: basic community guidelines; prevent spam, flooding, abuse, harassment, malicious content, repeated automated reactions; reasonable rate limits; reporting/moderation where appropriate (not over-built); clear rules; server-side enforcement where appropriate.
- Email: no spam; only legitimate user-relevant events; respect preferences; unsubscribe controls for non-essential email; no unnecessary recurring marketing; no duplicate sends; no emails to real users during development/testing unless intended.
- Notifications: audit before rebuilding (Web Push/FCM, service worker, device registration, permissions, backend sender, triggers); preserve what works; website notifications are separate from Claude/Claude Code notifications; no duplicate notifications per event.

**User experience**
- Simple enough for a brand-new user; advanced functionality available without overwhelming.
- Test important flows as both a brand-new user and an experienced trader.
- Make important actions obvious. Avoid unnecessary loading screens or animation delays. Preserve accessibility and reduced-motion behavior.

---

## MASTER CHECKLIST (verbatim)

```text
zelos update


🚀 AGENTICTRADING.INFO — MASTER DEVELOPMENT CHECKLIST
🔥 PRIORITY ORDER
🔴 HIGHEST PRIORITY — BUILD/FIX FIRST
	1.	Website Layout & Simplification
	2.	Clear separation between Real Trading and Trade War
	3.	Trade War as a top-level navigation section
	4.	Custom User Dashboard as the default dashboard
	5.	User customization/editable dashboard
	6.	Simple new-user onboarding
	7.	Profile setup
	8.	First Trade flow
	9.	Challenge a Friend flow
	10.	Core Trade War system
	11.	Separate Trade War virtual accounts
	12.	Equal Trade War starting capital / buy-in
	13.	Trade War leaderboard
	14.	Dedicated Trade War chart
	15.	MANDATORY FMP API chart/live-price fix
	16.	Keep existing mobile layout/functionality working
 
⸻
 
💰 1. TOKEN ECONOMY
Replace the old Gumroad $20 flat-fee skill payment model
	•	Deprecate/archive the current $20 Gumroad flat-fee skill payment.
	•	Build an on-site token purchase system.
	•	Tokens become the primary paid currency for scans/tools.
	•	Build secure backend token ledger.
	•	Track:  
	•	Token balance
	•	Purchases
	•	Spending
	•	Rewards
	•	Transactions
	•	Token-to-scan spending system.
	•	Allow tokens to:  
	•	Unlock a scanner for a set period, such as 1 week
	•	Purchase individual scans
	•	Potentially unlock other premium tools later
	•	XP/level-up/milestone system can reward users with tokens.
	•	Prevent duplicate rewards and token exploits.
Pricing — Future Exploration
	•	Explore:  
	•	Token packages
	•	Individual scan token costs
	•	Free token allowance
	•	Optional subscription that includes tokens
	•	Unlimited/limited scan models
	•	Free + paid scan model
	•	Paid Real Trading tools
	•	Do NOT finalize pricing until usage/costs are evaluated.
 
⸻
 
⚔️ 2. TRADE WAR INTERACTIVE ALERTS
	•	Interactive dark-mode Trade War alert cards.
	•	Accept / Decline buttons.
	•	Real-time WebSocket/polling triggers.
	•	Accepting a Trade War invitation enters the match/lobby.
	•	Initialize the player’s separate Trade War session account using the configured buy-in.
	•	Trade War alerts are strictly virtual competition alerts.
	•	Real-world trading/execution remains manual and separate.
 
⸻
 
📡 3. MANDATORY FMP LIVE CHART FIX
THIS MUST BE COMPLETED BEFORE CONSIDERING THE CHART FINISHED
	•	Use the paid Financial Modeling Prep (FMP) API for the quote system.
	•	FMP_API_KEY is stored in Firebase Secret Manager.
	•	DO NOT ask for, expose, print, or hardcode the API key.
	•	Keep FINNHUB_API_KEY intact as a separate secret/fallback.
	•	FMP must power the active quote path.
Required endpoint:
https://financialmodelingprep.com/stable/quote?symbol=SYMBOL&apikey=FMP_API_KEY
Required mapping:
	•	c = current price
	•	o = open
	•	h = day high
	•	l = day low
	•	pc = previous close
	•	t = timestamp
Required backend changes:
	•	_fmp_quote must actually call the FMP endpoint.
	•	Remove any accidental Finnhub URL from the FMP quote function.
	•	Do NOT send X-Finnhub-Token to FMP.
	•	Scheduled function must include:  
	•	FMP_API_KEY
	•	Environment lookup:  
	•	os.environ.get("FMP_API_KEY", "")
	•	Update logs/source labels from Finnhub to FMP where appropriate.
	•	Preserve existing:  
	•	Firebase
	•	Firestore
	•	scheduled refresh
	•	frontend quote pipeline
	•	markets / quotes
	•	practice.js
	•	Do NOT replace the existing pipeline unnecessarily.
Test:
	•	python3 -m py_compile functions/main.py
	•	Fix every syntax/indentation error.
	•	Deploy:  
	•	firebase deploy --only functions
	•	Force-run the quote refresh Cloud Scheduler job.
	•	Verify markets/quotes receives real quote data.
	•	Verify there is no 401/authentication error.
	•	Verify /practice/index.html receives live quotes.
	•	Verify the chart no longer shows:  
	•	“Live feed error: the price service rejected the API key.”
	•	Do not mark this complete until the chart is actually working through the paid FMP API.
 
⸻
 
🖥️ 4. WEBSITE LAYOUT
	•	Simplify the entire website.
	•	Clean, professional, simple interface.
	•	Keep AgenticTrading.info branding.
	•	Blue / white / black theme.
	•	Avoid overly bubbly/cartoonish/generic AI design.
	•	Separate:  
	•	Real Trading
	•	Trade War
	•	Trade War gets its own top-level navigation.
	•	Alerts removed from the main navigation.
	•	Put Alerts in a logical Trading/Tools location.
	•	Options Scanner + Daily Market should live under Trading Tools.
	•	Arcade should be a top-level section.
	•	Signed-out homepage should be different from signed-in dashboard.
	•	Existing custom dashboard remains the default dashboard.
	•	Dashboard must remain editable by users.
	•	Preserve the existing mobile layout where it works.
	•	Do not unnecessarily rebuild working mobile functionality.
	•	Keep the interface simple enough for a brand-new user.
 
⸻
 
👤 5. MAIN USER FLOW
Sign Up → Set Up Profile → Make First Trade → Challenge Friend → Trade War → Keep Trading
	•	Make the next action obvious.
	•	Show visible tasks/missions.
	•	Make profile setup easy.
	•	Highlight current task.
	•	Do not overwhelm new users.
 
⸻
 
🧑‍💻 6. NEW USER ONBOARDING
	•	Profile setup should be one of the first steps.
	•	Profile:  
	•	Picture
	•	Name
	•	Username
	•	Bio
	•	Visible onboarding tasks:  
	•	Complete Profile
	•	Make First Trade
	•	Challenge a Friend
	•	Join/Create Trade War
	•	Help Mode toggle.
	•	Private groups can have their own Help Mode setting.
	•	Make XP and Missions easy to find.
 
⸻
 
⚔️ 7. TRADE WAR CORE SYSTEM
Trade War is a completely separate competitive product inside AgenticTrading.info.
	•	Own top-level navigation.
	•	Separate from Real Trading.
	•	Separate Trade War account/wallet for every active session.
	•	Every Trade War has:  
	•	Virtual balance
	•	Portfolio
	•	Trades
	•	Leaderboard
	•	Stats
	•	Match history
	•	Trade War balance is created from the configured Trade War buy-in.
	•	Trade War can have its own rules, eliminations, squads, rewards, etc.
 
⸻
 
💵 8. TRADE WAR BUY-IN + EQUAL STARTING CAPITAL
	•	Host chooses a virtual Trade War buy-in.
	•	Examples:  
	•	$100
	•	$500
	•	$1,000
	•	Every participant in that Trade War contributes the exact same virtual buy-in.
	•	The buy-in creates the player’s separate Trade War starting balance.
	•	Example:
Player enters a $500 Trade War → Trade War account starts at $500.
	•	A user does not need to have a larger personal balance to gain an advantage.
	•	Everyone in the same Trade War starts with the exact same configured virtual capital.
Trade War session rules:
	•	Lock starting buy-in once the session begins.
	•	No adding money during active session unless a specific game mode allows it.
	•	No withdrawing money during active session unless a specific game mode allows it.
	•	Only Trade War capital can be used in Trade War.
	•	Track Trade War P&L separately.
 
⸻
 
🏆 9. TRADE WAR LEADERBOARD
Leaderboard should show:
	•	Starting Balance
	•	Current Balance
	•	$ P&L
	•	% P&L
	•	Rank
	•	Trades
	•	Wins/Losses
	•	Other configured stats
	•	Rankings should be based on Trade War performance.
	•	Use percentage gain/loss where appropriate to keep equal starting capital meaningful.
 
⸻
 
☠️ 10. LAST MAN STANDING / ELIMINATION
	•	Optional Trade War mode.
	•	Host configures rules.
	•	Possible elimination:  
	•	P&L threshold
	•	Maximum loss
	•	Number of losses
	•	Time-based elimination
	•	Clearly show rules before entering.
	•	Show eliminated state.
	•	Show remaining active players.
	•	Final winner.
	•	Final statistics.
	•	Dramatic but professional elimination animations.
 
⸻
 
👥 11. SQUADS + PRIVATE GROUPS
	•	Create squads.
	•	Join squads.
	•	Shared goals.
	•	Squad communication.
	•	Future squad-vs-squad competitions.
	•	Squad owner controls.
	•	Only squad owner can delete squad.
	•	Confirmation before deleting.
	•	Private room codes.
	•	Group configuration.
Configurable options:
	•	View everyone’s trades
	•	Emoji reactions
	•	Camera-roll photos
	•	Stocks
	•	Options
	•	Crypto
	•	All assets
	•	Individual stock restrictions
	•	Indicators
	•	Help Mode
	•	Drafts
	•	Whale & Minnow
	•	Volatility Storms
	•	Battlefield Feed
	•	Bounty Bonuses
 
⸻
 
🎯 12. ADVANCED TRADE WAR GAMEPLAY
Pre-Battle Asset Draft
	•	Players/squads draft assets before battle.
	•	Host can configure draft rules.
Whale vs Minnow
	•	Optional balancing system.
	•	Possible Shield Tokens.
	•	Configurable limits.
	•	Optional only.
Volatility Storms
	•	Temporary volatility events.
	•	Dramatic market conditions.
	•	Clearly virtual.
Battlefield Ticker
	•	Live Trade War event feed.
	•	Important player/trade events.
Bounty Board
	•	Place virtual bounties.
	•	Target specific players.
	•	Hunter/defender rewards.
	•	Prevent bounty farming.
 
⸻
 
📈 13. TRADE WAR CHART
Create a dedicated Trade War chart.
	•	Buy
	•	Sell
	•	Entry price
	•	Current price
	•	P&L
	•	Stop Loss
	•	Take Profit
	•	Trade markers
	•	Fibonacci
	•	Three-Legged Strategy
	•	Simple UI
	•	SL/TP boxes:  
	•	Green/red
	•	Movable
	•	Flip appropriately on sell
	•	Price alerts:  
	•	Above
	•	Below
	•	Edit
	•	Delete
	•	Clearly identify Trade War alerts.
	•	Trade War chart uses the working FMP quote pipeline.
 
⸻
 
⚔️ 14. DRAMATIC CHALLENGES
When someone challenges another player:
	•	Dramatic challenge pop-up.
	•	Chart blades/swords concept.
	•	Challenger profile.
	•	“YOU’VE BEEN CHALLENGED”
	•	Accept / Decline.
	•	Smooth transition into Trade War.
	•	Professional, not cheesy.
	•	Fast enough that it doesn’t become annoying.
	•	Challenge history.
	•	Direct friend challenges.
	•	Squad/private-group challenges.
 
⸻
 
🌎 15. GLOBAL LEADERBOARD + HIGH-STAKES CHALLENGES
	•	Global leaderboard separate from private Trade Wars.
	•	Optional high-stakes virtual challenges.
	•	Configurable eligibility.
	•	Invite / Accept / Decline.
	•	Never automatically enter someone into a high-stakes match.
Virtual Risk System
	•	Configurable virtual competition balance at risk.
	•	Examples:  
	•	10%
	•	25%
	•	Clearly show amount at risk.
	•	Require explicit confirmation.
	•	No deduction before acceptance.
	•	Loss deducts the predefined virtual competition amount.
	•	Success can provide:  
	•	Virtual rewards
	•	XP
	•	Badges
	•	Status
	•	Achievements
	•	Multi-player support.
	•	Separate statistics.
	•	Countdown.
	•	Possible names:  
	•	Top Trader Challenge
	•	King of Market
 
⸻
 
🏅 16. ACHIEVEMENTS
Create custom AgenticTrading / Trade War achievement icons.
	•	Professional.
	•	Branded.
	•	Small/readable.
	•	Not generic.
	•	Not overly bubbly.
	•	Not generic AI imagery.
	•	Fix achievements so they appear correctly on public profiles.
Important badges:
	•	King of the Squad — Individual
	•	King of the Squad — Team
	•	Last Man Standing
	•	High-Stakes Winner
	•	Squad Winner
	•	Individual Winner
 
⸻
 
👥 17. FRIENDS / FOLLOWERS / COMMUNITY
	•	Friend requests.
	•	Notifications.
	•	Accept/Decline.
	•	View friends’ profiles.
	•	Followers.
	•	Following.
	•	Friend/follower lists.
	•	Username search.
	•	Contacts search.
	•	QR code for adding/finding users.
	•	Never automatically follow someone.
	•	Suggested follows based on:  
	•	Mutuals
	•	Trade Wars
	•	Squads
	•	Games
	•	Shared interests
	•	Similar activity
	•	After a Trade War, suggest relevant users to follow.
Messaging:
	•	DMs.
	•	Private chat.
	•	Live chat for stock theses.
	•	Group discussions.
 
⸻
 
📤 18. TRADE SHARING
Create shareable branded Trade Cards.
Include:
	•	Profile picture
	•	Username
	•	Stock
	•	Direction
	•	Result
	•	%
	•	P&L
	•	Chart
	•	AgenticTrading branding
Allow users to share notable trades externally.
 
⸻
 
🧠 19. STOCK THESES
Users can create:
	•	Public theses.
	•	Private theses.
	•	Friend-only theses.
	•	Private group theses.
Fields:
	•	Stock
	•	Direction
	•	Thesis
	•	Chart
	•	User
	•	Timestamp
Interactions:
	•	Comments/reactions where appropriate.
	•	Private invitations.
	•	Live discussion.
 
⸻
 
👤 20. PROFILE
Profile should include:
	•	Edit Profile dropdown.
	•	Profile picture.
	•	Name.
	•	Username.
	•	Bio.
	•	Achievements.
	•	Public trading/community information.
	•	Trade War history.
	•	Reputation.
	•	XP/level.
	•	Relevant statistics.
Keep private information protected.
 
⸻
 
📊 21. TRADING + OPTIONS
Trading
	•	Clean brokerage-style interface.
	•	Estimated P&L visualization.
	•	Potential profit/loss.
	•	Position information.
	•	Clear charts.
Options
	•	Modern options layout.
	•	Estimated P&L.
	•	Potential profit/loss.
	•	Clean chain.
	•	Modern brokerage UX inspiration.
	•	Do not directly copy another brokerage’s interface.
 
⸻
 
🔔 22. ALERTS
Price Alerts
	•	Create directly from charts.
	•	Above/below price.
	•	Active alerts.
	•	Edit.
	•	Delete.
	•	Notifications.
Agent Signal Alerts
	•	New signal.
	•	Enable/disable.
	•	Agent.
	•	Stock.
	•	Direction.
	•	Entry/trigger.
	•	Target.
	•	Stop.
Trade War Alerts
	•	Trade War chart alerts.
	•	Notify user even when not viewing chart.
	•	Clearly identify Trade War alerts.
 
⸻
 
🌍 23. GLOBAL MARKET GLOBE
	•	3D market globe.
	•	Real market information.
	•	Current market times.
	•	Time zones.
	•	Markets such as:  
	•	New York
	•	London
	•	Tokyo
	•	Hong Kong
	•	Other major markets
	•	Focus on real market information.
	•	Do NOT make it look like a generic space/game environment.
	•	Keep globe transition smooth.
	•	Fix any globe loading/glitch issues.
 
⸻
 
📈 24. EXPAND ASSETS
	•	Expand supported US stocks.
	•	Additional markets/assets where appropriate.
	•	Consistent market data across:  
	•	Real Trading tools
	•	Trade War
	•	Charts
	•	Alerts
	•	Restricted Trade Wars must block unsupported assets.
	•	Keep asset data consistent throughout the platform.
 
⸻
 
🎮 25. ADVANCED TRADE WAR BATTLE MODES
Implement as optional modes:
	•	Head-to-Head
	•	Same Stock Battle
	•	Double Down
	•	Counterattack
	•	Revenge Match
	•	Best of 3
	•	Sudden Death
	•	Last Stand
	•	Bounty Hunt
	•	King of the Hill
	•	Winner Stays
	•	Tag Team
	•	Squad Wars
Rivalry System
	•	Rivalry record.
	•	Wins.
	•	Losses.
	•	Streaks.
	•	Biggest win.
	•	P&L.
	•	Rivalry badge.
	•	“Settle Score” button.
 
⸻
 
🏹 26. TRADER REPUTATION
Separate Reputation from XP.
Possible reputation labels based only on actual statistics:
	•	Hunter
	•	Survivor
	•	Fade
	•	Momentum Trader
	•	Contrarian
	•	Sniper
	•	Risk Taker
	•	Diamond Hands
	•	Paper Hands
	•	Comeback King
	•	Volatility Trader
	•	Bull
	•	Bear
Only display labels when the user’s actual statistics support them.
 
⸻
 
🎯 27. BOUNTY SYSTEM
	•	Virtual bounties.
	•	Hunter claims bounty.
	•	Defender reward.
	•	Achievements.
	•	Consecutive-win bonuses.
	•	Prevent farming/exploitation.
	•	Configurable bounty rules.
 
⸻
 
📡 28. LIVE TRADE WAR FEED
	•	Live Trade War event feed.
	•	Show important events.
	•	Tap event → battle/profile.
	•	Filters:  
	•	Friends
	•	Squad
	•	Global
Possible events:
	•	Big gain
	•	Big loss
	•	Bounty claimed
	•	Player eliminated
	•	Comeback
	•	Leader change
	•	Trade opened
	•	Trade closed
 
⸻
 
🔮 29. TRADE PREDICTIONS
Allow predictions such as:
	•	Bullish / Bearish
	•	Target reached
	•	Stop hit first
	•	Finish green
	•	Expected % move
	•	Outperform market
Reward with:
	•	XP
	•	Prediction achievements
Track:
	•	Prediction accuracy
	•	Lifetime accuracy
	•	Prediction history
 
⸻
 
💪 30. CONVICTION SYSTEM
	•	Conviction rating:  
	•	1–5
	•	Higher conviction can create:  
	•	Higher XP
	•	Greater consequences
	•	Special achievements
	•	Track:  
	•	High-conviction accuracy
	•	5/5 wins
	•	Prediction performance
	•	Shared trades can display conviction.
 
⸻
 
🔥 31. TRADE STATUS SYSTEM
Temporary statuses:
	•	Cooking
	•	Cooked
	•	Frozen
	•	Mooning
	•	Bleeding
	•	Survived
	•	Sniped
	•	Under Attack
Keep status animations professional and branded.
 
⸻
 
🏆 32. SEASONS
	•	Seasonal rankings.
	•	Seasonal achievements.
	•	Seasonal awards.
	•	Preserve lifetime statistics.
	•	Seasonal Trade War history.
	•	Seasonal reputation.
 
⸻
 
🎮 33. SPECIAL TRADE WAR MODES
Possible events:
	•	Market Crash
	•	Meme Week
	•	Bear Week
	•	24-Hour War
	•	One Shot
	•	Secret Trade
	•	Volatility Wars
	•	Blue Chip Wars
	•	Earnings War
All competitive balances remain virtual.
 
⸻
 
👀 34. SPECTATOR MODE
Allow users to watch active Trade Wars.
Show:
	•	Stock
	•	Live chart
	•	P&L
	•	Winner/current leader
	•	Timer
	•	Battle status
Features:
	•	Watch button.
	•	Friend battles.
	•	Reactions where enabled.
 
⸻
 
📤 35. SHAREABLE BATTLES
Create shareable battle cards.
Include:
	•	Traders
	•	Stock
	•	Direction
	•	Entry
	•	Exit
	•	Return
	•	P&L
	•	Winner
	•	Battle type
Allow:
	•	Share to social platforms.
	•	Active links to live battles where appropriate.
	•	“Bet Against Me” / “Take the Other Side” on eligible shared trades.
 
⸻
 
👑 36. TRADER REPUTATION PROFILE
Separate from normal XP.
Track:
	•	Career record
	•	Seasonal record
	•	Win streak
	•	Hunting
	•	Survival
	•	Rivalries
	•	Prediction accuracy
	•	Conviction accuracy
	•	Biggest wins
	•	Biggest comebacks
	•	Bounties
	•	Squad performance
 
⸻
 
🏅 37. EXPANDED ACHIEVEMENTS
Possible achievements:
	•	Founding Trader
	•	Squad Founder
	•	Recruiter
	•	Recruit 10
	•	Hunter
	•	Hunter Killer
	•	Survived Hunt
	•	Bounty Hunter
	•	Bounty Defender
	•	King of the Hill
	•	Comeback King
	•	Win Streak
	•	Rivalry Winner
	•	5/5 Conviction Winner
	•	Biggest Comeback
	•	Most Hunted
	•	Untouchable
	•	Squad Builder
	•	Trade War Champion
Use custom AgenticTrading / Trade War branding.
 
⸻
 
🚀 38. IPO WARS
Create a completely virtual IPO Wars game mode.
IPO Calendar
	•	Upcoming simulated IPOs.
	•	Company.
	•	Industry.
	•	Simulated IPO price.
	•	Open time.
	•	Status.
	•	Countdown.
	•	Description.
	•	Facts.
	•	Risk information.
IPO Launch
	•	Virtual money only.
	•	Equal virtual IPO starting budget.
	•	Limited initial shares.
	•	Allocation system.
	•	Requested shares.
	•	Shares received.
	•	Countdown.
	•	Launch animation.
IPO Trading
	•	Simulated live IPO price.
	•	Shares.
	•	Current price.
	•	%
	•	Position.
	•	Unrealized P&L.
	•	Milestones.
IPO Strategies
	•	Flip
	•	Hold
	•	Moonshot
	•	Fade
	•	Swing
Track strategy performance.
IPO Predictions
	•	Opening price.
	•	High.
	•	Low.
	•	End-of-day.
	•	One-week.
	•	Green/red.
Reward:
	•	XP
	•	Prediction achievements
Track lifetime prediction accuracy.
IPO Battles
	•	Players can take opposing positions.
	•	Same virtual rules.
	•	Optional hunting/bounty mechanics.
IPO Leaderboards
Separate rankings for:
	•	Best IPO Trader
	•	Best IPO Predictor
	•	Biggest Gain
	•	Best Flipper
	•	Best Long Hold
	•	Best Hunter
	•	Best Comeback
	•	Most IPO Wins
	•	Prediction Accuracy
IPO Modifiers
	•	Hot
	•	Limited
	•	After-Hours
	•	Crash
	•	Race
	•	Royale
IPO Achievements
	•	Pioneer
	•	Flipper
	•	Hunter
	•	Survivor
	•	Sniper
	•	King
	•	Early Bird
	•	Moonshot
	•	Contrarian
	•	Veteran
IPO Social
	•	Prediction cards.
	•	Result cards.
	•	IPO challenges.
	•	Shareable results.
	•	Historical IPO pages.
	•	IPO Hall of Fame.
Important:
	•	IPO Wars are completely virtual.
	•	Do not imply that simulated IPO performance predicts real-world investment performance.
	•	If IPO Wars use a special virtual budget, it must be clearly defined and must NOT silently create unlimited funds.
IPO LOOP:
Upcoming IPO → Research → Predict → Request Shares → Allocation → Launch → Trade/Hold → Battle → Close → Results → XP/Reputation/Badges → Share → Bring Friends
 
⸻
 
🛠️ 39. RECENT REQUIRED UPDATES
	•	Change Trade War main-page image.
	•	Owner will provide image.
	•	Change Challenge link image.
	•	Owner will provide image.
	•	Allow canceling pending Trade War orders.
	•	Friends & Profiles:  
	•	View friends’ profiles
	•	Followers
	•	Following
	•	Lists
	•	Contacts
	•	QR code
	•	Username search
	•	Make XP & Missions easier to find.
	•	Normal Chart Replay:  
	•	One-click autoplay
	•	Similar ease of use to Full Port
	•	Trade War Battle Preparation Guide:  
	•	Add second button to Trade War entry alert.
	•	Quick setup.
	•	Connect friends/contacts.
	•	Choose stock.
	•	Simple recommendations.
	•	Action-focused.
	•	Add Feedback / Complaints under Help / Support / Feedback.
	•	Future Broker Interest survey:  
	•	Keep low-profile.
	•	Clearly state it is interest/research.
	•	Do NOT imply current brokerage integration.
 
⸻
 
⚖️ 40. XP / COMPETITION / REWARDS
	•	XP-based competition system.
	•	XP can come from:  
	•	Trade Wars
	•	Predictions
	•	Missions
	•	Social activity
	•	Achievements
	•	Virtual rewards.
	•	Badges.
	•	Status.
	•	Tokens where appropriate.
	•	Keep real-money rewards separate.
	•	Legal/compliance review before introducing real-money wagering or cash prizes.
	•	Do not accidentally turn virtual Trade War balances into real-money gambling.
 
⸻
 
🪙 41. REAL-MONEY / WAGERING RESEARCH
	•	Keep current Trade Wars virtual.
	•	Research legal ways to eventually offer rewards or contests.
	•	Do not implement real-money wagering without legal/compliance review.
	•	Clearly separate:  
	•	Virtual currency
	•	Tokens
	•	Real money
	•	Any future rewards
	•	No real-money deposits should accidentally become part of the current Trade War system.
 
⸻
 
🪙 42. CRYPTO — LOWER PRIORITY
	•	Real Trading crypto tools.
	•	Trade War crypto.
	•	Weekend crypto competitions.
	•	Private group restrictions.
	•	Do not delay the core product for crypto.
 
⸻
 
💳 43. PRICING — FUTURE EXPLORATION
Possible ideas to evaluate:
	•	$15/month.
	•	$5.99 individual scan/setup.
	•	Unlimited vs limited scans.
	•	Free + paid scans.
	•	Free Trade War.
	•	Paid Real Trading tools.
	•	Token packages.
	•	Subscription that includes a monthly token allocation.
	•	Free tokens for new users.
	•	XP/level rewards that give tokens.
Important:
	•	Tokens are now the intended payment mechanism for scans.
	•	Pricing is still exploratory.
	•	Do not lock in pricing until usage, costs, conversion, and user behavior are evaluated.
 
⸻
 
🎬 44. TRADE WAR INTRO / RESULTS
Intro
	•	Black canvas: #0A0A0A
	•	Minimalist Zelos line art.
	•	Hover/click gold/blue glow.
	•	Fibonacci spiral transition.
	•	Professional cinematic feel.
Results
	•	Closing bell animation.
	•	Hero Trade.
	•	Biggest Blunder.
	•	Final ranking.
	•	Final P&L.
	•	Eliminations.
	•	Emoji reactions/roasts if enabled.
	•	Share results.
 
⸻
 
🧭 45. FINAL DEVELOPMENT PRIORITIES
🔴 PRIORITY 1
	•	Simplify layout.
	•	Separate Real Trading / Trade War.
	•	Trade War top-level navigation.
	•	Custom dashboard.
	•	Dashboard customization.
	•	New-user onboarding.
	•	Profile.
	•	First Trade.
	•	Challenge Friend.
	•	Core Trade War.
	•	Separate Trade War accounts.
	•	Equal Trade War buy-ins.
	•	Trade War leaderboard.
	•	Dedicated Trade War chart.
	•	FMP live quote fix.
	•	Preserve mobile.
🟠 PRIORITY 2
	•	Dramatic challenges.
	•	Last Man Standing.
	•	Friends.
	•	Followers.
	•	Notifications.
	•	Trade sharing.
	•	Stock theses.
	•	DMs.
	•	Squads.
🟡 PRIORITY 3
	•	Squad competitions.
	•	Advanced Trade War mechanics.
	•	Achievements.
	•	High-Stakes virtual challenges.
	•	Price alerts.
	•	Agent alerts.
	•	Global market times.
	•	Stock expansion.
	•	Options improvements.
🟢 PRIORITY 4
	•	XP competition expansion.
	•	Legal reward research.
	•	Crypto.
	•	Pricing experiments.
	•	Advanced events.
	•	IPO Wars expansion.
 
⸻
 
🧠 46. CORE PRODUCT PRINCIPLES
	•	Real Trading and Trade War are separate systems.
	•	Trade War is the virtual-money trading/competition environment.
	•	Trade War participants start with equal configured virtual capital.
	•	Real Trading is separate from Trade War.
	•	Trade War balances are virtual.
	•	Private competition should have fair starting conditions.
	•	Competitive features should be optional/configurable.
	•	Risk/reward should be transparent.
	•	Never automatically enter users into high-stakes competitions.
	•	Keep real-money wagering separate pending legal/compliance review.
	•	Simple interface.
	•	Professional trading competition/community.
	•	Do not make the platform feel like a generic AI game.
	•	Keep AgenticTrading branding consistent.
	•	Dramatic but professional.
	•	Trade War should support users who want to trade competitively as well as users who simply want to use the virtual trading environment.
	•	Preserve mobile functionality.
	•	Test the experience from both:  
	•	Brand-new user perspective
	•	Experienced trader perspective
 
⸻
 
🔁 47. CORE PRODUCT LOOP
SIGN UP
↓
CREATE PROFILE
↓
MAKE FIRST TRADE
↓
IMPROVE SKILLS + EARN XP
↓
CHALLENGE FRIEND
↓
ENTER TRADE WAR
↓
COMPETE WITH EQUAL VIRTUAL CAPITAL
↓
EARN XP / BADGES / REPUTATION
↓
KEEP TRADING
↓
CHALLENGE AGAIN
This creates the core AgenticTrading ecosystem:
📈 REAL TRADING
Learn → Analyze → Use Trading Tools → Make Real-World Decisions Independently
⚔️ TRADE WAR
Trade → Challenge → Compete → Win/Lose → Earn Reputation → Challenge Again
Both systems remain part of AgenticTrading.info, while real-world trading and virtual Trade War activity remain clearly separated.

also make sure cookies are on only when a user is legally required to see that and check terms of service is good, also with the the comments and reactions, make sure those have a basic guidelines restrictions on those. dont spam email.


Make the website feel like a premium trading platform rather than a collection of webpages.

Use smooth, purposeful transitions between screens and components.

Preserve all existing functionality and mobile layouts.

Do not redesign working components unnecessarily.

Do not add animations just for decoration.

Animations should communicate navigation, state changes, trading actions, competition, XP progression, achievements, and important events.

Use consistent timing, easing, spacing, and transition behavior throughout the site.

Prioritize performance and responsiveness.

Animations must never delay a user’s ability to trade or navigate.

Respect reduced-motion accessibility settings.

Keep the visual language professional, trading-focused, dark/blue/white/black, and consistent with AgenticTrading.info.

Avoid bubbly, childish, generic-AI, or excessive game-style animations.

Build transitions progressively. Do not replace the entire UI at once.

First audit the existing application and identify which screens/components can support shared transitions.

Then create a reusable motion system that can be used across the application.


Keep progress reports concise. Focus on actions, files changed, tests, and blockers.


Only implement what is required for the current phase.
Do not refactor unrelated code.
Do not create abstractions for hypothetical future features.
Do not create unnecessary files.
Do not rewrite working systems simply to make them "cleaner."
```
