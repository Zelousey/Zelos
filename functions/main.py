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
refresh_market_data    - every 5 minutes: crypto prices, market movers,
                          sectors, earnings calendar, company research and
                          real 5-minute bars from FMP (markets/* docs).
market_research        - research for one ticker on demand (alert pages),
                          cached 12 hours, capped per day.
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

import mdata as MD  # Marketstack + SEC market data (the sources the site may show)
import xp as XP  # XP award rules (server-decided amounts and limits)
import practice as PR  # practice account engine (server-side fills, see functions/practice.py)

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
    """At the close a live alert stops being live. It stays token-gated (at the cheaper
    after-close price) until its trade finishes; then release_alert_public frees it."""
    n = 0
    for snap in db.collection("alertsLocked").where("released", "==", False).stream():
        full = snap.to_dict()
        if (full.get("lockedUntil") or 0) > now_ms:
            continue
        db.collection("alerts").document(snap.id).set({"afterClose": True, "closedAt": now_ms}, merge=True)
        snap.reference.update({"released": True, "releasedAt": now_ms})
        n += 1
    return n


ALERT_FINAL_RESULTS = {"hit-target", "stopped-out", "expired", "no-trade"}


def release_alert_public(db, alert_id, outcome, now_ms):
    """A finished trade is part of the public track record: copy the full alert into its
    public doc (free for everyone from now on). Returns True if it was gated before."""
    lref = db.collection("alertsLocked").document(alert_id)
    snap = lref.get()
    if not snap.exists:
        return False
    full = snap.to_dict()
    lref.update({"outcome": outcome})
    if full.get("public"):
        return False
    pub = {k: v for k, v in full.items() if k not in ("lockedUntil", "released", "releasedAt", "public")}
    pub.update({"outcome": outcome, "locked": False, "afterClose": False, "releasedAt": now_ms})
    db.collection("alerts").document(alert_id).set(pub, merge=True)
    lref.update({"public": True, "publicAt": now_ms})
    return True


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

    sent = 0
    if alert_has_trade(alert):
        try:
            sent = alert_push(db, alert_id, alert)
        except Exception as e:  # a notification problem never fails the publish
            print("[push] alert %s failed: %s" % (alert_id, type(e).__name__))

    return https_fn.Response(
        json.dumps({"ok": True, "id": alert_id, "notified": sent}),
        status=200,
        content_type="application/json",
    )


@https_fn.on_request(secrets=["ZELOS_PUBLISH_SECRET"])
def publish_market_map(req: https_fn.Request) -> https_fn.Response:
    """Stores the globe's country market map (refresh_market_data now builds it from Marketstack after each close;
    this endpoint stays for manual fixes)
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
        if result in ALERT_FINAL_RESULTS:
            release_alert_public(db, alert_id, outcome, int(_time.time() * 1000))
        else:
            lref = db.collection("alertsLocked").document(alert_id)
            if lref.get().exists:
                lref.update({"outcome": outcome})
    except Exception as e:
        print("[update_alert_outcomes] Firestore write failed:", type(e).__name__)
        return alert_id, "Firestore write failed"
    return alert_id, None


@https_fn.on_request(secrets=["ZELOS_PUBLISH_SECRET"])
def alerts_open(req: https_fn.Request) -> https_fn.Response:
    """The full trade plan of every alert still token-gated (its trade hasn't finished),
    for the outcome checker (scripts/check_alert_outcomes.py runbook). Same shared-secret
    gate as publish_alert; read-only."""
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)
    if not _secret_ok(req.headers.get("X-Zelos-Secret", "")):
        return https_fn.Response("Unauthorized", status=401)
    db = firestore.client()
    out = []
    for snap in db.collection("alertsLocked").stream():
        d = snap.to_dict()
        if d.get("public"):
            continue
        d["id"] = snap.id
        out.append(d)
    return https_fn.Response(json.dumps({"ok": True, "alerts": out}, default=lambda o: o.isoformat() if hasattr(o, "isoformat") else str(o)),
                             status=200, content_type="application/json")


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
    secrets=["MARKETSTACK_API_KEY"],
    timeout_sec=120,
    memory=256,
)
def refresh_quotes(event: scheduler_fn.ScheduledEvent) -> None:
    """Stock prices from Marketstack (see functions/mdata.py). Wakes every minute but only
    calls Marketstack every QUOTE_EVERY_MIN minutes (15 on the Basic plan), one minute after
    each bar closes, plus once at 4:06 pm for the closing prices."""
    now = datetime.now(NY)
    minutes = now.hour * 60 + now.minute
    every = MD.quote_every_min()
    due = SESSION_OPEN < minutes <= SESSION_CLOSE + 1 and (minutes - SESSION_OPEN - 1) % every == 0
    if not (due or minutes == SESSION_CLOSE + 6):
        return
    db = firestore.client()
    key = os.environ.get("MARKETSTACK_API_KEY", "").strip()
    if not key:
        db.collection("markets").document("quotes").set({"error": "missing-key", "checkedAt": now.isoformat()}, merge=True)
        return
    fetched = None
    try:
        n, q, bars = ms_run_quotes(db, key, now)
        fetched = (q, bars)
        print("[refresh_quotes] %d prices" % n)
    except MD.MsKeyRejected:
        db.collection("markets").document("quotes").set({"error": "auth", "checkedAt": now.isoformat()}, merge=True)
        print("[refresh_quotes] Marketstack rejected the key")
    except MD.MsQuota:
        db.collection("markets").document("quotes").set({"error": "quota", "checkedAt": now.isoformat()}, merge=True)
        print("[refresh_quotes] Marketstack monthly requests used up")
    except Exception as e:
        db.collection("markets").document("quotes").set({"error": type(e).__name__, "checkedAt": now.isoformat()}, merge=True)
        print("[refresh_quotes] failed:", type(e).__name__, e)
    # practice accounts: fill / expire open orders on the prices just fetched (separately, so a
    # problem here never stops prices updating)
    try:
        if fetched is not None:
            print("[practice] orders pass:", practice_pass(db, fetched[0], fetched[1], int(now.timestamp() * 1000)))
    except Exception as e:
        print("[practice] orders pass failed:", type(e).__name__, e)


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


# refresh_news was retired: Finnhub's free plan is for personal use only, so its headlines
# can't be shown on the site. The helpers above stay for a licensed news source later.
# Remove the deployed copy once: firebase functions:delete refresh_news --force


# ---------------------------------------------------------------------------
# Market data from FMP (the paid plan): crypto, movers, sectors, earnings,
# company research, and real 5-minute / daily bars with volume.
#
# refresh_market_data runs every 5 minutes, around the clock. Each run does
# only what's due (state in serverMeta/marketData, which no browser can read):
#   - crypto quotes for the Trade War crypto list      -> markets/crypto        every run
#   - crypto 5-minute bars (last 3 days)                -> markets/intraday_<SYM> every 15 min
#   - crypto daily bars (last ~400 days)                -> markets/cryptoBars    once a day
#   - top gainers / losers / most active + sectors      -> markets/movers        every 15 min, weekdays 9:30-16:30 ET
#   - after the close: real 5-minute bars with volume
#     for the stock list (5 sessions), daily volume     -> markets/intraday_<SYM>, markets/dailyBars   once a day
#   - earnings calendar, next 45 days                   -> markets/earnings      once a day
#   - company research for 2 stock-list symbols         -> markets/research_<SYM>  each run, oldest first
#
# market_research({symbol}) is the on-demand version of that last one for any
# ticker (alert pages): served from the cache when it's under 12 hours old,
# with a daily cap on fresh fetches so nobody can run up the FMP bill.
#
# The key only ever lives in this function's secret config; browsers get the
# normalized results from public markets/* docs (firestore.rules: read-only).
# ---------------------------------------------------------------------------
FMP_BASE = os.environ.get("FMP_BASE_URL") or "https://financialmodelingprep.com/stable/"  # override only for local testing
RESEARCH_MAX_AGE_S = 12 * 3600
RESEARCH_DAILY_BUDGET = 60  # each fresh lookup can use a Marketstack request
RESEARCH_PER_RUN = 2
CRYPTO_INTRADAY_DAYS = 3
CRYPTO_DAILY_KEEP = 400
import re as _re_md
_SYM_RE = _re_md.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")


def _load_crypto_symbols():
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "crypto_universe.json"), encoding="utf-8") as f:
            d = json.load(f)
        rows = d.get("symbols") or d.get("pausedSymbols") or []  # paused: still recognised as crypto, never fetched
        out = [(str(u["sym"]).upper(), str(u.get("name") or u["sym"])) for u in rows]
        if out:
            return out[:12]
    except Exception as e:
        print("[market] crypto list unreadable, using the core list:", type(e).__name__, e)
    return [("BTCUSD", "Bitcoin"), ("ETHUSD", "Ethereum"), ("SOLUSD", "Solana")]


CRYPTO = _load_crypto_symbols()
CRYPTO_SYMBOLS = [s for s, _ in CRYPTO]


def _fmp_get(path, params, api_key, timeout=10):
    """GET one FMP stable endpoint. Returns parsed JSON, or None when FMP says
    the endpoint isn't in the plan / has no data. Raises _FmpKeyRejected for a
    bad key. The URL (which holds the key) is never logged."""
    q = dict(params or {})
    q["apikey"] = api_key
    req = urllib.request.Request(FMP_BASE + path + "?" + urllib.parse.urlencode(q), headers={"User-Agent": "zelos-market/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 401:
            raise _FmpKeyRejected()
        if e.code in (402, 403, 404):
            return None
        raise
    if isinstance(data, dict):
        msg = str(data.get("Error Message") or data.get("error") or data.get("message") or "")
        if "api key" in msg.lower() or "apikey" in msg.lower():
            raise _FmpKeyRejected()
        return None if msg else data
    return data


def _num(v, nd=None):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if x != x or x in (float("inf"), float("-inf")):
        return None
    return round(x, nd) if nd is not None else x


def _txt(v, n):
    return str(v or "").strip()[:n]


def _rows(data):
    return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []


# ---- pure shaping (unit-tested in scripts/market_test.py) --------------------
def md_quote(row):
    """FMP quote row -> the c/o/h/l/pc/t shape markets/quotes uses (+ name, chPct)."""
    if not isinstance(row, dict) or not _num(row.get("price")):
        return None
    out = {"c": _num(row.get("price")), "o": _num(row.get("open")), "h": _num(row.get("dayHigh")), "l": _num(row.get("dayLow")),
           "pc": _num(row.get("previousClose")), "t": int(_num(row.get("timestamp")) or 0),
           "chPct": _num(row.get("changePercentage", row.get("changesPercentage")), 2), "name": _txt(row.get("name"), 40)}
    return out


def md_movers(rows, n=8):
    out = []
    for r in _rows(rows):
        sym = _txt(r.get("symbol"), 12).upper()
        px = _num(r.get("price"), 4)
        if not sym or not _SYM_RE.match(sym) or not px:
            continue
        out.append({"sym": sym, "name": _txt(r.get("name"), 40), "price": px,
                    "chPct": _num(r.get("changesPercentage", r.get("changePercentage")), 2)})
        if len(out) >= n:
            break
    return out


def md_sectors(rows):
    """Sector snapshot rows (one per sector per exchange) -> [{sector, chPct}] averaged, best first."""
    acc = {}
    for r in _rows(rows):
        name, ch = _txt(r.get("sector"), 40), _num(r.get("averageChange", r.get("changesPercentage")))
        if not name or ch is None:
            continue
        a = acc.setdefault(name, [0.0, 0])
        a[0] += ch
        a[1] += 1
    out = [{"sector": k, "chPct": round(v[0] / v[1], 2)} for k, v in acc.items() if v[1]]
    return sorted(out, key=lambda x: -x["chPct"])


def md_bars(rows, intraday, keep_days=None, session_only=False):
    """FMP chart rows (newest first) -> ascending 'date,o,h,l,c,v' strings.
    intraday labels are 'YYYY-MM-DD HH:MM'; session_only keeps 9:30-15:55 bars."""
    out = {}
    for r in _rows(rows):
        d = _txt(r.get("date"), 19)
        o, h, l, c = (_num(r.get(k), 4) for k in ("open", "high", "low", "close"))
        if len(d) < 10 or None in (o, h, l, c):
            continue
        label = d[:16] if intraday else d[:10]
        if intraday and len(label) < 16:
            continue
        if session_only:
            mins = int(label[11:13]) * 60 + int(label[14:16])
            if mins < SESSION_OPEN or mins >= SESSION_CLOSE:
                continue
        v = int(_num(r.get("volume")) or 0)
        out[label] = "%s,%s,%s,%s,%s,%s" % (label, o, max(h, o, c), min(l, o, c), c, v)
    keys = sorted(out)
    if keep_days:
        days = sorted({k[:10] for k in keys})[-keep_days:]
        keys = [k for k in keys if k[:10] in set(days)]
    return [out[k] for k in keys]


def md_merge_daily(existing, fresh, keep):
    """Replace/append daily rows by date; existing and fresh are 'date,...' strings."""
    by = {str(r)[:10]: str(r) for r in existing or []}
    for r in fresh or []:
        by[str(r)[:10]] = str(r)
    return [by[k] for k in sorted(by)][-keep:]


def md_earnings(rows, max_rows=6000):
    """Earnings calendar rows -> {SYM: {date, eps, rev}} keeping each symbol's soonest date."""
    out = {}
    for r in sorted(_rows(rows), key=lambda x: str(x.get("date") or "")):
        sym, d = _txt(r.get("symbol"), 12).upper(), _txt(r.get("date"), 10)
        if not _SYM_RE.match(sym or "-") or len(d) != 10 or "." in sym or sym in out:
            continue
        out[sym] = {"date": d, "eps": _num(r.get("epsEstimated"), 3), "rev": _num(r.get("revenueEstimated"), 0)}
        if len(out) >= max_rows:
            break
    return out


def md_research(sym, parts, earnings=None):
    """The FMP pieces for one ticker -> the public markets/research_<SYM> doc."""
    p = (_rows(parts.get("profile")) or [{}])[0]
    t = (_rows(parts.get("target")) or [{}])[0]
    km = (_rows(parts.get("metrics")) or [{}])[0]
    rt = (_rows(parts.get("ratios")) or [{}])[0]
    inc = (_rows(parts.get("income")) or [{}])[0]
    ests = sorted(_rows(parts.get("estimates")), key=lambda r: str(r.get("date") or ""))
    doc = {"symbol": sym, "name": _txt(p.get("companyName"), 80) or sym}
    if p:
        doc["profile"] = {
            "sector": _txt(p.get("sector"), 40), "industry": _txt(p.get("industry"), 60), "exchange": _txt(p.get("exchange"), 20),
            "marketCap": _num(p.get("marketCap"), 0), "beta": _num(p.get("beta"), 2), "range": _txt(p.get("range"), 30),
            "avgVolume": _num(p.get("averageVolume", p.get("volAvg")), 0), "ceo": _txt(p.get("ceo"), 60),
            "employees": _num(p.get("fullTimeEmployees"), 0), "ipoDate": _txt(p.get("ipoDate"), 10),
            "website": _txt(p.get("website"), 120) if str(p.get("website") or "").startswith("https://") else "",
            "image": _txt(p.get("image"), 200) if str(p.get("image") or "").startswith("https://") else "",
            "description": _txt(p.get("description"), 420), "price": _num(p.get("price"), 4),
        }
    if t and _num(t.get("targetConsensus")):
        doc["target"] = {k: _num(t.get(k), 2) for k in ("targetHigh", "targetLow", "targetConsensus", "targetMedian")}
    grades = []
    for g in sorted(_rows(parts.get("grades")), key=lambda r: str(r.get("date") or ""), reverse=True)[:6]:
        grades.append({"date": _txt(g.get("date"), 10), "firm": _txt(g.get("gradingCompany"), 50),
                       "from": _txt(g.get("previousGrade"), 30), "to": _txt(g.get("newGrade"), 30), "action": _txt(g.get("action"), 20).lower()})
    if grades:
        doc["grades"] = grades
    today = datetime.now(NY).strftime("%Y-%m-%d")
    nxt = [e for e in ests if str(e.get("date") or "") >= today] or ests[-1:]
    if nxt:
        e = nxt[0]
        doc["estimate"] = {"year": _txt(e.get("date"), 4), "epsAvg": _num(e.get("epsAvg", e.get("estimatedEpsAvg")), 2),
                           "revenueAvg": _num(e.get("revenueAvg", e.get("estimatedRevenueAvg")), 0),
                           "analysts": int(_num(e.get("numAnalystsEps", e.get("numberAnalystsEstimatedEps"))) or 0)}
    m = {"pe": _num(rt.get("priceToEarningsRatioTTM", rt.get("peRatioTTM")), 1), "ps": _num(rt.get("priceToSalesRatioTTM"), 2),
         "margin": _num(rt.get("netProfitMarginTTM"), 4), "divYield": _num(rt.get("dividendYieldTTM", rt.get("dividendYielTTM")), 4),
         "roe": _num(km.get("returnOnEquity", km.get("roe")), 4), "evEbitda": _num(km.get("evToEBITDA", km.get("enterpriseValueOverEBITDA")), 1),
         "fcfYield": _num(km.get("freeCashFlowYield"), 4), "currentRatio": _num(km.get("currentRatio"), 2)}
    m = {k: v for k, v in m.items() if v is not None}
    if m:
        doc["metrics"] = m
    if inc:
        doc["financials"] = {"year": _txt(inc.get("fiscalYear") or str(inc.get("date") or "")[:4], 4), "revenue": _num(inc.get("revenue"), 0),
                             "grossProfit": _num(inc.get("grossProfit"), 0), "netIncome": _num(inc.get("netIncome"), 0),
                             "eps": _num(inc.get("epsDiluted", inc.get("eps")), 2)}
    ins = []
    for r in sorted(_rows(parts.get("insiders")), key=lambda r: str(r.get("transactionDate") or r.get("filingDate") or ""), reverse=True):
        kind = str(r.get("transactionType") or "")
        if not kind.startswith(("P", "S")):
            continue  # open-market buys and sells only (no grants, gifts or option exercises)
        ins.append({"date": _txt(r.get("transactionDate") or r.get("filingDate"), 10), "who": _txt(r.get("reportingName"), 50),
                    "role": _txt(r.get("typeOfOwner"), 50), "buy": kind.startswith("P"),
                    "shares": _num(r.get("securitiesTransacted"), 0), "price": _num(r.get("price"), 2)})
        if len(ins) >= 6:
            break
    if ins:
        doc["insiders"] = ins
    news = []
    for n in _rows(parts.get("news"))[:6]:
        url = str(n.get("url") or "")
        if not url.startswith("http") or not n.get("title"):
            continue
        news.append({"headline": _txt(n.get("title"), 220), "source": _txt(n.get("publisher") or n.get("site"), 60), "url": url[:600],
                     "date": _txt(n.get("publishedDate"), 19), "image": _txt(n.get("image"), 600) if str(n.get("image") or "").startswith("https") else ""})
    if news:
        doc["news"] = news
    bars = md_bars(parts.get("bars"), False)[-60:]
    if bars:
        doc["bars"] = bars  # the alert page's small chart: last ~3 months, "date,o,h,l,c,v"
    if earnings and earnings.get("date"):
        doc["earnings"] = earnings
    return doc


# ---- fetching ----------------------------------------------------------------
def _fmp_research_parts(sym, api_key):
    calls = {
        "profile": ("profile", {"symbol": sym}),
        "target": ("price-target-consensus", {"symbol": sym}),
        "grades": ("grades", {"symbol": sym}),
        "estimates": ("analyst-estimates", {"symbol": sym, "period": "annual", "limit": 4}),
        "metrics": ("key-metrics", {"symbol": sym, "limit": 1}),
        "ratios": ("ratios-ttm", {"symbol": sym}),
        "income": ("income-statement", {"symbol": sym, "limit": 1}),
        "insiders": ("insider-trading/search", {"symbol": sym, "page": 0, "limit": 25}),
        "news": ("news/stock", {"symbols": sym, "limit": 6}),
        "bars": ("historical-price-eod/full", {"symbol": sym, "from": datetime.fromtimestamp(_time.time() - 100 * 86400, NY).strftime("%Y-%m-%d")}),
    }
    parts = {}
    for k, (path, params) in calls.items():
        try:
            parts[k] = _fmp_get(path, params, api_key)
        except _FmpKeyRejected:
            raise
        except Exception as e:
            print("[research] %s %s: %s" % (sym, k, type(e).__name__))
            parts[k] = None
    return parts


def _earnings_for(db, sym):
    try:
        snap = db.collection("markets").document("earnings").get()
        return ((snap.to_dict() or {}).get("bySymbol") or {}).get(sym) if snap.exists else None
    except Exception:
        return None


def md_refresh_research(db, sym, api_key, now):
    parts = _fmp_research_parts(sym, api_key)
    doc = md_research(sym, parts, _earnings_for(db, sym))
    doc["updatedAt"] = now.isoformat()
    doc["fetchedAt"] = int(now.timestamp())
    doc["source"] = "Financial Modeling Prep"
    db.collection("markets").document("research_" + sym.replace(".", "-")).set(doc)
    return doc


def _md_crypto(db, api_key, now, state):
    quotes = {}
    for sym, name in CRYPTO:
        try:
            q = md_quote((_rows(_fmp_get("quote", {"symbol": sym}, api_key)) or [None])[0])
        except _FmpKeyRejected:
            raise
        except Exception as e:
            print("[market] crypto %s: %s" % (sym, type(e).__name__))
            continue
        if q:
            q["name"] = name
            quotes[sym] = q
    ref = db.collection("markets").document("crypto")
    if quotes:
        try:
            prev = ref.get()
            for s, q in (((prev.to_dict() or {}).get("quotes") or {}) if prev.exists else {}).items():
                if s in CRYPTO_SYMBOLS and s not in quotes:
                    quotes[s] = q
        except Exception:
            pass
        ref.set({"updatedAt": now.isoformat(), "quotes": quotes, "error": None})
    else:
        ref.set({"checkedAt": now.isoformat(), "error": "no data"}, merge=True)
    # 5-minute bars every 15 minutes, daily bars once a day
    if now.timestamp() - (state.get("cryptoIntradayAt") or 0) >= 14 * 60:
        frm = datetime.fromtimestamp(now.timestamp() - CRYPTO_INTRADAY_DAYS * 86400, NY).strftime("%Y-%m-%d")
        batch = db.batch()
        for sym in CRYPTO_SYMBOLS:
            try:
                bars = md_bars(_fmp_get("historical-chart/5min", {"symbol": sym, "from": frm}, api_key), True, keep_days=CRYPTO_INTRADAY_DAYS + 1)
            except _FmpKeyRejected:
                raise
            except Exception as e:
                print("[market] crypto bars %s: %s" % (sym, type(e).__name__))
                continue
            if bars:
                batch.set(db.collection("markets").document("intraday_" + sym), {"updatedAt": now.isoformat(), "interval": "5m", "crypto": True, "bars": bars})
        batch.commit()
        state["cryptoIntradayAt"] = int(now.timestamp())
    today = now.strftime("%Y-%m-%d")
    if state.get("cryptoDailyDay") != today:
        frm = datetime.fromtimestamp(now.timestamp() - (CRYPTO_DAILY_KEEP + 10) * 86400, NY).strftime("%Y-%m-%d")
        out = {}
        for sym in CRYPTO_SYMBOLS:
            try:
                out[sym] = md_bars(_fmp_get("historical-price-eod/full", {"symbol": sym, "from": frm}, api_key), False)[-CRYPTO_DAILY_KEEP:]
            except _FmpKeyRejected:
                raise
            except Exception as e:
                print("[market] crypto daily %s: %s" % (sym, type(e).__name__))
        if any(out.values()):
            db.collection("markets").document("cryptoBars").set({"updatedAt": now.isoformat(), "bars": {k: v for k, v in out.items() if v}})
            state["cryptoDailyDay"] = today


def _md_movers(db, api_key, now):
    doc = {"updatedAt": now.isoformat(), "date": now.strftime("%Y-%m-%d")}
    for key, path, params in (("gainers", "biggest-gainers", {}), ("losers", "biggest-losers", {}), ("actives", "most-actives", {})):
        try:
            doc[key] = md_movers(_fmp_get(path, params, api_key))
        except _FmpKeyRejected:
            raise
        except Exception as e:
            print("[market] %s: %s" % (key, type(e).__name__))
    try:
        day = now.strftime("%Y-%m-%d")
        rows = _fmp_get("sector-performance-snapshot", {"date": day}, api_key)
        if not _rows(rows):  # before the first print of the day: yesterday's
            rows = _fmp_get("sector-performance-snapshot", {"date": datetime.fromtimestamp(now.timestamp() - 86400, NY).strftime("%Y-%m-%d")}, api_key)
        doc["sectors"] = md_sectors(rows)
    except _FmpKeyRejected:
        raise
    except Exception as e:
        print("[market] sectors: %s" % type(e).__name__)
    if any(doc.get(k) for k in ("gainers", "losers", "actives", "sectors")):
        db.collection("markets").document("movers").set(doc)


def _md_after_close(db, api_key, now):
    """Real FMP 5-minute bars (with volume) replace the ones built from minute
    quotes, and the day's daily bars get their volume."""
    frm5 = datetime.fromtimestamp(now.timestamp() - 9 * 86400, NY).strftime("%Y-%m-%d")
    frmd = datetime.fromtimestamp(now.timestamp() - 12 * 86400, NY).strftime("%Y-%m-%d")
    daily = {}
    batch, n = db.batch(), 0
    for sym in PRACTICE_SYMBOLS:
        try:
            bars = md_bars(_fmp_get("historical-chart/5min", {"symbol": sym, "from": frm5}, api_key), True,
                           keep_days=INTRADAY_SESSIONS_KEEP, session_only=True)
            if bars:
                batch.set(db.collection("markets").document("intraday_" + sym), {"updatedAt": now.isoformat(), "interval": "5m", "source": "fmp", "bars": bars})
                n += 1
            daily[sym] = md_bars(_fmp_get("historical-price-eod/full", {"symbol": sym, "from": frmd}, api_key), False)
        except _FmpKeyRejected:
            raise
        except Exception as e:
            print("[market] after close %s: %s" % (sym, type(e).__name__))
    if n:
        batch.commit()
    if any(daily.values()):
        ref = db.collection("markets").document("dailyBars")
        snap = ref.get()
        stored = (snap.to_dict() or {}).get("bars", {}) if snap.exists else {}
        bars = {s: [str(r) for r in rows] for s, rows in stored.items()}
        for sym, rows in daily.items():
            if rows:
                bars[sym] = md_merge_daily(bars.get(sym, []), rows, DAILY_BARS_KEEP)
        ref.set({"updatedAt": now.isoformat(), "bars": bars})
    return n


def _md_earnings(db, api_key, now):
    frm = now.strftime("%Y-%m-%d")
    to = datetime.fromtimestamp(now.timestamp() + 45 * 86400, NY).strftime("%Y-%m-%d")
    by = md_earnings(_fmp_get("earnings-calendar", {"from": frm, "to": to}, api_key))
    if by:
        db.collection("markets").document("earnings").set({"updatedAt": now.isoformat(), "from": frm, "to": to, "bySymbol": by})
    return len(by)


def _md_research_rotation(db, api_key, now, state):
    stamps = dict(state.get("researchAt") or {})
    due = sorted(PRACTICE_SYMBOLS, key=lambda s: stamps.get(s, 0))[:RESEARCH_PER_RUN]
    for sym in due:
        if now.timestamp() - stamps.get(sym, 0) < 20 * 3600:
            break
        try:
            md_refresh_research(db, sym, api_key, now)
        except _FmpKeyRejected:
            raise
        except Exception as e:
            print("[research] %s: %s" % (sym, type(e).__name__))
        stamps[sym] = int(now.timestamp())
    state["researchAt"] = {k: v for k, v in stamps.items() if k in PRACTICE_SYMBOLS}


def md_due(now, state):
    """Which jobs this run does (pure; unit-tested)."""
    mins, wd, today = now.hour * 60 + now.minute, now.weekday(), now.strftime("%Y-%m-%d")
    weekday = wd < 5
    return {
        "movers": weekday and 9 * 60 + 30 <= mins <= 16 * 60 + 30 and now.timestamp() - (state.get("moversAt") or 0) >= 14 * 60,
        "afterClose": weekday and 16 * 60 + 15 <= mins < 18 * 60 and state.get("closeDay") != today,
        "earnings": state.get("earningsDay") != today and (mins >= 6 * 60 or not state.get("earningsDay")),
        "research": not (weekday and 9 * 60 + 25 <= mins <= 16 * 60 + 10),  # stay out of refresh_quotes' way
    }


@scheduler_fn.on_schedule(
    schedule="*/5 * * * *",
    timezone=scheduler_fn.Timezone("America/New_York"),
    secrets=["MARKETSTACK_API_KEY", "SEC_CONTACT"],
    timeout_sec=540,
    memory=512,
)
def refresh_market_data(event: scheduler_fn.ScheduledEvent) -> None:
    """Marketstack + SEC jobs, each only when due (state in serverMeta/marketData):
      - once: remove data from the old personal-use sources (news, earnings, FMP research, crypto)
      - after the close: daily bars, 2-year history, the ticker-tape snapshot, the globe,
        and full-day 15-minute bars for the stock list
      - outside market hours: SEC research for 2 stock-list symbols a run, oldest first"""
    key = os.environ.get("MARKETSTACK_API_KEY", "").strip()
    now = datetime.now(NY)
    db = firestore.client()
    sref = db.collection("serverMeta").document("marketData")
    snap = sref.get()
    state = (snap.to_dict() or {}) if snap.exists else {}
    try:
        if state.get("cleanup") != "licensed-v1":
            ms_cleanup_old_sources(db)
            state["cleanup"] = "licensed-v1"
        if not key:
            state["error"] = "missing-key"
        else:
            due = ms_due(now, state)
            if due["afterClose"]:
                print("[market] after close:", ms_after_close(db, key, now, state))
                state["closeDay"] = now.strftime("%Y-%m-%d")
                try:
                    print("[practice] nightly revalue:", practice_revalue_all(db, int(now.timestamp() * 1000)))
                except Exception as e:
                    print("[practice] nightly revalue failed:", type(e).__name__, e)
            if due["research"]:
                ms_research_rotation(db, key, now, state)
            state["error"] = None
    except MD.MsKeyRejected:
        state["error"] = "auth"
        print("[market] Marketstack rejected the key")
    except MD.MsQuota:
        state["error"] = "quota"
        print("[market] Marketstack monthly requests used up")
    except Exception as e:
        state["error"] = type(e).__name__
        print("[market] run failed:", type(e).__name__, e)
    state["ranAt"] = now.isoformat()
    sref.set(state)


