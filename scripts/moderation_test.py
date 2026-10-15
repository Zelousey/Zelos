"""Unit tests for functions/moderation.py (word filter and report checks, App Store 1.2).
Run: python3 scripts/moderation_test.py"""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
import moderation as M  # noqa: E402
import coaching as CO  # noqa: E402


class Filter(unittest.TestCase):
    def test_blocks_words_and_look_alikes(self):
        for bad in ("fuck you", "Sh1t happens", "$hit", "f.u.c.k", "what the f u c k", "you b1tch", "FUCKING", "go kill yourself!".replace(" ", "")):
            self.assertTrue(M.is_bad(bad), bad)

    def test_leaves_ordinary_text_alone(self):
        for ok in ("this hit a new high", "nice trade", "grape juice", "Scunthorpe", "cocktail hour", "spicy earnings",
                   "therapist", "Dickens", "assess the class", "AAPL to the moon 🚀", "", "a b c d"):
            self.assertFalse(M.is_bad(ok), ok)

    def test_mask_keeps_length_and_other_words(self):
        self.assertEqual(M.mask("well shit, AAPL"), "well ***** AAPL")  # the whole word goes, punctuation too
        self.assertEqual(M.mask("what the f u c k"), "what the * * * *")
        self.assertEqual(M.mask("clean text"), "clean text")
        self.assertEqual(M.mask(None), "")

    def test_masked_fields(self):
        self.assertEqual(M.masked_fields({"name": "Bob", "bio": "shit trader"}, ("name", "bio")), {"bio": "**** trader"})
        self.assertEqual(M.masked_fields({"goal": {"text": "beat the bitch"}}, ("name", "goal.text")), {"goal.text": "beat the *****"})
        self.assertEqual(M.masked_fields({"name": "Squad"}, ("name", "goal.text")), {})

    def test_coaching_text_is_masked(self):
        self.assertEqual(CO._clean("  watch   this shit  ", 80), "watch this ****")


class Reports(unittest.TestCase):
    def test_valid(self):
        r = M.validate_report({"kind": "chat", "target": "Uid123abc", "where": "sq1/msg2", "reason": "harassment", "note": "  rude \n again "})
        self.assertEqual(r, {"kind": "chat", "target": "Uid123abc", "where": "sq1/msg2", "reason": "harassment", "note": "rude again"})

    def test_invalid(self):
        for bad in ({}, {"kind": "news", "target": "u1", "reason": "spam"}, {"kind": "chat", "target": "../x", "reason": "spam"},
                    {"kind": "chat", "target": "u1", "reason": "boring"}, {"kind": "chat", "target": "u1", "reason": "spam", "where": "a b"}, "nope"):
            with self.assertRaises(ValueError):
                M.validate_report(bad)


if __name__ == "__main__":
    unittest.main(verbosity=1)
