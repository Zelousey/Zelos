#!/usr/bin/env bash
# What does our FMP plan include? Tries each feature once and prints only
# "included" / "not in your plan" — never the key, never the data.
#   bash scripts/fmp_check.sh
set -u
KEY="$(firebase functions:secrets:access FMP_API_KEY 2>/dev/null | tr -d '[:space:]')"
if [ -z "$KEY" ]; then echo "Couldn't read FMP_API_KEY (run this from ~/Zelos, logged in to Firebase)."; exit 1; fi
TODAY="$(date +%F)"; WEEK="$(date -d '+7 days' +%F 2>/dev/null || date +%F)"
check() {
  local label="$1" path="$2" sep="?"
  case "$path" in *\?*) sep="&";; esac
  local body code
  body="$(curl -s -w '\n%{http_code}' "https://financialmodelingprep.com/stable/${path}${sep}apikey=${KEY}")"
  code="$(printf '%s' "$body" | tail -n1)"; body="$(printf '%s' "$body" | sed '$d')"
  if [ "$code" = "000" ]; then printf '%-36s couldn'"'"'t reach FMP (network)\n' "$label"; return; fi
  if [ "$code" = "401" ]; then printf '%-36s key rejected (401)\n' "$label"; return; fi
  if [ "$code" = "200" ] && ! printf '%s' "$body" | grep -qiE 'restricted|premium|upgrade|not available|limit reach|Error Message'; then
    if printf '%s' "$body" | grep -q '^\[\]$'; then printf '%-36s included (no data right now)\n' "$label"; else printf '%-36s included\n' "$label"; fi
  else printf '%-36s not in your plan (%s)\n' "$label" "$code"; fi
}
echo "FMP plan check — $(date)"
check "Live quote (1 stock)"            "quote?symbol=AAPL"
check "Batch quotes (many at once)"     "batch-quote?symbols=AAPL,MSFT,NVDA"
check "Stock news"                      "news/stock?symbols=NVDA&limit=1"
check "Press releases"                  "news/press-releases?symbols=NVDA&limit=1"
check "1-minute intraday chart"         "historical-chart/1min?symbol=AAPL"
check "5-minute intraday chart"         "historical-chart/5min?symbol=AAPL"
check "Daily history (full)"            "historical-price-eod/full?symbol=AAPL"
check "Company profile"                 "profile?symbol=AAPL"
check "Analyst price targets"           "price-target-consensus?symbol=AAPL"
check "Analyst upgrades/downgrades"     "grades?symbol=AAPL"
check "Analyst estimates"               "analyst-estimates?symbol=AAPL&period=annual&limit=1"
check "Earnings calendar"               "earnings-calendar?from=${TODAY}&to=${WEEK}"
check "Top gainers"                     "biggest-gainers"
check "Most active"                     "most-actives"
check "Sector performance"              "sector-performance-snapshot?date=${TODAY}"
check "Insider trades"                  "insider-trading/latest?page=0&limit=1"
check "Financial statements"            "income-statement?symbol=AAPL&limit=1"
check "Key metrics / ratios"            "key-metrics?symbol=AAPL&limit=1"
check "ETF holdings"                    "etf/holdings?symbol=SPY"
check "Crypto quote (for later)"        "quote?symbol=BTCUSD"
unset KEY