# ---------------------------------------------------------------------------
# Marketstack + SEC jobs (pure shaping lives in functions/mdata.py)
# ---------------------------------------------------------------------------
def _load_universe_meta():
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "practice_universe.json"), encoding="utf-8") as f:
            rows = json.load(f)["symbols"]
        return {str(u["sym"]).upper(): str(u.get("name") or u["sym"]) for u in rows}, {str(u["sym"]).upper(): str(u.get("group") or "") for u in rows}
    except Exception:
        return {}, {}


UNIVERSE_NAMES, UNIVERSE_GROUPS = _load_universe_meta()


def _load_countries():
    try:
        import country_links  # copied next to this file by scripts/build_practice.py
        return country_links.COUNTRIES
    except Exception as e:
        print("[market] country list unavailable:", type(e).__name__)
        return {}


def _history_symbols():
    return sorted(set(PRACTICE_SYMBOLS) | set(MD.SNAP_SYMBOLS))


def ms_run_quotes(db, key, now):
    """Today's intraday bars for the stock list -> quotes, intraday docs and movers."""
    today = now.strftime("%Y-%m-%d")
    iv = MD.ms_interval()
    rows = []
    for ch in MD.chunks(PRACTICE_SYMBOLS, 100):
        rows += MD.ms_rows("intraday", {"symbols": ",".join(ch), "interval": iv, "date_from": today, "sort": "ASC"}, key, max_pages=4)
    bars = MD.ms_intraday_bars(rows)
    dsnap = db.collection("markets").document("dailyBars").get()
    daily = ((dsnap.to_dict() or {}).get("bars") or {}) if dsnap.exists else {}
    quotes = {}
    for sym in PRACTICE_SYMBOLS:
        q = MD.ms_quote([b for b in bars.get(sym, []) if b[:10] == today], MD.prev_close(daily.get(sym), today), MD.interval_minutes(iv))
        if q:
            quotes[sym] = q
    qref = db.collection("markets").document("quotes")
    if not quotes:
        qref.set({"checkedAt": now.isoformat(), "error": None}, merge=True)  # holiday or before the first bar
        return 0, {}, bars
    try:
        prev = qref.get()
        pd = (prev.to_dict() or {}) if prev.exists else {}
        if pd.get("date") == today:
            for sym, q in (pd.get("quotes") or {}).items():
                if sym in PRACTICE_SYMBOLS and sym not in quotes:
                    quotes[sym] = q
    except Exception as e:
        print("[refresh_quotes] couldn't read previous quotes:", type(e).__name__)
    mins = now.hour * 60 + now.minute
    label = iv.replace("min", "m").replace("1hour", "60m")
    qref.set({"source": "marketstack", "updatedAt": now.isoformat(), "date": today, "marketOpen": SESSION_OPEN <= mins < SESSION_CLOSE,
              "every": MD.quote_every_min(), "interval": label, "error": None, "quotes": quotes})
    batch = db.batch()
    for sym, b in bars.items():
        if sym not in PRACTICE_SYMBOLS:
            continue
        ref = db.collection("markets").document("intraday_" + sym)
        snap = ref.get()
        d = (snap.to_dict() or {}) if snap.exists else {}
        old = [str(x) for x in d.get("bars", [])] if d.get("interval") == label else []
        batch.set(ref, {"updatedAt": now.isoformat(), "interval": label, "source": "marketstack", "bars": MD.merge_intraday(old, b)})
    batch.commit()
    mv = MD.ms_movers(quotes, UNIVERSE_NAMES, UNIVERSE_GROUPS)
    mv.update({"updatedAt": now.isoformat(), "date": today, "source": "Marketstack"})
    db.collection("markets").document("movers").set(mv)
    return len(quotes), quotes, bars


