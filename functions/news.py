"""Zelos News: post validation and official market-news parsing (pure, unit-tested in
scripts/news_test.py).

Two kinds of content:
- Posts (news/{id}), written only by the site owner through the news_save callable:
    section  zelos | tradewar | market | voices
    voices = a post by someone who can move markets (on X or Truth Social), curated by the owner:
             shown as a quote card with author, platform, date and a link to the original.
- Official market news (markets/officialNews), written by refresh_official_news from free,
  official sources: Federal Reserve press releases (RSS) and SEC 8-K filings (EDGAR's
  current-filings Atom feed) for the Zelos stock list. No paid headline feed yet (owner,
  2026-10-08); add one only after its commercial license is checked.
"""
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

SECTIONS = ("zelos", "tradewar", "market", "voices")
PLATFORMS = ("x", "truth", "other")
VOICE_HOSTS = {"x": ("x.com", "twitter.com", "mobile.twitter.com"), "truth": ("truthsocial.com",)}
OFFICIAL_HOSTS = ("federalreserve.gov", "sec.gov")
MAX_TITLE, MAX_BODY, MAX_QUOTE, MAX_POSTS_PER_DAY = 140, 4000, 1000, 50
OFFICIAL_KEEP, OFFICIAL_DAYS = 80, 21


class NewsError(Exception):
    """Bad input; the message is shown to the poster."""


def _clean(v, n):
    s = str(v if v is not None else "").replace("\r", "")
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", s).strip()
    return s[:n]


def _host_ok(host, allowed):
    host = (host or "").lower()
    return any(host == h or host.endswith("." + h) for h in allowed)


def https_url(v, allowed=None):
    """An https URL (optionally on one of `allowed` hosts), or None."""
    s = _clean(v, 500)
    if not s:
        return None
    try:
        u = urlparse(s)
    except ValueError:
        return None
    if u.scheme != "https" or not u.netloc or "@" in u.netloc:
        return None
    if allowed and not _host_ok(u.hostname, allowed):
        return None
    return s


def app_link(v):
    """An in-app path like /practice or /markets/AAPL, or None."""
    s = _clean(v, 120)
    return s if re.fullmatch(r"/[a-z0-9][a-z0-9\-/]*", s or "") and "//" not in s else None


def valid_day(v):
    s = _clean(v, 10)
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return s
    except ValueError:
        return None


def validate_post(data, today):
    """Owner input -> the stored post (without id/timestamps). Raises NewsError."""
    if not isinstance(data, dict):
        raise NewsError("Nothing to post.")
    section = data.get("section")
    if section not in SECTIONS:
        raise NewsError("Pick a section.")
    title = _clean(data.get("title"), MAX_TITLE)
    if not title:
        raise NewsError("Add a title.")
    body = [p.strip() for p in re.split(r"\n\s*\n", _clean(data.get("body"), MAX_BODY)) if p.strip()][:12]
    day = valid_day(data.get("date")) or today
    post = {"section": section, "title": title, "body": body, "date": day, "featured": bool(data.get("featured"))}
    link = data.get("link") or {}
    if isinstance(link, dict) and (link.get("to") or link.get("label")):
        to = app_link(link.get("to")) or https_url(link.get("to"))
        label = _clean(link.get("label"), 40) or "Open"
        if not to:
            raise NewsError("The link must be an app page like /practice or an https:// address.")
        post["link"] = {"to": to, "label": label}
    if section == "voices":
        v = data.get("voice") if isinstance(data.get("voice"), dict) else {}
        platform = v.get("platform") if v.get("platform") in PLATFORMS else None
        if not platform:
            raise NewsError("Pick where it was posted (X, Truth Social or other).")
        url = https_url(v.get("url"), VOICE_HOSTS.get(platform))
        if not url:
            raise NewsError({"x": "Paste the post's x.com link.", "truth": "Paste the post's truthsocial.com link."}.get(platform, "Paste the post's https:// link."))
        author = _clean(v.get("author"), 60)
        quote = _clean(v.get("quote"), MAX_QUOTE)
        if not author or not quote:
            raise NewsError("Add who posted it and what they said.")
        post["voice"] = {"platform": platform, "url": url, "author": author, "handle": _clean(v.get("handle"), 40).lstrip("@"), "quote": quote,
                         "postedAt": valid_day(v.get("postedAt")) or day}
    elif not body:
        raise NewsError("Add some text.")
    return post


# ---------------------------------------------------------------- official sources
def _ts(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def _parse_xml(text):
    if not text or len(text) > 3_000_000 or "<!ENTITY" in text:  # no entity tricks from a feed
        return None
    try:
        return ET.fromstring(text)
    except ET.ParseError:
        return None


def parse_fed_rss(text, limit=20):
    """Federal Reserve press-release RSS -> [{id, source, kind, title, url, at}]."""
    root = _parse_xml(text)
    if root is None:
        return []
    out = []
    for it in root.iter("item"):
        title = _clean(it.findtext("title"), 200)
        url = https_url(it.findtext("link"), ("federalreserve.gov",))
        try:
            at = _ts(parsedate_to_datetime(it.findtext("pubDate") or ""))
        except (TypeError, ValueError, IndexError):
            at = None
        if title and url and at:
            cat = _clean(it.findtext("category"), 60)
            out.append({"id": "fed:" + url[-80:], "source": "Federal Reserve", "kind": "fed", "title": title, "detail": cat, "url": url, "at": at})
        if len(out) >= limit:
            break
    return out


ATOM = "{http://www.w3.org/2005/Atom}"
ITEM_RE = re.compile(r"Item\s+(\d+\.\d+):\s*([^<\n]+)")
CIK_RE = re.compile(r"\((\d{6,10})\)")


def parse_sec_current(text, cik_to_sym):
    """EDGAR 'current filings' Atom feed (8-K) -> items for the companies we cover."""
    root = _parse_xml(text)
    if root is None:
        return []
    out = []
    for e in root.iter(ATOM + "entry"):
        title = e.findtext(ATOM + "title") or ""
        m = CIK_RE.search(title)
        sym = cik_to_sym.get(int(m.group(1))) if m else None
        if not sym:
            continue
        link = e.find(ATOM + "link")
        url = https_url(link.get("href") if link is not None else "", ("sec.gov",))
        upd = e.findtext(ATOM + "updated") or ""
        try:
            at = _ts(datetime.fromisoformat(upd.strip()))
        except ValueError:
            at = None
        summary = re.sub(r"<[^>]+>", "\n", e.findtext(ATOM + "summary") or "")
        items = ["%s %s" % (a, b.strip()) for a, b in ITEM_RE.findall(summary)][:3]
        form = _clean(title.split(" - ")[0], 12) or "8-K"
        if url and at:
            out.append({"id": "sec:" + url[-80:], "source": "SEC filing", "kind": "filing", "sym": sym, "form": form,
                        "title": "%s: new %s filing" % (sym, form), "detail": "; ".join(items)[:240], "url": url, "at": at})
    return out


def merge_official(existing, fresh, now_ms, keep=OFFICIAL_KEEP, days=OFFICIAL_DAYS):
    """Merge by id (fresh wins), drop old ones, newest first."""
    by = {}
    for it in (existing or []) + (fresh or []):
        if isinstance(it, dict) and it.get("id") and isinstance(it.get("at"), (int, float)):
            by[it["id"]] = it
    cutoff = now_ms - days * 86400000
    return sorted((it for it in by.values() if it["at"] >= cutoff and it["at"] <= now_ms + 3600000), key=lambda it: -it["at"])[:keep]
