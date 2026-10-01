"""Tests for the FMP market-data shaping in functions/main.py (refresh_market_data
and market_research: the pure parts).

    python3 -m unittest discover -s scripts -p "*_test.py"
"""
import os
import sys
import unittest
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tradewar_test  # noqa: E402,F401  (installs the firebase stubs)
import main as m  # noqa: E402


def ny(y, mo, d, h, mi):
    return datetime(y, mo, d, h, mi, tzinfo=m.NY)


class Shaping(unittest.TestCase):
    def test_quote(self):
        q = m.md_quote({"symbol": "BTCUSD", "name": "Bitcoin USD", "price": 64000.5, "open": 63000, "dayHigh": 64500, "dayLow": 62900,
                        "previousClose": 63100, "timestamp": 1760000000, "changePercentage": 1.4262})
        self.assertEqual((q["c"], q["pc"], q["t"], q["chPct"]), (64000.5, 63100, 1760000000, 1.43))
        self.assertIsNone(m.md_quote({"symbol": "X", "price": 0}))
        self.assertIsNone(m.md_quote(None))

    def test_movers_skip_junk_and_cap(self):
        rows = [{"symbol": "ABCD", "name": "Abcd", "price": 3.2, "changesPercentage": 41.234}, {"symbol": "", "price": 1},
                {"symbol": "bad sym!", "price": 2}, {"symbol": "ZZ", "price": None}] + [{"symbol": "S%d" % i, "price": 1} for i in range(20)]
        out = m.md_movers(rows, n=5)
        self.assertEqual(out[0], {"sym": "ABCD", "name": "Abcd", "price": 3.2, "chPct": 41.23})
        self.assertEqual(len(out), 5)
        self.assertEqual(m.md_movers({"Error Message": "x"}), [])

    def test_sectors_average_across_exchanges(self):
        rows = [{"sector": "Technology", "exchange": "NASDAQ", "averageChange": 1.0}, {"sector": "Technology", "exchange": "NYSE", "averageChange": 2.0},
                {"sector": "Energy", "exchange": "NYSE", "averageChange": -0.5}, {"sector": "", "averageChange": 9}]
        self.assertEqual(m.md_sectors(rows), [{"sector": "Technology", "chPct": 1.5}, {"sector": "Energy", "chPct": -0.5}])

    def test_bars_sorted_session_only_with_volume(self):
        rows = [{"date": "2026-09-30 16:00:00", "open": 1, "high": 1, "low": 1, "close": 1, "volume": 5},
                {"date": "2026-09-30 15:55:00", "open": 10, "high": 11, "low": 9.5, "close": 10.5, "volume": 1200},
                {"date": "2026-09-30 09:30:00", "open": 9, "high": 9.2, "low": 8.8, "close": 9.1, "volume": 3000},
                {"date": "2026-09-30 09:25:00", "open": 9, "high": 9, "low": 9, "close": 9, "volume": 1},
                {"date": "2026-09-29 10:00:00", "open": 8, "high": 8, "low": 8, "close": 8, "volume": 1}]
        self.assertEqual(m.md_bars(rows, True, session_only=True, keep_days=1),
                         ["2026-09-30 09:30,9.0,9.2,8.8,9.1,3000", "2026-09-30 15:55,10.0,11.0,9.5,10.5,1200"])
        daily = m.md_bars([{"date": "2026-09-30", "open": 5, "high": 4, "low": 6, "close": 5.5, "volume": 7}], False)
        self.assertEqual(daily, ["2026-09-30,5.0,5.5,5.0,5.5,7"])  # high/low repaired around open/close

    def test_merge_daily_replaces_by_date(self):
        old = ["2026-09-28,1,1,1,1,0", "2026-09-29,2,2,2,2,0"]
        new = ["2026-09-29,2,3,1,2.5,900", "2026-09-30,3,3,3,3,100"]
        self.assertEqual(m.md_merge_daily(old, new, 2), ["2026-09-29,2,3,1,2.5,900", "2026-09-30,3,3,3,3,100"])

    def test_earnings_soonest_per_symbol(self):
        rows = [{"symbol": "NVDA", "date": "2026-11-19", "epsEstimated": 1.2}, {"symbol": "NVDA", "date": "2026-11-05"},
                {"symbol": "BRK.B", "date": "2026-11-01"}, {"symbol": "AAPL", "date": "2026-10-30", "revenueEstimated": 1e11}]
        out = m.md_earnings(rows)
        self.assertEqual(out["NVDA"]["date"], "2026-11-05")
        self.assertEqual(out["AAPL"]["rev"], 1e11)
        self.assertNotIn("BRK.B", out)

    def test_research_doc(self):
        parts = {
            "profile": [{"companyName": "NVIDIA Corporation", "sector": "Technology", "industry": "Semiconductors", "marketCap": 4.4e12, "beta": 2.1,
                         "range": "86.62-212.19", "website": "https://www.nvidia.com", "image": "http://insecure/x.png", "description": "x" * 900}],
            "target": [{"targetHigh": 300, "targetLow": 150, "targetConsensus": 230.456, "targetMedian": 235}],
            "grades": [{"date": "2026-08-01", "gradingCompany": "A", "previousGrade": "Hold", "newGrade": "Buy", "action": "upgrade"},
                       {"date": "2026-09-01", "gradingCompany": "B", "previousGrade": "Buy", "newGrade": "Buy", "action": "maintain"}],
            "estimates": [{"date": "2020-01-26", "epsAvg": 1}, {"date": "2099-01-26", "epsAvg": 4.567, "revenueAvg": 2e11, "numAnalystsEps": 30}],
            "ratios": [{"priceToEarningsRatioTTM": 55.55}], "metrics": [{"returnOnEquity": 1.1}],
            "income": [{"fiscalYear": "2026", "revenue": 1.3e11, "netIncome": 7e10, "epsDiluted": 2.94}],
            "insiders": [{"transactionDate": "2026-09-01", "reportingName": "Huang", "typeOfOwner": "CEO", "transactionType": "S-Sale", "securitiesTransacted": 1000, "price": 180},
                         {"transactionDate": "2026-09-02", "reportingName": "Grant", "transactionType": "A-Award"}],
            "news": [{"title": "Headline", "url": "https://x.com/a", "publisher": "Wire", "publishedDate": "2026-09-30 10:00:00"}, {"title": "no url"}],
        }
        d = m.md_research("NVDA", parts, {"date": "2026-11-19", "eps": 1.2})
        self.assertEqual(d["name"], "NVIDIA Corporation")
        self.assertEqual(len(d["profile"]["description"]), 420)
        self.assertEqual(d["profile"]["image"], "")  # https only
        self.assertEqual(d["target"]["targetConsensus"], 230.46)
        self.assertEqual([g["firm"] for g in d["grades"]], ["B", "A"])
        self.assertEqual((d["estimate"]["year"], d["estimate"]["analysts"]), ("2099", 30))
        self.assertEqual(d["metrics"], {"pe": round(55.55, 1), "roe": 1.1})
        self.assertEqual(d["insiders"], [{"date": "2026-09-01", "who": "Huang", "role": "CEO", "buy": False, "shares": 1000, "price": 180}])
        self.assertEqual([n["headline"] for n in d["news"]], ["Headline"])
        self.assertEqual(d["earnings"]["date"], "2026-11-19")
        empty = m.md_research("ZZZZ", {})
        self.assertEqual(empty, {"symbol": "ZZZZ", "name": "ZZZZ"})