def ms_due(now, state):
    """Which jobs this run does (pure; unit-tested)."""
    mins, wd, today = now.hour * 60 + now.minute, now.weekday(), now.strftime("%Y-%m-%d")
    weekday = wd < 5
    return {
        "afterClose": (weekday and 16 * 60 + 20 <= mins < 20 * 60 and state.get("closeDay") != today) or not state.get("historyAt"),
        "research": not (weekday and 9 * 60 + 25 <= mins <= 16 * 60 + 10),
    }


def _write_history(db, daily, now):
    syms = sorted(daily)
    parts = MD.chunks(syms, MD.HISTORY_PER_DOC)
    batch = db.batch()
    for i, part in enumerate(parts):
        blob = {s: MD.history_rows(daily[s]) for s in part}
        batch.set(db.collection("markets").document("history_%d" % i), {"json": json.dumps(blob, separators=(",", ":")), "updatedAt": now.isoformat()})
    batch.set(db.collection("markets").document("historyIndex"), {"parts": len(parts), "symbols": syms, "updatedAt": now.isoformat(), "source": "Marketstack"})
    batch.commit()


def _read_history(db):
    idx = db.collection("markets").document("historyIndex").get()
    n = int(((idx.to_dict() or {}).get("parts") or 0)) if idx.exists else 0
    out = {}
    for i in range(n):
        d = db.collection("markets").document("history_%d" % i).get()
        try:
            for s, rows in json.loads((d.to_dict() or {}).get("json") or "{}").items():
                out[s] = [",".join(str(x) for x in r) for r in rows]
        except Exception:
            pass
    return out


def ms_after_close(db, key, now, state):
    """Daily bars, history, snapshot, globe and the day's full 15-minute bars."""
    today = now.strftime("%Y-%m-%d")
    hist_syms = _history_symbols()
    countries = _load_countries()
    globe_syms = MD.globe_symbols(countries) if countries else []
    full = not state.get("historyAt") or now.timestamp() - state.get("historyAt", 0) > 30 * 86400
    # recent daily bars for everything we show (one paginated request per 100 symbols)
    frm = (now - MD.timedelta(days=45)).strftime("%Y-%m-%d")
    recent = {}
    for ch in MD.chunks(sorted(set(hist_syms) | set(globe_syms)), 100):
        recent.update(MD.ms_daily_bars(MD.ms_rows("eod", {"symbols": ",".join(ch), "date_from": frm, "sort": "ASC"}, key)))
    # history: a full ~2 years once a month, otherwise extend what's stored
    if full:
        hfrm = (now - MD.timedelta(days=int(MD.HISTORY_DAYS * 1.45))).strftime("%Y-%m-%d")
        hist = {}
        for ch in MD.chunks(hist_syms, 100):
            hist.update(MD.ms_daily_bars(MD.ms_rows("eod", {"symbols": ",".join(ch), "date_from": hfrm, "sort": "ASC"}, key, max_pages=80)))
    else:
        hist = _read_history(db)
    for s in hist_syms:
        if recent.get(s):
            hist[s] = MD.merge_series(hist.get(s, []), recent[s], MD.HISTORY_DAYS)
    hist = {s: rows for s, rows in hist.items() if rows and s in hist_syms}
    if hist:
        _write_history(db, hist, now)
        if full:
            state["historyAt"] = int(now.timestamp())
    # dailyBars (charts, previous close)
    ref = db.collection("markets").document("dailyBars")
    snap = ref.get()
    stored = ((snap.to_dict() or {}).get("bars") or {}) if snap.exists else {}
    bars = {s: MD.merge_series([str(r) for r in stored.get(s, []) if str(r).split(",")[5:6] != ["0"]] if s in stored else [], hist.get(s) or recent.get(s) or [], MD.DAILY_BARS_KEEP)
            for s in PRACTICE_SYMBOLS if hist.get(s) or recent.get(s)}
    if bars:
        ref.set({"updatedAt": now.isoformat(), "source": "Marketstack", "bars": bars})
    # ticker tape / market overview, and the globe
    snapd = MD.build_snapshot({s: hist.get(s) or recent.get(s) for s in MD.SNAP_SYMBOLS if hist.get(s) or recent.get(s)}, now)
    if snapd["items"]:
        db.collection("markets").document("snapshot").set({"json": json.dumps(snapd, separators=(",", ":")), "updatedAt": now.isoformat()})
    if countries:
        g = MD.build_globe(countries, MD.moves_from_daily({s: recent[s] for s in globe_syms if s in recent}))
        if g["asOf"]:
            db.collection("markets").document("globe").set({"json": json.dumps(g, ensure_ascii=False, separators=(",", ":")), "asOf": g["asOf"], "updatedAt": now.isoformat()})
    # the day's complete 15-minute bars (and the last few sessions) for the stock list
    iv = MD.ms_interval()
    label = iv.replace("min", "m").replace("1hour", "60m")
    ifrm = (now - MD.timedelta(days=8)).strftime("%Y-%m-%d")
    rows = []
    for ch in MD.chunks(PRACTICE_SYMBOLS, 100):
        rows += MD.ms_rows("intraday", {"symbols": ",".join(ch), "interval": iv, "date_from": ifrm, "sort": "ASC"}, key, max_pages=12)
    ib = MD.ms_intraday_bars(rows)
    batch = db.batch()
    for sym, b in ib.items():
        if sym in PRACTICE_SYMBOLS:
            batch.set(db.collection("markets").document("intraday_" + sym), {"updatedAt": now.isoformat(), "interval": label, "source": "marketstack", "bars": MD.merge_intraday([], b)})
    batch.commit()
    return {"history": len(hist), "daily": len(bars), "snapshot": len(snapd["items"]), "intraday": len(ib), "full": full}


def _sec_cik(db, sym, now):
    ref = db.collection("serverMeta").document("secCik")
    snap = ref.get()
    d = (snap.to_dict() or {}) if snap.exists else {}
    m = {}
    try:
        m = json.loads(d.get("json") or "{}")
    except Exception:
        m = {}
    if not m or now.timestamp() - (d.get("at") or 0) > 30 * 86400:
        m = MD.sec_cik_map(MD.sec_get(MD.SEC_WWW + "/files/company_tickers.json"))
        if m:
            ref.set({"json": json.dumps(m, separators=(",", ":")), "at": int(now.timestamp())})
    return m.get(sym.replace(".", "-"))


def _sec_insiders(sub, cik, limit=8):
    rec = ((sub or {}).get("filings") or {}).get("recent") or {}
    out = []
    forms, accs, docs = rec.get("form") or [], rec.get("accessionNumber") or [], rec.get("primaryDocument") or []
    for i, f in enumerate(forms):
        if f != "4" or i >= len(accs) or i >= len(docs):
            continue
        url = "%s/Archives/edgar/data/%d/%s/%s" % (MD.SEC_WWW, cik, accs[i].replace("-", ""), docs[i].split("/")[-1])
        try:
            out += MD.sec_form4(MD.sec_get(url, raw=True))
        except Exception as e:
            print("[research] form 4: %s" % type(e).__name__)
        limit -= 1
        if limit <= 0:
            break
    return out


def ms_refresh_research(db, sym, key, now):
    """One ticker's research doc: SEC profile, last fiscal year, insider trades + 60 daily bars."""
    bars = None
    dsnap = db.collection("markets").document("dailyBars").get()
    stored = ((dsnap.to_dict() or {}).get("bars") or {}).get(sym) if dsnap.exists else None
    if stored:
        bars = [str(r) for r in stored]
    elif key:
        frm = (now - MD.timedelta(days=100)).strftime("%Y-%m-%d")
        bars = MD.ms_daily_bars(MD.ms_rows("eod", {"symbols": sym, "date_from": frm, "sort": "ASC"}, key, max_pages=1)).get(sym)
    price = MD._num(str(bars[-1]).split(",")[4]) if bars else None
    sub = facts = None
    ins = []
    cik = None
    try:
        cik = _sec_cik(db, sym, now)
    except Exception as e:
        print("[research] cik map: %s" % type(e).__name__)
    if cik:
        try:
            sub = MD.sec_get("%s/submissions/CIK%010d.json" % (MD.SEC_BASE, cik))
        except Exception as e:
            print("[research] %s submissions: %s" % (sym, type(e).__name__))
        try:
            facts = MD.sec_get("%s/api/xbrl/companyfacts/CIK%010d.json" % (MD.SEC_BASE, cik))
        except Exception as e:
            print("[research] %s facts: %s" % (sym, type(e).__name__))
        ins = _sec_insiders(sub, cik) if sub else []
    doc = MD.sec_research(sym, sub, facts, ins, bars, price)
    if cik:
        doc["cik"] = "%010d" % cik
    doc["updatedAt"] = now.isoformat()
    doc["fetchedAt"] = int(now.timestamp())
    db.collection("markets").document("research_" + sym.replace(".", "-")).set(doc)
    return doc


def ms_research_rotation(db, key, now, state):
    stamps = dict(state.get("researchAt") or {})
    due = sorted(PRACTICE_SYMBOLS, key=lambda s: stamps.get(s, 0))[:RESEARCH_PER_RUN]
    for sym in due:
        if now.timestamp() - stamps.get(sym, 0) < 20 * 3600:
            break
        try:
            ms_refresh_research(db, sym, key, now)
        except (MD.MsKeyRejected, MD.MsQuota):
            raise
        except Exception as e:
            print("[research] %s: %s" % (sym, type(e).__name__))
        stamps[sym] = int(now.timestamp())
    state["researchAt"] = {k: v for k, v in stamps.items() if k in PRACTICE_SYMBOLS}


def ms_cleanup_old_sources(db):
    """One-time: stop showing anything from the personal-use sources."""
    m = db.collection("markets")
    for doc_id in ("news", "earnings", "cryptoBars"):
        m.document(doc_id).delete()
    # crypto is paused: keep the last prices (so open crypto positions still have a value) but say so
    m.document("crypto").set({"paused": True}, merge=True)
    for d in m.where("source", "==", "Financial Modeling Prep").stream():
        d.reference.delete()


def research_budget_ok(db, now):
    """One fresh research fetch against today's cap (transaction on serverMeta/researchBudget)."""
    ref = db.collection("serverMeta").document("researchBudget")
    today = now.strftime("%Y-%m-%d")

    @firestore.transactional
    def take(t):
        snap = ref.get(transaction=t)
        d = (snap.to_dict() or {}) if snap.exists else {}
        used = d.get("used", 0) if d.get("day") == today else 0
        if used >= RESEARCH_DAILY_BUDGET:
            return False
        t.set(ref, {"day": today, "used": used + 1})
        return True
    return take(db.transaction())


@https_fn.on_call(secrets=["MARKETSTACK_API_KEY", "SEC_CONTACT"], timeout_sec=60)
def market_research(req: https_fn.CallableRequest):
    """{symbol} -> that ticker's research doc (SEC company data + Marketstack prices), cached
    up to 12 hours. Open to everyone (alert pages work signed out); fresh fetches are capped
    per day so nobody can use up the plan."""
    sym = str((req.data or {}).get("symbol") or "").strip().upper()
    if not _SYM_RE.match(sym) or sym in CRYPTO_SYMBOLS or sym.endswith("USD") and len(sym) > 5:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "That isn't a stock symbol.")
    db = firestore.client()
    now = datetime.now(NY)
    ref = db.collection("markets").document("research_" + sym.replace(".", "-"))
    snap = ref.get()
    cached = (snap.to_dict() or {}) if snap.exists else None
    if cached and cached.get("source") != "SEC EDGAR":
        cached = None  # from the old source: never serve it
    if cached and now.timestamp() - (cached.get("fetchedAt") or 0) < RESEARCH_MAX_AGE_S:
        return cached
    key = os.environ.get("MARKETSTACK_API_KEY", "").strip()
    if not research_budget_ok(db, now):
        if cached:
            return cached
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED, "Research is busy right now. Try again later.")
    try:
        return ms_refresh_research(db, sym, key, now)
    except Exception as e:
        print("[research] on demand %s: %s" % (sym, type(e).__name__))
        if cached:
            return cached
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAVAILABLE, "Couldn't load research right now.")


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
# Stop loss / take profit is a game option ("stops"), off unless the host turns it on.
# Exits already set on open positions keep working and can still be cleared.


