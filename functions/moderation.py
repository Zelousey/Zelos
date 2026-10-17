"""Keeping what people post clean (App Store guideline 1.2: filter, report, block).

  is_bad(text)   True if the text contains a blocked word (also spelled with look-alike
                 characters or separators, e.g. "f.u.c.k", "sh1t")
  mask(text)     the text with every blocked word replaced by asterisks of the same length
  REASONS        report reasons people can pick
  validate_report(data) -> the report fields to store, or ValueError with a message to show

Pure functions only: main.py wires them into the chat / profile / squad triggers, coaching
text and the report_content callable.
"""
import re

# Substrings, matched on letters only after look-alikes are normalised. Kept short and
# unambiguous so ordinary words aren't hit ("class", "assess", "Scunthorpe" are fine).
BLOCKED = ("fuck", "shit", "bitch", "cunt", "nigg", "fag", "rape", "nazi", "porn", "dick", "pussy",
           "whore", "slut", "retard", "killyourself", "cock", "twat", "wank", "kike", "spic", "chink")
# words containing a blocked part that are fine on their own
ALLOWED = ("dickens", "therapeutic", "therapist", "grape", "drape", "scrape", "trapeze", "rapeseed", "cockpit",
           "peacock", "hancock", "shiitake", "cocktail", "spice", "spicy", "chinks", "skyscraper", "fagan", "scunthorpe", "shitake", "cockatoo", "cockroach", "hitchcock", "dickinson", "dickson")

_LOOK = str.maketrans({"0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "8": "b", "+": "t"})

REASONS = ("spam", "harassment", "hate", "sexual", "violence", "other")
KINDS = ("chat", "profile", "squad", "coach")
_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _norm(token):
    """A token's letters after look-alikes are normalised ("Sh1t!" -> "shit")."""
    return "".join(ch for ch in token.lower().translate(_LOOK) if "a" <= ch <= "z")


def _bad_word(word):
    return any(w in word for w in BLOCKED) and not any(a in word for a in ALLOWED)


def _hits(text):
    """[(start, end)] spans of whole words (whitespace-separated tokens) that contain a blocked
    word. Words are checked one at a time, so "this hit" is fine; letters spelled out one per
    token ("f u c k") are joined and checked too."""
    toks = [(m.start(), m.end(), _norm(m.group())) for m in re.finditer(r"\S+", str(text or ""))]
    spans = [(a, b) for a, b, w in toks if _bad_word(w)]
    i = 0
    while i < len(toks):  # runs of single letters
        j = i
        while j < len(toks) and len(toks[j][2]) == 1:
            j += 1
        if j - i >= 3 and _bad_word("".join(t[2] for t in toks[i:j])):
            spans.append((toks[i][0], toks[j - 1][1]))
        i = max(j, i + 1)
    return spans


def is_bad(text):
    return bool(_hits(text))


def mask(text):
    s = str(text or "")
    if not s:
        return s
    chars = list(s)
    for a, b in _hits(s):
        for i in range(a, b):
            if not chars[i].isspace():
                chars[i] = "*"
    return "".join(chars)


def masked_fields(doc, fields):
    """{field: masked text} for the given top-level text fields that contain a blocked word
    (dotted names reach into maps, e.g. "goal.text")."""
    out = {}
    for f in fields:
        cur = doc
        for part in f.split("."):
            cur = cur.get(part) if isinstance(cur, dict) else None
        if isinstance(cur, str) and is_bad(cur):
            out[f] = mask(cur)
    return out


def _clean(text, n):
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(text or "")).strip()
    return re.sub(r"\s+", " ", s)[:n]


def validate_report(data):
    """{kind, target, where?, reason, note?} -> dict to store, or ValueError(message)."""
    data = data if isinstance(data, dict) else {}
    kind, target, reason = data.get("kind"), data.get("target"), data.get("reason")
    if kind not in KINDS:
        raise ValueError("That can't be reported.")
    if not (isinstance(target, str) and _ID.match(target)):
        raise ValueError("That can't be reported.")
    if reason not in REASONS:
        raise ValueError("Pick a reason.")
    where = data.get("where")
    if where is not None and not (isinstance(where, str) and re.match(r"^[A-Za-z0-9_/-]{1,160}$", where)):
        raise ValueError("That can't be reported.")
    return {"kind": kind, "target": target, "where": where, "reason": reason, "note": _clean(data.get("note"), 300)}
