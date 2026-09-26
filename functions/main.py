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
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

from firebase_functions import https_fn
from firebase_admin import initialize_app, auth, firestore

initialize_app()

ALLOWED_STRATEGIES = {"swing-trader", "breakout-rider", "options-scanner"}

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

    expected_secret = os.environ.get("ZELOS_PUBLISH_SECRET", "")
    provided_secret = req.headers.get("X-Zelos-Secret", "")
    if not expected_secret or provided_secret != expected_secret:
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
        return https_fn.Response("Firestore write failed: %s" % (e,), status=500)

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
    expected_secret = os.environ.get("ZELOS_PUBLISH_SECRET", "")
    provided_secret = req.headers.get("X-Zelos-Secret", "")
    if not expected_secret or provided_secret != expected_secret:
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
        return https_fn.Response("Firestore write failed: %s" % (e,), status=500)
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

    expected_secret = os.environ.get("ZELOS_PUBLISH_SECRET", "")
    provided_secret = req.args.get("token", "")
    if not expected_secret or provided_secret != expected_secret:
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
        return https_fn.Response("Firestore write failed: %s" % (e,), status=500)

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
        return alert_id, "Firestore write failed: %s" % (e,)
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

    expected_secret = os.environ.get("ZELOS_PUBLISH_SECRET", "")
    provided_secret = req.headers.get("X-Zelos-Secret", "")
    if not expected_secret or provided_secret != expected_secret:
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

    expected_secret = os.environ.get("ZELOS_PUBLISH_SECRET", "")
    provided_secret = req.headers.get("X-Zelos-Secret", "")
    if not expected_secret or provided_secret != expected_secret:
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
# only calls Finnhub between 9:25 and 16:10. It fetches one quote per symbol
# (30 calls, inside Finnhub's free 60/minute) and writes them all to the
# public Firestore doc markets/quotes, which every open practice page is
# listening to. That way the API key stays in this function's secret config
# and never reaches a browser, and Finnhub sees one caller no matter how many
# people are on the site.
#
# After the close it also appends the day's bar (open/high/low/close from the
# quote; the quote has no volume, so that's stored as 0) to markets/dailyBars,
# so charts keep extending day by day between manual data refreshes.
#
# Setup: firebase functions:secrets:set FINNHUB_API_KEY, then deploy. See
# docs/practice-account.md.
# ---------------------------------------------------------------------------
from zoneinfo import ZoneInfo
from firebase_functions import scheduler_fn

PRACTICE_SYMBOLS = [
    "AAPL", "AMZN", "MSFT", "GOOGL", "NFLX", "CRWD", "UBER", "SMCI", "AVGO", "SOFI",
    "NVDA", "AMD", "TSLA", "META", "PLTR", "COIN", "SHOP", "MU", "SPY", "QQQ",
    "JPM", "XOM", "LLY", "COST", "HOOD", "ANET", "DKNG", "RBLX", "SNOW", "ABNB",
]
NY = ZoneInfo("America/New_York")
DAILY_BARS_KEEP = 90


def _finnhub_quote(symbol, api_key, timeout=8):
    req = urllib.request.Request(
        "https://finnhub.io/api/v1/quote?symbol=" + symbol,
        headers={"X-Finnhub-Token": api_key, "User-Agent": "zelos-practice/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _fetch_all_quotes(api_key):
    """Returns (quotes, error). error is 'auth' for a bad key, else a short message."""
    quotes, last_error = {}, None
    for sym in PRACTICE_SYMBOLS:
        try:
            q = _finnhub_quote(sym, api_key)
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                return {}, "auth"  # bad or revoked key: no point trying the rest
            last_error = "http %d" % e.code
            continue
        except Exception as e:  # timeout, DNS, bad JSON
            last_error = type(e).__name__
            continue
        # Finnhub answers unknown symbols with all zeros
        if not q or not q.get("c"):
            continue
        quotes[sym] = {k: q.get(k) for k in ("c", "o", "h", "l", "pc", "t")}
    return quotes, (None if quotes else (last_error or "no data"))


@scheduler_fn.on_schedule(
    schedule="* 9-16 * * 1-5",
    timezone=scheduler_fn.Timezone("America/New_York"),
    secrets=["FINNHUB_API_KEY"],
    timeout_sec=55,
    memory=256,
)
def refresh_quotes(event: scheduler_fn.ScheduledEvent) -> None:
    now = datetime.now(NY)
    minutes = now.hour * 60 + now.minute
    if minutes < 9 * 60 + 25 or minutes > 16 * 60 + 10:
        return
    api_key = os.environ.get("FINNHUB_API_KEY", "").strip()
    db = firestore.client()
    doc = db.collection("markets").document("quotes")
    if not api_key:
        doc.set({"error": "missing-key", "checkedAt": now.isoformat()}, merge=True)
        return

    quotes, error = _fetch_all_quotes(api_key)
    if error and not quotes:
        # keep the last good prices; just flag the problem so the page can say so
        doc.set({"error": error, "checkedAt": now.isoformat()}, merge=True)
        print("[refresh_quotes] Finnhub error:", error)
        return

    today = now.strftime("%Y-%m-%d")
    session_open = 9 * 60 + 30 <= minutes < 16 * 60
    doc.set({
        "source": "finnhub",
        "updatedAt": now.isoformat(),
        "date": today,
        "marketOpen": session_open,
        "error": None,
        "quotes": quotes,
    })

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