def tw_stops_on(war):
    return bool((war.get("modes") or {}).get("stops"))
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
    if raw.get("stops"):
        if raw["stops"] is not True:
            raise bad
        out["stops"] = True
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
    w = (war_ref.get().to_dict() or {})
    notify_users(db, [p for p in w.get("players") or [] if p != uid], "battles", "%s has started" % (w.get("name") or "Your Trade War"),
                 "The clock is running: %d day%s. Good luck." % (w.get("days") or 0, "" if w.get("days") == 1 else "s"), "practice/war.html?w=" + wid, "war-" + wid)
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
    notify_users(db, [p for p in war.get("players") or [] if p != uid], "battles", "%s was cancelled" % (war.get("name") or "A Trade War"),
                 "The host cancelled it before it started. Nothing counts on anyone's record.", "practice/index.html", "war-" + wid)
    return {"ok": True}


@https_fn.on_call()
@_tw_call
def tw_surrender(req, db, uid, now_ms):
    """Give up a live Trade War: everything is sold at the current price, you're out in
    last place among those still standing, it counts as a loss (and a surrender), and
    you give up any rewards from it. Ends the match if only one trader is left."""
    wid = _tw_war_id(req.data)
    war_ref = db.collection("tradeWars").document(wid)
    prices, _, _ = _tw_prices(db)

    @firestore.transactional
    def txn(t):
        snap = war_ref.get(transaction=t)
        if not snap.exists:
            raise TWError("NOT_FOUND", "That Trade War doesn't exist.")
        war = snap.to_dict()
        if uid not in (war.get("players") or []):
            raise TWError("PERMISSION_DENIED", "You're not in this Trade War.")
        if war.get("status") != "active":
            raise TWError("FAILED_PRECONDITION", "You can only surrender while the Trade War is live." if war.get("status") != "lobby"
                          else "It hasn't started: leave the lobby instead (the host can cancel it).")
        aref, bref = war_ref.collection("accounts").document(uid), war_ref.collection("books").document(uid)
        a, b = aref.get(transaction=t), bref.get(transaction=t)
        acct = a.to_dict() if a.exists else None
        if not acct or acct.get("out"):
            raise TWError("FAILED_PRECONDITION", "You're already out of this Trade War.")
        alive = []
        for p in war.get("alive") or war["players"]:
            if p == uid:
                alive.append(p)
                continue
            s2 = war_ref.collection("accounts").document(p).get(transaction=t)
            if s2.exists and not (s2.to_dict() or {}).get("out"):
                alive.append(p)
        place = len(alive)
        acct, book = tw_knock_out(acct, (b.to_dict() if b.exists else None) or tw_new_book(), prices, "surrender", place, now_ms)
        t.set(aref, acct)
        t.set(bref, book)
        outs = list(war.get("outs") or []) + [{"uid": uid, "name": acct.get("name"), "reason": "surrender", "at": now_ms, "pnlPct": acct["pnlPct"], "place": place}]
        t.update(war_ref, {"alive": [p for p in alive if p != uid], "outs": outs})
        _tw_log(t, war_ref, tw_event("out", "%s surrendered (#%d)" % (acct.get("name") or "Trader", place), now_ms, uid=uid))
        return place

    place = txn(db.transaction())
    tw_mark_war(db, war_ref, now_ms, prices, market_open=False)  # ends the match if one trader is left
    return {"ok": True, "place": place}


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
        # optional Stop Loss / Take Profit on a buy, only when the battle has them on
        sl, tp = tw_check_bracket(prices.get(sym), data.get("sl"), data.get("tp")) if side == "buy" and tw_stops_on(war) else (None, None)
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
        if (sl or tp) and not tw_stops_on(war):
            raise TWError("FAILED_PRECONDITION", "Stop loss and take profit are off in this Trade War.")
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
    notes, ended = [], {}

    @firestore.transactional
    def txn(t):
        del notes[:]
        ended.clear()
        wsnap = ref.get(transaction=t)
        war = wsnap.to_dict() if wsnap.exists else None
        if not war or war.get("status") != "active":
            return False
        wname, wpath = war.get("name") or "your Trade War", "practice/war.html?w=" + ref.id
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
                    notes.append((uid, "fills", "%s hit on %s" % ("Stop loss" if kind == "sl" else "Take profit", sym),
                                  "Sold %d at %s (%s) in %s." % (qty, _tw_money(px), _tw_money(fill["pnl"], signed=True), wname), wpath))
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
                notes.append((uid, "battles", "You're out of %s" % wname, "You finished #%d (%+.2f%%). Stay and watch who's left standing." % (a["place"], a["pnlPct"]), wpath))
                knocked.add(uid)
            alive = [u for u in alive if u not in knocked]
            update.update({"alive": alive, "outs": outs})
            cut = lms.get("cutHours")
            if cut and war.get("nextCutAt") and now_ms >= war["nextCutAt"]:
                update["nextCutAt"] = war["nextCutAt"] + cut * 3600000
        # Last Man Standing ends with one trader left; any match ends when everyone else surrendered
        ending = time_up or (len(alive) <= 1 and (lms or len(accts) > 1))
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
                if war.get("leader") in alive:
                    notes.append((war["leader"], "battles", "You lost the lead in %s" % wname,
                                  "%s took first place (%+.2f%%). Time to answer." % (names.get(lead, "Trader"), accts[lead]["pnlPct"]), wpath))
        else:
            rows = [{"uid": uid, "name": a.get("name"), "start": a["start"], "final": a["equity"], "pnl": a["pnl"],
                     "pnlPct": a["pnlPct"], "trades": a.get("trades", 0), "wins": a.get("wins", 0), "losses": a.get("losses", 0),
                     "out": bool(a.get("out")), "outReason": a.get("outReason"), "place": a.get("place")} for uid, a in accts.items()]
            update.update({"status": "ended", "results": tw_rank(rows), "endedAt": now_ms, "rewardsPaid": False})
            win = update["results"][0] if update["results"] else None
            if win:
                events.append(tw_event("win", "%s wins the Trade War (%+.2f%%)" % (win["name"] or "Trader", win["pnlPct"]), now_ms, uid=win["uid"]))
            ended.update(name=war.get("name") or "Trade War", results=update["results"])
            n = len(update["results"])
            for r in update["results"]:
                notes.append((r["uid"], "battles", ("You won %s 🏆" if r["rank"] == 1 else "%s is over") % wname,
                              "You finished #%d of %d (%+.2f%%)." % (r["rank"], n, r["pnlPct"] or 0), wpath))
        for uid, acct in accts.items():
            t.set(ref.collection("accounts").document(uid), acct)
            if uid in knocked or uid in touched:
                t.set(ref.collection("books").document(uid), books[uid])
        t.update(ref, update)
        for ev in events:
            _tw_log(t, ref, ev)
        return True

    out = txn(db.transaction())
    if out and ended:
        tw_record_results(db, ref.id, ended["name"], ended["results"], now_ms)
    for uid, kind, title, body, path in (notes if out else []):
        notify_users(db, [uid], kind, title, body, path, "war-" + ref.id)
    return out


def tw_record_update(rec, row, n, war_name, wid, now_ms):
    """Pure: one player's public Trade War record after a finished match. A surrender
    counts as a loss and also as a surrender."""
    rec = dict(rec or {})
    won = row.get("rank") == 1
    surr = row.get("outReason") == "surrender"
    rec["played"] = (rec.get("played") or 0) + 1
    rec["wins"] = (rec.get("wins") or 0) + (1 if won else 0)
    rec["losses"] = (rec.get("losses") or 0) + (0 if won else 1)
    rec["surrenders"] = (rec.get("surrenders") or 0) + (1 if surr else 0)
    recent = [x for x in (rec.get("recent") or []) if x.get("w") != wid]
    recent.insert(0, {"w": wid, "name": str(war_name)[:40], "rank": row.get("rank"), "of": n, "pnlPct": row.get("pnlPct"), "surrendered": surr, "at": now_ms})
    rec["recent"] = recent[:8]
    rec["updatedAt"] = now_ms
    return rec


