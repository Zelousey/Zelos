"""
Zelos Cloud Functions - leaderboard-agentictrading project.

Runs inside the leaderboard-agentictrading Firebase project, so both functions
below can read/write that project's Firestore using the project's own built-in
permissions - no downloaded service-account key needed anywhere.

publish_alert          - a scheduled Claude task calls this over plain HTTPS
                          with a shared secret to publish a generic Zelos
                          alert.
release_alerts         - every weekday just after the 4 pm ET close: makes the
                          day's full alert public (see publish_alert).
tokens_*, squareWebhook - the token wallet, passes, unlocks and Square
                          Checkout (see the Tokens section at the end).
update_alert_outcomes  - a scheduled Claude task (with Robinhood market data)
                          calls this once it has decided what actually
                          happened to one or more previously-published
                          alerts - see scripts/check_alert_outcomes.py for
                          the decision logic and docs/firestore-alerts-setup.md
                          for the full runbook. This is what fills in the
                          `outcome` field docs/data-model.md already
                          documents, turning alert-history.html from a feed
                          of predictions into an honest track record.
post_to_buffer         - the same kind of scheduled Claude task calls this
                          once a day to drop one post into Nate's own,
                          already-connected Buffer queue: either "this alert
                          just ran to target 2" (see the target2Hit tracking
                          in scripts/check_alert_outcomes.py) or, on a day
                          with nothing to brag about, a plain market recap -
                          see docs/buffer-automation.md for the full runbook
                          and scripts/buffer_post_content.py for how the post
                          text itself gets written. Keeps the actual Buffer
                          API key in this function's own secret config,
                          never in the calling agent session.

Every endpoint checks a shared secret before doing anything, so if any URL
ever leaked, it could only trigger that one narrow action - never read or
write anything else in the database, and never touch Square, Robinhood, or
Buffer directly.
"""
import hmac
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import time as _time

from firebase_functions import https_fn, scheduler_fn
from firebase_admin import initialize_app, firestore

initialize_app()

ALLOWED_STRATEGIES = {"swing-trader", "breakout-rider", "options-scanner"}


def _secret_ok(provided):
    """Constant-time check of the shared ZELOS_PUBLISH_SECRET."""
    expected = os.environ.get("ZELOS_PUBLISH_SECRET", "")
    return bool(expected) and hmac.compare_digest(str(provided or "").encode(), expected.encode())


def _write_failed(where, e):
    """Log the real error server-side; tell the caller only that it failed."""
    print("[%s] Firestore write failed: %s" % (where, type(e).__name__))
    return https_fn.Response("Firestore write failed", status=500)

# Live alerts are token-gated until the close. The teaser keeps what's needed for the
# public pages (which scanner, the score, the kind of setup, the market mood) and
# drops everything that would let someone trade it (ticker, levels, reasoning).
ALERT_PUBLIC_FIELDS = ("strategy", "createdAt", "status", "direction", "score", "scoreMax", "setupLabel", "marketRegime", "outcome")


def alert_has_trade(alert):
    return bool(alert.get("ticker")) and alert.get("status") != "no-qualifying-setup"


def alert_teaser(alert):
    t = {k: alert[k] for k in ALERT_PUBLIC_FIELDS if k in alert}
    st = alert.get("scanStats")
    if isinstance(st, dict):
        t["scanStats"] = {k: st[k] for k in ("scanned", "passedFilters") if k in st}
    return t


def alert_lock_until(now_utc):
    """Epoch ms of the next 4:00 pm New York close (today's if before it; skips weekends)."""
    from zoneinfo import ZoneInfo
    from datetime import timedelta
    ny = now_utc.astimezone(ZoneInfo("America/New_York"))
    close = ny.replace(hour=16, minute=0, second=0, microsecond=0)
    if ny >= close:
        close += timedelta(days=1)
    while close.weekday() >= 5:
        close += timedelta(days=1)
    return int(close.timestamp() * 1000)


def release_due_alerts(db, now_ms):
    """Copy every locked alert whose close has passed into its public doc."""
    n = 0
    for snap in db.collection("alertsLocked").where("released", "==", False).stream():
        full = snap.to_dict()
        if (full.get("lockedUntil") or 0) > now_ms:
            continue
        pub = {k: v for k, v in full.items() if k not in ("lockedUntil", "released")}
        pub.update({"locked": False, "releasedAt": now_ms})
        db.collection("alerts").document(snap.id).set(pub, merge=True)
        snap.reference.update({"released": True, "releasedAt": now_ms})
        n += 1
    return n


@scheduler_fn.on_schedule(schedule="10,40 16-23 * * 1-5", timezone=scheduler_fn.Timezone("America/New_York"), timeout_sec=120, memory=256)
def release_alerts(event: scheduler_fn.ScheduledEvent) -> None:
    n = release_due_alerts(firestore.client(), int(_time.time() * 1000))
    if n:
        print("[release_alerts] released %d alerts" % n)


@https_fn.on_request(secrets=["ZELOS_PUBLISH_SECRET"])
def publish_alert(req: https_fn.Request) -> https_fn.Response:
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    if not _secret_ok(req.headers.get("X-Zelos-Secret", "")):
        return https_fn.Response("Unauthorized", status=401)

    try:
        payload = req.get_json(silent=False)
    except Exception:
        return https_fn.Response("Invalid JSON body", status=400)

    if not isinstance(payload, dict):
        return https_fn.Response("Body must be a JSON object", status=400)

    strategy = payload.get("strategy")
    if strategy not in ALLOWED_STRATEGIES:
        return https_fn.Response(
            "Missing or invalid 'strategy' (must be one of: %s)" % ", ".join(sorted(ALLOWED_STRATEGIES)),
            status=400,
        )

    alert = dict(payload)

    try:
        from zoneinfo import ZoneInfo
        et_date = datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")
    except Exception:
        et_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    alert_id = "%s-%s" % (strategy, et_date)
    alert["createdAt"] = firestore.SERVER_TIMESTAMP

    db = firestore.client()
    try:
        if alert_has_trade(alert):
            # Live alert: the public doc is a teaser; the full alert waits in alertsLocked
            # for token holders (a scanner pass or a single unlock) and goes public after the close.
            until = alert_lock_until(datetime.now(timezone.utc))
            db.collection("alertsLocked").document(alert_id).set(dict(alert, lockedUntil=until, released=False))
            db.collection("alerts").document(alert_id).set(dict(alert_teaser(alert), locked=True, lockedUntil=until), merge=False)
        else:
            db.collection("alerts").document(alert_id).set(alert, merge=True)
    except Exception as e:
        return _write_failed("publish_alert", e)

    return https_fn.Response(
        json.dumps({"ok": True, "id": alert_id}),
        status=200,
        content_type="application/json",
    )


@https_fn.on_request(secrets=["ZELOS_PUBLISH_SECRET"])
def publish_market_map(req: https_fn.Request) -> https_fn.Response:
    """Stores the globe's country market map (built by scripts/build_market_map.py)
    at markets/globe, as one JSON string so the browser can read it with a single
    public GET. Same shared-secret gate as publish_alert."""
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)
    if not _secret_ok(req.headers.get("X-Zelos-Secret", "")):
        return https_fn.Response("Unauthorized", status=401)
    try:
        payload = req.get_json(silent=False)
    except Exception:
        return https_fn.Response("Invalid JSON body", status=400)
    if not isinstance(payload, dict) or not isinstance(payload.get("countries"), dict) or not payload.get("asOf"):
        return https_fn.Response("Body must be a market map with 'asOf' and 'countries'", status=400)
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    if len(body) > 500_000:
        return https_fn.Response("Market map too large", status=413)
    db = firestore.client()
    try:
        db.collection("markets").document("globe").set(
            {"json": body, "asOf": payload["asOf"], "updatedAt": firestore.SERVER_TIMESTAMP})
    except Exception as e:
        return _write_failed("publish_market_map", e)
    return https_fn.Response(json.dumps({"ok": True, "asOf": payload["asOf"]}), status=200, content_type="application/json")


VALID_OUTCOME_RESULTS = {"hit-target", "stopped-out", "open", "expired", "no-trade"}


def _apply_one_outcome(db, update):
    """Validate and write a single {alertId, result, closedAt?, exitPrice?,
    notes?} update. Returns (alert_id, error_message_or_None)."""
    alert_id = (update.get("alertId") or "").strip()
    result = update.get("result")
    if not alert_id:
        return None, "missing 'alertId'"
    if result not in VALID_OUTCOME_RESULTS:
        return alert_id, "invalid 'result' (must be one of: %s)" % ", ".join(sorted(VALID_OUTCOME_RESULTS))

    outcome = {
        "result": result,
        "closedAt": update.get("closedAt"),
        "exitPrice": update.get("exitPrice"),
        "target2Hit": update.get("target2Hit"),
        "target2ResolvedAt": update.get("target2ResolvedAt"),
        "notes": update.get("notes") or "",
    }
    try:
        db.collection("alerts").document(alert_id).set({"outcome": outcome}, merge=True)
    except Exception as e:
        print("[update_alert_outcomes] Firestore write failed:", type(e).__name__)
        return alert_id, "Firestore write failed"
    return alert_id, None


@https_fn.on_request(secrets=["ZELOS_PUBLISH_SECRET"])
def update_alert_outcomes(req: https_fn.Request) -> https_fn.Response:
    """Write the result of checking what actually happened to one or more
    already-published alerts (see scripts/check_alert_outcomes.py for how
    that decision gets made, and docs/firestore-alerts-setup.md for the full
    runbook of what calls this and how often).

    Body is either a single update:
      {"alertId": "swing-trader-2026-09-15", "result": "hit-target",
       "closedAt": "2026-09-17", "exitPrice": 29.21, "notes": "..."}
    or a batch:
      {"updates": [ {...}, {...}, ... ]}

    Only ever touches the `outcome` field of an existing alert doc (merge:
    true) - never creates a new alert, never touches anything else about it.
    Same shared-secret gate as publish_alert: this can only
    ever overwrite an outcome, never read or write anything else.
    """
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    if not _secret_ok(req.headers.get("X-Zelos-Secret", "")):
        return https_fn.Response("Unauthorized", status=401)

    try:
        payload = req.get_json(silent=False)
    except Exception:
        return https_fn.Response("Invalid JSON body", status=400)

    if not isinstance(payload, dict):
        return https_fn.Response("Body must be a JSON object", status=400)

    updates = payload.get("updates")
    if updates is None:
        updates = [payload]
    if not isinstance(updates, list) or not updates:
        return https_fn.Response("Body must contain 'alertId'+'result', or a non-empty 'updates' list", status=400)

    db = firestore.client()
    results = []
    any_ok = False
    for update in updates:
        if not isinstance(update, dict):
            results.append({"ok": False, "error": "each update must be an object"})
            continue
        alert_id, error = _apply_one_outcome(db, update)
        if error:
            results.append({"ok": False, "alertId": alert_id, "error": error})
        else:
            any_ok = True
            results.append({"ok": True, "alertId": alert_id})

    status = 200 if any_ok else 400
    return https_fn.Response(
        json.dumps({"ok": any_ok, "results": results}),
        status=status,
        content_type="application/json",
    )


BUFFER_API_URL = "https://api.buffer.com"


def _escape_graphql_string(text):
    """Buffer's API takes the post body as a quoted string inside a GraphQL
    query document (see docs/buffer-automation.md) rather than as a separate
    JSON variable, so this is the one thing standing between a post with a
    quote mark or a line break in it and a broken request - escape exactly
    the three characters that would otherwise break out of the quotes."""
    return text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _buffer_create_post(api_key, channel_id, text, timeout=15):
    """One createPost call to Buffer's GraphQL API for one channel. Always
    schedulingType=automatic / mode=addToQueue - this drops the post into
    whatever posting schedule is already configured for that channel in
    Buffer, rather than this function trying to pick a good time itself.
    Returns (ok, post_id_or_None, error_message_or_None)."""
    query = (
        "mutation ZelosPost { createPost(input: { text: \"%s\", "
        "channelId: \"%s\", schedulingType: automatic, mode: addToQueue }) "
        "{ ... on PostActionSuccess { post { id dueAt } } "
        "... on MutationError { message } } }"
        % (_escape_graphql_string(text), channel_id)
    )
    req = urllib.request.Request(
        BUFFER_API_URL,
        data=json.dumps({"query": query}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer %s" % api_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return False, None, "Buffer API HTTP %s: %s" % (e.code, e.read().decode("utf-8", "replace")[:300])
    except Exception as e:
        return False, None, "Buffer API request failed: %s" % (e,)

    if data.get("errors"):
        return False, None, str(data["errors"])[:300]
    create = ((data.get("data") or {}).get("createPost") or {})
    if create.get("message"):
        return False, None, create["message"]
    post = create.get("post")
    if post:
        return True, post.get("id"), None
    return False, None, "Unrecognized Buffer response: %s" % (str(data)[:300],)


@https_fn.on_request(secrets=["ZELOS_PUBLISH_SECRET", "BUFFER_API_KEY", "BUFFER_CHANNEL_IDS"])
def post_to_buffer(req: https_fn.Request) -> https_fn.Response:
    """Drop one post into Nate's own Buffer queue, on one or more of his
    already-connected channels. See docs/buffer-automation.md for the full
    runbook (getting a Buffer personal API key, finding channel ids, and how
    the daily job decides what to post) and scripts/buffer_post_content.py
    for how the post text itself gets composed - this endpoint only relays
    already-composed text, it never decides what to say.

    Body: {"text": "...", "channelIds": ["...", ...], "alertId": "..."}
      - channelIds is optional; if omitted, posts to every id in the
        comma-separated BUFFER_CHANNEL_IDS secret (i.e. "post this
        everywhere I've got Buffer set up").
      - alertId is optional. If given AND the post succeeds on at least one
        channel, this also marks that alert's outcome.target2Announced=true
        (merge, same narrow write as update_alert_outcomes) so the daily job
        never announces the same win twice.

    The actual Buffer API key lives only in this function's own secret
    config - the calling agent session never sees or needs it.
    """
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    if not _secret_ok(req.headers.get("X-Zelos-Secret", "")):
        return https_fn.Response("Unauthorized", status=401)

    api_key = os.environ.get("BUFFER_API_KEY", "")
    if not api_key:
        return https_fn.Response(
            json.dumps({"ok": False, "error": "BUFFER_API_KEY is not configured"}),
            status=500, content_type="application/json",
        )

    try:
        payload = req.get_json(silent=False)
    except Exception:
        return https_fn.Response("Invalid JSON body", status=400)
    if not isinstance(payload, dict):
        return https_fn.Response("Body must be a JSON object", status=400)

    text = (payload.get("text") or "").strip()
    if not text:
        return https_fn.Response("Missing 'text'", status=400)
    if len(text) > 2000:
        return https_fn.Response("'text' is too long (max 2000 chars)", status=400)

    channel_ids = payload.get("channelIds")
    if not channel_ids:
        channel_ids = [c.strip() for c in os.environ.get("BUFFER_CHANNEL_IDS", "").split(",") if c.strip()]
    if not channel_ids or not isinstance(channel_ids, list):
        return https_fn.Response(
            json.dumps({"ok": False, "error": "No channelIds given and BUFFER_CHANNEL_IDS is not configured"}),
            status=400, content_type="application/json",
        )

    results = []
    any_ok = False
    for channel_id in channel_ids:
        ok, post_id, error = _buffer_create_post(api_key, channel_id, text)
        if ok:
            any_ok = True
            results.append({"ok": True, "channelId": channel_id, "postId": post_id})
        else:
            results.append({"ok": False, "channelId": channel_id, "error": error})

    alert_id = (payload.get("alertId") or "").strip()
    if any_ok and alert_id:
        try:
            db = firestore.client()
            db.collection("alerts").document(alert_id).set(
                {"outcome": {
                    "target2Announced": True,
                    "target2AnnouncedAt": datetime.now(timezone.utc).isoformat(),
                }},
                merge=True,
            )
        except Exception:
            pass  # the post already went out; never fail the response over this bookkeeping step

    status = 200 if any_ok else 502
    return https_fn.Response(
        json.dumps({"ok": any_ok, "results": results}),
        status=status,
        content_type="application/json",
    )


# ---------------------------------------------------------------------------
# Live prices for the $10,000 Practice Account (practice/index.html).
#
# refresh_quotes runs every minute on weekdays, 9:00-16:59 New York time, and
# only calls Financial Modeling Prep (FMP, the paid quote provider) between
# 9:25 and 16:10. It fetches one quote per symbol and writes them all to the
# public Firestore doc markets/quotes, which every open practice page is
# listening to. That way the API key stays in this function's secret config
# and never reaches a browser, and FMP sees one caller no matter how many
# people are on the site. (News still comes from Finnhub: see refresh_news.)
#
# During the session it also builds 5-minute bars for each symbol from those
# once-a-minute prices (markets/intraday_<SYM>, the last 5 sessions), which is
# what the page's 5m / 15m / 1h charts are made of. These bars are our own:
# open/close are the first/last price seen in each 5 minutes, high/low the
# extremes of those samples.
#
# After the close it also appends the day's bar (open/high/low/close from the
# quote; the quote has no volume, so that's stored as 0) to markets/dailyBars,
# so charts keep extending day by day between manual data refreshes.
#
# Setup: firebase functions:secrets:set FMP_API_KEY (and FINNHUB_API_KEY for
# news), then deploy. See docs/practice-account.md.
# ---------------------------------------------------------------------------
from zoneinfo import ZoneInfo
from firebase_functions import scheduler_fn

def _load_practice_symbols():
    """The stock list lives in data/practice-universe.json (the page reads the
    same file); scripts/build_practice.py copies it next to this module so it
    ships with the deploy. Falls back to a core list if the copy is missing."""
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "practice_universe.json"), encoding="utf-8") as f:
            syms = [str(u["sym"]).upper() for u in json.load(f)["symbols"]]
        if syms:
            return syms[:55]  # one quote call per symbol per minute
    except Exception as e:
        print("[practice] universe file unreadable, using the core list:", type(e).__name__, e)
    return ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD", "SPY", "QQQ"]