class Schedule(unittest.TestCase):
    def test_due(self):
        st = {}
        d = m.md_due(ny(2026, 9, 30, 10, 0), st)  # Wednesday mid-session
        self.assertTrue(d["movers"]); self.assertFalse(d["afterClose"]); self.assertFalse(d["research"]); self.assertTrue(d["earnings"])
        d = m.md_due(ny(2026, 9, 30, 16, 20), {"earningsDay": "2026-09-30"})
        self.assertTrue(d["afterClose"]); self.assertTrue(d["movers"]); self.assertFalse(d["earnings"]); self.assertTrue(d["research"])
        self.assertFalse(m.md_due(ny(2026, 9, 30, 16, 25), {"closeDay": "2026-09-30"})["afterClose"])
        sat = m.md_due(ny(2026, 10, 3, 12, 0), {"earningsDay": "2026-10-03"})
        self.assertEqual((sat["movers"], sat["afterClose"], sat["research"]), (False, False, True))
        self.assertFalse(m.md_due(ny(2026, 9, 30, 10, 5), {"moversAt": ny(2026, 9, 30, 10, 0).timestamp()})["movers"])

    def test_symbols(self):
        self.assertTrue(m._SYM_RE.match("BRK.B") and m._SYM_RE.match("NVDA"))
        self.assertFalse(m._SYM_RE.match("nvda") or m._SYM_RE.match("../x") or m._SYM_RE.match(""))
        self.assertIn("BTCUSD", m.CRYPTO_SYMBOLS)


if __name__ == "__main__":
    unittest.main()
