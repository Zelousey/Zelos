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

Both endpoints check a shared secret before doing anything, so if either URL
ever leaked, it could only trigger that one narrow action - never read or
write anything else in the database, and never touch Gumroad or Robinhood
directly.
"""
import json
import os
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
