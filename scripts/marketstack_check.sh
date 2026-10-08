#!/usr/bin/env bash
# Is the Marketstack key set up right, and what does the plan include?
# Prints only "works" / "not in your plan" and the field names it saw, never the key or prices.
#   bash scripts/marketstack_check.sh
set -u
KEY="$(firebase functions:secrets:access MARKETSTACK_API_KEY 2>/dev/null | tr -d '[:space:]')"
if [ -z "$KEY" ]; then echo "Couldn't read MARKETSTACK_API_KEY. Set it first: firebase functions:secrets:set MARKETSTACK_API_KEY"; exit 1; fi
FROM="$(date -d '-6 days' +%F 2>/dev/null || date +%F)"
check() {
  local label="$1" path="$2"
  local body; body="$(curl -s "https://api.marketstack.com/v2/${path}&access_key=${KEY}")"
  python3 - "$label" "$body" <<'PY'
import json, sys
label, body = sys.argv[1], sys.argv[2]
try:
    d = json.loads(body)
except Exception:
    print("%-34s couldn't reach Marketstack" % label); sys.exit()
if isinstance(d, dict) and isinstance(d.get("error"), dict):
    code = d["error"].get("code", "")
    msg = {"invalid_access_key": "key rejected", "usage_limit_reached": "monthly requests used up",
           "function_access_restricted": "not in your plan"}.get(code, code)
    print("%-34s %s" % (label, msg))
else:
    rows = d.get("data") or []
    syms = sorted({r.get("symbol") for r in rows if isinstance(r, dict)})
    print("%-34s works (%d rows, symbols %s, fields: %s)" % (label, len(rows), ",".join(syms), ",".join(sorted(rows[0].keys())[:12]) if rows else "-"))
PY
}
echo "Marketstack plan check - $(date)"
check "Daily prices (stocks + ETFs)"     "eod?symbols=AAPL,SPY,XLK&date_from=${FROM}&limit=20"
check "Intraday, 15-minute bars"         "intraday?symbols=AAPL,SPY&interval=15min&date_from=${FROM}&limit=20"
check "Intraday, 1-minute bars"          "intraday?symbols=AAPL,SPY&interval=1min&date_from=${FROM}&limit=20"
SINCE="$(date -u -d "-3 days" +%Y-%m-%dT13:30:00 2>/dev/null || date -u +%Y-%m-%dT13:30:00)%2B0000"  # "+" must be sent as %2B
check "1-minute bars since a time"       "intraday?symbols=AAPL&interval=1min&date_from=${SINCE}&limit=5"
check "Country ETF (globe)"              "eod?symbols=EWJ,EWC&date_from=${FROM}&limit=10"
unset KEY
echo "Needed: 'Daily prices', 'Intraday, 15-minute bars' and 'Country ETF' say 'works'."
echo "For prices every minute (functions/.env QUOTE_EVERY_MIN=1, MS_INTERVAL=1min): both 1-minute lines must say 'works'."
echo "If they say 'not in your plan', set QUOTE_EVERY_MIN=15 and MS_INTERVAL=15min in functions/.env before deploying."