def tw_record_results(db, wid, war_name, results, now_ms):
    """Once per match: everyone's public record in twRecords/{uid}."""
    try:
        db.collection("twRecorded").document(wid).create({"at": now_ms})
    except Exception:
        return
    n = len(results or [])
    for row in results or []:
        try:
            ref = db.collection("twRecords").document(row["uid"])
            snap = ref.get()
            ref.set(tw_record_update(snap.to_dict() if snap.exists else None, row, n, war_name, wid, now_ms))
        except Exception as e:
            print("[tw] record failed: %s" % type(e).__name__)


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
    # token rewards for matches that just ended (rewardsPaid False until paid; older matches have no flag)
    for wsnap in db.collection("tradeWars").where("rewardsPaid", "==", False).stream():
        try:
            tw_pay_rewards(db, wsnap.reference, now_ms)
        except Exception as e:
            print("[tw_mark_matches] rewards %s failed: %s" % (wsnap.id, type(e).__name__))
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
    # every battle has its own name (people can be in several at once)
    name = _re.sub(r"[<>]", "", str(data.get("name") or "")).strip()[:40]
    if len(name) < 2:
        raise TWError("INVALID_ARGUMENT", "Give your battle a name, so you can tell your battles apart.")
    return targets, buy_in, days, name, squad_id, lms


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
    notify_users(db, targets, "challenges", "%s challenged you to a Trade War" % pname,
                 "%s · %s virtual buy-in · %d day%s. Tap to accept or decline." % (name, _tw_money(buy_in).split(".")[0], days, "" if days == 1 else "s")
                 + (" Last Man Standing." if lms else ""), "practice/index.html", "inv-" + wid)
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
    seen = {}

    @firestore.transactional
    def txn(t):
        isnap = inv_ref.get(transaction=t)
        if not isnap.exists or isnap.to_dict().get("to") != uid:
            raise TWError("NOT_FOUND", "That challenge doesn't exist.")
        inv = isnap.to_dict()
        seen.clear()
        if inv["status"] != "pending":
            return {"status": inv["status"], "warId": inv["warId"]}
        seen.update(inv)
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

    out = txn(db.transaction())
    if seen.get("from") and out.get("status") in ("accepted", "declined"):
        who = pname or _tw_name(db, uid, req.auth.token)
        ok = out["status"] == "accepted"
        notify_users(db, [seen["from"]], "challenges", "%s %s your challenge" % (who, "accepted" if ok else "declined"),
                     ("%s is on. %s" % (seen.get("warName") or "Your Trade War", "It has started." if out.get("started") else "Start it when everyone's in."))
                     if ok else "%s won't be playing %s." % (who, seen.get("warName") or "this Trade War"),
                     "practice/war.html?w=" + urllib.parse.quote(seen.get("warId") or ""), "inv-" + (seen.get("warId") or ""))
    return out


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
    "unlock": 10,                  # one live alert (before the 4 pm ET close)
    "unlockClosed": 3,             # one alert after the close, until its trade finishes (then free)
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
        if not locked or locked.get("public"):
            raise TWError("FAILED_PRECONDITION", "This alert is already free to read.")
        strategy = locked.get("strategy")
        if tk_has_access(wallet, strategy, alert_id, now_ms):
            return wallet, None
        closed = locked.get("released") or (locked.get("lockedUntil") or 0) <= now_ms
        cost, ref = TOKENS["unlockClosed" if closed else "unlock"], alert_id
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
    bought = 0
    if _square_ready():
        try:
            bought = square_reconcile(db, uid, now_ms)
        except Exception as e:
            print("[square] reconcile failed: %s" % type(e).__name__)
        if bought:
            wallet = db.collection("wallets").document(uid).get().to_dict() or wallet
    out = _tk_public(wallet)
    out.update({"welcomed": bool(line), "bought": bought, "prices": {"pass": TOKENS["pass"], "passDays": TOKENS["passDays"], "unlock": TOKENS["unlock"], "unlockClosed": TOKENS["unlockClosed"], "welcome": TOKENS["welcome"]},
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
# Earning tokens (free), profile cosmetics and the Founder Program.
#
#   rewards_checkin       once per New York day: a few tokens, a bonus on every 7th day in
#                         a row. Verified accounts only. Also counts as "active" for the
#                         Founder Program.
#   Trade War rewards     paid by tw_mark_matches when a match ends (tw_pay_rewards).
#   cosmetics_buy/equip   name colors, badges, profile banners bought with tokens. What you
#                         show is in cosmetics/{uid} (public read, server write).
#   community_create/join/leave/get
#                         Founder Program communities (see the section further down).
#
# Every token amount lives in EARN / COSMETICS / FOUNDER_TIERS; browsers never send one.
# ---------------------------------------------------------------------------
EARN = {
    "daily": 2, "streakBonus": 10, "streakEvery": 7,
    "twTop": (25, 15, 10),   # 1st/2nd/3rd when 4+ eligible players
    "twDuel": 15,            # the winner, when 2-3 eligible players
    "lmsSurvivor": 10,       # extra for the last trader standing in Last Man Standing
    "twDailyCap": 2,         # rewarded matches per player per New York day
}


def _ny_day(now_ms, offset_days=0):
    from zoneinfo import ZoneInfo
    from datetime import timedelta
    d = datetime.fromtimestamp(now_ms / 1000, ZoneInfo("America/New_York")).date() + timedelta(days=offset_days)
    return d.isoformat()


def tk_checkin(wallet, today, yesterday, now_ms):
    """Pure: (wallet, ledger line | None, checkin state). Once per day; the streak
    continues if your last check-in was yesterday."""
    c = wallet.get("checkin") or {}
    if c.get("day") == today:
        return wallet, None, c
    streak = (c.get("streak") or 0) + 1 if c.get("day") == yesterday else 1
    c2 = {"day": today, "streak": streak, "days": (c.get("days") or 0) + 1}
    amount, note = EARN["daily"], "Daily check-in (day %d)" % streak
    if streak % EARN["streakEvery"] == 0:
        amount += EARN["streakBonus"]
        note = "Daily check-in + %d-day streak bonus" % streak
    w = dict(wallet, balance=wallet["balance"] + amount, checkin=c2, updatedAt=now_ms)
    return w, tk_ledger("checkin", amount, w["balance"], now_ms, note), c2


def _client_ip(req):
    """The caller's IP: the last X-Forwarded-For hop is the one Google's front end adds
    (a browser can prepend its own, never replace it)."""
    raw = getattr(req, "raw_request", None)
    if raw is None:
        return ""
    xff = raw.headers.get("X-Forwarded-For") or ""
    hops = [h.strip() for h in xff.split(",") if h.strip()]
    return hops[-1] if hops else (getattr(raw, "remote_addr", "") or "")


def _ip_hash(ip):
    """Stored instead of the IP itself; only ever compared for equality."""
    return _hashlib.sha256(("zelos-founder|" + (ip or "")).encode()).hexdigest()[:24] if ip else ""


@https_fn.on_call()
@_tk_call
def rewards_checkin(req, db, uid, tok, now_ms):
    if not _tk_verified(tok):
        return {"earned": 0, "needsVerify": True}
    today, yesterday = _ny_day(now_ms), _ny_day(now_ms, -1)
    ref = db.collection("wallets").document(uid)

    @firestore.transactional
    def txn(t):
        snap = ref.get(transaction=t)
        wallet = snap.to_dict() if snap.exists else tk_new_wallet(now_ms)
        wallet, wline = tk_welcome(wallet, True, now_ms)
        wallet, line, c = tk_checkin(wallet, today, yesterday, now_ms)
        if wline or line or not snap.exists:
            t.set(ref, wallet)
        for ln in (wline, line):
            if ln:
                t.set(ref.collection("ledger").document(), ln)
        return wallet, line, c

    wallet, line, c = txn(db.transaction())
    try:
        community_activity(db, uid, tok, today, now_ms, _ip_hash(_client_ip(req)))
    except Exception as e:
        print("[rewards_checkin] community update failed: %s" % type(e).__name__)
    return {"earned": (line or {}).get("amount", 0), "balance": wallet["balance"], "streak": c.get("streak", 0),
            "days": c.get("days", 0), "every": EARN["streakEvery"], "bonus": EARN["streakBonus"], "daily": EARN["daily"]}


# ---- Trade War rewards -------------------------------------------------------
# When a match ends, its top finishers earn tokens. Only players who made at least one
# trade and have a verified account count, and a match needs two of them, so a lone
# account can't farm rewards. Each player is paid for at most twDailyCap matches a day.

def tw_rewards(results, lms, eligible):
    """Pure: [(uid, tokens, note)] for an ended match. results is ranked (tw_rank);
    eligible is the set of uids that may earn."""
    rows = [r for r in results or [] if r.get("uid") in eligible and (r.get("trades") or 0) >= 1 and r.get("outReason") != "surrender"]
    out = []
    if len(rows) >= 4:
        for r, amt, place in zip(rows, EARN["twTop"], ("1st", "2nd", "3rd")):
            out.append([r["uid"], amt, "Trade War: %s place" % place])
    elif len(rows) >= 2:
        out.append([rows[0]["uid"], EARN["twDuel"], "Trade War: 1st place"])
    if lms and len(rows) >= 2 and not rows[0].get("out") and (results or [{}])[0].get("uid") == rows[0]["uid"]:
        out[0][1] += EARN["lmsSurvivor"]
        out[0][2] = "Last Man Standing: survived and won"
    return [tuple(x) for x in out]


def _verified_uids(uids):
    """uids whose account is verified (Google sign-in or a verified email)."""
    from firebase_admin import auth as _auth
    ok = set()
    uids = list(uids)
    for i in range(0, len(uids), 100):
        try:
            res = _auth.get_users([_auth.UidIdentifier(u) for u in uids[i:i + 100]])
        except Exception as e:
            print("[tw_rewards] get_users failed: %s" % type(e).__name__)
            continue
        for u in res.users:
            if u.email_verified or any(p.provider_id == "google.com" for p in (u.provider_data or [])):
                ok.add(u.uid)
    return ok


def tw_credit_reward(db, uid, war_id, amount, note, now_ms):
    """Credit one match reward once (the ledger id is per match) within the daily cap.
    Returns True if paid."""
    ref = db.collection("wallets").document(uid)
    lref = ref.collection("ledger").document("tw-" + war_id)
    today = _ny_day(now_ms)

    @firestore.transactional
    def txn(t):
        snap = ref.get(transaction=t)
        if lref.get(transaction=t).exists:
            return False
        wallet = snap.to_dict() if snap.exists else tk_new_wallet(now_ms)
        cap = wallet.get("twRewards") or {}
        n = cap.get("n", 0) if cap.get("day") == today else 0
        if n >= EARN["twDailyCap"]:
            return False
        w, line = tk_credit(wallet, amount, now_ms, "trade-war", note, war_id)
        w["twRewards"] = {"day": today, "n": n + 1}
        t.set(ref, w)
        t.set(lref, line)
        return True

    return txn(db.transaction())


def tw_pay_rewards(db, ref, now_ms):
    """Pay the rewards of one ended match (once: rewardsPaid flips in the end)."""
    war = ref.get().to_dict() or {}
    if war.get("status") != "ended" or war.get("rewardsPaid") is not False:
        return 0
    results = war.get("results") or []
    traded = [r["uid"] for r in results if (r.get("trades") or 0) >= 1]
    plan = tw_rewards(results, war.get("lms"), _verified_uids(traded) if len(traded) >= 2 else set())
    paid = []
    for uid, amount, note in plan:
        if tw_credit_reward(db, uid, ref.id, amount, note, now_ms):
            paid.append({"uid": uid, "tokens": amount, "note": note})
    ref.update({"rewardsPaid": True, "rewards": paid})
    names = war.get("names") or {}
    for p in paid:
        ref.collection("events").document().set(tw_event("reward", "%s earned %d tokens (%s)" % (names.get(p["uid"], "Trader"), p["tokens"], p["note"]), now_ms, uid=p["uid"]))
    return len(paid)


# ---- Profile cosmetics -------------------------------------------------------
# Bought once with tokens, then yours to switch on and off. The look itself (colors,
# gradients, emoji) is drawn by zelos-tokens.js from the same ids.
COSMETICS = {
    "color": {"gold": ("Gold name", 60), "emerald": ("Emerald name", 60), "electric": ("Electric blue name", 60),
              "crimson": ("Crimson name", 60), "violet": ("Violet name", 60), "rainbow": ("Prism name", 150)},
    "badge": {"bull": ("Bull badge", 40), "bear": ("Bear badge", 40), "rocket": ("Rocket badge", 40),
              "diamond": ("Diamond hands badge", 80), "crown": ("Crown badge", 120)},
    "banner": {"sunset": ("Sunset banner", 80), "midnight": ("Midnight banner", 80), "neon": ("Neon grid banner", 100),
               "ocean": ("Ocean banner", 80), "gold": ("Gold rush banner", 150)},
}


def cosmetic_buy(wallet, kind, cid, now_ms):
    """Pure: (wallet, ledger line | None). Already owned = no charge."""
    item = (COSMETICS.get(kind) or {}).get(cid)
    if not item:
        raise TWError("INVALID_ARGUMENT", "That item isn't in the shop.")
    key = "%s:%s" % (kind, cid)
    owned = list(wallet.get("owned") or [])
    if key in owned:
        return wallet, None
    name, cost = item
    if wallet["balance"] < cost:
        raise TWError("FAILED_PRECONDITION", "You need %d tokens and have %d." % (cost, wallet["balance"]))
    w = dict(wallet, balance=wallet["balance"] - cost, owned=owned + [key], updatedAt=now_ms)
    return w, tk_ledger("cosmetic", -cost, w["balance"], now_ms, name, key)


def _cosmetics_shop():
    return {k: [{"id": i, "name": v[0], "price": v[1]} for i, v in items.items()] for k, items in COSMETICS.items()}


@https_fn.on_call()
@_tk_call
def cosmetics_buy(req, db, uid, tok, now_ms):
    """{kind, id}: buy it (if you don't own it) and wear it."""
    data = req.data or {}
    kind, cid = str(data.get("kind") or ""), str(data.get("id") or "")
    ref = db.collection("wallets").document(uid)
    look = db.collection("cosmetics").document(uid)

    @firestore.transactional
    def txn(t):
        snap = ref.get(transaction=t)
        wallet = snap.to_dict() if snap.exists else tk_new_wallet(now_ms)
        wallet, line = cosmetic_buy(wallet, kind, cid, now_ms)
        if line:
            t.set(ref, wallet)
            t.set(ref.collection("ledger").document(), line)
        t.set(look, {kind: cid, "updatedAt": now_ms}, merge=True)
        return wallet, line

    wallet, line = txn(db.transaction())
    return {"balance": wallet["balance"], "owned": wallet.get("owned") or [], "charged": -(line or {}).get("amount", 0)}


@https_fn.on_call()
@_tk_call
def cosmetics_equip(req, db, uid, tok, now_ms):
    """{kind, id|null}: wear something you own, or take it off. Also {} = the shop."""
    data = req.data or {}
    kind = str(data.get("kind") or "")
    wsnap = db.collection("wallets").document(uid).get()
    wallet = wsnap.to_dict() if wsnap.exists else {}
    look_ref = db.collection("cosmetics").document(uid)
    if kind:
        if kind not in COSMETICS:
            raise TWError("INVALID_ARGUMENT", "That item isn't in the shop.")
        cid = data.get("id")
        if cid is not None and "%s:%s" % (kind, cid) not in (wallet.get("owned") or []):
            raise TWError("FAILED_PRECONDITION", "Buy it first.")
        look_ref.set({kind: cid, "updatedAt": now_ms}, merge=True)
    ls = look_ref.get()
    return {"shop": _cosmetics_shop(), "owned": wallet.get("owned") or [], "look": ls.to_dict() if ls.exists else {}}


# ---- Founder Program ---------------------------------------------------------
# Start a community (a name + your state), share its link, and earn tokens and Founder
# titles as real members join and stay active.
#
#   communities/{cid}                public: {name, state, slug, founder, founderName, members, counted,
#                                    xp, tier, title, rewarded: [5, 10, ...], weeks: {wYYYYWW: joins},
#                                    createdAt, lastJoinAt}. cid = slug of name + state.
#   communities/{cid}/members/{uid}  public: {name, joinedAt, xp, counted, founder}
#   communityMembers/{uid}           you only: {cid, joinedAt, activeDays, lastActive, counted,
#                                    countedFor, ipHash, founded}
#   communityPrivate/{cid}           server only: {founderIps, countedIps} (hashed, never raw IPs)
#
# A member counts toward the founder's milestones once, when all of these hold:
#   - a verified account (Google sign-in or a verified email), and not the founder;
#   - never counted for any community before (switching can't count twice);
#   - active (the daily check-in) on FOUNDER_ACTIVE_DAYS different days since joining;
#   - on a different network from the founder and from every member already counted.
# Members' XP (users/{uid}.xp) is summed into the community's XP when they check in.
US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado",
    "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts",
    "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
    "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
    "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota",
    "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}
FOUNDER_TIERS = [(5, 250, "Founder"), (10, 150, "Rising Founder"), (25, 400, "Community Builder"),
                 (50, 750, "Community Leader"), (100, 1500, "Legendary Founder")]
FOUNDER_ACTIVE_DAYS = 2
_COMMUNITY_NAME_RE = _re.compile(r"^[A-Za-z0-9][A-Za-z0-9 '&.-]{1,28}[A-Za-z0-9.]$")
_BLOCKED_WORDS = ("fuck", "shit", "bitch", "cunt", "nigg", "fag", "rape", "nazi", "porn", "dick", "pussy", "whore", "slut", "retard")


def community_slug(name, state):
    """Validated (display name, state code, cid) or TWError."""
    name = _re.sub(r"\s+", " ", str(name or "")).strip()
    state = str(state or "").strip().upper()
    if state not in US_STATES:
        raise TWError("INVALID_ARGUMENT", "Pick your state.")
    if not _COMMUNITY_NAME_RE.match(name):
        raise TWError("INVALID_ARGUMENT", "Community names are 3 to 30 letters, numbers and spaces.")
    flat = _re.sub(r"[^a-z]", "", name.lower())
    if any(w in flat for w in _BLOCKED_WORDS):
        raise TWError("INVALID_ARGUMENT", "Pick a different name.")
    base = _re.sub(r"-+", "-", _re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")
    return name, state, "%s-%s" % (base, state.lower())


def founder_due(counted, rewarded):
    """Pure: the milestones reached and not yet paid, [(members, tokens, title)]."""
    return [t for t in FOUNDER_TIERS if counted >= t[0] and t[0] not in (rewarded or [])]


def founder_title(counted):
    best = None
    for t in FOUNDER_TIERS:
        if counted >= t[0]:
            best = t
    return best


def member_counts(m, priv, founder, uid, verified, ip_hash):
    """Pure: (counts now?, reason). m is communityMembers/{uid}."""
    if m.get("counted"):
        return False, "already counted"
    if uid == founder:
        return False, "founder"
    if not verified:
        return False, "not verified"
    if m.get("countedFor"):
        return False, "counted before"
    if (m.get("activeDays") or 0) < FOUNDER_ACTIVE_DAYS:
        return False, "not active enough yet"
    seen = set((priv or {}).get("founderIps") or []) | set((priv or {}).get("countedIps") or [])
    mine = {h for h in (m.get("ipHash"), ip_hash) if h}
    if mine & seen:
        return False, "same network"
    return True, "ok"


def _week_key(now_ms):
    from zoneinfo import ZoneInfo
    y, w, _ = datetime.fromtimestamp(now_ms / 1000, ZoneInfo("America/New_York")).date().isocalendar()
    return "w%d%02d" % (y, w)


def _user_xp(db, uid):
    try:
        d = db.collection("users").document(uid).get()
        return max(0, int((d.to_dict() or {}).get("xp") or 0)) if d.exists else 0
    except Exception:
        return 0


def _leave_writes(t, db, uid, m, comm):
    """Writes that take uid out of its community (inside a transaction, after the reads)."""
    cref = db.collection("communities").document(m["cid"])
    mref = cref.collection("members").document(uid)
    upd = {"members": firestore.Increment(-1)}
    if m.get("counted"):
        upd["counted"] = firestore.Increment(-1)
    if m.get("xp"):
        upd["xp"] = firestore.Increment(-int(m.get("xp") or 0))
    if comm:
        t.update(cref, upd)
    t.delete(mref)


@https_fn.on_call()
@_tk_call
def community_create(req, db, uid, tok, now_ms):
    """{name, state} -> {cid}. You become its founder (one community per founder)."""
    if not _tk_verified(tok):
        raise TWError("FAILED_PRECONDITION", "Verify your email (or sign in with Google) to start a community.")
    data = req.data or {}
    name, state, cid = community_slug(data.get("name"), data.get("state"))
    who, xp, iph, today = _tw_name(db, uid, tok), _user_xp(db, uid), _ip_hash(_client_ip(req)), _ny_day(now_ms)
    mref = db.collection("communityMembers").document(uid)
    cref = db.collection("communities").document(cid)

    @firestore.transactional
    def txn(t):
        ms = mref.get(transaction=t)
        m = ms.to_dict() if ms.exists else {}
        if m.get("founded"):
            raise TWError("FAILED_PRECONDITION", "You already founded a community.")
        if m.get("cid"):
            raise TWError("FAILED_PRECONDITION", "Leave your current community first.")
        if cref.get(transaction=t).exists:
            raise TWError("ALREADY_EXISTS", "%s already has a community called %s. Pick another name." % (US_STATES[state], name))
        t.set(cref, {"name": name, "state": state, "slug": cid, "founder": uid, "founderName": who, "members": 1, "counted": 0,
                     "xp": xp, "tier": 0, "title": None, "rewarded": [], "weeks": {}, "createdAt": now_ms, "lastJoinAt": now_ms})
        t.set(cref.collection("members").document(uid), {"name": who, "joinedAt": now_ms, "xp": xp, "counted": False, "founder": True})
        t.set(db.collection("communityPrivate").document(cid), {"founderIps": [iph] if iph else [], "countedIps": []})
        t.set(mref, dict(m, cid=cid, founded=cid, joinedAt=now_ms, activeDays=1, lastActive=today, counted=False, ipHash=iph, xp=xp))
        t.set(db.collection("cosmetics").document(uid), {"community": {"cid": cid, "name": name, "state": state}, "updatedAt": now_ms}, merge=True)

    txn(db.transaction())
    print("[community] created %s" % cid)
    return {"cid": cid}


@https_fn.on_call()
@_tk_call
def community_join(req, db, uid, tok, now_ms):
    """{cid, switch?}: join (leaving your current community only if switch is true)."""
    data = req.data or {}
    cid = str(data.get("cid") or "")
    if not _re.match(r"^[a-z0-9-]{3,40}$", cid):
        raise TWError("INVALID_ARGUMENT", "That community link isn't valid.")
    who, xp, iph, today, wk = _tw_name(db, uid, tok), _user_xp(db, uid), _ip_hash(_client_ip(req)), _ny_day(now_ms), _week_key(now_ms)
    mref = db.collection("communityMembers").document(uid)
    cref = db.collection("communities").document(cid)

    @firestore.transactional
    def txn(t):
        ms = mref.get(transaction=t)
        m = ms.to_dict() if ms.exists else {}
        cs = cref.get(transaction=t)
        if not cs.exists:
            raise TWError("NOT_FOUND", "That community doesn't exist (any more).")
        if m.get("cid") == cid:
            return {"cid": cid, "already": True}
        old = None
        if m.get("cid"):
            if m.get("founded") == m["cid"]:
                raise TWError("FAILED_PRECONDITION", "You founded %s, so you can't switch communities." % m["cid"])
            if not data.get("switch"):
                raise TWError("FAILED_PRECONDITION", "SWITCH:You're already in a community. Switch to this one?")
            os_ = db.collection("communities").document(m["cid"]).get(transaction=t)
            old = os_.to_dict() if os_.exists else None
        if m.get("cid"):
            _leave_writes(t, db, uid, m, old)
        t.update(cref, {"members": firestore.Increment(1), "xp": firestore.Increment(xp), "lastJoinAt": now_ms,
                        "weeks." + wk: firestore.Increment(1)})
        t.set(cref.collection("members").document(uid), {"name": who, "joinedAt": now_ms, "xp": xp, "counted": False, "founder": False})
        t.set(mref, {"cid": cid, "joinedAt": now_ms, "activeDays": 1, "lastActive": today, "counted": False,
                     "countedFor": m.get("countedFor"), "ipHash": iph, "founded": m.get("founded"), "xp": xp})
        comm = cs.to_dict()
        t.set(db.collection("cosmetics").document(uid), {"community": {"cid": cid, "name": comm.get("name"), "state": comm.get("state")}, "updatedAt": now_ms}, merge=True)
        return {"cid": cid}

    out = txn(db.transaction())
    print("[community] join %s" % cid)
    if not out.get("already"):
        try:
            c = cref.get().to_dict() or {}
            if c.get("founder") and c["founder"] != uid:
                notify_users(db, [c["founder"]], "community", "%s joined %s" % (who, c.get("name") or "your community"),
                             "%d member%s now. They count toward your Founder milestones once they're active for %d days." % (c.get("members") or 0, "" if c.get("members") == 1 else "s", FOUNDER_ACTIVE_DAYS),
                             "practice/communities.html", "comm-" + cid)
        except Exception as e:
            print("[community] notify failed: %s" % type(e).__name__)
    return out


@https_fn.on_call()
@_tk_call
def community_leave(req, db, uid, tok, now_ms):
    mref = db.collection("communityMembers").document(uid)

    @firestore.transactional
    def txn(t):
        ms = mref.get(transaction=t)
        m = ms.to_dict() if ms.exists else {}
        if not m.get("cid"):
            return {"left": False}
        if m.get("founded") == m["cid"]:
            raise TWError("FAILED_PRECONDITION", "Founders can't leave their own community.")
        cs = db.collection("communities").document(m["cid"]).get(transaction=t)
        _leave_writes(t, db, uid, m, cs.to_dict() if cs.exists else None)
        t.set(mref, {"cid": None, "counted": False, "countedFor": m.get("countedFor"), "founded": m.get("founded"), "ipHash": m.get("ipHash")})
        t.set(db.collection("cosmetics").document(uid), {"community": None, "updatedAt": now_ms}, merge=True)
        return {"left": True}

    return txn(db.transaction())


def community_activity(db, uid, tok, today, now_ms, iph):
    """Called on each daily check-in: active days, XP, and the Founder milestones."""
    mref = db.collection("communityMembers").document(uid)
    first = mref.get()
    if not first.exists or not (first.to_dict() or {}).get("cid"):
        return None
    xp = _user_xp(db, uid)
    verified = _tk_verified(tok)

    @firestore.transactional
    def txn(t):
        ms = mref.get(transaction=t)
        m = ms.to_dict() if ms.exists else {}
        cid = m.get("cid")
        if not cid:
            return None
        cref = db.collection("communities").document(cid)
        cs = cref.get(transaction=t)
        if not cs.exists:
            return None
        comm = cs.to_dict()
        pref = db.collection("communityPrivate").document(cid)
        ps = pref.get(transaction=t)
        priv = ps.to_dict() if ps.exists else {"founderIps": [], "countedIps": []}
        founder = comm.get("founder")
        fref = db.collection("wallets").document(founder)
        fs = fref.get(transaction=t)
        fwallet = fs.to_dict() if fs.exists else tk_new_wallet(now_ms)

        m2 = dict(m)
        if m.get("lastActive") != today:
            m2.update(activeDays=(m.get("activeDays") or 0) + 1, lastActive=today)
        dxp = xp - int(m.get("xp") or 0)
        m2["xp"] = xp
        cupd = {}
        if dxp:
            cupd["xp"] = firestore.Increment(dxp)
        member_upd = {"xp": xp}
        if uid == founder and iph and iph not in (priv.get("founderIps") or []):
            priv = dict(priv, founderIps=((priv.get("founderIps") or []) + [iph])[-20:])
            t.set(pref, priv)
        ok, why = member_counts(m2, priv, founder, uid, verified, iph)
        paid = []
        if ok:
            m2.update(counted=True, countedFor=cid)
            member_upd["counted"] = True
            counted = (comm.get("counted") or 0) + 1
            cupd["counted"] = firestore.Increment(1)
            hashes = [h for h in {m.get("ipHash"), iph} if h]
            t.set(pref, dict(priv, countedIps=((priv.get("countedIps") or []) + hashes)[-500:]))
            due = founder_due(counted, comm.get("rewarded"))
            for need, tokens, title in due:
                fwallet, line = tk_credit(fwallet, tokens, now_ms, "founder", "Founder Program: %s reached %d members (%s)" % (comm.get("name"), need, title), cid)
                t.set(fref.collection("ledger").document("founder-%s-%d" % (cid, need)), line)
                paid.append(need)
            if paid:
                best = founder_title(counted)
                t.set(fref, fwallet)
                cupd.update(rewarded=(comm.get("rewarded") or []) + paid, tier=best[0], title=best[2])
                t.set(db.collection("cosmetics").document(founder),
                      {"founder": {"title": best[2], "tier": best[0], "cid": cid, "name": comm.get("name")}, "updatedAt": now_ms}, merge=True)
        t.set(mref, m2)
        t.set(cref.collection("members").document(uid), member_upd, merge=True)
        if cupd:
            t.update(cref, cupd)
        return {"counted": ok, "why": why, "paid": paid, "founder": founder, "name": comm.get("name"), "cid": cid}

    out = txn(db.transaction())
    if out and (out["counted"] or out["paid"]):
        print("[community] activity counted=%s paid=%s" % (out["counted"], out["paid"]))
    if out and out.get("paid"):
        tiers = {need: (tokens, title) for need, tokens, title in FOUNDER_TIERS}
        for need in out["paid"]:
            tokens, title = tiers.get(need, (0, "Founder"))
            notify_users(db, [out["founder"]], "community", "%s reached %d members" % (out.get("name") or "Your community", need),
                         "You're a %s now: +%d tokens are in your wallet." % (title, tokens), "practice/communities.html", "comm-" + out["cid"])
    return out


# ---------------------------------------------------------------------------
# Website push notifications (Firebase Cloud Messaging, Web Push).
#
#   push_register {token}    save this browser's push token (pushTokens/{hash}, server only)
#   push_unregister {token}  forget it (turning notifications off on this device)
#   push_test {}             send yourself a test notification on every device you turned on
#   alert_push(...)          publish_alert calls it for every alert with a trade: one
#                            notification per alert, ever (alertPushes/{alertId} is the
#                            guard), to everyone whose My Agents switch for that scanner is on.
#
# The notification shows only the teaser (scanner, setup, score), never the ticker or levels,
# so it doesn't give away a token-gated alert. Tapping it opens the alert page.
# ---------------------------------------------------------------------------
PUSH_NAMES = {"swing-trader": "Swing Trader", "breakout-rider": "Breakout Rider", "options-scanner": "Options Scanner"}
PUSH_MAX_TOKENS = 10


def _push_id(token):
    return _hashlib.sha256(token.encode()).hexdigest()[:40]


def push_wants(prefs, strategy):
    """My Agents switches: notificationPrefs.strategies absent = every scanner on."""
    chosen = (prefs or {}).get("strategies")
    return True if chosen is None else strategy in chosen


def push_alert_message(alert_id, alert):
    """Pure: (title, body, link, image) for a new alert. Teaser only."""
    name = PUSH_NAMES.get(alert.get("strategy"), "Zelos")
    bits = [alert.get("setupLabel") or (alert.get("direction") or "").title() or "New setup"]
    if alert.get("score") is not None and alert.get("scoreMax"):
        bits.append("score %s/%s" % (alert["score"], alert["scoreMax"]))
    if alert.get("marketRegime"):
        bits.append("%s market" % alert["marketRegime"])
    body = " · ".join(b for b in bits if b) + ". Tap to see it on Zelos."
    return ("New %s alert" % name, body, "%s/alert.html?id=%s" % (SITE_URL, urllib.parse.quote(alert_id)),
            "%s/images/alert-%s.png" % (SITE_URL, alert.get("strategy") if alert.get("strategy") in PUSH_NAMES else "zelos"))


def _push_send(tokens, title, body, link, image, tag):
    """Send to [(doc_id, token)]; returns (sent, [doc ids of dead tokens])."""
    from firebase_admin import messaging
    sent, dead = 0, []
    for i in range(0, len(tokens), 500):
        chunk = tokens[i:i + 500]
        msgs = [messaging.Message(token=t, data={"link": link, "tag": tag},
                                  webpush=messaging.WebpushConfig(
                                      notification=messaging.WebpushNotification(title=title, body=body, icon=SITE_URL + "/icons/icon-192.png",
                                                                                 badge=SITE_URL + "/icons/icon-192.png", image=image, tag=tag),
                                      fcm_options=messaging.WebpushFCMOptions(link=link)))
                for _, t in chunk]
        res = messaging.send_each(msgs)
        for (doc_id, _), r in zip(chunk, res.responses):
            if r.success:
                sent += 1
            elif type(r.exception).__name__ in ("UnregisteredError", "SenderIdMismatchError") or "registration-token-not-registered" in str(r.exception):
                dead.append(doc_id)
            else:
                print("[push] send failed: %s" % type(r.exception).__name__)
    return sent, dead


def alert_push(db, alert_id, alert):
    """Notify subscribers about a new alert, once. Returns how many devices got it."""
    guard = db.collection("alertPushes").document(alert_id)
    try:
        guard.create({"at": int(_time.time() * 1000), "strategy": alert.get("strategy")})
    except Exception:
        print("[push] alert %s already notified" % alert_id)
        return 0
    strategy = alert.get("strategy")
    by_uid = {}
    for snap in db.collection("pushTokens").stream():
        d = snap.to_dict()
        if d.get("uid") and d.get("token"):
            by_uid.setdefault(d["uid"], []).append((snap.id, d["token"]))
    tokens = []
    for uid, toks in by_uid.items():
        u = db.collection("users").document(uid).get()
        if push_wants((u.to_dict() or {}).get("notificationPrefs") if u.exists else None, strategy):
            tokens += toks
    if not tokens:
        guard.update({"devices": 0})
        return 0
    title, body, link, image = push_alert_message(alert_id, alert)
    sent, dead = _push_send(tokens, title, body, link, image, "alert-" + alert_id)
    for doc_id in dead:
        db.collection("pushTokens").document(doc_id).delete()
    guard.update({"devices": sent, "removed": len(dead)})
    print("[push] alert %s: sent %d, removed %d dead tokens" % (alert_id, sent, len(dead)))
    return sent


# ---- personal notifications ---------------------------------------------------
# Everything that's about *you* (not a scanner alert): challenges, battle updates,
# friends, your community, Trade War stop loss / take profit fills. Each one lands
# in users/{uid}/inbox (the bell on every page) and, if that kind is switched on in
# Alerts -> Notifications (users/{uid}.notificationPrefs.types; missing = on), as a
# push to every device the person turned notifications on for.
NOTIFY_KINDS = ("challenges", "battles", "friends", "community", "fills")


def notify_wants(prefs, kind):
    return ((prefs or {}).get("types") or {}).get(kind) is not False


def notify_users(db, uids, kind, title, body, path, tag):
    """Inbox + push for each uid. Never raises: a notification must never break the action that caused it."""
    sent, now_ms = 0, int(_time.time() * 1000)
    for uid in dict.fromkeys(u for u in (uids or []) if u):
        try:
            uref = db.collection("users").document(uid)
            u = uref.get()
            uref.collection("inbox").add({"kind": kind, "title": str(title)[:120], "body": str(body)[:240], "link": path, "at": now_ms, "read": False})
            if not notify_wants((u.to_dict() or {}).get("notificationPrefs") if u.exists else None, kind):
                continue
            toks = [(x.id, (x.to_dict() or {}).get("token")) for x in db.collection("pushTokens").where("uid", "==", uid).stream()]
            toks = [t for t in toks if t[1]]
            if not toks:
                continue
            n, dead = _push_send(toks, str(title)[:120], str(body)[:240], SITE_URL + "/" + path.lstrip("/"), None, tag)
            sent += n
            for doc_id in dead:
                db.collection("pushTokens").document(doc_id).delete()
        except Exception as e:
            print("[notify] %s to one user failed: %s" % (kind, type(e).__name__))
    return sent


@https_fn.on_call()
@_tk_call
def friend_ping(req, db, uid, tok, now_ms):
    """{uid}: tell someone you added them as a friend (once per pair). If they already
    had you, it's mutual: tell them you're friends now."""
    to = str((req.data or {}).get("uid") or "")
    if not _TW_UID_RE.match(to) or to == uid:
        raise TWError("INVALID_ARGUMENT", "That trader isn't valid.")
    me = db.collection("users").document(uid).get()
    if to not in ((me.to_dict() or {}).get("friends") or []):
        raise TWError("FAILED_PRECONDITION", "Add them as a friend first.")
    guard = db.collection("friendPings").document("%s_%s" % (uid, to))
    try:
        guard.create({"at": now_ms})
    except Exception:
        return {"sent": False}
    them = db.collection("users").document(to).get()
    mutual = uid in ((them.to_dict() or {}).get("friends") or [])
    who = _tw_name(db, uid, tok)
    if mutual:
        notify_users(db, [to], "friends", "You and %s are friends now" % who, "%s added you back. Challenge them to a Trade War." % who,
                     "practice/profile.html?u=" + urllib.parse.quote(uid), "friend-" + uid[:12])
    else:
        notify_users(db, [to], "friends", "%s added you as a friend" % who, "Add them back to see each other's Trade War results and challenge each other.",
                     "practice/profile.html?u=" + urllib.parse.quote(uid), "friend-" + uid[:12])
    return {"sent": True, "mutual": mutual}


@https_fn.on_call()
@_tk_call
def push_register(req, db, uid, tok, now_ms):
    token = str((req.data or {}).get("token") or "")
    if not (20 <= len(token) <= 4096) or not _re.match(r"^[A-Za-z0-9_:.\-]+$", token):
        raise TWError("INVALID_ARGUMENT", "That device couldn't be registered.")
    ref = db.collection("pushTokens").document(_push_id(token))
    old = ref.get()
    ref.set(dict({"uid": uid, "token": token, "lastSeen": now_ms}, **({} if old.exists else {"createdAt": now_ms})), merge=True)
    mine = sorted([s for s in db.collection("pushTokens").where("uid", "==", uid).stream()], key=lambda s: (s.to_dict() or {}).get("lastSeen") or 0)
    for s in mine[:-PUSH_MAX_TOKENS]:
        s.reference.delete()
    return {"ok": True, "devices": min(len(mine), PUSH_MAX_TOKENS)}


@https_fn.on_call()
@_tk_call
def push_unregister(req, db, uid, tok, now_ms):
    token = str((req.data or {}).get("token") or "")
    ref = db.collection("pushTokens").document(_push_id(token)) if token else None
    if ref:
        s = ref.get()
        if s.exists and (s.to_dict() or {}).get("uid") == uid:
            ref.delete()
    return {"ok": True}


@https_fn.on_call()
@_tk_call
def push_test(req, db, uid, tok, now_ms):
    """{token?}: send a test to this device (its current token, registered on the spot
    if it's new or belonged to another sign-in), else to every device on the account."""
    token = str((req.data or {}).get("token") or "")
    if 20 <= len(token) <= 4096 and _re.match(r"^[A-Za-z0-9_:.\-]+$", token):
        ref = db.collection("pushTokens").document(_push_id(token))
        ref.set({"uid": uid, "token": token, "lastSeen": now_ms}, merge=True)
        toks = [(ref.id, token)]
    else:
        toks = [(s.id, (s.to_dict() or {}).get("token")) for s in db.collection("pushTokens").where("uid", "==", uid).stream()]
    toks = [t for t in toks if t[1]]
    if not toks:
        raise TWError("FAILED_PRECONDITION", "Turn on notifications on this device first.")
    sent, dead = _push_send(toks, "Zelos notifications are on", "You'll get a notification like this when a new scanner alert publishes.",
                            SITE_URL + "/dashboard.html", SITE_URL + "/images/alert-zelos.png", "test-" + uid[:8])
    for doc_id in dead:
        db.collection("pushTokens").document(doc_id).delete()
    return {"sent": sent}


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


def square_webhook_urls(headers, path):
    """Every URL Square may have signed: the configured one, plus the address this request
    actually came in on (the cloudfunctions.net and the run.app forms of the same function)."""
    urls = [SQUARE_WEBHOOK_URL]
    path = path or "/"
    for h in (headers.get("X-Forwarded-Host"), headers.get("Host")):
        h = (h or "").split(",")[0].strip()
        if h and _re.match(r"^[A-Za-z0-9.-]+(:\d+)?$", h):
            for u in ("https://%s%s" % (h, path), "https://%s%s" % (h, path.rstrip("/") or "/")):
                if u not in urls:
                    urls.append(u)
    return urls


def _key_print(key):
    """A short fingerprint of the signature key for the logs (never the key itself)."""
    return _hashlib.sha256(key.encode()).hexdigest()[:8] if key else "missing"


@https_fn.on_request(secrets=["SQUARE_WEBHOOK_SIGNATURE_KEY"])
def squareWebhook(req: https_fn.Request) -> https_fn.Response:
    """Square payment notifications. Verified by signature; credits each order exactly once."""
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)
    raw = req.get_data()
    key, sig = os.environ.get("SQUARE_WEBHOOK_SIGNATURE_KEY", "").strip(), req.headers.get("x-square-hmacsha256-signature", "")
    urls = square_webhook_urls(req.headers, req.path)
    if not any(square_verify(raw, sig, key, u) for u in urls):
        print("[square] webhook rejected: bad signature (signature header %s, key length %d, key print %s, tried %s)"
              % ("present" if sig else "MISSING", len(key), _key_print(key), " | ".join(urls)))
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
    try:
        why = square_credit(db, payment, eid, etype, now_ms)
    except Exception as e:
        print("[square] webhook %s failed: %s" % (eid[:12], type(e).__name__))
        return https_fn.Response("retry", status=500)  # Square retries
    print("[square] event %s %s order=%s status=%s -> %s" % (etype, eid[:12], payment.get("order_id"), payment.get("status"), why or "credited"))
    return https_fn.Response("ok", status=200)


def square_credit(db, payment, eid, etype, now_ms):
    """Credit the checkout this payment belongs to, exactly once. Returns None if credited,
    else why not. Used by the webhook and by square_reconcile."""
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

    return txn(db.transaction())


# ---------------------------------------------------------------------------
# Owner-only sales report (sales.html). Only accounts listed in admins/{uid} can read it;
# that collection is server-only (rules deny all browser access) and is added by hand in
# the Firebase console: Firestore -> admins -> document ID = your account ID.
# ---------------------------------------------------------------------------
def sales_summary(purchases, checkouts, now_ms):
    """Pure: totals and recent sales. purchases/checkouts are lists of dicts (at/createdAt in ms)."""
    from datetime import datetime, timezone
    from zoneinfo import ZoneInfo
    ny = ZoneInfo("America/New_York")
    now = datetime.fromtimestamp(now_ms / 1000, timezone.utc).astimezone(ny)
    day0 = now.replace(hour=0, minute=0, second=0, microsecond=0)
    starts = {"today": day0.timestamp() * 1000, "d7": now_ms - 7 * 864e5, "d30": now_ms - 30 * 864e5,
              "month": day0.replace(day=1).timestamp() * 1000}
    def blank():
        return {"count": 0, "cents": 0, "tokens": 0}
    tot = {k: blank() for k in ["all"] + list(starts)}
    packs, buyers = {}, set()
    for p in purchases:
        at, cents, tokens = int(p.get("at") or 0), int(p.get("amountCents") or 0), int(p.get("tokens") or 0)
        for k in tot:
            if k == "all" or at >= starts[k]:
                tot[k]["count"] += 1; tot[k]["cents"] += cents; tot[k]["tokens"] += tokens
        pk = packs.setdefault(p.get("pack") or "?", blank())
        pk["count"] += 1; pk["cents"] += cents; pk["tokens"] += tokens
        if p.get("uid"):
            buyers.add(p["uid"])
    started = [c for c in checkouts if int(c.get("createdAt") or 0) >= starts["d30"]]
    paid = sum(1 for c in started if c.get("status") == "credited")
    # one row per day for the last 30 days (oldest first), for the chart
    days = []
    for i in range(29, -1, -1):
        d = (day0.timestamp() * 1000) - i * 864e5
        days.append({"day": datetime.fromtimestamp(d / 1000, ny).strftime("%Y-%m-%d"), "cents": 0, "count": 0})
    idx = {r["day"]: r for r in days}
    for p in purchases:
        k = datetime.fromtimestamp(int(p.get("at") or 0) / 1000, ny).strftime("%Y-%m-%d")
        if k in idx:
            idx[k]["cents"] += int(p.get("amountCents") or 0); idx[k]["count"] += 1
    recent = sorted(purchases, key=lambda p: -int(p.get("at") or 0))[:200]
    return {"totals": tot, "packs": packs, "buyers": len(buyers), "days": days,
            "checkouts30": {"started": len(started), "paid": paid},
            "recent": [{"at": int(p.get("at") or 0), "uid": p.get("uid"), "pack": p.get("pack"), "tokens": int(p.get("tokens") or 0),
                        "cents": int(p.get("amountCents") or 0), "provider": p.get("provider") or "square", "paymentId": p.get("paymentId") or ""}
                       for p in recent]}


@https_fn.on_call()
@_tk_call
def admin_sales(req, db, uid, tok, now_ms):
    """Owner-only: token sales totals and the latest purchases, with buyers' @usernames."""
    if not db.collection("admins").document(uid).get().exists:
        raise TWError("PERMISSION_DENIED", "This page is only for the site owner.")
    purchases = [d.to_dict() for d in db.collection("purchases").order_by("at", direction=firestore.Query.DESCENDING).limit(2000).stream()]
    checkouts = [d.to_dict() for d in db.collection("squareCheckouts").where("createdAt", ">=", now_ms - 30 * 86400000).stream()]
    out = sales_summary(purchases, checkouts, now_ms)
    names = {}
    for u in {r["uid"] for r in out["recent"] if r.get("uid")}:
        t = db.collection("traders").document(u).get()
        d = t.to_dict() if t.exists else {}
        names[u] = d.get("username") or d.get("name") or ""
    for r in out["recent"]:
        r["name"] = names.get(r.get("uid"), "")
    out["env"] = _square_env()
    return out


def square_reconcile(db, uid, now_ms):
    """Backup for a missed or rejected webhook: ask Square about this person's pending
    checkouts (last 30 days) and credit any that were paid. Returns tokens credited."""
    got = 0
    for snap in db.collection("squareCheckouts").where("uid", "==", uid).where("status", "==", "pending").limit(5).stream():
        co = snap.to_dict()
        if now_ms - (co.get("createdAt") or 0) > 30 * 86400000 or co.get("env", "sandbox") != _square_env():
            continue
        try:
            order = _square_api("GET", "/v2/orders/%s" % urllib.parse.quote(snap.id)).get("order") or {}
            for tender in order.get("tenders") or []:
                pid = tender.get("payment_id") or tender.get("id")
                if not pid:
                    continue
                pay = _square_api("GET", "/v2/payments/%s" % urllib.parse.quote(pid)).get("payment") or {}
                if pay.get("order_id") != snap.id:
                    continue
                why = square_credit(db, pay, "reconcile-" + pid, "reconcile", now_ms)
                print("[square] reconcile order=%s status=%s -> %s" % (snap.id, pay.get("status"), why or "credited"))
                if not why:
                    got += co.get("tokens") or 0
        except TWError:
            continue
    return got


# ---------------------------------------------------------------- XP (server-decided)
#   xp_award {type, refId}  -> {awarded, xp, streakDays}
# The browser used to write users/{uid}.xp itself. Now only this function does: the
# amount comes from functions/xp.py, never from the browser, and the activity ledger
# users/{uid}/activity/{type:refId} (the dedup record) is server-only too.
# Anonymous visitors earn XP as before (it carries over when they sign up).
#   xpState/{uid}   server-only: {day, counts: {type: n}, xp} for the daily limits

@https_fn.on_call()
def xp_award(req: https_fn.CallableRequest):
    a = req.auth
    if not a or not a.uid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Sign in to earn XP.")
    uid, data = a.uid, req.data or {}
    kind = str(data.get("type") or "")[:40]
    db, now_ms = firestore.client(), int(_time.time() * 1000)
    today = _ny_day(now_ms)
    try:
        amount, ref_id, why = XP.decide(kind, data.get("refId"), today)
        if why:
            return {"awarded": False, "reason": why}
        # alert-open must name a real alert (teaser docs live in alerts/)
        if kind == "alert-open" and not db.collection("alerts").document(ref_id).get().exists:
            return {"awarded": False, "reason": "bad-ref"}
        # referral XP only when that friend's referral record really names you
        if kind == "referral":
            r = db.collection("referrals").document(ref_id).get()
            if not r.exists or (r.to_dict() or {}).get("referrer") != uid:
                return {"awarded": False, "reason": "bad-ref"}
        if kind == "referral-welcome" and not db.collection("referrals").document(uid).get().exists:
            return {"awarded": False, "reason": "bad-ref"}

        return xp_grant(db, uid, kind, ref_id, now_ms)
    except https_fn.HttpsError:
        raise
    except Exception as e:
        print("[xp] award failed: %s" % type(e).__name__)
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INTERNAL, "Something went wrong. Try again.")


def xp_grant(db, uid, kind, ref_id, now_ms, counted=False):
    """Award XP once per (kind, refId), with the daily limits in functions/xp.py, in one
    transaction. `counted=True` (server-side grants such as practice fills) numbers the refId
    itself: "<today>:<n>" with n = how many of that kind were granted today + 1."""
    today, yesterday = _ny_day(now_ms), _ny_day(now_ms, -1)
    uref = db.collection("users").document(uid)
    sref = db.collection("xpState").document(uid)
    src = XP.SOURCES.get(kind, ("platform", kind))

    @firestore.transactional
    def txn(t):
        st, us = sref.get(transaction=t), uref.get(transaction=t)
        u = us.to_dict() if us.exists else {}
        s = st.to_dict() if st.exists else {}
        if s.get("day") != today:
            s = {"day": today, "counts": {}, "xp": 0}
        ref = "%s:%d" % (today, (s.get("counts") or {}).get(kind, 0) + 1) if counted else ref_id
        eref = uref.collection("activity").document((kind + ":" + ref)[:400].replace("/", "_"))
        ev = eref.get(transaction=t)
        before = max(0, int(u.get("xp") or 0))
        upd, awarded = {}, False
        if not ev.exists:
            amt, _, why2 = XP.decide(kind, ref, today, s.get("counts") or {}, int(s.get("xp") or 0))
            if not why2:
                upd["xp"] = before + amt
                t.set(eref, {"type": kind, "refId": ref, "xp": amt, "source": src[0], "label": src[1],
                             "createdAt": firestore.SERVER_TIMESTAMP})
                counts = dict(s.get("counts") or {})
                counts[kind] = counts.get(kind, 0) + 1
                t.set(sref, {"day": today, "counts": counts, "xp": int(s.get("xp") or 0) + amt})
                awarded = True
        if kind == "alert-open":
            upd.update(XP.streak_update(u, today, yesterday))
        if upd:
            t.set(uref, upd, merge=True)
        return {"awarded": awarded, "before": before, "xp": upd.get("xp", before),
                "streakDays": upd.get("streakDays", int(u.get("streakDays") or 0))}

    return txn(db.transaction())


# ---------------------------------------------------------------- account deletion
#   account_delete {confirm: "DELETE"} -> {deleted: true}
# Deletes the signed-in person's account and personal data, as the Privacy Policy
# promises. Needs a sign-in from the last 10 minutes (the page re-asks for it), so a
# stolen, idle session can't wipe an account. Kept on purpose (legal/tax/fraud records):
# purchases/*, squareCheckouts/*, squareEvents/*. Past Trade War match results stay with
# the match (other players' standings depend on them) but the account behind them is gone.

ACCOUNT_DOCS = ("users", "wallets", "practiceProfiles", "practiceAccounts", "practiceArchive", "traders", "strategyVotes", "referrals",
                "cosmetics", "twRecords", "xpState")
ACCOUNT_SUBCOLLECTIONS = {"users": ("activity", "inbox", "realTrades"), "wallets": ("ledger",), "traders": ("realLog",), "practiceAccounts": ("history",)}


def _delete_collection(ref, batch_size=200):
    while True:
        docs = list(ref.limit(batch_size).stream())
        if not docs:
            return
        b = ref._client.batch()
        for d in docs:
            b.delete(d.reference)
        b.commit()


def account_recent_login(tok, now_s, max_age_s=600):
    """Pure: True if the ID token's sign-in time is within max_age_s."""
    try:
        return now_s - int(tok.get("auth_time") or 0) <= max_age_s
    except (TypeError, ValueError):
        return False


@https_fn.on_call(timeout_sec=120)
def account_delete(req: https_fn.CallableRequest):
    from firebase_admin import auth as fb_auth
    a = req.auth
    if not a or not a.uid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Sign in first.")
    if (req.data or {}).get("confirm") != "DELETE":
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Confirmation missing.")
    if not account_recent_login(a.token or {}, int(_time.time())):
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Please sign in again, then delete.")
    uid, db = a.uid, firestore.client()
    try:
        # leave a community (keeps its counters right); founders' communities stay, minus them
        ms = db.collection("communityMembers").document(uid).get()
        m = ms.to_dict() if ms.exists else {}
        if m.get("cid"):
            cs = db.collection("communities").document(m["cid"]).get()

            @firestore.transactional
            def leave(t):
                _leave_writes(t, db, uid, m, cs.to_dict() if cs.exists else None)
            leave(db.transaction())
            if cs.exists and (cs.to_dict() or {}).get("founder") == uid:
                db.collection("communities").document(m["cid"]).update({"founderName": ""})
        db.collection("communityMembers").document(uid).delete()

        # squads: leave each; a squad you own with nobody else in it is deleted
        for sq in db.collection("squads").where("members", "array_contains", uid).stream():
            d = sq.to_dict() or {}
            others = [x for x in d.get("members") or [] if x != uid]
            if not others:
                _delete_collection(sq.reference.collection("messages"))
                sq.reference.delete()
                if d.get("code"):
                    db.collection("squadCodes").document(d["code"]).delete()
            else:
                upd = {"members": others, "names." + uid: firestore.DELETE_FIELD}
                if d.get("owner") == uid:
                    upd["owner"] = others[0]
                sq.reference.update(upd)

        for snap in db.collection("usernames").where("uid", "==", uid).stream():
            snap.reference.delete()
        for snap in db.collection("pushTokens").where("uid", "==", uid).stream():
            snap.reference.delete()
        for col in ACCOUNT_DOCS:
            ref = db.collection(col).document(uid)
            for sub in ACCOUNT_SUBCOLLECTIONS.get(col, ()):
                _delete_collection(ref.collection(sub))
            ref.delete()
        fb_auth.delete_user(uid)
        print("[account] deleted one account")
        return {"deleted": True}
    except Exception as e:
        print("[account] delete failed: %s" % type(e).__name__)
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INTERNAL, "Couldn't delete everything. Email support and we'll finish it.")


