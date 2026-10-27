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

---

## ADDENDUM 2026-10-27: consolidated update lists A–D

Added on 2026-10-27 from four lists the owner pasted. **The checklist above is unchanged and still
the source of truth;** this addendum only adds to it. Where an item repeats something in the checklist
or something already built, it says so and points to it instead of restating it as new.

**Sources (each item below is tagged with where it came from):**
- **A**: Zelos Trade Wars — Additional gameplay requirements (War lobby, territories, challenges, Squad rulesets)
- **B**: Zelos Trade Wars — Main hub, navigation and dashboard
- **C**: Zelos — Dashboard redesign, swipeable pages and global navigation
- **D**: Zelos — Website and app bug fixes, polish and onboarding
- **H**: still-open items from `docs/HANDOFF.md` (2026-10-27)

**Ground rules from these lists (they apply to every phase below):**
- Preserve existing working functionality; additions only; reuse existing systems, names and components (A, B, C, D).
- Server-authoritative for everything that matters: match state, deployments, challenges, balances, tokens, missions, XP (A, C, D; checklist Security).
- Never mix portfolios between Solo, Battle, Squad and War; every number on screen says which one it belongs to (B, C).
- No new paid data provider; delayed data is labelled as delayed (C).
- No invented token prices or rules: anything unspecified goes to the owner as a question (A, D).
- Restrained motion (GSAP only where it already fits), always with a reduced-motion version (B, C, D; checklist Motion).
- Reproduce and report before broad fixes (mobile glitches, D); inventory before writing (Trading 101, D); ask before editing (Hall of Minds pictures, D).

### 1. What exists today (inspection, 2026-10-27)
So the plan builds on what's there instead of rebuilding it:
- **Trade War matches** (`functions/main.py`, `tw_*`; app `features/battles`):
  - statuses `lobby | draft | active | ended | cancelled`;
  - equal buy-in; long-only trades on the server quote;
  - Last Man Standing (`lms`), snake draft (`modes.draftPicks`), whale/shields, storms, bounties, stops, ticker events;
  - revive, battle slots, surrender, buy-in level locks;
  - locked until the Chapter 1 quiz is passed.
  - The classic site's `practice/` pages use the same functions.
- **Squads** (`features/social`): squad Trade Wars with allowed-stock lists and a "view trades" option (`tw_squad_rules`).
- **Solo:** the server-run $10,000 practice account (`features/practice`), shown on the Dashboard since 2026-10-20 and in the Trade War tab.
  - There is no "Chaos Simulator".
  - The checklist's "Practice Mode must NOT be reintroduced" refers to the old classic-site mode; Solo is the existing account and must stay one account.
- **War with territories / deployment pieces / enemy presence:** **does not exist** in code or in any repo doc. The A list says "preserve the existing spec", but no such spec is in the repo (see Q1).
- **Header (phone):** logo, then Tokens · Profile · Bell · ☰ (`shell/AppShell.tsx`). The desktop has a sidebar. The token chip opens a sheet with buy options and the last 15 ledger lines (`strategies/Tokens.tsx`, `TokenHistory.tsx`).
- **Charts** (`features/charts`): line **and** candlestick styles already exist; line is the default (owner, 2026-10-09).
- **Dashboard** (`features/dashboard`): one page of panels, with the Solo account inside it.
- **Strategies** (`features/strategies`):
  - Swing Trader, Breakout Rider, Options Scanner and 3-Leg Options (paid passes);
  - no "Position Builder" and no "saved strategies" (the Position Builder is only an idea in `MASTER_PLAN.md`).
- **Learning:**
  - Trading 101 has 2 chapters (`learn/chapters.ts`); Chapter 1 lesson 2 "Why prices move" mentions 9:30–4:00 New York time in one step only.
  - First steps / onboarding is in `features/welcome` (`FirstSteps.tsx`).
- **Hall of Minds** (`features/minds`):
  - `BookIntro.tsx` flips every figure page, then fades out; it has no closing back cover.
  - 48 picture files are in `webapp/public/minds/`.
- **Push notifications** use `icons/icon-192.png` plus `images/alert-*.png` (`_push_send`, `functions/main.py`). Those images predate the new logo.
- **Rematch:** none exists.

