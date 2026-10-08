#!/usr/bin/env bash
# Runs functions.e2e.mjs against the real Python functions on the emulators.
# The Admin SDK wants *some* credential file even when every call goes to an emulator,
# so we make a throwaway one (random key, fake project) that never leaves this machine.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
openssl genrsa -out "$tmp/k.pem" 2048 2>/dev/null
python3 - "$tmp" <<'PY'
import json, sys
d = sys.argv[1]
json.dump({"type": "service_account", "project_id": "demo-zelos", "private_key_id": "x",
           "private_key": open(d + "/k.pem").read(), "client_email": "fake@demo-zelos.iam.gserviceaccount.com",
           "client_id": "1", "token_uri": "https://oauth2.googleapis.com/token"}, open(d + "/sa.json", "w"))
PY
# Each declared secret needs a value for the emulator; dummies are fine here.
if [ ! -f "$root/functions/.secret.local" ]; then
  grep -oE 'secrets=\[[^]]*\]' "$root/functions/main.py" | grep -oE '"[A-Z_]+"' | tr -d '"' | sort -u | sed 's/$/=dummy/' > "$tmp/secrets"
  cp "$tmp/secrets" "$root/functions/.secret.local"
  trap 'rm -rf "$tmp"; rm -f "$root/functions/.secret.local"' EXIT
fi
cd "$root"
GOOGLE_APPLICATION_CREDENTIALS="$tmp/sa.json" "$here/node_modules/.bin/firebase" emulators:exec \
  --project demo-zelos --config firebase.rules-test.json --only auth,firestore,functions \
  "node tests/rules/functions.e2e.mjs && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 functions/venv/bin/python -I tests/rules/practice_pass.e2e.py && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 functions/venv/bin/python -I tests/rules/official_news.e2e.py"
