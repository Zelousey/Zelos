"""The website and docs quote the token prices and the alert time the code really uses.

functions/main.py TOKENS is the only source of prices; the pages read the live numbers from
tokens_wallet but ship fallbacks (for visitors before the script loads, and for search engines),
and the FAQs quote them in words. This fails if any of them drift from the code again (a research
review on 2026-11-22 found three different price lists). Alerts go out at about 10 am New York
time (morning_alerts), so no page may promise them "before the market opens".
Run: python3 scripts/site_copy_test.py"""
import glob
import os
import re
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "functions"))
import tradewar_test  # noqa: E402,F401  (installs the firebase stubs)
import main as m  # noqa: E402

T = m.TOKENS


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def site_files():
    out = []
    for pat in ("*.html", "practice/*.html", "practice/*.js", "learn/*.html", "scan/*.html", "*.js"):
        out += glob.glob(os.path.join(ROOT, pat))
    return [p for p in out if "mockup" not in p and "node_modules" not in p]


class TokenPrices(unittest.TestCase):
    def test_tokens_page_fallbacks_match_the_code(self):
        s = read("tokens.html")
        for key in ("pass", "unlock", "unlockClosed", "welcome"):
            for got in re.findall(r'data-price="%s">(\d+)<' % key, s):
                self.assertEqual(int(got), T[key], "tokens.html %s fallback" % key)
        for got in re.findall(r'data-price-pass="three-leg">(\d+)<', s):
            self.assertEqual(int(got), T["passPrices"]["three-leg"])

    def test_docs_table_matches_the_code(self):
        s = read("docs/tokens.md")
        rows = {
            "Welcome bonus": T["welcome"], "7-day scanner pass": T["pass"],
            "7-day 3-Leg Options pass": T["passPrices"]["three-leg"],
            "One live alert": T["unlock"], "One alert after the close": T["unlockClosed"],
            "Take back a declined alert": m.REACTIVATE_COST,
        }
        for name, want in rows.items():
            got = re.search(r"\| %s \| (\d+)" % re.escape(name), s)
            self.assertIsNotNone(got, "docs/tokens.md is missing the %s row" % name)
            self.assertEqual(int(got.group(1)), want, "docs/tokens.md %s" % name)

    def test_pages_quote_the_after_close_price(self):
        bad = []
        for p in site_files():
            with open(p, encoding="utf-8") as f:
                s = f.read()
            for n in re.findall(r"(\d+) tokens after the 4:00 pm ET close", s) + re.findall(r"After the 4:00 pm ET close (?:it's|a single alert is|an alert is) (\d+) tokens", s) \
                    + re.findall(r"after the 4:00 pm ET close they\\?'re (\d+) tokens", s):
                if int(n) != T["unlockClosed"]:
                    bad.append((os.path.relpath(p, ROOT), n))
        self.assertEqual(bad, [], "pages quoting a wrong after-close price")

    def test_homepage_tokens_section_matches_the_code(self):
        s = read("index.html")
        for key in ("pass", "unlock", "unlockClosed", "welcome"):
            got = re.findall(r'data-tk="%s">(\d+)<' % key, s)
            self.assertTrue(got, "index.html is missing the %s price" % key)
            self.assertTrue(all(int(g) == T[key] for g in got), "index.html %s" % key)

    def test_strategy_faqs_quote_the_live_prices(self):
        for page in ("swing-trader.html",):
            s = read(page)
            m2 = re.search(r"a 1-week Swing Trader pass is (\d+) tokens.*?a 1-day pass is (\d+), and a single alert is (\d+) \((\d+) after", s)
            self.assertIsNotNone(m2)
            self.assertEqual(tuple(int(x) for x in m2.groups()), (T["pass"], T["dayPass"], T["unlock"], T["unlockClosed"]))


class AlertTime(unittest.TestCase):
    def test_no_page_promises_alerts_before_the_open(self):
        bad = []
        for p in site_files():
            with open(p, encoding="utf-8") as f:
                s = f.read()
            if re.search(r"alert[^.<]{0,60}before the market opens|latest alert is on the site every morning", s, re.I):
                bad.append(os.path.relpath(p, ROOT))
        self.assertEqual(bad, [], "alerts go out at about 10 am New York time (morning_alerts)")


if __name__ == "__main__":
    unittest.main(verbosity=2)