# ---------------------------------------------------------------- practice account (server-side)
# The $10,000 practice account lives on the server (decided 2026-10-07; engine in
# functions/practice.py, unit tests in scripts/practice_test.py):
#   practiceAccounts/{uid}            the account (cash, positions, open orders, stats). Owner reads, server writes.
#   practiceAccounts/{uid}/history/*  closed orders, fills and trades. Owner reads, server writes.
#   practiceArchive/{uid}             the old browser-written account, kept read-only (unverified).
#   practiceProfiles/{uid}            public leaderboard numbers, written here (same shape as before).
# Callables: practice_account (create), practice_order, practice_cancel, practice_reset,
# practice_settings. Fills happen in practice_pass (after every price refresh) on prices
# observed after each order was placed; practice_revalue_all marks every account after the close.

import secrets as _secrets

def _pr_universe():
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "practice_universe.json"), encoding="utf-8") as f:
            rows = json.load(f)["symbols"]
        return frozenset(str(r["sym"]).upper() for r in rows if str(r.get("group") or "") != "Crypto")
    except Exception:
        return frozenset(PRACTICE_SYMBOLS)


PRACTICE_UNIVERSE = _pr_universe()


def _pr_user(req):
    a = req.auth
    if not a or not a.uid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Sign in to use your practice account.")
    tok = a.token or {}
    if ((tok.get("firebase") or {}).get("sign_in_provider")) == "anonymous":
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Create a free account to start your practice account.")
    return a.uid, tok


