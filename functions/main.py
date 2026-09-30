"""
Zelos Cloud Functions - leaderboard-agentictrading project.

Runs inside the leaderboard-agentictrading Firebase project, so both functions
below can read/write that project's Firestore using the project's own built-in
permissions - no downloaded service-account key needed anywhere.

publish_alert          - a scheduled Claude task calls this over plain HTTPS
                          with a shared secret to publish a generic Zelos
                          alert.
gumroad_ping           - Gumroad calls this itself (its account-wide "Ping"
                          webhook, configured once in Gumroad's own
                          Settings > Advanced) on every sale, so a buyer's
                          ownedSkills gets set automatically instead of
                          relying on them to self-report a purchase.
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
write anything else in the database, and never touch Gumroad, Robinhood, or
Buffer directly.
"""
import hmac
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from firebase_functions import https_fn
from firebase_admin import initialize_app, auth, firestore

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

# Gumroad product permalink -> Zelos skill id. Permalinks are the part after
# gumroad.com/l/ in each product's URL (see going-to-gumroad*.html on the site).
# Keys are compared case-insensitively.
GUMROAD_PERMALINK_TO_SKILL = {
    "agentictrading": "swing-trader",
    "breakoutrider": "breakout-rider",
    "optionsscanner": "options-scanner",
}


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


