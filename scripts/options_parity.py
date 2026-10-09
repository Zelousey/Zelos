"""The app's options parity fixture (webapp/src/features/options/parity.json): the server model's
numbers for a set of contracts. The app's model.test.ts checks its own numbers against it and
scripts/options_test.py checks the file still matches functions/options.py.
Rewrite after a model change: python3 scripts/options_parity.py --write"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
import options as O  # noqa: E402

PATH = os.path.join(ROOT, "webapp", "src", "features", "options", "parity.json")
CASES = [["call", 250, 250, "2026-11-20", "2026-10-07", 0.3], ["put", 250, 240, "2026-10-16", "2026-10-07", 0.45], ["call", 18.4, 20, "2026-12-18", "2026-10-07", 0.9],
         ["put", 612, 700, "2027-01-15", "2026-10-07", 0.2], ["call", 100, 80, "2026-10-07", "2026-10-07", 0.3], ["put", 113, 115, "2026-10-09", "2026-10-07", 0.3248], ["call", 1234.5, 1250, "2026-12-31", "2026-12-28", 0.6]]


def build():
    return {"quotes": [[c, {k: v for k, v in O.quote(*c).items()}] for c in CASES],
            "expirations": {d: O.expirations(d) for d in ["2026-10-07", "2026-10-09", "2026-12-28", "2027-01-31"]},
            "strikes": {str(s): O.strikes(s) for s in [3.21, 18.4, 114, 252.3, 612, 1234.5]}}


if __name__ == "__main__":
    if "--write" in sys.argv:
        with open(PATH, "w") as f:
            f.write(json.dumps(build(), indent=1) + "\n")
    else:
        print(json.dumps(build(), indent=1))