def _pr_quotes(db):
    """{SYM: {"c": price, "t": epoch s}} from markets/quotes (the server's own prices)."""
    snap = db.collection("markets").document("quotes").get()
    out = {}
    for sym, q in (((snap.to_dict() or {}).get("quotes") or {}) if snap.exists else {}).items():
        try:
            c = float(q.get("c"))
            if c > 0:
                out[str(sym)] = {"c": c, "t": int(q.get("t") or 0)}
        except (TypeError, ValueError, AttributeError):
            continue
    return out


def _pr_prices(quotes):
    return {s: q["c"] for s, q in quotes.items()}


def _pr_bars(raw_bars):
    """ms_run_quotes bars {SYM: ["YYYY-MM-DD HH:MM,o,h,l,c,v", ...]} -> {SYM: [[label, o, h, l, c, v], ...]}."""
    out = {}
    for sym, rows in (raw_bars or {}).items():
        lst = []
        for r in rows:
            p = str(r).split(",")
            try:
                lst.append([p[0], float(p[1]), float(p[2]), float(p[3]), float(p[4]), float(p[5]) if len(p) > 5 else 0])
            except (IndexError, ValueError):
                continue
        out[sym] = lst
    return out


def _pr_identity(db, uid, tok):
    t = db.collection("traders").document(uid).get()
    d = (t.to_dict() or {}) if t.exists else {}
    photo = d.get("avatar") or d.get("photo") or (tok.get("picture") if tok else None)
    if not (isinstance(photo, str) and (photo.startswith("https://") or photo.startswith("data:image/")) and len(photo) <= 20000):
        photo = None
    name = d.get("name") or ((tok or {}).get("name") or "").split(" ")[0] or "Trader-" + uid[:4]
    return {"name": str(name)[:24], "username": d.get("username") if isinstance(d.get("username"), str) else None, "photo": photo}