### 2. Consolidated requirements (deduplicated, classified)
Each ID is used by the phases in §3. **Cat** gives the class:
- **S**: critical security or data integrity;
- **N**: core functionality or broken navigation;
- **M**: market data and calculations;
- **F**: feature implementation;
- **U**: UI/UX and visual polish;
- **T**: testing and release readiness.

#### S: security and data integrity
| ID | Requirement | From |
|---|---|---|
| S1 | Portfolio isolation: Solo, Battle, Squad and War positions, orders, cash and P&L never mix; every list and metric carries its context label. | B, C |
| S2 | War: opponents' deployment placements and chip counts stay hidden. They're stored where only the server and the owner can read them, are never in shared docs, the events ticker, notifications or subscriptions, and are revealed only by the server when the rules say so. | A, D |
| S3 | War enemy-presence warning: the server computes a safe yes/no (or coarse) indicator; it never sends counts. Audit the existing rules and listeners for leaks first. | D |
| S4 | Token Store: the balance shown is the server's; buying uses the existing Square flow (hidden on iOS, rule 3.1.1); purchases are idempotent; the full ledger history comes from the server ledger. | D |
| S5 | Challenges: locked parameters (stake, symbol, side, window) are set at creation and can't be changed by either side afterwards; the server resolves them from its own prices; no double resolution. | A |
| S6 | Match lifecycle: a match starts exactly once (idempotent start), and joins, leaves and readiness are checked on the server against the state. | A |
| S7 | Daily missions shown on the Profile page are server-validated (reuse the existing missions/XP backend). | C |
| S8 | Rematch makes a new match document; it never reopens or duplicates an old one, and a double tap creates one rematch. | D |
| S9 | Notifications never leak hidden information (deployments, opponents' private choices). | A, D |

#### N: core functionality and navigation
| ID | Requirement | From |
|---|---|---|
| N1 | Global header, same order on every screen: **Menu → Account/profile → Tokens (balance) → Notification bell (unread badge)**. | C |
| N2 | Trade War icon smart routing, in deterministic priority: (A) in a Solo session → Solo; (B) has active competitions → Trade Wars Dashboard; (C) none → Mode Selection. | B |
| N3 | Mode Selection: compact grid of Solo / Battle / Squad / War with the bull/bear art. | B |
| N4 | Trade War section nav: Overview / Solo / Battle / Squad / War / Leaderboards / Strategies, switching without page reloads. | B |
| N5 | Return to the exact lesson or test step after opening a chart from it. | D |
| N6 | Find a Stock → "How do you want to trade this stock?" modal (Solo Trade / Battle), carrying the ticker. Shown only at the Find a Stock entry point; inside an active mode, keep that mode's context. | C |
| N7 | Session and state rules: resume where you were in each mode; back navigation behaves; nothing lost on page switch. | B, C |
| N8 | Mobile glitches: reproduce, list and report first, then fix in targeted PRs. | D |

#### M: market data and calculations
| ID | Requirement | From |
|---|---|---|
| M1 | Dashboard primary chart in candlesticks/OHLC with a timeframe switch, real data, delayed data labelled. Reuse `ChartView` candles. | C |
| M2 | P&L, portfolio value, buying power and cash, scoped per mode and labelled. | C |
| M3 | Market page: U.S. indices (via the index ETFs already quoted: SPY, QQQ, DIA if added to the list), top movers, overview, watchlist. No new provider; respect the Marketstack cap. | C |
| M4 | Three-Leg Strategy chart in the existing strategy-chart style with the correct payoff for each strategy; the calculations themselves don't change. | D |
| M5 | Challenge resolution math (long vs short over a fixed window, from server prices). Needs **short selling** inside the match book, which the server doesn't support today (long only). | A |
| M6 | Leaderboard/summary metrics clearly scoped (per match, per mode, overall). | B |

#### F: features
| ID | Requirement | From |
|---|---|---|
| F1 | War creation flow: the organizer places their deployments, which then lock; the match goes to a queued/recruiting lobby. | A |
| F2 | War lobby states (configuring, queued, recruiting, ready, starting, active, completed, cancelled), mapped onto the existing status names; readiness UI; min/max players; deadline outcomes; the organizer leaving; disconnect/rejoin. | A |
| F3 | Hidden deployment-piece claims on territories: higher total wins, ties stay neutral. | A |
| F4 | Direct stock-trading challenges between territory owners (one long, one short). Covers the challenge flow and rules, defender options, a limit on active challenges, surrender during a challenge, and notifications without leaks. **Recommended capture model:** a won challenge earns attack progress on the territory, and hidden deployment stays the main way to capture. | A |
| F5 | Squad rulesets as a layer on the one match engine (no separate engines): Free-for-all, Team Cooperation, Fantasy Draft, Last Man Standing. | A |
| F6 | Fantasy Draft: draft order, pick count, pick timer, optional ban phase. Reuses the existing snake draft. | A |
| F7 | Last Man Standing (Squad ruleset): explicit thresholds; no elimination on a temporary unrealized loss unless the ruleset says so. Reuses `lms`. | A |
| F8 | Future squad modes are **listed only, not built** (no unfinished UI). | A |
| F9 | Squad section split: Together (Team Cooperation…) / Compete (FFA, Fantasy Draft, Last Man Standing). | B |
| F10 | Battle panel: create, join, invites, public, active, completed, resume. Mostly exists in `/battles`; regroup it. | B |
| F11 | War panel: create, join, public, private codes, queued, active, completed. | B |
| F12 | Solo section: Real Market and Chaos Simulator, resume; never mixes portfolios. **Chaos Simulator doesn't exist** (Q5). | B |
| F13 | Trade Wars Dashboard: summary strip, Open Matches grouped by mode, Create/Join, leaderboard preview, strategies panel (reuse), recent activity, empty states. | B |
| F14 | Dashboard as 4 pages: Trading / Profile / Market / Strategies. Persistent page nav row and phone swipe that doesn't fight vertical scroll, charts or the OS back gesture. Reduced motion. Shortcut back to Trading. | C |
| F15 | Trading page: positions and orders labelled by context, with View All. | C |
| F16 | Profile page: avatar, XP/level, rank, streaks, achievements, leaderboard preview, daily missions. | C |
| F17 | Strategies page: links to the scanners and strategies that exist, with no duplicate token charges. Position Builder and saved strategies **don't exist** (Q6). | C |
| F18 | Token icon → Token Store: balance, bundles at the existing prices, the full ledger history (paged). | D |
| F19 | Battle and War Rematch: a new instance with editable settings and no duplicates. | D |
| F20 | Short contextual animated tutorials: skip and replay, never place trades, one framework for all. | D |
| F21 | First-trade visual walkthrough: highlight the controls; the trade needs an explicit confirm. | D |
| F22 | Onboarding checklist discoverability (reuse `FirstSteps`, no second checklist). | D |
| F23 | Help and notification visibility: easy to find, not intrusive. Links with the queued "Help & feedback" screen (H). | D, H |

#### U: UI/UX and polish
| ID | Requirement | From |
|---|---|---|
| U1 | Replace the outdated notification image with the approved one; check caching (service worker, CDN, `?v=`). | D |
| U2 | Hall of Minds ("Hall of Mines" in the list) picture polish. **Make a contact sheet first and ask the owner which pictures; no edits before they choose.** | D |
| U3 | Hall of Minds opening: the final frame is the red book's back cover with a quote (no white page, no flash); reduced motion respected. | D |
| U4 | Responsive desktop and phone layouts for the hub and the dashboard. | B, C |
| U5 | Visual rules: square UI, bull/bear logo, tokens.css colours. Readable numbers, consistent labels. | C, owner |
| U6 | Empty states for every new list (no matches, no positions, no challenges…). | B |

#### Content (part of F/U)
| ID | Requirement | From |
|---|---|---|
| L1 | Inventory Trading 101: list what's incomplete before writing anything. | D |
| L2 | Chapter 1 lesson 2 "Why prices move": U.S. hours 9:30–4:00 ET, pre-market and after-hours, global sessions, time zones and daylight saving time, why it matters. Check other lessons so nothing is said twice. | D |
| L3 | Finish Trading 101 (Chapter 3+, already queued). | D, H |

#### T: testing and release readiness
| ID | Requirement | From |
|---|---|---|
| T1 | A's list of tests: lifecycle transitions, start-once, min/max, deadlines, organizer leaving, rejoin, hidden-info leak tests (rules + payloads), claim ties, challenge resolution, surrender, limits, every ruleset. | A |
| T2 | Navigation tests: routing priority A/B/C, header order on every screen, swipe and reduced motion, Find a Stock modal, return-to-lesson. | B, C, D |
| T3 | Data tests: per-mode isolation, Token Store balance and ledger, idempotent purchases (reusing the Square e2e). | C, D |
| T4 | Security audit and load test before launch. | H |
| T5 | Every PR: lint, typecheck, unit, build, Playwright phone and desktop with axe, rules tests, functions e2e; screenshots or video for the owner. | owner |

Also still open from H (unchanged):
- swipe lessons for the other 6 figures;
- news/thesis posts;
- the 3-Leg server scanner;
- the options payoff drill;
- the iPhone app (#81, on hold);
- the loose ends (classic-site look, favicons, README, Dependabot, Node 20 actions, stale PROJECT_STATE sections).

### 3. Phases (safest order)
One PR per item unless it says otherwise. Each phase waits for the owner's go, and its PR waits for "merge".

**Phase 0: Plan (this document).** Docs only.

**Phase 1: Audits and reports (no app changes).** N8, L1, U2-sheet, S2/S3/S9 leak audit, A's audit step, U1 inventory.
- Deliverables:
  - a mobile glitch report with screenshots and video;
  - a Trading 101 inventory;
  - a Hall of Minds contact sheet (every picture, numbered);
  - a rules/listener leak audit of `tradeWars/*` (what every player can read);
  - a current-image list for notifications;
  - an audit of existing Trade War/Squad modes against list A.
- Accept when: the owner has the reports and has answered the open questions that block later phases.
- Tests: none change; the reports cite files and lines.

**Phase 2: Global header + Token Store.** N1, F18, S4.
- Accept when:
  - the order is Menu → Account → Tokens → Bell on every screen, phone and desktop top bar, with the bell badge;
  - the token icon opens the Store: server balance, the existing bundles, and the full paged ledger;
  - buying uses the existing flow (hidden on iOS); no price is invented.
- Tests: AppShell unit tests updated; e2e header order on several routes; ledger paging; axe; Square e2e still green.

**Phase 3: Small, safe fixes.** U1, U3, M4, L2, N5. One PR each, in any order.
- Accept when:
  - the new notification image shows (cache-busted);
  - the book ends on the red back cover with a quote and no white flash, and reduced motion skips it;
  - the 3-Leg chart matches the existing strategy chart and shows each strategy's correct payoff;
  - the lesson covers hours, sessions, time zones and DST without repeating other lessons;
  - closing a chart returns you to the same lesson step.
- Tests: unit tests for the payoff shapes; e2e for return-to-lesson and the book's end frame; axe.

**Phase 4: Mobile glitch fixes** from the Phase 1 report, in the order the owner picks. N8.
- Accept when: each reproduced glitch is fixed on 375px and 390px phones with a before/after.
- Tests: an e2e case per glitch where practical.

**Phase 5: Trade War hub.** N2, N3, N4, F9–F11, F13, M6, U4, U6, N7. Uses only modes that exist; War and Chaos stay hidden until built.
- Accept when:
  - routing follows A > B > C deterministically;
  - the mode grid and section nav switch without reloads;
  - the dashboard summary strip is scoped; empty states are in place;
  - layouts work on phone and desktop.
- Tests: unit tests for the routing function (every combination); e2e per section; reduced motion; axe.

**Phase 6: Dashboard 4 pages.** F14–F17, M1–M3, S1, S7, U4.
- Accept when:
  - there are 4 pages with a nav row; swipe works on phones without breaking scroll, charts or back;
  - the primary chart is candles with timeframes and a delayed label;
  - every metric and position shows its mode;
  - the Market page uses existing data within the cap;
  - Strategies links only to things that exist.
- Tests: e2e swipe and keyboard, isolation (a Solo trade never appears in a Battle list and the reverse), chart style, axe; check the Marketstack call count.

**Phase 7: Find a Stock modal.** N6. Small; after Phase 6 because it routes into the new pages.
- Accept when: the modal appears only from Find a Stock, carries the ticker into Solo or Battle, and doesn't appear inside an active mode.
- Tests: e2e for both choices and for the no-modal case.

**Phase 8: Onboarding and help.** F22, F23, F21, F20 (in that order; one tutorial framework).
- Accept when:
  - the checklist is easy to find (and is the existing one);
  - the first-trade walkthrough highlights controls and never trades without the confirm tap;
  - tutorials can be skipped and replayed and have a reduced-motion version.
- Tests: e2e walkthrough (no order is placed until confirm); skip/replay persistence; axe.

**Phase 9: Rematch** for Battles. F19, S8. (War rematch follows Phase 11.)
- Accept when: one tap gives one new match with copied, editable settings; the old match is untouched.
- Tests: functions e2e (double call gives one match); app e2e.

**Phase 10: Squad ruleset layer.** F5, F8, then F6 (Fantasy Draft), then F7 (Squad Last Man Standing), then Team Cooperation. Design first (needs owner approval).
- Accept when: rulesets are a config on the existing match engine; existing squad wars and battles behave exactly as before.
- Tests: the existing 90 unit + 30 advanced + 27 squad e2e stay green; new tests per ruleset.

**Phase 11: War: queued lifecycle and lobby.** F1, F2, S6, F11. Design first (Q1, Q13).
- Accept when: every state transition is server-checked; start happens once; deadlines, organizer leaving and rejoin follow the approved rules.
- Tests: T1 lifecycle set; rules tests.

**Phase 12: War: territories and hidden deployment.** F3, S2, S3, S9.
- Accept when: placements are invisible to opponents in every read path; claims resolve on the server; ties stay neutral; the presence warning shows no counts.
- Tests: rules tests proving opponents can't read placements; payload tests on events and notifications.

**Phase 13: Direct trading challenges.** F4, S5, M5 (short selling in match books).
- Accept when: parameters lock at creation; the server resolves from its own prices once; the capture effect follows the approved model; limits and surrender work.
- Tests: math unit tests for long and short; double-resolution test; leak tests; e2e.

**Phase 14: War rematch, notifications, leaderboards and docs for War and Squads.** F19 (War), S9, M6.

**Phase 15: Content.** L3 (Trading 101 Chapter 3+), U2 (Hall of Minds pictures, only after the owner's selection), the remaining HANDOFF queue.

**Phase 16: Release readiness.** T4 security audit and load test, a full regression on phone and desktop, docs.

**Dependencies:**
- Phase 2 (header) comes before Phases 5–8, which all sit under the header.
- Phase 5 (hub) comes before 9–14, which add panels to it.
- Phase 6 must land before Phase 7.
- Phase 10 (ruleset layer) comes before Fantasy Draft and Last Man Standing.
- Phase 11 → 12 → 13 → 14.
- Short selling (M5) is needed only by Phase 13.
- U2 waits on the owner's picture selection.
- Phase 1's answers unblock Phases 4, 11, 12 and 15.

### 4. Open questions for the owner
- **Q1** War with territories: no War/territory spec or code exists in the repo. Is there a document to paste, or should a design be written for approval? This covers map size, territory count, piece budget, reveal timing and win condition.
- **Q2** Capture model: approve "challenges earn attack progress; hidden deployment stays primary"? How much progress does a win give, and does progress decay?
- **Q3** Short selling in challenges: the max loss on a short, whether a cash or margin requirement applies, and whether shorting is allowed only inside challenges.
- **Q4** Dashboard chart: candles on the Dashboard's main chart only, or change the app-wide default from line (2026-10-09 decision)?
- **Q5** Chaos Simulator: build it (what is it: random or synthetic prices?) or leave it out until designed? Rule: nothing unfinished in the app.
- **Q6** Position Builder and saved strategies don't exist: link only to what exists now, or build them (separate phase)?
- **Q7** Header on desktop: the same top-bar order there too, with the sidebar kept?
- **Q8** "Hall of Mines" = Hall of Minds? Which pictures (from the contact sheet)?
- **Q9** The approved notification image: which file? Please send or point to it.
- **Q10** Book back cover: which quote, or a rotating one?
- **Q11** Naming: is "Solo" the existing $10,000 account under a new name (one account, not a new Practice Mode)?
- **Q12** Min and max players for War, the lobby deadline, and what happens at the deadline (start with who's ready, or cancel and refund).
- **Q13** Status names: keep the stored `lobby/draft/active/ended/cancelled` and show the new names as labels? (Recommended: renaming stored values breaks the classic site and old matches.)
- **Q14** Last Man Standing squad thresholds (percent drop, check times) and whether unrealized losses count.
- **Q15** Limits: active challenges per player, a challenge stake (virtual cash or tokens? Tokens would be a payments decision), and the challenge window length.
- **Q16** Fantasy Draft: pick count, timer and whether the ban phase is on by default.
- **Q17** Team Cooperation: how a team score is made (sum, average) and whether teammates see each other's trades.
- **Q18** Market page indices: OK to show SPY/QQQ/DIA ETFs labelled as "index ETFs" (true index levels would need another provider)?

**Owner answers (2026-10-27, second message):**
- **Q1:** write a War design for approval. Done: `docs/WAR_DESIGN.md` (draft, waiting for approval).
- **Q2:** approved. Challenges earn attack progress; hidden deployment stays the main way to hold territory.
- **Q3:** the short side exists **only inside challenges**, with a **fixed maximum loss** (a set amount, "more like a put"). It's shown as simple Bull/Bear sides for new users. Virtual money only.
- **Q4:** **candles are the default on every chart, green up / red down,** unless the user picks other colours in Settings. (This changes the 2026-10-09 line default.)
- **Q5:** Chaos Simulator: wild charts (generated, or real ones that went crazy) on the same timeframes, with 20% days instead of 2%. You keep only **5–10% of the profit**. Details are in `docs/WAR_DESIGN.md` §7.
- **Q9:** the owner didn't remember the approved picture, so new ones were proposed in the share-picture (#120) style. **Approved by the owner (2026-10-27, third message):** keep that design and add a Territory Battle picture in the same style.
- **Q8:** yes, "Hall of Mines" is the Hall of Minds.
- **Q11:** "Solo" means trading on your own (not on a team). A Solo account can stay open while you're in a head-to-head battle, and each keeps its own account value.

Still open: Q6, Q7, Q10, Q12–Q18. Most of them get proposed answers in `docs/WAR_DESIGN.md` §9 for the owner to approve.

### 4b. War Mode rules update (owner, 2026-10-27, third message)
The owner's "War Mode Rules, Balancing & Pre-Phase-One Updates". Full rules are in `docs/WAR_DESIGN.md` **v2**.

**Approved by the owner (keep; don't change without a specific, written reason):**
- The v1 numbers:
  - 100 pieces, 2–10 players, sector territories;
  - map 6/8/10 territories;
  - stake 5% of the buy-in;
  - capture after 1 + pieces÷20 battle wins;
  - Chaos payout 5%.
- The capture model, and the short side only in challenges with a fixed max loss (Bull/Bear).
- **Notification pictures** (new-logo style), and the **new logo** direction everywhere.
- Approving the pictures and the logo does **not** approve any mechanic.

**NOT approved:** `docs/WAR_DESIGN.md` **Section 9** stays pending until the owner explicitly approves it. The earlier approval was withdrawn.

**New requirements (IDs continue §2):**
| ID | Cat | Requirement |
|---|---|---|
| W-R1 | S | During the claiming stage, nobody sees opponents' choices; owners are revealed after claiming ends; piece counts are never shown. |
| W-R2 | F | A tie on a claim starts a tie battle at once between the tied players. The winner gets the territory, it's never left unresolved, the loser must attack or claim neutral, and both get notifications and results. Battle rules and the ownership-record update are documented. |
| W-R3 | F/S | Attacking an owned territory requires a minimum of simulated money (the stake) and a performance condition. It uses the same battle system; the territory transfers on a win and stays on a loss. Entry, stakes, settlement and consequences are defined before code. |
| W-R4 | F | Defender counterplay: limited, fair, no guaranteed edge, no endless battles. |
| W-R5 | F | One consistent decline policy: response deadline, reminder, what a decline does, and what no response does. |
| W-R6 | F | Comeback balance: struggling players can recover; no runaway leader; no handouts; skill isn't punished. |
| W-R7 | F/S | Neutral territories can be claimed without a battle but are worth less XP and points than battle-won land. Neutral land becomes contested after a battle. No farming through repeated claims, releases or ownership changes. |
| N-R1 | F | A territory-battle notification (challenged/attacked) plus states: accepted/declined, resolved, territory won/lost, deadline approaching. Uses the existing notification design system and the approved pictures. |
| N-R2 | F | Invitations: coaching, battle and team-up each show who, what, and that flow's own actions. They stay separate flows (existing invite kinds `coach`, `battle`, `squad`, plus `twInvites`). |
| U-R1 | U | Keep the approved logo and notification art; no generic replacements or redesigns. |

**Proposed answers** are in `docs/WAR_DESIGN.md` v2 §3–§12:
- tie battle on a random stock, coin flip for the first side pick, no stake, no draw;
- attack eligibility = stake in cash + (return ≥ 0% or a +1% winning trade in 2 days);
- Counter-pick once per trading day;
- 1 free decline a day, then a concession (progress only), no answer = auto-accept, 30-minute reminder;
- Giant-slayer bonus + leader exposure + points counted at the end;
- 1/2/3 points for neutral/deployed/battle land; neutral claims 1 a day.

**Conflicts with earlier specs or code:** listed in `docs/WAR_DESIGN.md` §15. Main ones:
- list A's "ties neutral" is replaced by rule 2;
- list D's enemy-presence warning conflicts with rule 1;
- v1 "most territories wins" becomes "most points".

**Unresolved decisions (need the owner):**
- **W1** Enemy-presence warning: drop it during claiming (proposed) and show only "Contested: tie battle" after the reveal?
- **W2** Tie battles: no stake (proposed) or the normal 5% stake? Do 3+ tied players use a "best pick" battle (proposed)?
- **W3** Attack performance threshold: return ≥ 0% **or** a winning trade of +1% in the last 2 trading days (proposed). Is +1% right? Adjust after test Wars?
- **W4** Defender counterplay: approve Counter-pick (swap the stock, once per trading day)?
- **W5** Declines: 1 free a day, then a concession that gives the attacker progress only (no money, points or XP). No answer within 2 market hours = auto-accept. Approve?
- **W6** Comebacks: Giant-slayer +1 point (+1 more for taking the leader's land), and the leader gets no free declines. Approve?
- **W7** Points 1/2/3 and neutral claims limited to 1 a day. Approve? Should neutral claims need the attack performance rule (proposed: yes)?
- **W8** XP values: neutral 2, battle win 10, defence 10, Giant-slayer +5 (all within the existing daily caps).
- **W9** Piece counts never revealed, even after the War (proposed), or a reveal on the results screen?
- **W10** Redeploy pass for the tie-battle loser (proposed). Approve?
- **W11** Ping-pong rule: you can't attack back land you just lost for 1 trading day. Approve?
- **W12** Chaos losses counted at 5% too, and 1 paid session a day (still pending from v1).

### 5. Risks and breaking changes
- **Hidden-information leaks (high).** Today `tradeWars/{id}/accounts` is readable by all players and the ticker is player-readable. Deployments need new owner-only docs plus server-only reveal. Rules tests are required before any War UI.
- **Short selling changes match accounting** (`tw_apply_trade`, `tw_mark`, knock-outs, LMS floors). It touches every mode, so it's limited to challenges unless decided otherwise.
- **Status renames** would break existing matches, the classic site's `practice/` pages and tests. The plan is to map labels, not rename stored values.
- **Dashboard restructure** changes a screen users know (Practice moved there on 2026-10-20). Many e2e tests and selectors change; Solo must remain one account.
- **Header reorder** touches every screen and the AppShell tests; the phone top bar is tight at 375px.
- **Swipe** can conflict with chart pan, horizontal lists and the iOS back gesture. Swipe should be limited to the page body outside charts.
- **Data costs:** more live charts and movers mean more Marketstack calls and Firestore reads. Keep the 95k cap and reuse `markets/quotes`.
- **Payments and iOS:** the Token Store must stay hidden for purchase on iOS (3.1.1). Bundles must use the existing approved prices.
- **Scope:** lists A–D are many PRs. War (Phases 11–14) is a new game system and the largest risk to fairness. Its design needs approval before code.
- **Nothing unfinished:** War, Chaos Simulator and future squad modes must not appear until they work.
