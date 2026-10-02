"""Cache-busting for the site's own scripts and stylesheets.

    python3 scripts/stamp_assets.py          # run after any build script, before committing

Every local <script src="..."> and <link rel="stylesheet" href="..."> in the site's
HTML gets ?v=<first 8 hex of the file's sha1>. When a file changes its URL changes,
so phones (and the iPhone Home Screen app, which caches hard) always load the new
version, while unchanged files stay cached. Files that don't exist are left alone;
the service worker (firebase-messaging-sw.js) is never stamped because its URL must
stay fixed.
"""
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "node_modules", "functions", "scripts", "docs", "data"}
NEVER = {"firebase-messaging-sw.js"}
REF = re.compile(r'''(?P<attr>\b(?:src|href))=(?P<q>["'])(?P<path>(?!https?:|//|data:|#|mailto:)[^"'?#]+\.(?:js|css))(?:\?v=[0-9a-f]*)?(?P=q)''')


def digest(path, cache={}):
    if path not in cache:
        with open(path, "rb") as f:
            cache[path] = hashlib.sha1(f.read()).hexdigest()[:8]
    return cache[path]


def stamp_file(html_path):
    with open(html_path, encoding="utf-8") as f:
        text = f.read()
    base = os.path.dirname(html_path)

    def fix(m):
        rel = m.group("path")
        if os.path.basename(rel) in NEVER:
            return m.group(0)
        target = os.path.normpath(os.path.join(ROOT, rel.lstrip("/")) if rel.startswith("/") else os.path.join(base, rel))
        if not os.path.isfile(target):
            return m.group(0)
        return '%s=%s%s?v=%s%s' % (m.group("attr"), m.group("q"), rel, digest(target), m.group("q"))

    new = REF.sub(fix, text)
    if new != text:
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(new)
        return True
    return False


def main():
    changed = 0
    for dirpath, dirnames, files in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in files:
            if name.endswith(".html") and stamp_file(os.path.join(dirpath, name)):
                changed += 1
    print("stamped %d html file%s" % (changed, "" if changed == 1 else "s"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
