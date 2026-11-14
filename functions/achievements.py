"""Achievements the server grants itself (owner 2026-11-14): learning, community, strategies and
one Solo milestone. Each one is decided here from what the server actually recorded, never from a
page being opened, and granted once (main.award_achievements: users/{uid}.progress.achievements,
the public profile, and its XP from xp.ACHIEVEMENTS).

  student-market     Student of the Market   pass 3 Trading 101 chapter quizzes
  market-scholar     Market Scholar          pass every Trading 101 chapter quiz
  historic-expert    Historic Expert         finish every lesson in the Hall of Minds
  first-post         On the Board            share your first post with the community
  first-victory      First Victory           share a winning trade or battle
  honest-trader      Honest Trader           share a losing trade or battle
  first-friend       Friendly                add your first friend
  squad-talk         Say Hello               send your first message in a squad chat
  conversationalist  Conversationalist       send 25 messages in squad chats
  strategist         Strategist              use a strategy for the first time (a pass or an unlocked alert)
  multi-strategist   Strategy Explorer       use 3 different strategies
  strategy-regular   Strategy Regular        use strategies 10 times
  round-trip         Gave It All Back        reach +60% in Solo, then fall below $10,000 (same account, no reset)
"""

STUDENT_CHAPTERS = 3
SQUAD_MSGS = 25
MULTI_STRATEGIES = 3
STRATEGY_ACTS = 10
ROUND_TRIP_PEAK = 16000.0  # +60% on the $10,000 start
START = 10000.0


def learn_awards(passed, chapters):
    """passed: users/{uid}.learnPassed {chapter: ms}; chapters: every chapter id (learn.ORDER)."""
    passed = passed if isinstance(passed, dict) else {}
    n = sum(1 for c in chapters if passed.get(c))
    out = []
    if n >= STUDENT_CHAPTERS:
        out.append("student-market")
    if chapters and n == len(chapters):
        out.append("market-scholar")
    return out


def minds_award(done, all_refs):
    """done: lesson refs ("figure:lesson") read; all_refs: every lesson in the Hall of Minds."""
    all_refs = set(all_refs or [])
    return ["historic-expert"] if all_refs and all_refs <= set(done or []) else []


def post_awards(card):
    """A shared card (functions/posts.py): any post, then a win or a loss by its P&L."""
    out = ["first-post"]
    pnl = (card or {}).get("pnl")
    if isinstance(pnl, (int, float)) and not isinstance(pnl, bool):
        if pnl > 0:
            out.append("first-victory")
        elif pnl < 0:
            out.append("honest-trader")
    return out


def squad_awards(messages):
    out = []
    if messages >= 1:
        out.append("squad-talk")
    if messages >= SQUAD_MSGS:
        out.append("conversationalist")
    return out


def strategy_awards(used, acts):
    """used: the different strategies you've used; acts: how many times (passes + unlocks)."""
    used = set(used or [])
    out = []
    if used:
        out.append("strategist")
    if len(used) >= MULTI_STRATEGIES:
        out.append("multi-strategist")
    if acts >= STRATEGY_ACTS:
        out.append("strategy-regular")
    return out


def round_trip(peak, equity):
    """Gave It All Back: this Solo account (a reset starts a new one, and its peak) once reached
    +60% and is now below where it started."""
    try:
        return float(peak) >= ROUND_TRIP_PEAK and float(equity) < START
    except (TypeError, ValueError):
        return False