PRACTICE_SYMBOLS = _load_practice_symbols()
NY = ZoneInfo("America/New_York")
DAILY_BARS_KEEP = 90
INTRADAY_SESSIONS_KEEP = 5
SESSION_OPEN, SESSION_CLOSE = 9 * 60 + 30, 16 * 60


def _update_intraday(db, quotes, now):
    """Folds this minute's prices into each symbol's 5-minute bars.

    Bars are "YYYY-MM-DD HH:MM,o,h,l,c" strings (Firestore can't nest arrays),
    one doc per symbol so a page only downloads the stock it's showing."""
    minutes = now.hour * 60 + now.minute
    if minutes < SESSION_OPEN or minutes > SESSION_CLOSE:
        return
    today = now.strftime("%Y-%m-%d")
    # the 16:00 sample closes the 15:55 bar rather than opening a 16:00 one
    bucket = SESSION_OPEN + (min(minutes, SESSION_CLOSE - 1) - SESSION_OPEN) // 5 * 5
    label = "%s %02d:%02d" % (today, bucket // 60, bucket % 60)
    batch = db.batch()
    for sym, q in quotes.items():
        qdate = datetime.fromtimestamp(q.get("t") or 0, NY).strftime("%Y-%m-%d")
        px = q.get("c")
        if qdate != today or not px:
            continue  # market holiday or a stale quote: nothing traded today
        ref = db.collection("markets").document("intraday_" + sym)
        snap = ref.get()
        bars = [str(b) for b in ((snap.to_dict() or {}).get("bars", []) if snap.exists else [])]
        if bars and bars[-1].startswith(label + ","):
            parts = bars[-1].split(",")
            o, h, l = float(parts[1]), float(parts[2]), float(parts[3])
            bars[-1] = "%s,%s,%s,%s,%s" % (label, o, max(h, px), min(l, px), px)
        else:
            bars.append("%s,%s,%s,%s,%s" % (label, px, px, px, px))
        # keep the last few sessions
        dates = sorted({b[:10] for b in bars})
        keep = set(dates[-INTRADAY_SESSIONS_KEEP:])
        bars = [b for b in bars if b[:10] in keep]
        batch.set(ref, {"updatedAt": now.isoformat(), "interval": "5m", "bars": bars})
    batch.commit()


# Finnhub quote call, kept as the fallback provider (FINNHUB_API_KEY stays
# configured for refresh_news). Not on the active quote path.
def _finnhub_quote(symbol, api_key, timeout=8):
    req = urllib.request.Request(
        "https://finnhub.io/api/v1/quote?symbol=" + symbol,
        headers={"X-Finnhub-Token": api_key, "User-Agent": "zelos-practice/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


FMP_QUOTE_URL = "https://financialmodelingprep.com/stable/quote"


class _FmpKeyRejected(Exception):
    """FMP refused the API key (it sometimes says so with a 200 + error body)."""


def _fmp_quote(symbol, api_key, timeout=8):
    """One quote from FMP's stable endpoint, mapped to the c/o/h/l/pc/t shape
    markets/quotes has always used. Returns None for an unknown symbol.

    The key goes only in the query string, never in a header, and the URL is
    never logged (it contains the key)."""
    url = FMP_QUOTE_URL + "?" + urllib.parse.urlencode({"symbol": symbol, "apikey": api_key})
    req = urllib.request.Request(url, headers={"User-Agent": "zelos-practice/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if isinstance(data, dict):
        msg = str(data.get("Error Message") or data.get("error") or data.get("message") or "")
        if "api key" in msg.lower() or "apikey" in msg.lower():
            raise _FmpKeyRejected()
        return None
    row = data[0] if isinstance(data, list) and data else None
    if not isinstance(row, dict) or not row.get("price"):
        return None
    return {
        "c": row.get("price"),
        "o": row.get("open"),
        "h": row.get("dayHigh"),
        "l": row.get("dayLow"),
        "pc": row.get("previousClose"),
        "t": row.get("timestamp"),
    }


def _fetch_all_quotes(api_key):
    """Returns (quotes, error). error is 'auth' for a bad key, else a short message."""
    quotes, last_error, denied = {}, None, []
    for sym in PRACTICE_SYMBOLS:
        try:
            q = _fmp_quote(sym, api_key)
        except _FmpKeyRejected:
            return {}, "auth"  # bad or revoked key: no point trying the rest
        except urllib.error.HTTPError as e:
            if e.code == 401:
                return {}, "auth"
            if e.code in (402, 403):
                # FMP answers 402/403 for symbols the plan doesn't cover; skip just that one
                denied.append(sym)
                if len(denied) >= 5 and not quotes:
                    return {}, "auth"  # everything is being refused: it's the key/plan
                continue
            last_error = "http %d" % e.code
            continue
        except Exception as e:  # timeout, DNS, bad JSON
            last_error = type(e).__name__
            continue
        if not q:
            continue  # unknown symbol / no price
        quotes[sym] = q
    if denied:
        print("[refresh_quotes] FMP refused (402/403):", ",".join(denied))
    return quotes, (None if quotes else ("auth" if denied else (last_error or "no data")))


@scheduler_fn.on_schedule(
    schedule="* 9-16 * * 1-5",
    timezone=scheduler_fn.Timezone("America/New_York"),
    secrets=["FMP_API_KEY"],
    timeout_sec=55,
    memory=256,
)
def refresh_quotes(event: scheduler_fn.ScheduledEvent) -> None:
    now = datetime.now(NY)
    minutes = now.hour * 60 + now.minute
    if minutes < 9 * 60 + 25 or minutes > 16 * 60 + 10:
        return
    api_key = os.environ.get("FMP_API_KEY", "").strip()
    db = firestore.client()
    doc = db.collection("markets").document("quotes")
    if not api_key:
        doc.set({"error": "missing-key", "checkedAt": now.isoformat()}, merge=True)
        return

    quotes, error = _fetch_all_quotes(api_key)
    if error and not quotes:
        # keep the last good prices; just flag the problem so the page can say so
        doc.set({"error": error, "checkedAt": now.isoformat()}, merge=True)
        print("[refresh_quotes] FMP error:", error)
        return

    # a symbol that failed this round (timeout, rate limit) keeps its last good
    # quote instead of dropping off the page for a minute
    try:
        prev = doc.get()
        for sym, q in (((prev.to_dict() or {}).get("quotes") or {}) if prev.exists else {}).items():
            if sym in PRACTICE_SYMBOLS and sym not in quotes:
                quotes[sym] = q
    except Exception as e:
        print("[refresh_quotes] couldn't read previous quotes:", type(e).__name__)

    today = now.strftime("%Y-%m-%d")
    session_open = 9 * 60 + 30 <= minutes < 16 * 60
    doc.set({
        "source": "fmp",
        "updatedAt": now.isoformat(),
        "date": today,
        "marketOpen": session_open,
        "error": None,
        "quotes": quotes,
    })
    try:
        _update_intraday(db, quotes, now)
    except Exception as e:  # never let chart bookkeeping stop the quotes
        print("[refresh_quotes] intraday update failed:", type(e).__name__, e)

    # after the close: record today's bar once the quotes are from today.
    # Firestore can't store nested arrays, so each bar is kept as a
    # "date,o,h,l,c,v" string; the page splits it back apart.
    if minutes >= 16 * 60 + 2:
        bars_ref = db.collection("markets").document("dailyBars")
        snap = bars_ref.get()
        stored = (snap.to_dict() or {}).get("bars", {}) if snap.exists else {}
        bars = {sym: [str(r) for r in rows] for sym, rows in stored.items()}
        changed = False
        for sym, q in quotes.items():
            qdate = datetime.fromtimestamp(q.get("t") or 0, NY).strftime("%Y-%m-%d")
            if qdate != today or not q.get("o"):
                continue
            row = ",".join(str(x) for x in (today, q["o"], q["h"], q["l"], q["c"], 0))
            series = [r for r in bars.get(sym, []) if not r.startswith(today + ",")]
            series.append(row)
            bars[sym] = series[-DAILY_BARS_KEEP:]
            changed = True
        if changed:
            bars_ref.set({"updatedAt": now.isoformat(), "bars": bars})


# ---------------------------------------------------------------------------
# refresh_news - market headlines for the dashboard's Trending News and
# Watchlist News widgets.
#
# Every 10 minutes: the latest general market headlines, plus company news for
# the 5 practice symbols refreshed longest ago (so the whole list turns over
# about every 100 minutes, at 6 Finnhub calls a run, well inside the free
# 60-a-minute limit even while refresh_quotes is running). Everything lands in
# ONE doc, markets/news, so a dashboard needs a single read:
#   { provider, attribution, attributionUrl, updatedAt,
#     general: [item...], bySymbol: {SYM: [item...]}, symbolsUpdatedAt: {SYM: iso} }
# item = { headline, source, url, datetime (unix s), summary, image, tickers: [..] }
#
# The provider is swappable: write another pair of fetch functions returning
# the same item shape and point NEWS_PROVIDER at them. The browser only ever
# sees the normalized items plus the attribution to show.
# ---------------------------------------------------------------------------
NEWS_SYMBOLS_PER_RUN = 5
NEWS_ITEMS_GENERAL = 30
NEWS_ITEMS_PER_SYMBOL = 6


def _finnhub_get(path, api_key, timeout=8):
    req = urllib.request.Request(
        "https://finnhub.io/api/v1" + path,
        headers={"X-Finnhub-Token": api_key, "User-Agent": "zelos-news/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _news_item(raw, tickers=None):
    url = str(raw.get("url") or "")
    headline = str(raw.get("headline") or "").strip()
    if not headline or not url.startswith("http"):
        return None
    related = [t.strip().upper() for t in str(raw.get("related") or "").split(",") if t.strip()]
    return {
        "headline": headline[:220],
        "source": str(raw.get("source") or "")[:60],
        "url": url[:600],
        "datetime": int(raw.get("datetime") or 0),
        "summary": str(raw.get("summary") or "").strip()[:240],
        "image": str(raw.get("image") or "")[:600] if str(raw.get("image") or "").startswith("https") else "",
        "tickers": sorted(set((tickers or []) + related))[:6],
    }


def _finnhub_general_news(api_key):
    rows = _finnhub_get("/news?category=general", api_key) or []
    items = [i for i in (_news_item(r) for r in rows) if i]
    return sorted(items, key=lambda i: -i["datetime"])[:NEWS_ITEMS_GENERAL]


def _finnhub_company_news(sym, api_key, now):
    to = now.strftime("%Y-%m-%d")
    frm = datetime.fromtimestamp(now.timestamp() - 6 * 86400, NY).strftime("%Y-%m-%d")
    rows = _finnhub_get("/company-news?symbol=%s&from=%s&to=%s" % (sym, frm, to), api_key) or []
    items, seen = [], set()
    for r in sorted(rows, key=lambda r: -(r.get("datetime") or 0)):
        i = _news_item(r, [sym])
        if i and i["headline"] not in seen:
            seen.add(i["headline"])
            items.append(i)
        if len(items) >= NEWS_ITEMS_PER_SYMBOL:
            break
    return items


NEWS_PROVIDER = {
    "name": "finnhub",
    "attribution": "News via Finnhub",
    "attributionUrl": "https://finnhub.io",
    "general": _finnhub_general_news,
    "company": _finnhub_company_news,
}


@scheduler_fn.on_schedule(
    schedule="*/10 * * * *",
    timezone=scheduler_fn.Timezone("America/New_York"),
    secrets=["FINNHUB_API_KEY"],
    timeout_sec=60,
    memory=256,
)
def refresh_news(event: scheduler_fn.ScheduledEvent) -> None:
    api_key = os.environ.get("FINNHUB_API_KEY", "").strip()
    if not api_key:
        return
    now = datetime.now(NY)
    db = firestore.client()
    ref = db.collection("markets").document("news")
    snap = ref.get()
    doc = (snap.to_dict() or {}) if snap.exists else {}
    by_symbol = {k: v for k, v in (doc.get("bySymbol") or {}).items() if k in PRACTICE_SYMBOLS}
    stamps = {k: v for k, v in (doc.get("symbolsUpdatedAt") or {}).items() if k in PRACTICE_SYMBOLS}
    general, errors = doc.get("general") or [], []
    try:
        general = NEWS_PROVIDER["general"](api_key) or general
    except Exception as e:
        errors.append("general: %s" % type(e).__name__)
    # the symbols refreshed longest ago (never-fetched first)
    due = sorted(PRACTICE_SYMBOLS, key=lambda s: stamps.get(s, ""))[:NEWS_SYMBOLS_PER_RUN]
    for sym in due:
        try:
            by_symbol[sym] = NEWS_PROVIDER["company"](sym, api_key, now)
            stamps[sym] = now.isoformat()
        except urllib.error.HTTPError as e:
            errors.append("%s: http %d" % (sym, e.code))
            stamps[sym] = now.isoformat()  # retried next lap, so one bad symbol can't stall the rotation
            if e.code in (401, 403, 429):
                break
        except Exception as e:
            errors.append("%s: %s" % (sym, type(e).__name__))
            stamps[sym] = now.isoformat()
    ref.set({
        "provider": NEWS_PROVIDER["name"],
        "attribution": NEWS_PROVIDER["attribution"],
        "attributionUrl": NEWS_PROVIDER["attributionUrl"],
        "updatedAt": now.isoformat(),
        "general": general,
        "bySymbol": by_symbol,
        "symbolsUpdatedAt": stamps,
        "error": "; ".join(errors)[:300] or None,
    })
    if errors:
        print("[refresh_news]", "; ".join(errors))


# ---------------------------------------------------------------------------
# Trade War matches: server-authoritative virtual competitions (practice/war.html).
#
# Everything in a match is VIRTUAL money. It never touches real money, tokens,
# or the standing $10,000 Trade War account, and nothing here can be bought.
#
#   tradeWars/{warId}                 { name, host, hostName, buyIn, days, maxPlayers,
#                                       status: lobby|active|ended|cancelled, players: [uid],
#                                       names: {uid: name}, createdAt, startAt, endAt,
#                                       results: [...] once ended, markedAt }
#   tradeWars/{warId}/accounts/{uid}  leaderboard numbers every player in the match can
#                                       read: { name, start, cash, equity, pnl, pnlPct,
#                                       trades, wins, losses, realized, updatedAt }
#   tradeWars/{warId}/books/{uid}     that player's own positions + fills (owner-only read)
#
# Browsers can't write any of it (firestore.rules). Every change goes through the
# callable functions below, which check the rules of the game server-side:
#   - every player starts with exactly the host's buy-in; the buy-in can't change
#   - no deposits or withdrawals exist at all; only match cash can be spent
#   - you can join or leave only while the match is in its lobby
#   - trades use the server's own FMP quote (markets/quotes), during market hours,
#     long only, from the same symbol list as the rest of Trade War
# tw_mark revalues open matches every 5 minutes and closes them at their end time.
# ---------------------------------------------------------------------------
import re as _re
import secrets as _secrets
import time as _time

TW_BUYIN_MIN, TW_BUYIN_MAX = 100, 10000
# Bigger buy-ins unlock with the host's level (XP ladder in zelos-levels.js;
# the same table is in zelos-challenge.js for the lock icons):
#   (max buy-in, level needed, XP needed, level name)
TW_BUYIN_TIERS = ((1000, 0, 0, ""), (5000, 3, 150, "Gold"), (10000, 5, 1000, "Diamond"))
TW_DAYS = (1, 3, 7, 14, 30)
TW_MAX_PLAYERS = 50
TW_MAX_FILLS = 500
TW_TRADE_GAP_S = 1.0          # anti-spam: one trade a second per player
TW_QUOTE_MAX_AGE_S = 180      # quotes older than this can't be traded on
_TW_ID_RE = _re.compile(r"^[A-Za-z0-9]{12}$")


class TWError(Exception):
    """A rule of the game was broken; code is a FunctionsErrorCode name."""
    def __init__(self, code, message):
        super().__init__(message)
        self.code, self.message = code, message


def _r2(x):
    return round(float(x) + 0.0, 2)


def tw_validate_create(data):
    """Returns (name, buy_in, days, max_players) or raises TWError."""
    name = str((data or {}).get("name") or "").strip()
    name = _re.sub(r"[<>]", "", name)[:40]
    if not name:
        raise TWError("INVALID_ARGUMENT", "Give your Trade War a name.")
    try:
        buy_in = int(data.get("buyIn"))
        days = int(data.get("days"))
        max_players = int(data.get("maxPlayers") or 10)
    except (TypeError, ValueError):
        raise TWError("INVALID_ARGUMENT", "Buy-in, length and player limit must be numbers.")
    if not (TW_BUYIN_MIN <= buy_in <= TW_BUYIN_MAX) or buy_in % 100:
        raise TWError("INVALID_ARGUMENT", "Buy-in must be a multiple of $100 between $100 and $10,000 (virtual).")
    if days not in TW_DAYS:
        raise TWError("INVALID_ARGUMENT", "Length must be 1, 3, 7, 14 or 30 days.")
    if not (2 <= max_players <= TW_MAX_PLAYERS):
        raise TWError("INVALID_ARGUMENT", "Player limit must be between 2 and %d." % TW_MAX_PLAYERS)
    return name, buy_in, days, max_players


def tw_buyin_lock(buy_in, xp):
    """None if this XP may host this buy-in, else the (level, xp, name) it needs."""
    for cap, level, need, name in TW_BUYIN_TIERS:
        if buy_in <= cap:
            return None if (xp or 0) >= need else (level, need, name)
    return TW_BUYIN_TIERS[-1][1:]


# Last Man Standing (optional mode). The host turns on any of these; breaking one knocks
# you out: your positions are sold at the current price and your result is frozen.
#   floorPct   P&L threshold: out when your total % P&L falls to -X%
#   maxLossPct maximum loss: out when one closed trade loses more than X% of the buy-in
#   maxLosses  out after N losing trades
#   cutHours   time-based: every N hours the last-place player still standing is out
# The last trader standing wins at once; otherwise survivors are ranked by % gain when the
# clock runs out, above everyone who was knocked out (later out = higher place).
TW_LMS_OPTS = {"floorPct": (5, 10, 15, 20, 30), "maxLossPct": (2, 5, 10), "maxLosses": (3, 5, 10), "cutHours": (6, 12, 24, 48)}


def tw_validate_lms(data, days):
    """None for a classic match, else the elimination rules dict, or raises TWError."""
    raw = (data or {}).get("lms")
    if not raw:
        return None
    if not isinstance(raw, dict):
        raise TWError("INVALID_ARGUMENT", "Last Man Standing rules aren't valid.")
    elim = {}
    for key, allowed in TW_LMS_OPTS.items():
        v = raw.get(key)
        if v in (None, 0, False, ""):
            continue
        if isinstance(v, float) and v.is_integer():
            v = int(v)
        if isinstance(v, bool) or v not in allowed:
            raise TWError("INVALID_ARGUMENT", "Last Man Standing rules aren't valid.")
        elim[key] = v
    if not elim:
        raise TWError("INVALID_ARGUMENT", "Pick at least one elimination rule for Last Man Standing.")
    if elim.get("cutHours") and elim["cutHours"] >= days * 24:
        raise TWError("INVALID_ARGUMENT", "Timed cuts must come more often than the match length.")
    return elim


def tw_out_reason(acct, elim):
    """Which elimination rule this account breaks (None if none). Cuts are handled by tw_pick_outs."""
    if not elim or acct.get("out"):
        return None
    if elim.get("floorPct") and (acct.get("pnlPct") or 0) <= -elim["floorPct"]:
        return "floor"
    if elim.get("maxLossPct") and -(acct.get("worst") or 0) > acct["start"] * elim["maxLossPct"] / 100.0 + 1e-9:
        return "bigLoss"
    if elim.get("maxLosses") and (acct.get("losses") or 0) >= elim["maxLosses"]:
        return "losses"
    return None


def _tw_order(acct, uid):
    return (acct.get("pnlPct") or 0, acct.get("pnl") or 0, uid)


def tw_pick_outs(alive, accts, elim, now_ms, next_cut, shields=None, used=None):
    """Pure: [(uid, reason)] to knock out now, worst first. Never knocks out everyone left:
    if all would go, the best of them survives (and wins). A Shield Token (Whale vs Minnow)
    saves a player from a timed cut: the shield is spent (uid appended to used) and the
    next-worst player without one is cut instead."""
    outs = [(u, r) for u in alive for r in [tw_out_reason(accts[u], elim)] if r]
    if elim.get("cutHours") and next_cut and now_ms >= next_cut:
        hit = {u for u, _ in outs}
        rest = sorted((u for u in alive if u not in hit), key=lambda u: _tw_order(accts[u], u))
        shields = dict(shields or {})
        while len(rest) > 1:
            u = rest[0]
            if shields.get(u, 0) > 0:
                shields[u] -= 1
                if used is not None:
                    used.append(u)
                rest = rest[1:]
                continue
            outs.append((u, "cut"))
            break
    if outs and len(outs) >= len(alive):
        best = max(outs, key=lambda o: _tw_order(accts[o[0]], o[0]))
        outs.remove(best)
    return sorted(outs, key=lambda o: _tw_order(accts[o[0]], o[0]))


def tw_knock_out(acct, book, prices, reason, place, now_ms):
    """Pure: sell everything at the current price (cost if none) and freeze the account."""
    acct, fills = dict(acct), list(book.get("fills") or [])
    for sym, p in (book.get("positions") or {}).items():
        px = prices.get(sym) or p["avg"]
        acct["cash"] = _r2(acct["cash"] + p["qty"] * px)
        fills.append({"sym": sym, "side": "sell", "qty": p["qty"], "price": _r2(px), "at": now_ms, "auto": True,
                      "pnl": _r2((px - p["avg"]) * p["qty"])})
    book = {"positions": {}, "fills": fills[-TW_MAX_FILLS:]}
    acct = tw_mark(acct, book, prices, now_ms)
    acct.update({"out": True, "outReason": reason, "outAt": now_ms, "place": place})
    return acct, book


def tw_live_fields(war, now_ms):
    """Fields that make a match live (straight from the lobby, or when its draft ends)."""
    f = {"status": "active", "startAt": now_ms, "endAt": now_ms + war["days"] * 86400000}
    if war.get("lms"):
        cut = war["lms"].get("cutHours")
        f.update({"alive": list(war["players"]), "outs": [], "nextCutAt": now_ms + cut * 3600000 if cut else None})
    return f


def tw_start_fields(war, now_ms, xps=None, rng=None):
    """Fields that start a lobby: Whale vs Minnow roles, then the draft (if on) or the live match."""
    modes, f = war.get("modes") or {}, {}
    if modes.get("whale"):
        whales = tw_whales(war["players"], xps or {})
        f.update({"whales": whales, "shields": {u: modes["whale"]["shields"] for u in war["players"] if u not in whales}})
    if modes.get("draft"):
        universe = tw_draft_universe(war)
        if len(war["players"]) * modes["draft"]["picks"] > len(universe):
            raise TWError("FAILED_PRECONDITION", "Too many players for a %d-pick draft: there are only %d stocks to go around." % (modes["draft"]["picks"], len(universe)))
        f.update({"status": "draft", "draft": tw_draft_new(war["players"], modes["draft"]["picks"], now_ms, rng)})
        return f
    f.update(tw_live_fields(war, now_ms))
    return f


# ---------------------------------------------------------------------------
# Advanced gameplay (optional, host picks at creation; all enforced here):
#   draft    Pre-battle asset draft: a snake draft; each player can only trade
#            the stocks they drafted. 45 s a pick, then the server picks for you.
#   whale    Whale vs Minnow: players above the match's median XP are "whales"
#            with a position-size cap; the others get Shield Tokens (cancel a
#            bounty on you, or survive one timed cut).
#   storms   Volatility Storms: random 30-minute virtual events during market
#            hours: double P&L on sells, a 1% trade fee, or a halt on one stock.
#   bounties Bounty Board: stake part of your match cash on a rival; the player
#            who beats them by the most (since the bounty) wins the pot, else the
#            target keeps it. Limits stop farming (see tw_new_bounty).
# The Battlefield Ticker (tradeWars/{id}/events) is always on.
# ---------------------------------------------------------------------------
TW_MODE_OPTS = {"draftPicks": (2, 3, 5), "whaleCap": (25, 50, 75), "whaleShields": (1, 2, 3), "storms": ("rare", "often")}
TW_DRAFT_PICK_MS = 45000
TW_DRAFT_IDLE_MS = 120000     # a draft nobody touches is finished by the 5-minute job
TW_STORM_MS = 30 * 60000
TW_STORM_CHANCE = {"rare": 1 / 78.0, "often": 3 / 78.0}  # per 5-minute check: ~1 or ~3 a trading day
TW_STORM_KINDS = ("double", "fee", "halt")
TW_STORM_FEE = 0.01
TW_BIG_TRADE = 0.25           # a trade worth 25%+ of your account makes the ticker
TW_BOUNTY_PCTS, TW_BOUNTY_HOURS = (2, 5, 10), (6, 24)
TW_BOUNTY_MAX_ON_TARGET = 2


def tw_validate_modes(data, days):
    """{} or the advanced-gameplay settings, or raises TWError."""
    raw = (data or {}).get("modes")
    if not raw:
        return {}
    if not isinstance(raw, dict):
        raise TWError("INVALID_ARGUMENT", "Game options aren't valid.")
    bad = TWError("INVALID_ARGUMENT", "Game options aren't valid.")
    out = {}

    def num(k):
        v = raw.get(k)
        if isinstance(v, float) and v.is_integer():
            v = int(v)
        if isinstance(v, bool) or v not in TW_MODE_OPTS[k]:
            raise bad
        return v
    if raw.get("draftPicks"):
        out["draft"] = {"picks": num("draftPicks")}
    if raw.get("whaleCap"):
        out["whale"] = {"capPct": num("whaleCap"), "shields": num("whaleShields")}
    if raw.get("storms"):
        if raw["storms"] not in TW_MODE_OPTS["storms"]:
            raise bad
        out["storms"] = raw["storms"]
    if raw.get("bounties"):
        if raw["bounties"] is not True:
            raise bad
        out["bounties"] = True
    return out


def tw_draft_universe(war):
    syms = (war.get("rules") or {}).get("symbols")
    return sorted(syms) if syms else sorted(PRACTICE_SYMBOLS)


def tw_draft_new(players, per, now_ms, rng=None):
    order = list(players)
    (rng or _secrets.SystemRandom()).shuffle(order)
    return {"order": order, "per": per, "picks": {u: [] for u in order}, "taken": [], "turn": 0,
            "total": len(order) * per, "deadline": now_ms + TW_DRAFT_PICK_MS}


def tw_draft_on_clock(draft):
    """Whose pick it is: a snake order (1-2-3, 3-2-1, ...)."""
    n = len(draft["order"])
    rnd, pos = divmod(draft["turn"], n)
    return draft["order"][pos if rnd % 2 == 0 else n - 1 - pos]


def tw_draft_apply(draft, sym, universe, now_ms):
    """Pure: the draft after the player on the clock takes sym."""
    if draft["turn"] >= draft["total"]:
        raise TWError("FAILED_PRECONDITION", "The draft is over.")
    if sym not in universe:
        raise TWError("INVALID_ARGUMENT", "%s isn't in this draft." % (sym or "That stock"))
    if sym in draft["taken"]:
        raise TWError("FAILED_PRECONDITION", "%s was already drafted. Pick another stock." % sym)
    uid = tw_draft_on_clock(draft)
    d = dict(draft, picks={u: list(v) for u, v in draft["picks"].items()}, taken=draft["taken"] + [sym])
    d["picks"][uid].append(sym)
    d["turn"] = draft["turn"] + 1
    d["deadline"] = now_ms + TW_DRAFT_PICK_MS
    return d, uid


def tw_draft_auto(draft, universe, rng=None):
    """A stock for a player who ran out of time: a random one nobody has."""
    left = [s for s in universe if s not in draft["taken"]]
    return (rng or _secrets.SystemRandom()).choice(left)


def tw_whales(players, xps):
    """Players above the median XP (XP from users/{uid}); nobody if everyone is level."""
    vals = sorted(int(xps.get(u) or 0) for u in players)
    if not vals:
        return []
    n = len(vals)
    med = vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2.0
    return [u for u in players if int(xps.get(u) or 0) > med]


def tw_storm_now(storm, now_ms):
    return storm if storm and storm.get("start", 0) <= now_ms < storm.get("end", 0) else None


def tw_maybe_storm(freq, storm, now_ms, end_at, market_open, roll, pick, held):
    """Pure: a new storm, or None. roll in [0, 1); pick(list) chooses."""
    if not freq or not market_open or tw_storm_now(storm, now_ms) or end_at - now_ms < TW_STORM_MS:
        return None
    if storm and now_ms - storm.get("end", 0) < TW_STORM_MS:  # a calm spell between storms
        return None
    if roll >= TW_STORM_CHANCE[freq]:
        return None
    kind = pick(list(TW_STORM_KINDS))
    st = {"kind": kind, "start": now_ms, "end": now_ms + TW_STORM_MS}
    if kind == "halt":
        st["sym"] = pick(sorted(held)) if held else pick(sorted(PRACTICE_SYMBOLS))
    return st


def tw_storm_text(st):
    return {"double": "Double or nothing: profits and losses on sells count twice",
            "fee": "Choppy water: every trade costs a 1% virtual fee",
            "halt": "Trading halt: %s can't be traded" % st.get("sym")}.get(st.get("kind"), "")


def tw_whale_ok(acct, book, prices, sym, qty, price, cap_pct):
    """True if this buy keeps the position within cap_pct% of the account."""
    pos = (book.get("positions") or {}).get(sym) or {"qty": 0}
    equity = tw_mark(acct, book, prices, 0)["equity"]
    return (pos["qty"] + qty) * price <= equity * cap_pct / 100.0 + 1e-6


def tw_new_bounty(war, accts, by, target, pct, hours, now_ms, bid):
    """Pure: a new bounty (the pot comes out of the sponsor's cash), or raises TWError.
    Anti-farming: one open bounty per sponsor, each sponsor->target pair once per match,
    at most 2 open on a target, 1h+ left in the match, and only real rivals can win it:
    hunters must trade after it's placed and neither the sponsor nor the target can hunt."""
    if pct not in TW_BOUNTY_PCTS or hours not in TW_BOUNTY_HOURS:
        raise TWError("INVALID_ARGUMENT", "Bounties are 2%, 5% or 10% of your cash, for 6 or 24 hours.")
    if target == by:
        raise TWError("INVALID_ARGUMENT", "You can't put a bounty on yourself.")
    if target not in war["players"] or target not in accts:
        raise TWError("INVALID_ARGUMENT", "That player isn't in this Trade War.")
    if accts[by].get("out") or accts[target].get("out"):
        raise TWError("FAILED_PRECONDITION", "Knocked-out players can't place or receive bounties.")
    open_ = [b for b in war.get("bounties") or [] if b["status"] == "open"]
    if any(b["by"] == by for b in open_):
        raise TWError("FAILED_PRECONDITION", "You already have a bounty out. Wait for it to settle.")
    if any(b["by"] == by and b["target"] == target for b in war.get("bounties") or []):
        raise TWError("FAILED_PRECONDITION", "You've already put a bounty on this player in this Trade War.")
    if sum(1 for b in open_ if b["target"] == target) >= TW_BOUNTY_MAX_ON_TARGET:
        raise TWError("FAILED_PRECONDITION", "This player already has 2 bounties on them.")
    if (war.get("endAt") or 0) - now_ms < 3600000:
        raise TWError("FAILED_PRECONDITION", "Bounties close in the last hour of a Trade War.")
    amount = _r2(accts[by]["equity"] * pct / 100.0)
    if amount < 1 or amount > accts[by]["cash"] + 1e-9:
        raise TWError("FAILED_PRECONDITION", "Not enough match cash for that bounty (it's paid from cash, not stocks).")
    names = war.get("names") or {}
    return {"id": bid, "by": by, "byName": names.get(by, "Trader"), "target": target, "targetName": names.get(target, "Trader"),
            "amount": amount, "pct": pct, "at": now_ms, "end": min(now_ms + hours * 3600000, war["endAt"]), "status": "open",
            "base": {u: {"eq": a["equity"], "trades": a.get("trades", 0)} for u, a in accts.items()}}


def tw_settle_bounty(b, accts):
    """Pure: ('won', hunter) / ('defended', target) / ('refunded', sponsor)."""
    def gain(u):
        base = (b["base"].get(u) or {}).get("eq") or 0
        return (accts[u]["equity"] / base - 1) if base else 0
    t = accts.get(b["target"])
    tg = gain(b["target"]) if t else 0
    hunters = [u for u, a in accts.items() if u not in (b["by"], b["target"]) and not a.get("out") and u in b["base"]
               and a.get("trades", 0) > b["base"][u]["trades"] and gain(u) > tg]
    if hunters:
        return "won", max(hunters, key=lambda u: (gain(u), u))
    if t and not t.get("out"):
        return "defended", b["target"]
    return "refunded", b["by"]


def tw_leader(accts, alive):
    rows = [(a.get("pnlPct") or 0, u) for u, a in accts.items() if u in alive and not a.get("out")]
    best = max(rows) if rows else None
    return best[1] if best and best[0] > 0 else None


def _tw_money(v, signed=False):
    return ("+" if signed and v >= 0 else "-" if v < 0 else "") + "$" + format(abs(v), ",.2f")


def tw_event(kind, text, now_ms, **extra):
    e = {"kind": kind, "text": text[:160], "at": now_ms}
    e.update(extra)
    return e


def _tw_check_buyin(db, uid, buy_in):
    try:
        u = db.collection("users").document(uid).get()
        xp = int((u.to_dict() or {}).get("xp") or 0) if u.exists else 0
    except Exception:
        xp = 0
    lock = tw_buyin_lock(buy_in, xp)
    if lock:
        raise TWError("FAILED_PRECONDITION", "The $%s buy-in unlocks at Level %d (%s, %s XP). Earn XP from trades, missions and matches to unlock it."
                      % (format(buy_in, ","), lock[0], lock[2], format(lock[1], ",")))


def tw_new_account(name, buy_in, now_ms):
    return {"name": name, "start": buy_in, "cash": buy_in, "equity": buy_in, "pnl": 0.0, "pnlPct": 0.0,
            "trades": 0, "wins": 0, "losses": 0, "realized": 0.0, "lastTradeAt": 0, "updatedAt": now_ms}


def tw_new_book():
    return {"positions": {}, "fills": []}


def tw_apply_trade(acct, book, sym, side, qty, price, now_ms, storm=None):
    """Pure: returns (acct, book, fill) after one market order, or raises TWError.
    storm (a live Volatility Storm): 'fee' charges 1% of the trade; 'double' counts a
    sell's profit or loss twice (cash never goes below zero)."""
    if side not in ("buy", "sell"):
        raise TWError("INVALID_ARGUMENT", "Side must be buy or sell.")
    if not isinstance(qty, int) or isinstance(qty, bool) or qty < 1 or qty > 1000000:
        raise TWError("INVALID_ARGUMENT", "Quantity must be a whole number of shares.")
    if not price or price <= 0:
        raise TWError("UNAVAILABLE", "No live price for %s right now." % sym)
    if now_ms - (acct.get("lastTradeAt") or 0) < TW_TRADE_GAP_S * 1000:
        raise TWError("RESOURCE_EXHAUSTED", "Slow down: one trade a second.")
    acct, book = dict(acct), {"positions": dict(book.get("positions") or {}), "fills": list(book.get("fills") or [])}
    pos = dict(book["positions"].get(sym) or {"qty": 0, "avg": 0.0})
    cost = _r2(qty * price)
    kind = (storm or {}).get("kind")
    fee = _r2(cost * TW_STORM_FEE) if kind == "fee" else 0.0
    fill = {"sym": sym, "side": side, "qty": qty, "price": _r2(price), "at": now_ms}
    if fee:
        fill["fee"] = fee
    if side == "buy":
        if cost + fee > acct["cash"] + 1e-9:
            if fee and cost <= acct["cash"] + 1e-9:
                raise TWError("FAILED_PRECONDITION", "Not enough match cash to cover the storm's 1%% fee ($%s)." % format(fee, ",.2f"))
            raise TWError("FAILED_PRECONDITION", "Not enough match cash: %d shares of %s cost $%s and you have $%s." % (qty, sym, format(cost, ",.2f"), format(acct["cash"], ",.2f")))
        new_qty = pos["qty"] + qty
        pos["avg"] = _r2((pos["qty"] * pos["avg"] + cost) / new_qty)
        pos["qty"] = new_qty
        acct["cash"] = _r2(acct["cash"] - cost - fee)
    else:
        if qty > pos["qty"]:
            raise TWError("FAILED_PRECONDITION", "You only hold %d shares of %s (Trade War is long only)." % (pos["qty"], sym))
        gain = _r2((price - pos["avg"]) * qty)
        extra = gain if kind == "double" else 0.0
        fill["pnl"] = gain
        acct["worst"] = min(acct.get("worst") or 0, gain)
        acct["realized"] = _r2(acct.get("realized", 0) + gain)
        if gain > 0:
            acct["wins"] = acct.get("wins", 0) + 1
        elif gain < 0:
            acct["losses"] = acct.get("losses", 0) + 1
        pos["qty"] -= qty
        acct["cash"] = _r2(acct["cash"] + cost - fee)
        if extra:
            extra = max(extra, -acct["cash"])  # a doubled loss can't take cash below zero
            acct["cash"] = _r2(acct["cash"] + extra)
            acct["realized"] = _r2(acct["realized"] + extra)
            acct["worst"] = min(acct.get("worst") or 0, _r2(gain + extra))
            fill["pnl"] = _r2(gain + extra)
            fill["storm"] = "double"
    if pos["qty"]:
        book["positions"][sym] = pos
    else:
        book["positions"].pop(sym, None)
    book["fills"] = (book["fills"] + [fill])[-TW_MAX_FILLS:]
    acct["trades"] = acct.get("trades", 0) + 1
    acct["lastTradeAt"] = now_ms
    return acct, book, fill


def tw_mark(acct, book, prices, now_ms):
    """Pure: acct with equity / P&L revalued at prices (falls back to cost basis)."""
    acct = dict(acct)
    value = sum(p["qty"] * (prices.get(s) or p["avg"]) for s, p in (book.get("positions") or {}).items())
    equity = _r2(acct["cash"] + value)
    acct["equity"] = equity
    acct["pnl"] = _r2(equity - acct["start"])
    acct["pnlPct"] = round((equity / acct["start"] - 1) * 100, 3) if acct["start"] else 0.0
    acct["updatedAt"] = now_ms
    return acct


def tw_check_bracket(price, sl, tp):
    """(sl, tp) as clean numbers or None, or raises TWError. Long only: stop below the
    current price, target above it."""
    out = []
    for v, name in ((sl, "Stop loss"), (tp, "Take profit")):
        if v in (None, "", 0):
            out.append(None)
            continue
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not (0 < v < 1e7):
            raise TWError("INVALID_ARGUMENT", "%s must be a price." % name)
        out.append(_r2(v))
    sl, tp = out
    if price:
        if sl is not None and sl >= price:
            raise TWError("INVALID_ARGUMENT", "Stop loss has to be below the current price ($%s)." % format(price, ",.2f"))
        if tp is not None and tp <= price:
            raise TWError("INVALID_ARGUMENT", "Take profit has to be above the current price ($%s)." % format(price, ",.2f"))
    return sl, tp


def tw_bracket_hits(book, prices):
    """[(sym, 'sl'|'tp', price)] for positions whose stop loss or take profit was reached."""
    hits = []
    for sym, p in sorted((book.get("positions") or {}).items()):
        px = prices.get(sym)
        if not px:
            continue
        if p.get("sl") and px <= p["sl"]:
            hits.append((sym, "sl", px))
        elif p.get("tp") and px >= p["tp"]:
            hits.append((sym, "tp", px))
    return hits


def tw_rank(rows):
    """Rows of {uid, pnlPct, pnl, ...} ranked by % P&L (equal capital, so % and $ agree).
    In Last Man Standing, players still standing rank above those knocked out (by place)."""
    rows = sorted(rows, key=lambda r: (1, r.get("place") or 0, 0, 0, r.get("uid", "")) if r.get("out")
                  else (0, 0, -(r.get("pnlPct") or 0), -(r.get("pnl") or 0), r.get("uid", "")))
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows


def _tw_prices(db, now_s=None):
    """(prices {SYM: c}, tradable bool, why) from the markets/quotes doc refresh_quotes writes."""
    snap = db.collection("markets").document("quotes").get()
    doc = (snap.to_dict() or {}) if snap.exists else {}
    prices = {s: q.get("c") for s, q in (doc.get("quotes") or {}).items() if q and q.get("c")}
    try:
        age = (now_s or _time.time()) - datetime.fromisoformat(doc.get("updatedAt")).timestamp()
    except Exception:
        age = 1e9
    if not doc.get("marketOpen"):
        return prices, False, "The market is closed. Trade War matches trade during market hours (9:30 am to 4:00 pm New York time)."
    if age > TW_QUOTE_MAX_AGE_S:
        return prices, False, "Live prices are delayed right now, so trading is paused. Try again in a minute."
    return prices, True, ""


def _tw_http(e):
    return https_fn.HttpsError(getattr(https_fn.FunctionsErrorCode, e.code), e.message)


def _tw_user(req):
    auth_ = req.auth
    if not auth_ or not auth_.uid:
        raise TWError("UNAUTHENTICATED", "Sign in to play Trade War.")
    provider = ((auth_.token or {}).get("firebase") or {}).get("sign_in_provider")
    if provider == "anonymous":
        raise TWError("UNAUTHENTICATED", "Create a free account to play Trade War matches.")
    return auth_.uid


def _tw_name(db, uid, token):
    try:
        t = db.collection("traders").document(uid).get()
        n = (t.to_dict() or {}).get("name") if t.exists else None
        if n:
            return str(n)[:24]
        p = db.collection("practiceProfiles").document(uid).get()
        n = (p.to_dict() or {}).get("name") if p.exists else None
        if n:
            return str(n)[:24]
    except Exception:
        pass
    return str((token or {}).get("name") or "Trader").split(" ")[0][:24]


def _tw_xps(db, uids):
    """XP per player (users/{uid}.xp) for Whale vs Minnow roles."""
    out = {}
    for u in uids:
        try:
            d = db.collection("users").document(u).get()
            out[u] = int((d.to_dict() or {}).get("xp") or 0) if d.exists else 0
        except Exception:
            out[u] = 0
    return out


def _tw_log(w, ref, ev):
    """Add a Battlefield Ticker event (w is a transaction or batch)."""
    w.set(ref.collection("events").document(), ev)


def _tw_start_events(war, fields, now_ms):
    names = war.get("names") or {}
    evs = []
    if fields.get("whales"):
        evs.append(tw_event("whale", "Whales: %s. Everyone else gets %d Shield Token%s." % (", ".join(names.get(u, "Trader") for u in fields["whales"]),
                    war["modes"]["whale"]["shields"], "" if war["modes"]["whale"]["shields"] == 1 else "s"), now_ms))
    if fields.get("status") == "draft":
        evs.append(tw_event("draft", "The draft is on. %s picks first." % names.get(fields["draft"]["order"][0], "Trader"), now_ms))
    else:
        evs.append(tw_event("start", "The Trade War has started. Everyone has %s of virtual money." % ("$" + format(war["buyIn"], ",")), now_ms))
    return evs


def _tw_war_id(data):
    wid = str((data or {}).get("warId") or "")
    if not _TW_ID_RE.match(wid):
        raise TWError("INVALID_ARGUMENT", "That Trade War link isn't valid.")
    return wid


def _tw_call(fn):
    """Runs fn(req, db, uid, now_ms), turning TWError into a clean HttpsError."""
    def wrapper(req):
        try:
            uid = _tw_user(req)
            return fn(req, firestore.client(), uid, int(_time.time() * 1000))
        except TWError as e:
            raise _tw_http(e)
        except https_fn.HttpsError:
            raise
        except Exception as e:
            print("[tradewar] %s failed: %s" % (fn.__name__, type(e).__name__))
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INTERNAL, "Something went wrong. Try again.")
    wrapper.__name__ = fn.__name__
    return wrapper


@https_fn.on_call()
@_tw_call
def tw_create(req, db, uid, now_ms):
    name, buy_in, days, max_players = tw_validate_create(req.data)
    lms = tw_validate_lms(req.data, days)
    modes = tw_validate_modes(req.data, days)
    _tw_check_buyin(db, uid, buy_in)
    open_count = sum(1 for d in db.collection("tradeWars").where("host", "==", uid).where("status", "==", "lobby").limit(6).stream())
    if open_count >= 5:
        raise TWError("RESOURCE_EXHAUSTED", "You already have 5 Trade Wars waiting in the lobby. Start or cancel one first.")
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    wid = "".join(_secrets.choice(alphabet) for _ in range(12))
    pname = _tw_name(db, uid, req.auth.token)
    war_ref = db.collection("tradeWars").document(wid)
    batch = db.batch()
    batch.set(war_ref, {"name": name, "host": uid, "hostName": pname, "buyIn": buy_in, "days": days,
                        "maxPlayers": max_players, "status": "lobby", "players": [uid], "names": {uid: pname},
                        "lms": lms, "modes": modes, "createdAt": now_ms, "startAt": None, "endAt": None, "results": None, "markedAt": None,
                        "rules": {"deposits": False, "withdrawals": False, "shortSelling": False, "assets": "stocks"}})
    batch.set(war_ref.collection("accounts").document(uid), tw_new_account(pname, buy_in, now_ms))
    batch.set(war_ref.collection("books").document(uid), tw_new_book())
    batch.commit()
    return {"warId": wid}


@https_fn.on_call()
@_tw_call
def tw_join(req, db, uid, now_ms):
    wid = _tw_war_id(req.data)
    war_ref = db.collection("tradeWars").document(wid)
    pname = _tw_name(db, uid, req.auth.token)

    @firestore.transactional
    def txn(t):
        snap = war_ref.get(transaction=t)
        if not snap.exists:
            raise TWError("NOT_FOUND", "That Trade War doesn't exist.")
        war = snap.to_dict()
        if uid in war["players"]:
            return
        if war["status"] != "lobby":
            raise TWError("FAILED_PRECONDITION", "This Trade War has already started. Buy-ins are locked once it begins.")
        if len(war["players"]) >= war["maxPlayers"]:
            raise TWError("FAILED_PRECONDITION", "This Trade War is full.")
        t.update(war_ref, {"players": war["players"] + [uid], "names.%s" % uid: pname})
        t.set(war_ref.collection("accounts").document(uid), tw_new_account(pname, war["buyIn"], now_ms))
        t.set(war_ref.collection("books").document(uid), tw_new_book())

    txn(db.transaction())
    return {"ok": True}


@https_fn.on_call()
@_tw_call
def tw_leave(req, db, uid, now_ms):
    wid = _tw_war_id(req.data)
    war_ref = db.collection("tradeWars").document(wid)

    @firestore.transactional
    def txn(t):
        snap = war_ref.get(transaction=t)
        if not snap.exists:
            raise TWError("NOT_FOUND", "That Trade War doesn't exist.")
        war = snap.to_dict()
        if uid not in war["players"]:
            return
        if war["status"] != "lobby":
            raise TWError("FAILED_PRECONDITION", "You can't leave once the Trade War has started.")
        if uid == war["host"]:
            raise TWError("FAILED_PRECONDITION", "The host can cancel the Trade War instead of leaving.")
        names = dict(war.get("names") or {})
        names.pop(uid, None)
        t.update(war_ref, {"players": [p for p in war["players"] if p != uid], "names": names})
        t.delete(war_ref.collection("accounts").document(uid))
        t.delete(war_ref.collection("books").document(uid))

    txn(db.transaction())
    return {"ok": True}


@https_fn.on_call()
@_tw_call
def tw_start(req, db, uid, now_ms):
    wid = _tw_war_id(req.data)
    war_ref = db.collection("tradeWars").document(wid)

    @firestore.transactional
    def txn(t):
        snap = war_ref.get(transaction=t)
        if not snap.exists:
            raise TWError("NOT_FOUND", "That Trade War doesn't exist.")
        war = snap.to_dict()
        if war["host"] != uid:
            raise TWError("PERMISSION_DENIED", "Only the host can start this Trade War.")
        if war["status"] != "lobby":
            raise TWError("FAILED_PRECONDITION", "This Trade War has already started.")
        if len(war["players"]) < 2:
            raise TWError("FAILED_PRECONDITION", "You need at least one opponent. Share the invite link first.")
        xps = _tw_xps(db, war["players"]) if (war.get("modes") or {}).get("whale") else {}
        fields = tw_start_fields(war, now_ms, xps)
        t.update(war_ref, fields)
        for ev in _tw_start_events(war, fields, now_ms):
            _tw_log(t, war_ref, ev)

    txn(db.transaction())
    _tw_close_invites(db, wid, "expired", now_ms)  # the buy-in is locked: unanswered invites lapse
    return {"ok": True}


@https_fn.on_call()
@_tw_call
def tw_cancel(req, db, uid, now_ms):
    wid = _tw_war_id(req.data)
    war_ref = db.collection("tradeWars").document(wid)
    snap = war_ref.get()
    if not snap.exists:
        raise TWError("NOT_FOUND", "That Trade War doesn't exist.")
    war = snap.to_dict()
    if war["host"] != uid:
        raise TWError("PERMISSION_DENIED", "Only the host can cancel this Trade War.")
    if war["status"] != "lobby":
        raise TWError("FAILED_PRECONDITION", "A Trade War can only be cancelled before it starts.")
    war_ref.update({"status": "cancelled"})
    _tw_close_invites(db, wid, "cancelled", now_ms)
    return {"ok": True}


@https_fn.on_call()
@_tw_call
def tw_trade(req, db, uid, now_ms):
    data = req.data or {}
    wid = _tw_war_id(data)
    sym = str(data.get("sym") or "").upper()
    if sym not in PRACTICE_SYMBOLS:
        raise TWError("INVALID_ARGUMENT", "%s isn't available in Trade War." % (sym or "That symbol"))
    side = data.get("side")
    qty = data.get("qty")
    if isinstance(qty, float) and qty.is_integer():
        qty = int(qty)
    prices, tradable, why = _tw_prices(db)
    if not tradable:
        raise TWError("FAILED_PRECONDITION", why)
    # optional Stop Loss / Take Profit attached to a buy (checked against the live price)
    sl, tp = tw_check_bracket(prices.get(sym), data.get("sl"), data.get("tp")) if side == "buy" else (None, None)
    war_ref = db.collection("tradeWars").document(wid)
    acct_ref = war_ref.collection("accounts").document(uid)
    book_ref = war_ref.collection("books").document(uid)

    @firestore.transactional
    def txn(t):
        wsnap = war_ref.get(transaction=t)
        if not wsnap.exists:
            raise TWError("NOT_FOUND", "That Trade War doesn't exist.")
        war = wsnap.to_dict()
        if uid not in war["players"]:
            raise TWError("PERMISSION_DENIED", "You're not in this Trade War.")
        if war["status"] != "active":
            raise TWError("FAILED_PRECONDITION", "This Trade War isn't live yet." if war["status"] in ("lobby", "draft") else "This Trade War is over.")
        if now_ms >= (war.get("endAt") or 0):
            raise TWError("FAILED_PRECONDITION", "This Trade War has ended. Final results are being tallied.")
        mine = ((war.get("draft") or {}).get("picks") or {}).get(uid)
        if (war.get("modes") or {}).get("draft") and mine is not None and sym not in mine:
            raise TWError("FAILED_PRECONDITION", "You can only trade the stocks you drafted: %s." % ", ".join(mine))
        storm = tw_storm_now(war.get("storm"), now_ms)
        if storm and storm.get("kind") == "halt" and storm.get("sym") == sym:
            raise TWError("FAILED_PRECONDITION", "%s is halted by a Volatility Storm (a virtual game event) for a few more minutes." % sym)
        allowed = (war.get("rules") or {}).get("symbols")
        if allowed and sym not in allowed:
            listed = ", ".join(allowed[:12]) + (" and more" if len(allowed) > 12 else "")
            raise TWError("FAILED_PRECONDITION", "This squad Trade War only allows %s." % listed)
        acct = acct_ref.get(transaction=t).to_dict()
        if acct.get("out"):
            raise TWError("FAILED_PRECONDITION", "You've been eliminated from this Last Man Standing. Your result is locked in.")
        book = book_ref.get(transaction=t).to_dict() or tw_new_book()
        whale = (war.get("modes") or {}).get("whale")
        if whale and side == "buy" and uid in (war.get("whales") or []) and prices.get(sym) and isinstance(qty, int) \
                and not tw_whale_ok(acct, book, prices, sym, qty, prices[sym], whale["capPct"]):
            raise TWError("FAILED_PRECONDITION", "Whale limit: as a whale you can put at most %d%% of your account in one stock." % whale["capPct"])
        eq_before = acct.get("equity") or acct["start"]
        acct, book, fill = tw_apply_trade(acct, book, sym, side, qty, prices.get(sym), now_ms, storm)
        if sl or tp:
            book["positions"][sym] = dict(book["positions"][sym], **{k: v for k, v in (("sl", sl), ("tp", tp)) if v})
        acct = tw_mark(acct, book, prices, now_ms)
        name = (war.get("names") or {}).get(uid, "Trader")
        if fill["qty"] * fill["price"] >= TW_BIG_TRADE * eq_before:
            open_book = (war.get("rules") or {}).get("viewTrades") or (war.get("modes") or {}).get("draft")
            if open_book:
                what = "%s %d %s" % ("bought" if side == "buy" else "sold", qty, sym)
                if fill.get("pnl") is not None:
                    what += " (%s)" % _tw_money(fill["pnl"], signed=True)
            else:
                what = "a big " + ("buy" if side == "buy" else "sell")
            _tw_log(t, war_ref, tw_event("big", "%s went big: %s" % (name, what), now_ms, uid=uid))
        if fill.get("storm") == "double" and abs(fill.get("pnl") or 0) >= 1:
            _tw_log(t, war_ref, tw_event("storm", "%s rode the storm: %s, doubled" % (name, _tw_money(fill["pnl"], signed=True)), now_ms, uid=uid))
        reason, alive = tw_out_reason(acct, war.get("lms")), None
        if reason:
            alive = [u for u in (war.get("alive") or war["players"]) if u != uid]
            acct, book = tw_knock_out(acct, book, prices, reason, len(alive) + 1, now_ms)
            t.update(war_ref, {"alive": alive, "outs": (war.get("outs") or []) + [
                {"uid": uid, "name": acct.get("name"), "reason": reason, "at": now_ms, "pnlPct": acct["pnlPct"], "place": acct["place"]}]})
            _tw_log(t, war_ref, tw_event("out", "%s is knocked out (#%d)" % (name, acct["place"]), now_ms, uid=uid))
        t.set(acct_ref, acct)
        t.set(book_ref, book)
        return fill, acct, alive

    fill, acct, alive = txn(db.transaction())
    if alive is not None and len(alive) <= 1:
        tw_mark_war(db, war_ref, now_ms, prices)  # the last trader standing wins now
    return {"fill": fill, "cash": acct["cash"], "equity": acct["equity"], "out": acct.get("outReason")}


@https_fn.on_call()
@_tw_call
def tw_bracket(req, db, uid, now_ms):
    """Set or clear the Stop Loss / Take Profit on one of your positions:
    {warId, sym, sl, tp} (null clears). The 5-minute job sells the whole position at the
    market price once the price reaches either one (during market hours)."""
    data = req.data or {}
    war_ref = db.collection("tradeWars").document(_tw_war_id(data))
    sym = str(data.get("sym") or "").upper()
    prices, _, _ = _tw_prices(db)
    sl, tp = tw_check_bracket(prices.get(sym), data.get("sl"), data.get("tp"))
    book_ref = war_ref.collection("books").document(uid)

    @firestore.transactional
    def txn(t):
        wsnap = war_ref.get(transaction=t)
        war = wsnap.to_dict() if wsnap.exists else None
        if not war or uid not in war["players"]:
            raise TWError("PERMISSION_DENIED", "You're not in this Trade War.")
        if war["status"] != "active":
            raise TWError("FAILED_PRECONDITION", "This Trade War isn't live.")
        acct = war_ref.collection("accounts").document(uid).get(transaction=t).to_dict() or {}
        if acct.get("out"):
            raise TWError("FAILED_PRECONDITION", "You've been knocked out.")
        book = book_ref.get(transaction=t).to_dict() or tw_new_book()
        pos = (book.get("positions") or {}).get(sym)
        if not pos:
            raise TWError("FAILED_PRECONDITION", "You don't hold %s." % (sym or "that stock"))
        pos = {k: v for k, v in pos.items() if k not in ("sl", "tp")}
        if sl:
            pos["sl"] = sl
        if tp:
            pos["tp"] = tp
        t.update(book_ref, {"positions.%s" % sym: pos})
        return pos

    pos = txn(db.transaction())
    return {"sl": pos.get("sl"), "tp": pos.get("tp")}


@https_fn.on_call()
@_tw_call
def tw_draft_pick(req, db, uid, now_ms):
    """Your draft pick ({warId, sym}), or {warId} alone to auto-pick for a player whose time ran out."""
    data = req.data or {}
    sym = str(data.get("sym") or "").upper() or None
    tw_draft_step(db, db.collection("tradeWars").document(_tw_war_id(data)), now_ms, uid, sym)
    return {"ok": True}


@https_fn.on_call()
@_tw_call
def tw_bounty(req, db, uid, now_ms):
    """Place a bounty: {warId, target, pct: 2|5|10, hours: 6|24}. The pot comes out of your match cash."""
    data = req.data or {}
    war_ref = db.collection("tradeWars").document(_tw_war_id(data))
    target = str(data.get("target") or "")
    pct, hours = data.get("pct"), data.get("hours")
    prices, _, _ = _tw_prices(db)

    @firestore.transactional
    def txn(t):
        wsnap = war_ref.get(transaction=t)
        war = wsnap.to_dict() if wsnap.exists else None
        if not war or uid not in war["players"]:
            raise TWError("PERMISSION_DENIED", "You're not in this Trade War.")
        if not (war.get("modes") or {}).get("bounties"):
            raise TWError("FAILED_PRECONDITION", "Bounties are off in this Trade War.")
        if war["status"] != "active" or now_ms >= (war.get("endAt") or 0):
            raise TWError("FAILED_PRECONDITION", "Bounties can only be placed while the Trade War is live.")
        accts, books = {}, {}
        for u in war["players"]:
            a = war_ref.collection("accounts").document(u).get(transaction=t)
            if a.exists:
                b = war_ref.collection("books").document(u).get(transaction=t)
                books[u] = (b.to_dict() if b.exists else None) or tw_new_book()
                accts[u] = a.to_dict() if a.to_dict().get("out") else tw_mark(a.to_dict(), books[u], prices, now_ms)
        bid = "".join(_secrets.choice("abcdefghijkmnopqrstuvwxyz23456789") for _ in range(10))
        b = tw_new_bounty(war, accts, uid, target, pct, hours, now_ms, bid)
        me = tw_mark(dict(accts[uid], cash=_r2(accts[uid]["cash"] - b["amount"])), books[uid], prices, now_ms)
        t.set(war_ref.collection("accounts").document(uid), me)
        t.update(war_ref, {"bounties": (war.get("bounties") or []) + [b]})
        _tw_log(t, war_ref, tw_event("bounty", "%s put a %s bounty on %s (%d h)" % (b["byName"], _tw_money(b["amount"]), b["targetName"], hours), now_ms, uid=uid))
        return b

    b = txn(db.transaction())
    return {"id": b["id"], "amount": b["amount"], "end": b["end"]}


@https_fn.on_call()
@_tw_call
def tw_shield(req, db, uid, now_ms):
    """Spend a Shield Token to cancel a bounty on you: {warId, bountyId}. The sponsor gets the pot back."""
    data = req.data or {}
    war_ref = db.collection("tradeWars").document(_tw_war_id(data))
    bid = str(data.get("bountyId") or "")
    prices, _, _ = _tw_prices(db)

    @firestore.transactional
    def txn(t):
        wsnap = war_ref.get(transaction=t)
        war = wsnap.to_dict() if wsnap.exists else None
        if not war or uid not in war["players"]:
            raise TWError("PERMISSION_DENIED", "You're not in this Trade War.")
        if war["status"] != "active":
            raise TWError("FAILED_PRECONDITION", "This Trade War isn't live.")
        shields = dict(war.get("shields") or {})
        if shields.get(uid, 0) < 1:
            raise TWError("FAILED_PRECONDITION", "You don't have a Shield Token.")
        bounties = list(war.get("bounties") or [])
        i = next((k for k, b in enumerate(bounties) if b["id"] == bid), None)
        if i is None or bounties[i]["target"] != uid or bounties[i]["status"] != "open":
            raise TWError("NOT_FOUND", "There's no open bounty on you with that id.")
        b = bounties[i]
        sref = war_ref.collection("accounts").document(b["by"])
        sp = sref.get(transaction=t).to_dict()
        if not sp.get("out"):
            bk = war_ref.collection("books").document(b["by"]).get(transaction=t)
            t.set(sref, tw_mark(dict(sp, cash=_r2(sp["cash"] + b["amount"])), (bk.to_dict() if bk.exists else None) or tw_new_book(), prices, now_ms))
        bounties[i] = dict(b, status="shielded", settledAt=now_ms)
        shields[uid] -= 1
        t.update(war_ref, {"bounties": bounties, "shields": shields})
        _tw_log(t, war_ref, tw_event("shield", "%s raised a Shield: the %s bounty is cancelled" % (b["targetName"], _tw_money(b["amount"])), now_ms, uid=uid))

    txn(db.transaction())
    return {"ok": True}


def tw_settle_bounties(war, accts, books, prices, now_ms, force):
    """Pure-ish: settles due bounties (all open ones if force), paying the pot into cash.
    Returns (bounties, events)."""
    names, out, evs = war.get("names") or {}, [], []
    for b in war.get("bounties") or []:
        if b["status"] != "open" or (not force and now_ms < b["end"]):
            out.append(b)
            continue
        status, who = tw_settle_bounty(b, accts)
        b = dict(b, status=status, winner=who, winnerName=names.get(who, "Trader"), settledAt=now_ms)
        if who in accts and not accts[who].get("out"):
            a = dict(accts[who], cash=_r2(accts[who]["cash"] + b["amount"]))
            accts[who] = tw_mark(a, books[who], prices, now_ms)
        money = _tw_money(b["amount"])
        evs.append(tw_event("bounty", {"won": "%s claimed the %s bounty on %s" % (b["winnerName"], money, b["targetName"]),
                                       "defended": "%s survived the bounty and keeps %s" % (b["targetName"], money),
                                       "refunded": "The %s bounty on %s expired unclaimed" % (money, b["targetName"])}[status], now_ms, uid=who))
        out.append(b)
    return out, evs


def tw_mark_war(db, ref, now_ms, prices, market_open=False, rng=None):
    """Revalue one live match in a transaction (so it can't overwrite a trade in flight),
    then: settle due bounties, apply Last Man Standing eliminations (Shield Tokens save
    you from a timed cut), roll for Volatility Storms, post lead changes to the
    Battlefield Ticker, and close the match when time is up or one trader is left."""
    rng = rng or _secrets.SystemRandom()

    @firestore.transactional
    def txn(t):
        wsnap = ref.get(transaction=t)
        war = wsnap.to_dict() if wsnap.exists else None
        if not war or war.get("status") != "active":
            return False
        accts, books = {}, {}
        for uid in war.get("players") or []:
            a = ref.collection("accounts").document(uid).get(transaction=t)
            b = ref.collection("books").document(uid).get(transaction=t)
            if a.exists:
                accts[uid] = a.to_dict()
                books[uid] = (b.to_dict() if b.exists else None) or tw_new_book()
        for uid, acct in accts.items():
            if not acct.get("out"):
                accts[uid] = tw_mark(acct, books[uid], prices, now_ms)
        names, modes = war.get("names") or {}, war.get("modes") or {}
        update, lms, knocked, events, touched = {"markedAt": now_ms}, war.get("lms"), set(), [], set()
        time_up = now_ms >= (war.get("endAt") or 0)
        if market_open and not time_up:
            # Stop Loss / Take Profit: sell the whole position at the market price
            storm = tw_storm_now(war.get("storm"), now_ms)
            open_book = (war.get("rules") or {}).get("viewTrades") or modes.get("draft")
            for uid in sorted(accts):
                if accts[uid].get("out"):
                    continue
                for sym, kind, px in tw_bracket_hits(books[uid], prices):
                    if storm and storm.get("kind") == "halt" and storm.get("sym") == sym:
                        continue
                    qty = books[uid]["positions"][sym]["qty"]
                    a, books[uid], fill = tw_apply_trade(dict(accts[uid], lastTradeAt=0), books[uid], sym, "sell", qty, px, now_ms, storm)
                    fill["auto"] = kind
                    a["lastTradeAt"] = accts[uid].get("lastTradeAt") or 0
                    accts[uid] = tw_mark(a, books[uid], prices, now_ms)
                    touched.add(uid)
                    what = ("%s on %s: sold %d at %s (%s)" % ("Stop loss" if kind == "sl" else "Take profit", sym, qty, _tw_money(px), _tw_money(fill["pnl"], signed=True))
                            if open_book else ("stop loss hit" if kind == "sl" else "take profit hit"))
                    events.append(tw_event("bracket", "%s: %s" % (names.get(uid, "Trader"), what), now_ms, uid=uid))
        if war.get("bounties"):
            update["bounties"], evs = tw_settle_bounties(war, accts, books, prices, now_ms, time_up)
            events += evs
        alive = [u for u in (war.get("alive") or war["players"]) if u in accts and not accts[u].get("out")]
        if lms:
            outs, used, shields = list(war.get("outs") or []), [], dict(war.get("shields") or {})
            picks = tw_pick_outs(alive, accts, lms, now_ms, war.get("nextCutAt"), shields, used)
            for u in used:
                shields[u] -= 1
                events.append(tw_event("shield", "%s used a Shield Token to survive the cut" % names.get(u, "Trader"), now_ms, uid=u))
            if used:
                update["shields"] = shields
            for i, (uid, reason) in enumerate(picks):
                accts[uid], books[uid] = tw_knock_out(accts[uid], books[uid], prices, reason, len(alive) - i, now_ms)
                a = accts[uid]
                outs.append({"uid": uid, "name": a.get("name"), "reason": reason, "at": now_ms, "pnlPct": a["pnlPct"], "place": a["place"]})
                events.append(tw_event("out", "%s is knocked out (#%d)" % (a.get("name") or "Trader", a["place"]), now_ms, uid=uid))
                knocked.add(uid)
            alive = [u for u in alive if u not in knocked]
            update.update({"alive": alive, "outs": outs})
            cut = lms.get("cutHours")
            if cut and war.get("nextCutAt") and now_ms >= war["nextCutAt"]:
                update["nextCutAt"] = war["nextCutAt"] + cut * 3600000
        ending = time_up or (lms and len(alive) <= 1)
        if ending and not time_up and any(b["status"] == "open" for b in update.get("bounties") or war.get("bounties") or []):
            update["bounties"], evs = tw_settle_bounties(dict(war, bounties=update.get("bounties") or war.get("bounties")), accts, books, prices, now_ms, True)
            events += evs
        if not ending:
            storm = war.get("storm")
            if storm and storm.get("end", 0) <= now_ms and not storm.get("over"):
                update["storm"] = storm = dict(storm, over=True)
                events.append(tw_event("storm", "The storm has passed. Normal trading resumes.", now_ms))
            held = {s for u in alive for s in (books[u].get("positions") or {})}
            new = tw_maybe_storm(modes.get("storms"), storm, now_ms, war.get("endAt") or 0, market_open, rng.random(), rng.choice, held)
            if new:
                update["storm"] = new
                events.append(tw_event("storm", "VOLATILITY STORM (virtual): " + tw_storm_text(new) + " for 30 minutes.", now_ms))
            lead = tw_leader(accts, alive)
            if lead and lead != war.get("leader"):
                update["leader"] = lead
                events.append(tw_event("lead", "%s takes the lead (%+.2f%%)" % (names.get(lead, "Trader"), accts[lead]["pnlPct"]), now_ms, uid=lead))
        else:
            rows = [{"uid": uid, "name": a.get("name"), "start": a["start"], "final": a["equity"], "pnl": a["pnl"],
                     "pnlPct": a["pnlPct"], "trades": a.get("trades", 0), "wins": a.get("wins", 0), "losses": a.get("losses", 0),
                     "out": bool(a.get("out")), "outReason": a.get("outReason"), "place": a.get("place")} for uid, a in accts.items()]
            update.update({"status": "ended", "results": tw_rank(rows), "endedAt": now_ms})
            win = update["results"][0] if update["results"] else None
            if win:
                events.append(tw_event("win", "%s wins the Trade War (%+.2f%%)" % (win["name"] or "Trader", win["pnlPct"]), now_ms, uid=win["uid"]))
        for uid, acct in accts.items():
            t.set(ref.collection("accounts").document(uid), acct)
            if uid in knocked or uid in touched:
                t.set(ref.collection("books").document(uid), books[uid])
        t.update(ref, update)
        for ev in events:
            _tw_log(t, ref, ev)
        return True

    return txn(db.transaction())


def tw_draft_step(db, ref, now_ms, uid=None, sym=None, rng=None):
    """One draft pick in a transaction. uid picks sym on their turn; with sym None, any
    player (or the 5-minute job, uid None) auto-picks for whoever's clock has run out.
    The 5-minute job finishes a draft nobody has touched for 2 minutes."""
    rng = rng or _secrets.SystemRandom()

    @firestore.transactional
    def txn(t):
        wsnap = ref.get(transaction=t)
        war = wsnap.to_dict() if wsnap.exists else None
        if not war:
            raise TWError("NOT_FOUND", "That Trade War doesn't exist.")
        if war.get("status") != "draft":
            if uid is None:
                return None
            raise TWError("FAILED_PRECONDITION", "The draft is over." if war.get("status") == "active" else "This Trade War isn't drafting.")
        if uid is not None and uid not in war["players"]:
            raise TWError("PERMISSION_DENIED", "You're not in this Trade War.")
        draft, universe, names, events = war["draft"], tw_draft_universe(war), war.get("names") or {}, []
        on_clock = tw_draft_on_clock(draft)
        if uid is not None and sym is not None:
            if uid != on_clock:
                raise TWError("FAILED_PRECONDITION", "It's %s's pick." % names.get(on_clock, "another player"))
            draft, who = tw_draft_apply(draft, sym, universe, now_ms)
            events.append(tw_event("draft", "%s drafts %s" % (names.get(who, "Trader"), sym), now_ms, uid=who))
        else:
            overdue = now_ms >= draft["deadline"]
            idle = now_ms >= draft["deadline"] - TW_DRAFT_PICK_MS + TW_DRAFT_IDLE_MS
            if not overdue:
                if uid is None:
                    return None
                raise TWError("FAILED_PRECONDITION", "%s still has time to pick." % names.get(on_clock, "The player on the clock"))
            while draft["turn"] < draft["total"]:
                pick = tw_draft_auto(draft, universe, rng)
                draft, who = tw_draft_apply(draft, pick, universe, now_ms)
                events.append(tw_event("draft", "%s ran out of time: auto-drafted %s" % (names.get(who, "Trader"), pick), now_ms, uid=who))
                if not (uid is None and idle):
                    break
        upd = {"draft": draft}
        if draft["turn"] >= draft["total"]:
            upd.update(tw_live_fields(war, now_ms))
            upd["draft"] = dict(draft, done=True)
            events.append(tw_event("start", "Draft complete. The Trade War has started: trade your drafted stocks.", now_ms))
        t.update(ref, upd)
        for ev in events:
            _tw_log(t, ref, ev)
        return upd

    return txn(db.transaction())


def tw_mark_all(db, now_ms, prices, market_open=False):
    """Revalue every active match (closing the ones whose time is up) and move stalled drafts
    along. Returns #matches touched."""
    n = 0
    for wsnap in db.collection("tradeWars").where("status", "==", "active").stream():
        try:
            n += 1 if tw_mark_war(db, wsnap.reference, now_ms, prices, market_open) else 0
        except Exception as e:
            print("[tw_mark_matches] %s failed: %s" % (wsnap.id, type(e).__name__))
    for wsnap in db.collection("tradeWars").where("status", "==", "draft").stream():
        try:
            n += 1 if tw_draft_step(db, wsnap.reference, now_ms) else 0
        except Exception as e:
            print("[tw_mark_matches] draft %s failed: %s" % (wsnap.id, type(e).__name__))
    return n


@scheduler_fn.on_schedule(
    schedule="*/5 * * * *",
    timezone=scheduler_fn.Timezone("America/New_York"),
    timeout_sec=120,
    memory=256,
)
def tw_mark_matches(event: scheduler_fn.ScheduledEvent) -> None:
    db = firestore.client()
    prices, market_open, _ = _tw_prices(db)
    try:
        n = tw_mark_all(db, int(_time.time() * 1000), prices, market_open)
        if n:
            print("[tw_mark_matches] revalued %d active matches" % n)
    except Exception as e:
        print("[tw_mark_matches] failed:", type(e).__name__)


# ---------------------------------------------------------------------------
# Trade War challenges: invite a friend, several friends, or a whole squad into
# a new match. The invited players get a real-time invite card
# (zelos-challenge.js) with Accept / Decline.
#
#   twInvites/{id}  { to, from, fromName, fromUsername, fromPhoto, warId, warName, buyIn, days,
#                     mode: duel|group, status: pending|accepted|declined|cancelled|expired,
#                     createdAt, respondedAt }   readable by `to` and `from` only; server-written
#
# Accepting joins the match with the same buy-in as everyone (a new, separate match account).
# A 1-on-1 ("duel") starts the moment it's accepted; a group match waits for the host.
# Nobody is ever entered into a match without accepting.
# ---------------------------------------------------------------------------
TW_MAX_INVITEES = 20
TW_MAX_PENDING_SENT = 20
_TW_UID_RE = _re.compile(r"^[A-Za-z0-9_-]{6,128}$")


def tw_validate_challenge(data, uid):
    """Returns (targets, buy_in, days, name, squad_id) or raises TWError. targets excludes uid."""
    data = data or {}
    to = data.get("to")
    squad_id = data.get("squadId")
    targets = []
    if squad_id is not None:
        if not isinstance(squad_id, str) or not _TW_ID_RE.match(squad_id):
            raise TWError("INVALID_ARGUMENT", "That squad isn't valid.")
    else:
        to = [to] if isinstance(to, str) else to
        if not isinstance(to, list) or not to:
            raise TWError("INVALID_ARGUMENT", "Pick someone to challenge.")
        for t in to:
            if not isinstance(t, str) or not _TW_UID_RE.match(t):
                raise TWError("INVALID_ARGUMENT", "That player isn't valid.")
            if t != uid and t not in targets:
                targets.append(t)
        if not targets:
            raise TWError("INVALID_ARGUMENT", "You can't challenge yourself.")
        if len(targets) > TW_MAX_INVITEES:
            raise TWError("INVALID_ARGUMENT", "Challenge up to %d players at a time." % TW_MAX_INVITEES)
    _, buy_in, days, _ = tw_validate_create({"name": "x", "buyIn": data.get("buyIn"), "days": data.get("days"), "maxPlayers": 2})
    lms = tw_validate_lms(data, days)
    name = str(data.get("name") or "").strip() or ("Last Man Standing" if lms else "Squad Trade War" if squad_id else "Head-to-head")
    return targets, buy_in, days, _re.sub(r"[<>]", "", name)[:40], squad_id, lms


def tw_squad_rules(config):
    """Match rules a squad's owner set for its Trade Wars: allowed stocks and
    whether players can see each other's trades. Unknown symbols are dropped."""
    config = config if isinstance(config, dict) else {}
    out = {}
    syms = config.get("symbols")
    if isinstance(syms, list):
        syms = [s for s in dict.fromkeys(str(x).upper() for x in syms[:60]) if s in PRACTICE_SYMBOLS]
        if syms:
            out["symbols"] = syms
    if config.get("viewTrades") is True:
        out["viewTrades"] = True
    return out


def _tw_close_invites(db, wid, status, now_ms):
    try:
        for d in db.collection("twInvites").where("warId", "==", wid).where("status", "==", "pending").stream():
            d.reference.update({"status": status, "respondedAt": now_ms})
    except Exception as e:
        print("[tradewar] closing invites failed:", type(e).__name__)


@https_fn.on_call()
@_tw_call
def tw_challenge(req, db, uid, now_ms):
    targets, buy_in, days, name, squad_id, lms = tw_validate_challenge(req.data, uid)
    modes = tw_validate_modes(req.data, days)
    _tw_check_buyin(db, uid, buy_in)
    extra_rules = {}
    if squad_id:
        sq = db.collection("squads").document(squad_id).get()
        if not sq.exists or uid not in (sq.to_dict().get("members") or []):
            raise TWError("PERMISSION_DENIED", "You can only challenge a squad you're in.")
        targets = [m for m in sq.to_dict().get("members") or [] if m != uid][:TW_MAX_INVITEES]
        extra_rules = tw_squad_rules(sq.to_dict().get("config"))
        if not targets:
            raise TWError("FAILED_PRECONDITION", "Your squad has nobody else in it yet.")
    pending = sum(1 for _ in db.collection("twInvites").where("from", "==", uid).where("status", "==", "pending").limit(TW_MAX_PENDING_SENT + 1).stream())
    if pending + len(targets) > TW_MAX_PENDING_SENT:
        raise TWError("RESOURCE_EXHAUSTED", "You have too many challenges waiting for an answer. Wait for replies or cancel some first.")
    trader = db.collection("traders").document(uid).get()
    t = (trader.to_dict() or {}) if trader.exists else {}
    pname = _tw_name(db, uid, req.auth.token)
    photo = t.get("avatar") or t.get("photo")
    mode = "duel" if len(targets) == 1 and not squad_id else "group"
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    wid = "".join(_secrets.choice(alphabet) for _ in range(12))
    war_ref = db.collection("tradeWars").document(wid)
    batch = db.batch()
    batch.set(war_ref, {"name": name, "host": uid, "hostName": pname, "buyIn": buy_in, "days": days,
                        "maxPlayers": 1 + len(targets), "status": "lobby", "players": [uid], "names": {uid: pname},
                        "invited": targets, "mode": mode, "squadId": squad_id or None, "lms": lms, "modes": modes,
                        "createdAt": now_ms, "startAt": None, "endAt": None, "results": None, "markedAt": None,
                        "rules": dict({"deposits": False, "withdrawals": False, "shortSelling": False, "assets": "stocks"}, **extra_rules)})
    batch.set(war_ref.collection("accounts").document(uid), tw_new_account(pname, buy_in, now_ms))
    batch.set(war_ref.collection("books").document(uid), tw_new_book())
    for to in targets:
        batch.set(db.collection("twInvites").document(), {
            "to": to, "toName": _tw_name(db, to, None), "from": uid, "fromName": pname, "fromUsername": t.get("username"), "fromPhoto": photo,
            "warId": wid, "warName": name, "buyIn": buy_in, "days": days, "mode": mode, "lms": lms, "modes": modes,
            "symbols": extra_rules.get("symbols"),
            "status": "pending", "createdAt": now_ms, "respondedAt": None})
    batch.commit()
    return {"warId": wid, "invited": len(targets), "mode": mode}


@https_fn.on_call()
@_tw_call
def tw_respond(req, db, uid, now_ms):
    data = req.data or {}
    iid = str(data.get("inviteId") or "")
    if not _TW_UID_RE.match(iid):
        raise TWError("INVALID_ARGUMENT", "That challenge isn't valid.")
    accept = data.get("accept") is True
    inv_ref = db.collection("twInvites").document(iid)
    pname = _tw_name(db, uid, req.auth.token) if accept else None

    @firestore.transactional
    def txn(t):
        isnap = inv_ref.get(transaction=t)
        if not isnap.exists or isnap.to_dict().get("to") != uid:
            raise TWError("NOT_FOUND", "That challenge doesn't exist.")
        inv = isnap.to_dict()
        if inv["status"] != "pending":
            return {"status": inv["status"], "warId": inv["warId"]}
        war_ref = db.collection("tradeWars").document(inv["warId"])
        wsnap = war_ref.get(transaction=t)
        war = wsnap.to_dict() if wsnap.exists else None
        if not war or war["status"] != "lobby":
            t.update(inv_ref, {"status": "expired", "respondedAt": now_ms})
            return {"status": "expired", "warId": inv["warId"]}
        if not accept:
            t.update(inv_ref, {"status": "declined", "respondedAt": now_ms})
            if war.get("mode") == "duel":
                t.update(war_ref, {"status": "cancelled"})
            return {"status": "declined", "warId": inv["warId"]}
        if uid not in war["players"]:
            if len(war["players"]) >= war["maxPlayers"]:
                raise TWError("FAILED_PRECONDITION", "This Trade War is full.")
            upd = {"players": war["players"] + [uid], "names.%s" % uid: pname}
            started = None
            if war.get("mode") == "duel":
                w2 = dict(war, players=upd["players"], names=dict(war.get("names") or {}, **{uid: pname}))
                started = tw_start_fields(w2, now_ms, _tw_xps(db, w2["players"]) if (war.get("modes") or {}).get("whale") else {})
                upd.update(started)
            t.update(war_ref, upd)
            if started:
                for ev in _tw_start_events(w2, started, now_ms):
                    _tw_log(t, war_ref, ev)
            t.set(war_ref.collection("accounts").document(uid), tw_new_account(pname, war["buyIn"], now_ms))
            t.set(war_ref.collection("books").document(uid), tw_new_book())
        t.update(inv_ref, {"status": "accepted", "respondedAt": now_ms})
        return {"status": "accepted", "warId": inv["warId"], "started": war.get("mode") == "duel"}

    return txn(db.transaction())


# ---------------------------------------------------------------------------
# Tokens: the site's paid currency (replaces the old $20 Gumroad purchase).
#
#   wallets/{uid}                 { balance, passes: {strategy: untilMs}, unlocked: [alertId],
#                                   welcomed, createdAt, updatedAt }   owner-read, server-write
#   wallets/{uid}/ledger/{id}     { type, amount (+/-), balanceAfter, note, ref, at }
#   purchases/sq_{orderId}        { uid, pack, tokens, amountCents, provider, paymentId, at }  server only
#   squareCheckouts/{orderId}     a payment link we created: { uid, pack, tokens, amountCents, status }
#   squareEvents/{eventId}        webhook events already handled (duplicate guard)
#   alertsLocked/{alertId}        the full alert while it's live (see publish_alert); readable
#                                 with a pass for that scanner or a single unlock
#
# Every balance change happens here, in a transaction that also writes the ledger
# line, so balances can't be edited from a browser and can't be double-spent.
# Prices are provisional (the spec keeps pricing open) and live only in TOKENS.
# Payments: Square Checkout (see the Square section below). Until the owner adds the
# Square secrets, buying says "coming soon"; free tokens, passes and unlocks work regardless.
# ---------------------------------------------------------------------------
import hashlib as _hashlib

TOKENS = {
    "welcome": 75,                 # once per verified account
    "pass": 40, "passDays": 7,     # one scanner, 7 days
    "unlock": 10,                  # one live alert
    "packs": {"p100": (100, 300), "p350": (350, 1000), "p750": (750, 2000)},  # id: (tokens, US cents)
}
TK_UNLOCKED_MAX = 300
SITE_URL = "https://agentictrading.info"


def _tk_user(req):
    a = req.auth
    if not a or not a.uid:
        raise TWError("UNAUTHENTICATED", "Sign in to use tokens.")
    tok = a.token or {}
    if ((tok.get("firebase") or {}).get("sign_in_provider")) == "anonymous":
        raise TWError("UNAUTHENTICATED", "Create a free account to use tokens.")
    return a.uid, tok


def _tk_verified(tok):
    """Welcome tokens only for verified accounts (Google sign-in, or a verified email),
    so throwaway sign-ups can't farm them."""
    return tok.get("email_verified") is True or ((tok.get("firebase") or {}).get("sign_in_provider")) == "google.com"


def tk_new_wallet(now_ms):
    return {"balance": 0, "passes": {}, "unlocked": [], "welcomed": False, "createdAt": now_ms, "updatedAt": now_ms}


def tk_ledger(kind, amount, balance_after, now_ms, note="", ref=None):
    return {"type": kind, "amount": amount, "balanceAfter": balance_after, "note": note[:120], "ref": ref, "at": now_ms}


def tk_welcome(wallet, verified, now_ms):
    """Pure: (wallet, ledger line | None). The welcome bonus is granted exactly once."""
    if wallet.get("welcomed") or not verified:
        return wallet, None
    w = dict(wallet, balance=wallet["balance"] + TOKENS["welcome"], welcomed=True, updatedAt=now_ms)
    return w, tk_ledger("welcome", TOKENS["welcome"], w["balance"], now_ms, "Welcome tokens")


def tk_has_access(wallet, strategy, alert_id, now_ms):
    return (wallet.get("passes") or {}).get(strategy, 0) > now_ms or alert_id in (wallet.get("unlocked") or [])


def tk_spend(wallet, kind, now_ms, strategy=None, alert_id=None, locked=None):
    """Pure: (wallet, ledger line | None) for a pass or a single-alert unlock.
    locked: the alertsLocked doc for an unlock (None if it doesn't exist).
    Already covered = no charge (ledger None)."""
    if kind == "pass":
        if strategy not in ALLOWED_STRATEGIES:
            raise TWError("INVALID_ARGUMENT", "Pick a scanner.")
        cost, ref = TOKENS["pass"], strategy
    elif kind == "unlock":
        if not locked or locked.get("released"):
            raise TWError("FAILED_PRECONDITION", "This alert is already free to read.")
        strategy = locked.get("strategy")
        if tk_has_access(wallet, strategy, alert_id, now_ms):
            return wallet, None
        cost, ref = TOKENS["unlock"], alert_id
    else:
        raise TWError("INVALID_ARGUMENT", "Unknown purchase.")
    if wallet["balance"] < cost:
        raise TWError("FAILED_PRECONDITION", "You need %d tokens and have %d." % (cost, wallet["balance"]))
    w = dict(wallet, balance=wallet["balance"] - cost, updatedAt=now_ms)
    if kind == "pass":
        passes = dict(wallet.get("passes") or {})
        passes[strategy] = max(passes.get(strategy, 0), now_ms) + TOKENS["passDays"] * 86400000
        w["passes"] = passes
        note = "%s pass (%d days)" % (strategy.replace("-", " ").title(), TOKENS["passDays"])
    else:
        w["unlocked"] = ((wallet.get("unlocked") or []) + [alert_id])[-TK_UNLOCKED_MAX:]
        note = "Unlocked %s" % alert_id
    return w, tk_ledger(kind, -cost, w["balance"], now_ms, note, ref)


def tk_credit(wallet, tokens, now_ms, kind, note, ref):
    w = dict(wallet, balance=wallet["balance"] + tokens, updatedAt=now_ms)
    return w, tk_ledger(kind, tokens, w["balance"], now_ms, note, ref)


def _tk_call(fn):
    def wrapper(req):
        try:
            uid, tok = _tk_user(req)
            return fn(req, firestore.client(), uid, tok, int(_time.time() * 1000))
        except TWError as e:
            raise _tw_http(e)
        except https_fn.HttpsError:
            raise
        except Exception as e:
            print("[tokens] %s failed: %s" % (fn.__name__, type(e).__name__))
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INTERNAL, "Something went wrong. Try again.")
    wrapper.__name__ = fn.__name__
    return wrapper


def _tk_public(wallet):
    return {"balance": wallet["balance"], "passes": wallet.get("passes") or {}, "unlocked": (wallet.get("unlocked") or [])[-50:]}


@https_fn.on_call(secrets=["SQUARE_ACCESS_TOKEN"])
@_tk_call
def tokens_wallet(req, db, uid, tok, now_ms):
    """Your wallet (made on first use; welcome tokens once for a verified account) plus prices."""
    ref = db.collection("wallets").document(uid)

    @firestore.transactional
    def txn(t):
        snap = ref.get(transaction=t)
        wallet = snap.to_dict() if snap.exists else tk_new_wallet(now_ms)
        wallet, line = tk_welcome(wallet, _tk_verified(tok), now_ms)
        if line or not snap.exists:
            t.set(ref, wallet)
        if line:
            t.set(ref.collection("ledger").document(), line)
        return wallet, line

    wallet, line = txn(db.transaction())
    out = _tk_public(wallet)
    out.update({"welcomed": bool(line), "prices": {"pass": TOKENS["pass"], "passDays": TOKENS["passDays"], "unlock": TOKENS["unlock"], "welcome": TOKENS["welcome"]},
                "packs": [{"id": k, "tokens": v[0], "cents": v[1]} for k, v in TOKENS["packs"].items()],
                "canBuy": _square_ready(), "needsVerify": not wallet.get("welcomed") and not _tk_verified(tok)})
    return out


@https_fn.on_call()
@_tk_call
def tokens_spend(req, db, uid, tok, now_ms):
    """{kind: 'pass', strategy} or {kind: 'unlock', alertId}."""
    data = req.data or {}
    kind, strategy, alert_id = data.get("kind"), data.get("strategy"), str(data.get("alertId") or "")
    if kind == "unlock" and not _re.match(r"^[a-z-]+-\d{4}-\d{2}-\d{2}$", alert_id):
        raise TWError("INVALID_ARGUMENT", "That alert isn't valid.")
    ref = db.collection("wallets").document(uid)

    @firestore.transactional
    def txn(t):
        snap = ref.get(transaction=t)
        wallet = snap.to_dict() if snap.exists else tk_new_wallet(now_ms)
        locked = None
        if kind == "unlock":
            ls = db.collection("alertsLocked").document(alert_id).get(transaction=t)
            locked = ls.to_dict() if ls.exists else None
        wallet, line = tk_spend(wallet, kind, now_ms, strategy, alert_id, locked)
        if line:
            t.set(ref, wallet)
            t.set(ref.collection("ledger").document(), line)
        return wallet, line

    wallet, line = txn(db.transaction())
    out = _tk_public(wallet)
    out["charged"] = -(line or {}).get("amount", 0)
    return out


# ---------------------------------------------------------------------------
# Square payments (token packs). Two secrets, set with
#   firebase functions:secrets:set SQUARE_ACCESS_TOKEN            (Square app -> Credentials)
#   firebase functions:secrets:set SQUARE_WEBHOOK_SIGNATURE_KEY   (Square app -> Webhooks -> your subscription)
# and SQUARE_ENVIRONMENT=sandbox|production in functions/.env (not a secret).
#
#   tokens_checkout {pack}  -> a Square Checkout payment link for that pack (server-side
#                              price; the browser only names the pack). Remembered in
#                              squareCheckouts/{orderId} = {uid, pack, tokens, amountCents, status}.
#   squareWebhook           -> Square calls it on payment.created / payment.updated. The
#                              signature is checked; a COMPLETED payment whose order is one of
#                              our checkouts, for exactly the expected amount, credits the
#                              buyer once (the checkout flips pending -> credited in a
#                              transaction; squareEvents/{eventId} also skips repeats).
# ---------------------------------------------------------------------------
import base64 as _base64
import uuid as _uuid

SQUARE_VERSION = "2024-10-17"
SQUARE_WEBHOOK_URL = os.environ.get("SQUARE_WEBHOOK_URL") or "https://us-central1-leaderboard-agentictrading.cloudfunctions.net/squareWebhook"
_SQ_LOCATION = {}


def _square_env():
    return "production" if os.environ.get("SQUARE_ENVIRONMENT", "sandbox").strip().lower() == "production" else "sandbox"


def _square_base():
    # SQUARE_API_BASE only exists for local tests against a fake Square server
    return os.environ.get("SQUARE_API_BASE") or ("https://connect.squareup.com" if _square_env() == "production" else "https://connect.squareupsandbox.com")


def _square_ready():
    t = os.environ.get("SQUARE_ACCESS_TOKEN", "").strip()
    return len(t) > 20 and t.lower() not in ("none", "placeholder")


def _square_api(method, path, body=None):
    """One Square API call; returns parsed JSON or raises TWError (never logs the token)."""
    rq = urllib.request.Request(_square_base() + path, method=method,
                                data=json.dumps(body).encode() if body is not None else None,
                                headers={"Authorization": "Bearer " + os.environ["SQUARE_ACCESS_TOKEN"].strip(),
                                         "Square-Version": SQUARE_VERSION, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(rq, timeout=15) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            errs = json.loads(e.read().decode()).get("errors") or []
            codes = ",".join(str(x.get("code")) for x in errs)[:120]
        except Exception:
            codes = "?"
        print("[square] %s %s -> HTTP %s %s" % (method, path.split("?")[0], e.code, codes))
    except Exception as e:
        print("[square] %s %s failed: %s" % (method, path.split("?")[0], type(e).__name__))
    raise TWError("UNAVAILABLE", "Checkout isn't available right now. Try again in a minute.")


def _square_location():
    """SQUARE_LOCATION_ID if set, else the account's first active location (cached)."""
    loc = os.environ.get("SQUARE_LOCATION_ID", "").strip()
    if loc:
        return loc
    key = _square_base()
    if key not in _SQ_LOCATION:
        locs = [l for l in (_square_api("GET", "/v2/locations").get("locations") or []) if l.get("status") == "ACTIVE"]
        if not locs:
            print("[square] no active location on this account")
            raise TWError("UNAVAILABLE", "Checkout isn't set up yet.")
        _SQ_LOCATION[key] = locs[0]["id"]
    return _SQ_LOCATION[key]


def square_link_body(uid, pack, email, location_id, idem):
    """The CreatePaymentLink request for a pack. Prices come only from TOKENS."""
    if pack not in TOKENS["packs"]:
        raise TWError("INVALID_ARGUMENT", "Pick a token pack.")
    tokens, cents = TOKENS["packs"][pack]
    body = {"idempotency_key": idem,
            "quick_pay": {"name": "%d AgenticTrading.info credits" % tokens, "location_id": location_id,
                          "price_money": {"amount": cents, "currency": "USD"}},
            "checkout_options": {"redirect_url": SITE_URL + "/tokens.html?paid=1", "ask_for_shipping_address": False},
            "payment_note": "AgenticTrading.info credits (%s) for %s" % (pack, uid)}
    if email:
        body["pre_populated_data"] = {"buyer_email": email}
    return body


@https_fn.on_call(secrets=["SQUARE_ACCESS_TOKEN"])
@_tk_call
def tokens_checkout(req, db, uid, tok, now_ms):
    """A Square Checkout payment link for a token pack: {pack}. Returns {url}."""
    pack = str((req.data or {}).get("pack") or "")
    if pack not in TOKENS["packs"]:
        raise TWError("INVALID_ARGUMENT", "Pick a token pack.")
    if not _square_ready():
        raise TWError("FAILED_PRECONDITION", "Buying tokens is coming soon. You can use your free tokens now.")
    tokens, cents = TOKENS["packs"][pack]
    idem = str(_uuid.uuid4())
    email = tok.get("email") if tok.get("email_verified") else None
    res = _square_api("POST", "/v2/online-checkout/payment-links", square_link_body(uid, pack, email, _square_location(), idem))
    link = res.get("payment_link") or {}
    order_id, url = link.get("order_id"), link.get("url") or link.get("long_url")
    if not order_id or not url:
        print("[square] payment link response missing order_id/url")
        raise TWError("UNAVAILABLE", "Checkout isn't available right now. Try again in a minute.")
    db.collection("squareCheckouts").document(order_id).set({
        "uid": uid, "pack": pack, "tokens": tokens, "amountCents": cents, "currency": "USD", "status": "pending",
        "paymentLinkId": link.get("id"), "env": _square_env(),
        "createdAt": now_ms})
    print("[square] checkout created env=%s order=%s pack=%s uid=%s" % (_square_env(), order_id, pack, uid[:6]))
    return {"url": url}


def square_verify(body, signature, key, url=None):
    """Square webhook signature: base64(HMAC-SHA256(signature key, notification URL + raw body))."""
    if not key or not signature:
        return False
    msg = (url or SQUARE_WEBHOOK_URL).encode() + body
    expected = _base64.b64encode(hmac.new(key.encode(), msg, _hashlib.sha256).digest()).decode()
    return hmac.compare_digest(expected, str(signature).strip())


def square_payment_credit(payment, checkout):
    """Pure: None if this payment should credit tokens for this checkout, else why not."""
    if not checkout:
        return "not one of our checkouts"
    if payment.get("status") != "COMPLETED":
        return "status %s" % payment.get("status")
    if checkout.get("status") != "pending":
        return "already %s" % checkout.get("status")
    money = payment.get("amount_money") or {}
    if money.get("amount") != checkout.get("amountCents") or money.get("currency") != checkout.get("currency", "USD"):
        return "amount mismatch"
    return None


@https_fn.on_request(secrets=["SQUARE_WEBHOOK_SIGNATURE_KEY"])
def squareWebhook(req: https_fn.Request) -> https_fn.Response:
    """Square payment notifications. Verified by signature; credits each order exactly once."""
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)
    raw = req.get_data()
    if not square_verify(raw, req.headers.get("x-square-hmacsha256-signature", ""), os.environ.get("SQUARE_WEBHOOK_SIGNATURE_KEY", "").strip()):
        print("[square] webhook rejected: bad signature")
        return https_fn.Response("Bad signature", status=403)
    try:
        event = json.loads(raw.decode())
    except Exception:
        return https_fn.Response("Bad JSON", status=400)
    etype, eid = event.get("type"), str(event.get("event_id") or "")
    payment = ((event.get("data") or {}).get("object") or {}).get("payment") or {}
    if etype not in ("payment.created", "payment.updated") or not payment.get("order_id") or not eid:
        print("[square] event %s %s ignored" % (etype, eid[:12]))
        return https_fn.Response("ignored", status=200)
    db, now_ms = firestore.client(), int(_time.time() * 1000)
    order_id, pay_id = str(payment["order_id"]), str(payment.get("id") or "")
    cref, eref = db.collection("squareCheckouts").document(order_id), db.collection("squareEvents").document(eid)

    @firestore.transactional
    def txn(t):
        if eref.get(transaction=t).exists:
            return "duplicate event"
        cs = cref.get(transaction=t)
        checkout = cs.to_dict() if cs.exists else None
        why = square_payment_credit(payment, checkout)
        wref = ws = None
        if not why:  # every read happens before any write in a Firestore transaction
            wref = db.collection("wallets").document(checkout["uid"])
            ws = wref.get(transaction=t)
        t.set(eref, {"type": etype, "orderId": order_id, "paymentId": pay_id, "status": payment.get("status"), "result": why or "credited", "at": now_ms})
        if why:
            return why
        wallet = ws.to_dict() if ws.exists else tk_new_wallet(now_ms)
        wallet, line = tk_credit(wallet, checkout["tokens"], now_ms, "purchase", "Bought %d tokens" % checkout["tokens"], order_id)
        t.set(wref, wallet)
        t.set(wref.collection("ledger").document(), line)
        t.update(cref, {"status": "credited", "paymentId": pay_id, "creditedAt": now_ms})
        t.set(db.collection("purchases").document("sq_" + order_id), {"uid": checkout["uid"], "pack": checkout["pack"], "tokens": checkout["tokens"],
                                                                     "amountCents": checkout["amountCents"], "provider": "square", "paymentId": pay_id, "at": now_ms})
        return None

    try:
        why = txn(db.transaction())
    except Exception as e:
        print("[square] webhook %s failed: %s" % (eid[:12], type(e).__name__))
        return https_fn.Response("retry", status=500)  # Square retries
    print("[square] event %s %s order=%s status=%s -> %s" % (etype, eid[:12], order_id, payment.get("status"), why or "credited"))
    return https_fn.Response("ok", status=200)