@https_fn.on_request(secrets=["ZELOS_PUBLISH_SECRET"])
def gumroad_ping(req: https_fn.Request) -> https_fn.Response:
    """Gumroad's account-wide sale-notification webhook.

    Gumroad POSTs form-encoded data to whatever URL you configure in Settings >
    Advanced > Ping - for EVERY sale across every product, and it cannot send a
    custom header, so the shared secret rides along as a query-string token on
    the URL you paste into Gumroad instead: .../gumroad_ping?token=<secret>.
    That URL lives only in your own Gumroad account settings, never published
    anywhere on the site.
    """
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    if not _secret_ok(req.args.get("token", "")):
        return https_fn.Response("Unauthorized", status=401)

    form = req.form
    email = (form.get("email") or "").strip().lower()
    permalink = (form.get("permalink") or form.get("short_product_id") or "").strip().lower()
    is_test = (form.get("test") or "").strip().lower() == "true"

    skill_id = GUMROAD_PERMALINK_TO_SKILL.get(permalink)

    # Always 200 back to Gumroad even when there's nothing useful to do - a
    # non-2xx response makes Gumroad retry the same ping repeatedly, and none
    # of these are actually errors on Gumroad's end.
    if not email or not skill_id:
        return https_fn.Response(
            json.dumps({"ok": True, "skipped": "no matching email/permalink"}),
            status=200, content_type="application/json",
        )
    if is_test:
        return https_fn.Response(
            json.dumps({"ok": True, "skipped": "test ping, no write"}),
            status=200, content_type="application/json",
        )

    db = firestore.client()

    # Always record it in pendingOwnership first - this is the durable source of
    # truth a buyer claims into their own account doc the next time they sign
    # in with this same email (see claimPendingOwnership() in dashboard.html /
    # my-zelos.html). Keeping this write even when we can also apply it directly
    # below means nothing is lost if the direct write fails or the account gets
    # created under this email later.
    try:
        db.collection("pendingOwnership").document(email).set(
            {
                "skills": firestore.ArrayUnion([skill_id]),
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
    except Exception as e:
        return _write_failed("gumroad_ping", e)

    # Best-effort: if this email already has a Zelos account, apply it right
    # away too, so they don't have to sign out/in again to see it.
    try:
        user = auth.get_user_by_email(email)
        db.collection("users").document(user.uid).set(
            {"ownedSkills": firestore.ArrayUnion([skill_id])}, merge=True
        )
    except auth.UserNotFoundError:
        pass
    except Exception:
        pass  # never fail the webhook over this optional convenience step

    return https_fn.Response(
        json.dumps({"ok": True, "skill": skill_id}),
        status=200, content_type="application/json",
    )


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
    Same shared-secret gate as publish_alert and gumroad_ping: this can only
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

TW_BUYIN_MIN, TW_BUYIN_MAX = 100, 100000
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
        raise TWError("INVALID_ARGUMENT", "Buy-in must be a multiple of $100 between $100 and $100,000 (virtual).")
    if days not in TW_DAYS:
        raise TWError("INVALID_ARGUMENT", "Length must be 1, 3, 7, 14 or 30 days.")
    if not (2 <= max_players <= TW_MAX_PLAYERS):
        raise TWError("INVALID_ARGUMENT", "Player limit must be between 2 and %d." % TW_MAX_PLAYERS)
    return name, buy_in, days, max_players


def tw_new_account(name, buy_in, now_ms):
    return {"name": name, "start": buy_in, "cash": buy_in, "equity": buy_in, "pnl": 0.0, "pnlPct": 0.0,
            "trades": 0, "wins": 0, "losses": 0, "realized": 0.0, "lastTradeAt": 0, "updatedAt": now_ms}


def tw_new_book():
    return {"positions": {}, "fills": []}


def tw_apply_trade(acct, book, sym, side, qty, price, now_ms):
    """Pure: returns (acct, book, fill) after one market order, or raises TWError."""
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
    fill = {"sym": sym, "side": side, "qty": qty, "price": _r2(price), "at": now_ms}
    if side == "buy":
        if cost > acct["cash"] + 1e-9:
            raise TWError("FAILED_PRECONDITION", "Not enough match cash: %d shares of %s cost $%s and you have $%s." % (qty, sym, format(cost, ",.2f"), format(acct["cash"], ",.2f")))
        new_qty = pos["qty"] + qty
        pos["avg"] = _r2((pos["qty"] * pos["avg"] + cost) / new_qty)
        pos["qty"] = new_qty
        acct["cash"] = _r2(acct["cash"] - cost)
    else:
        if qty > pos["qty"]:
            raise TWError("FAILED_PRECONDITION", "You only hold %d shares of %s (Trade War is long only)." % (pos["qty"], sym))
        gain = _r2((price - pos["avg"]) * qty)
        fill["pnl"] = gain
        acct["realized"] = _r2(acct.get("realized", 0) + gain)
        if gain > 0:
            acct["wins"] = acct.get("wins", 0) + 1
        elif gain < 0:
            acct["losses"] = acct.get("losses", 0) + 1
        pos["qty"] -= qty
        acct["cash"] = _r2(acct["cash"] + cost)
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


def tw_rank(rows):
    """Rows of {uid, pnlPct, pnl, ...} ranked by % P&L (equal capital, so % and $ agree)."""
    rows = sorted(rows, key=lambda r: (-(r.get("pnlPct") or 0), -(r.get("pnl") or 0), r.get("uid", "")))
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
                        "createdAt": now_ms, "startAt": None, "endAt": None, "results": None, "markedAt": None,
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
        t.update(war_ref, {"status": "active", "startAt": now_ms, "endAt": now_ms + war["days"] * 86400000})

    txn(db.transaction())
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
            raise TWError("FAILED_PRECONDITION", "This Trade War isn't live yet." if war["status"] == "lobby" else "This Trade War is over.")
        if now_ms >= (war.get("endAt") or 0):
            raise TWError("FAILED_PRECONDITION", "This Trade War has ended. Final results are being tallied.")
        acct = acct_ref.get(transaction=t).to_dict()
        book = book_ref.get(transaction=t).to_dict() or tw_new_book()
        acct, book, fill = tw_apply_trade(acct, book, sym, side, qty, prices.get(sym), now_ms)
        acct = tw_mark(acct, book, prices, now_ms)
        t.set(acct_ref, acct)
        t.set(book_ref, book)
        return fill, acct

    fill, acct = txn(db.transaction())
    return {"fill": fill, "cash": acct["cash"], "equity": acct["equity"]}


def tw_mark_all(db, now_ms, prices):
    """Revalue every active match; close the ones whose time is up. Returns #matches touched."""
    n = 0
    for wsnap in db.collection("tradeWars").where("status", "==", "active").stream():
        war, ref = wsnap.to_dict(), wsnap.reference
        rows, batch = [], db.batch()
        for uid in war.get("players") or []:
            a = ref.collection("accounts").document(uid).get()
            b = ref.collection("books").document(uid).get()
            if not a.exists:
                continue
            acct = tw_mark(a.to_dict(), (b.to_dict() if b.exists else None) or tw_new_book(), prices, now_ms)
            batch.set(a.reference, acct)
            rows.append({"uid": uid, "name": acct.get("name"), "start": acct["start"], "final": acct["equity"],
                         "pnl": acct["pnl"], "pnlPct": acct["pnlPct"], "trades": acct.get("trades", 0),
                         "wins": acct.get("wins", 0), "losses": acct.get("losses", 0)})
        update = {"markedAt": now_ms}
        if now_ms >= (war.get("endAt") or 0):
            update.update({"status": "ended", "results": tw_rank(rows), "endedAt": now_ms})
        batch.update(ref, update)
        batch.commit()
        n += 1
    return n


@scheduler_fn.on_schedule(
    schedule="*/5 * * * *",
    timezone=scheduler_fn.Timezone("America/New_York"),
    timeout_sec=120,
    memory=256,
)
def tw_mark_matches(event: scheduler_fn.ScheduledEvent) -> None:
    db = firestore.client()
    prices, _, _ = _tw_prices(db)
    try:
        n = tw_mark_all(db, int(_time.time() * 1000), prices)
        if n:
            print("[tw_mark_matches] revalued %d active matches" % n)
    except Exception as e:
        print("[tw_mark_matches] failed:", type(e).__name__)
