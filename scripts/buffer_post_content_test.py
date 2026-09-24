#!/usr/bin/env python3
"""Unit tests for buffer_post_content.py — run with:
   python3 scripts/buffer_post_content_test.py
No network, no Buffer, no Firestore — pure string formatting against
synthetic alert/snapshot dicts.
"""
import sys
import unittest

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from buffer_post_content import win_announcement_text, market_recap_text  # noqa: E402


def winning_alert(**overrides):
    alert = {
        "id": "swing-trader-2026-09-15",
        "ticker": "aapl",
        "strategy": "swing-trader",
        "direction": "long",
        "entry": 200.0,
        "target1": 206.0,
        "target2": 212.0,
        "outcome": {"result": "hit-target", "target2Hit": True, "target2ResolvedAt": "2026-09-20"},
    }
    alert.update(overrides)
    return alert


class WinAnnouncement(unittest.TestCase):
    def test_refuses_when_target2_not_hit(self):
        alert = winning_alert(outcome={"result": "hit-target", "target2Hit": None})
        with self.assertRaises(ValueError):
            win_announcement_text(alert)

    def test_refuses_when_target2_hit_is_false(self):
        alert = winning_alert(outcome={"result": "hit-target", "target2Hit": False})
        with self.assertRaises(ValueError):
            win_announcement_text(alert)

    def test_refuses_on_open_alert(self):
        alert = winning_alert(outcome={"result": "open"})
        with self.assertRaises(ValueError):
            win_announcement_text(alert)

    def test_basic_win_text(self):
        text = win_announcement_text(winning_alert())
        self.assertIn("$AAPL", text)
        self.assertIn("second target", text)
        self.assertIn("Swing Trader", text)
        self.assertIn("agentictrading.info/alert.html?id=swing-trader-2026-09-15", text)
        self.assertIn("Not investment advice", text)

    def test_pct_move_shown_for_long(self):
        text = win_announcement_text(winning_alert(entry=200.0, target2=212.0))
        self.assertIn("+6.0%", text)

    def test_pct_move_shown_for_short(self):
        alert = winning_alert(direction="short", entry=100.0, target1=95.0, target2=90.0)
        text = win_announcement_text(alert)
        self.assertIn("+10.0%", text)

    def test_falls_back_to_history_link_without_id(self):
        alert = winning_alert(id=None)
        text = win_announcement_text(alert)
        self.assertIn("alert-history.html", text)

    def test_options_scanner_label(self):
        alert = winning_alert(strategy="options-scanner")
        text = win_announcement_text(alert)
        self.assertIn("Options Scanner", text)

    def test_never_overpromises(self):
        # "don't guarantee" is the compliance disclaimer itself and is fine —
        # this checks the post never phrases things as a promise.
        text = win_announcement_text(winning_alert()).lower()
        for banned in ("is guaranteed", "guaranteed to", "sure thing", "risk-free", "can't lose"):
            self.assertNotIn(banned, text)
        self.assertIn("not investment advice", text)


class MarketRecap(unittest.TestCase):
    def test_basic_recap(self):
        snapshot = {
            "date": "2026-09-24",
            "indices": [
                {"label": "S&P 500", "changePct": 0.42},
                {"label": "Nasdaq", "changePct": -0.18},
            ],
        }
        text = market_recap_text(snapshot)
        self.assertIn("2026-09-24", text)
        self.assertIn("S&P 500 +0.42%", text)
        self.assertIn("Nasdaq -0.18%", text)
        self.assertIn("Not investment advice", text)

    def test_optional_note_included(self):
        snapshot = {
            "date": "2026-09-24",
            "indices": [{"label": "S&P 500", "changePct": 0.1}],
            "note": "Fed minutes released this afternoon.",
        }
        text = market_recap_text(snapshot)
        self.assertIn("Fed minutes released this afternoon.", text)

    def test_no_note_key_omits_blank_section(self):
        snapshot = {"date": "2026-09-24", "indices": [{"label": "S&P 500", "changePct": 0.1}]}
        text = market_recap_text(snapshot)
        self.assertNotIn("\n\n\n", text)

    def test_raises_without_indices(self):
        with self.assertRaises(ValueError):
            market_recap_text({"date": "2026-09-24", "indices": []})

    def test_skips_index_missing_changepct(self):
        snapshot = {
            "date": "2026-09-24",
            "indices": [{"label": "S&P 500"}, {"label": "Nasdaq", "changePct": 1.0}],
        }
        text = market_recap_text(snapshot)
        self.assertIn("Nasdaq +1.00%", text)
        self.assertNotIn("S&P 500", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
