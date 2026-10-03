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
check "Intraday, 5-minute bars"          "intraday?symbols=AAPL&interval=5min&date_from=${FROM}&limit=5"
check "Country ETF (globe)"              "eod?symbols=EWJ,EWC&date_from=${FROM}&limit=10"
unset KEY
echo "Needed: the first, second and fourth lines say 'works'. 5-minute bars need the Professional plan (not required)."