def _pr_events(db, uid, events, t=None):
    col = db.collection("practiceAccounts").document(uid).collection("history")
    for e in events:
        rec = dict(e.get("order") or e.get("trade") or {k: v for k, v in e.items() if k != "kind"})
        rec["kind"] = e["kind"]
        rec["at"] = rec.get("closedAt") or rec.get("at") or int(_time.time() * 1000)
        ref = col.document()
        if t is not None:
            t.set(ref, rec)
        else:
            ref.set(rec)


def _pr_after(db, uid, events, now_ms, tok=None):
    """Outside the account transaction: XP for fills/wins, then the public profile."""
    if any(e["kind"] == "fill" for e in events):
        try:  # onboarding checklist: "Make your first trade" (zelos-profile.js reads onboard.trade)
            db.collection("users").document(uid).set({"onboard": {"trade": True}}, merge=True)
        except Exception as ex:
            print("[practice] onboard flag failed:", type(ex).__name__)
    for e in events:
        try:
            if e["kind"] == "fill":
                xp_grant(db, uid, "practice-trade", None, now_ms, counted=True)
            if e["kind"] == "trade" and e["trade"]["pnl"] > 0:
                xp_grant(db, uid, "practice-win", None, now_ms, counted=True)
        except Exception as ex:
            print("[practice] xp grant failed:", type(ex).__name__)
    _pr_publish(db, uid, now_ms, tok)


def _pr_publish(db, uid, now_ms, tok=None, quotes=None, acct=None):
    ref = db.collection("practiceAccounts").document(uid)
    if acct is None:
        snap = ref.get()
        if not snap.exists:
            return
        acct = snap.to_dict()
    pref = db.collection("practiceProfiles").document(uid)
    if not acct.get("publicProfile", True):
        pref.delete()
        return
    quotes = quotes if quotes is not None else _pr_quotes(db)
    eq = PR.equity(acct, _pr_prices(quotes))
    old = pref.get()
    keep = (old.to_dict() or {}) if old.exists else {}
    prof = PR.build_profile(acct, eq, now_ms, _pr_identity(db, uid, tok), _user_xp(db, uid), keep)
    pref.set(prof)


def _pr_http(e):
    return https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, str(e))


def _pr_call(fn):
    def wrapper(req):
        uid, tok = _pr_user(req)
        try:
            return fn(req, firestore.client(), uid, tok, int(_time.time() * 1000))
        except PR.OrderError as e:
            raise _pr_http(e)
        except https_fn.HttpsError:
            raise
        except Exception as e:
            print("[practice] %s failed: %s" % (fn.__name__, type(e).__name__))
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INTERNAL, "Something went wrong. Nothing was changed. Try again.")
    wrapper.__name__ = fn.__name__
    return wrapper


@https_fn.on_call()
@_pr_call
def practice_account(req, db, uid, tok, now_ms):
    """Open your server practice account ($10,000) if you don't have one. The first time, the
    old browser-written account is copied to practiceArchive/{uid} (read-only, unverified)."""
    ref = db.collection("practiceAccounts").document(uid)
    aref = db.collection("practiceArchive").document(uid)
    uref = db.collection("users").document(uid)

    @firestore.transactional
    def txn(t):
        snap = ref.get(transaction=t)
        if snap.exists:
            return False
        arc, u = aref.get(transaction=t), uref.get(transaction=t)
        acct = PR.new_account(now_ms)
        PR.mark(acct, PR.START_CASH, now_ms, 0)
        if not arc.exists and u.exists:
            old = PR.archive_classic((u.to_dict() or {}).get("practice"))
            if old:
                old["archivedAt"] = now_ms
                t.set(aref, old)
                acct["archivedClassic"] = True
        t.set(ref, acct)
        return True

    created = txn(db.transaction())
    if created:
        _pr_publish(db, uid, now_ms, tok)
    return {"created": created}


@https_fn.on_call()
@_pr_call
def practice_order(req, db, uid, tok, now_ms):
    """{sym, side, type, qty, limit?, stop?, tif?, bracket?: {sl?, tp?}} -> {order}. The order is
    checked here and fills later, on prices observed after this moment (see functions/practice.py)."""
    quotes = _pr_quotes(db)
    data = req.data if isinstance(req.data, dict) else {}
    sym = str(data.get("sym") or "").upper()
    ref = db.collection("practiceAccounts").document(uid)
    oid = _secrets.token_hex(8)

    @firestore.transactional
    def txn(t):
        snap = ref.get(transaction=t)
        if not snap.exists:
            raise PR.OrderError("Open your practice account first.")
        acct = snap.to_dict()
        o = PR.validate_order(acct, data, (quotes.get(sym) or {}).get("c"), PRACTICE_UNIVERSE, now_ms, oid)
        PR.add_order(acct, o)
        acct["updatedAt"] = now_ms
        t.set(ref, acct)
        return o

    return {"order": txn(db.transaction())}


@https_fn.on_call()
@_pr_call
def practice_cancel(req, db, uid, tok, now_ms):
    """{orderId} -> {cancelled: true}"""
    oid = (req.data or {}).get("orderId") if isinstance(req.data, dict) else None
    if not isinstance(oid, str) or not PR.ORDER_ID_RE.match(oid):
        raise PR.OrderError("That order isn't open any more.")
    ref = db.collection("practiceAccounts").document(uid)

    @firestore.transactional
    def txn(t):
        snap = ref.get(transaction=t)
        if not snap.exists:
            raise PR.OrderError("Open your practice account first.")
        acct = snap.to_dict()
        events = PR.cancel_order(acct, oid, now_ms)
        acct["updatedAt"] = now_ms
        t.set(ref, acct)
        _pr_events(db, uid, events, t)
        return True

    return {"cancelled": txn(db.transaction())}


@https_fn.on_call()
@_pr_call
def practice_reset(req, db, uid, tok, now_ms):
    """Back to $10,000 (only once the account is below $2,500). Counts as a public reset."""
    quotes = _pr_quotes(db)
    ref = db.collection("practiceAccounts").document(uid)

    @firestore.transactional
    def txn(t):
        snap = ref.get(transaction=t)
        if not snap.exists:
            raise PR.OrderError("Open your practice account first.")
        acct = snap.to_dict()
        fresh, events = PR.reset_account(acct, PR.equity(acct, _pr_prices(quotes)), now_ms)
        t.set(ref, fresh)
        _pr_events(db, uid, events, t)
        return fresh["resets"]

    resets = txn(db.transaction())
    _pr_publish(db, uid, now_ms, tok, quotes)
    return {"resets": resets}


@https_fn.on_call()
@_pr_call
def practice_settings(req, db, uid, tok, now_ms):
    """{publicProfile: bool}: show or hide your numbers on the public leaderboards."""
    data = req.data if isinstance(req.data, dict) else {}
    if not isinstance(data.get("publicProfile"), bool):
        raise PR.OrderError("Nothing to change.")
    ref = db.collection("practiceAccounts").document(uid)
    if not ref.get().exists:
        raise PR.OrderError("Open your practice account first.")
    ref.update({"publicProfile": data["publicProfile"], "updatedAt": now_ms})
    _pr_publish(db, uid, now_ms, tok)
    return {"publicProfile": data["publicProfile"]}


def practice_pass(db, quotes, raw_bars, now_ms):
    """After a price refresh: fill or expire open orders in every account that has some."""
    q = {s: {"c": v.get("c"), "t": v.get("t")} for s, v in (quotes or {}).items() if v and v.get("c")}
    bars = _pr_bars(raw_bars)
    fills = accounts = 0
    for snap in db.collection("practiceAccounts").where("openOrders", ">", 0).stream():
        uid = snap.id
        ref = snap.reference

        @firestore.transactional
        def txn(t):
            s2 = ref.get(transaction=t)
            acct = s2.to_dict() if s2.exists else None
            if not acct or not acct.get("orders"):
                return []
            events = PR.process_orders(acct, q, bars, now_ms)
            if events:
                acct["updatedAt"] = now_ms
                t.set(ref, acct)
                _pr_events(db, uid, events, t)
            return events

        try:
            events = txn(db.transaction())
        except Exception as e:
            print("[practice] pass failed for one account:", type(e).__name__)
            continue
        accounts += 1
        if any(e["kind"] == "fill" for e in events):
            fills += sum(1 for e in events if e["kind"] == "fill")
            try:
                _pr_after(db, uid, events, now_ms)
            except Exception as e:
                print("[practice] after-fill update failed:", type(e).__name__)
    return {"accounts": accounts, "fills": fills}


def practice_revalue_all(db, now_ms):
    """After the close: mark every account at the closing prices (peak, period baselines, daily
    history) and refresh its public profile."""
    quotes = _pr_quotes(db)
    prices = _pr_prices(quotes)
    n = 0
    for snap in db.collection("practiceAccounts").stream():
        try:
            acct = snap.to_dict()
            eq = PR.equity(acct, prices)
            PR.mark(acct, eq, now_ms, _user_xp(db, snap.id))
            snap.reference.update({"peak": acct["peak"], "periods": acct["periods"], "hist": acct["hist"], "markedAt": now_ms})
            _pr_publish(db, snap.id, now_ms, None, quotes, acct)
            n += 1
        except Exception as e:
            print("[practice] revalue failed for one account:", type(e).__name__)
    return n
