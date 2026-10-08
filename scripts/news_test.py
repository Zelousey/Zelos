"""Unit tests for functions/news.py (post validation, official news parsing). python3 scripts/news_test.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import news as N

fails = 0
def ok(c, m):
    global fails
    print(("ok   " if c else "FAIL ") + m)
    fails += 0 if c else 1

def err(data, needle):
    try:
        N.validate_post(data, "2026-10-08")
        return False
    except N.NewsError as e:
        return needle.lower() in str(e).lower()

T = "2026-10-08"
p = N.validate_post({"section": "zelos", "title": "  Hello  ", "body": "First para.\n\n\nSecond para.", "featured": 1, "link": {"to": "/practice", "label": "Open"}}, T)
ok(p == {"section": "zelos", "title": "Hello", "body": ["First para.", "Second para."], "date": T, "featured": True, "link": {"to": "/practice", "label": "Open"}}, "zelos post: %s" % p)
ok(N.validate_post({"section": "market", "title": "t", "body": "b", "date": "2026-10-01"}, T)["date"] == "2026-10-01", "explicit date kept")
ok(N.validate_post({"section": "market", "title": "t", "body": "b", "date": "nope"}, T)["date"] == T, "bad date -> today")
ok(err({"section": "nope", "title": "t", "body": "b"}, "section"), "unknown section rejected")
ok(err({"section": "zelos", "title": "", "body": "b"}, "title"), "empty title rejected")
ok(err({"section": "zelos", "title": "t", "body": ""}, "text"), "empty body rejected")
ok(err({"section": "zelos", "title": "t", "body": "b", "link": {"to": "javascript:alert(1)"}}, "link"), "javascript: link rejected")
ok(err({"section": "zelos", "title": "t", "body": "b", "link": {"to": "http://example.com"}}, "link"), "http link rejected")
ok(err({"section": "zelos", "title": "t", "body": "b", "link": {"to": "//evil.com/x"}}, "link"), "protocol-relative link rejected")
ok(N.validate_post({"section": "zelos", "title": "t", "body": "b", "link": {"to": "https://www.sec.gov/x"}}, T)["link"]["to"] == "https://www.sec.gov/x", "https link ok")
ok(len(N.validate_post({"section": "zelos", "title": "x" * 500, "body": "b"}, T)["title"]) == N.MAX_TITLE, "title capped")
ok("\x07" not in N.validate_post({"section": "zelos", "title": "a\x07b", "body": "b"}, T)["title"], "control chars stripped")

v = N.validate_post({"section": "voices", "title": "Fed chair on rates", "body": "", "voice": {"platform": "x", "url": "https://x.com/federalreserve/status/123", "author": "Federal Reserve", "handle": "@federalreserve", "quote": "Rates unchanged.", "postedAt": "2026-10-07"}}, T)
ok(v["voice"] == {"platform": "x", "url": "https://x.com/federalreserve/status/123", "author": "Federal Reserve", "handle": "federalreserve", "quote": "Rates unchanged.", "postedAt": "2026-10-07"} and v["body"] == [], "voice post: %s" % v.get("voice"))
ok(N.validate_post({"section": "voices", "title": "t", "voice": {"platform": "truth", "url": "https://truthsocial.com/@x/posts/1", "author": "A", "quote": "q"}}, T)["voice"]["platform"] == "truth", "truth social voice ok")
ok(err({"section": "voices", "title": "t", "voice": {"platform": "x", "url": "https://evil.com/x.com/1", "author": "A", "quote": "q"}}, "x.com"), "voice url must be on x.com")
ok(err({"section": "voices", "title": "t", "voice": {"platform": "x", "url": "https://x.com.evil.com/1", "author": "A", "quote": "q"}}, "x.com"), "look-alike host rejected")
ok(err({"section": "voices", "title": "t", "voice": {"platform": "x", "url": "https://x.com/a/status/1", "author": "", "quote": "q"}}, "who posted"), "voice needs author")
ok(err({"section": "voices", "title": "t", "voice": {"platform": "myspace", "url": "https://x.com/1", "author": "a", "quote": "q"}}, "where"), "voice needs platform")
ok(err("nope", "nothing"), "non-dict rejected")

RSS = """<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>FRB</title>
<item><title>Federal Reserve issues FOMC statement</title><link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20260917a.htm</link>
<pubDate>Wed, 17 Sep 2026 18:00:00 GMT</pubDate><category>Monetary Policy</category></item>
<item><title>Bad link</title><link>https://evil.com/x</link><pubDate>Wed, 17 Sep 2026 18:00:00 GMT</pubDate></item>
<item><title>No date</title><link>https://www.federalreserve.gov/x.htm</link></item></channel></rss>"""
f = N.parse_fed_rss(RSS)
ok(len(f) == 1 and f[0]["title"] == "Federal Reserve issues FOMC statement" and f[0]["detail"] == "Monetary Policy" and f[0]["at"] == 1789668000000, "fed rss: %s" % f)
ok(N.parse_fed_rss("<not xml") == [] and N.parse_fed_rss('<!DOCTYPE x [<!ENTITY a "b">]><rss/>') == [], "bad or entity xml ignored")

ATOMX = """<?xml version="1.0" encoding="ISO-8859-1" ?><feed xmlns="http://www.w3.org/2005/Atom"><title>Latest Filings</title>
<entry><title>8-K - APPLE INC (0000320193) (Filer)</title><link rel="alternate" type="text/html" href="https://www.sec.gov/Archives/edgar/data/320193/000032019326000090/0000320193-26-000090-index.htm"/>
<summary type="html"> &lt;b&gt;Filed:&lt;/b&gt; 2026-10-07 &lt;b&gt;AccNo:&lt;/b&gt; 0000320193-26-000090 &lt;b&gt;Size:&lt;/b&gt; 300 KB&lt;br&gt;Item 2.02: Results of Operations and Financial Condition&lt;br&gt;Item 9.01: Financial Statements and Exhibits</summary>
<updated>2026-10-07T16:30:12-04:00</updated></entry>
<entry><title>8-K - SOME OTHER CO (0000999999) (Filer)</title><link href="https://www.sec.gov/x"/><updated>2026-10-07T16:30:12-04:00</updated></entry></feed>"""
s = N.parse_sec_current(ATOMX, {320193: "AAPL"})
ok(len(s) == 1 and s[0]["sym"] == "AAPL" and s[0]["form"] == "8-K" and s[0]["detail"].startswith("2.02 Results of Operations") and "9.01" in s[0]["detail"], "sec atom: %s" % s)
ok(s[0]["at"] == 1791405012000, "sec time parsed with offset")

now = 1791405012000
m = N.merge_official([{"id": "a", "at": now - 10}, {"id": "old", "at": now - 30 * 86400000}, {"id": "b", "at": now - 5}, "junk"], [{"id": "a", "at": now - 1, "title": "new"}], now)
ok([i["id"] for i in m] == ["a", "b"] and m[0]["title"] == "new", "merge: dedupe, fresh wins, drop old, newest first")

print("ALL CHECKS PASSED" if not fails else "%d FAILED" % fails)
sys.exit(1 if fails else 0)
