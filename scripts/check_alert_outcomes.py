#!/usr/bin/env python3
"""The outcome checker's decision logic lives in functions/outcomes.py (the server runs it every
market day). This file keeps the old import path and command line working:
  echo '{"alert": {...}, "bars": [...]}' | python3 scripts/check_alert_outcomes.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import outcomes as _o  # noqa: E402

globals().update({k: v for k, v in vars(_o).items() if not k.startswith("__")})

if __name__ == "__main__":
    import json
    payload = json.load(sys.stdin)
    print(json.dumps(_o.outcome_for_alert(payload["alert"], payload.get("bars") or [], max_hold_sessions=payload.get("max_hold_sessions", 10))))
