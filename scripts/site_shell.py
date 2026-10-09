"""Wraps page content in the standard Zelos site shell (head, nav, footer,
auth + theme scripts) for pages that live one folder deep: /games/, /learn/,
/scan/.

The shell is lifted straight from games/setup-spotter.html so generated
pages always match the hand-written ones. If the nav changes there, re-run
the build scripts and every generated page picks it up.
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://agentictrading.info'
_TEMPLATE = os.path.join(ROOT, 'games', 'setup-spotter.html')


def _parts():
    # the template's own ?v= stamps are dropped here; render() re-stamps every page it writes
    src = re.sub(r'(\.(?:js|css))\?v=[0-9a-f]+', r'\1', open(_TEMPLATE, encoding='utf-8').read())
    head_end = src.index('<style>')
    head = src[:head_end]
    nav = src[src.index('<body'):src.index('</nav>') + len('</nav>')]
    footer = src[src.index('<footer class="site-footer">'):src.index('</footer>') + len('</footer>')]
    # firebase + shared scripts block, then the generic nav/theme/auth tail
    scripts_start = src.index('<script src="https://www.gstatic.com/firebasejs')
    scripts_end = src.index('<script src="../leaderboard.js"></script>') + len('<script src="../leaderboard.js"></script>')
    shared_scripts = src[scripts_start:scripts_end]
    tail_start = src.index('<script>\n(function(){\n  function wireDropdown')
    tail = src[tail_start:]
    return head, nav, footer, shared_scripts, tail


def _set_meta(head, title, desc, url, og_type='website'):
    e = html.escape
    head = re.sub(r'<title>.*?</title>', '<title>%s</title>' % e(title), head, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % e(desc, quote=True), head)
    head = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="%s">' % url, head)
    head = re.sub(r'<meta property="og:type" content="[^"]*">', '<meta property="og:type" content="%s">' % og_type, head)
    head = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="%s">' % e(title, quote=True), head)
    head = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="%s">' % e(desc, quote=True), head)
    head = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="%s">' % url, head)
    head = re.sub(r'<meta name="twitter:title" content="[^"]*">', '<meta name="twitter:title" content="%s">' % e(title, quote=True), head)
    head = re.sub(r'<meta name="twitter:description" content="[^"]*">', '<meta name="twitter:description" content="%s">' % e(desc, quote=True), head)
    return head


def add_learn_nav(nav, prefix='../'):
    """Adds a 'Learn' link next to Knowledge (idempotent)."""
    if 'learn/index.html' in nav:
        return nav
    # desktop nav has no spare width, so Learn takes Knowledge's slot there
    # (the Learn hub links to the Knowledge catalog); mobile keeps both.
    nav = nav.replace('<a class="nav-link" href="%sai-knowledge-catalog.html">Knowledge</a>' % prefix,
                      '<a class="nav-link" href="%slearn/index.html">Learn</a>' % prefix)
    nav = nav.replace('<a href="%sai-knowledge-catalog.html">Knowledge</a>' % prefix,
                      '<a href="%slearn/index.html">Learn</a>\n      <a href="%sai-knowledge-catalog.html">Knowledge</a>' % (prefix, prefix))
    return nav


# path prefix -> which nav item is highlighted (see the nav in games/setup-spotter.html)
_NAV_SECTIONS = [('practice/', 'Trade War'), ('real/', 'Trading Tools'), ('scan/', 'Trading Tools'),
                 ('games/', 'Training Ground'), ('learn/', 'Learn')]


def set_active_nav(nav, path):
    """Highlights the nav item for this page's section (the template's own
    highlight is for the Training Ground, since it's a game page)."""
    nav = nav.replace(' is-active', '').replace(' aria-current="page"', '')
    label = next((l for pre, l in _NAV_SECTIONS if path.startswith(pre)), None)
    if label == 'Learn':
        nav = nav.replace('<a class="nav-link" href="../learn/index.html">Learn</a>',
                          '<a class="nav-link is-active" href="../learn/index.html" aria-current="page">Learn</a>', 1)
    elif label:
        nav = nav.replace('<button class="nav-drop-btn" type="button" aria-haspopup="true" aria-expanded="false">%s ' % label,
                          '<button class="nav-drop-btn is-active" type="button" aria-haspopup="true" aria-expanded="false">%s ' % label, 1)
    return nav


def render(path, title, desc, body, extra_head='', scripts='', jsonld=None, og_type='website',
           include_shared_scripts=True, robots=None):
    """path is the site path, e.g. 'games/chart-replay.html'."""
    head, nav, footer, shared, tail = _parts()
    url = SITE + '/' + path
    head = _set_meta(head, title, desc, url, og_type)
    if robots:
        head = head.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="%s">' % robots)
    base_style = ('<style>\n  :root{ color-scheme: dark; }\n  *{ box-sizing:border-box; }\n'
                  '  body{ margin:0; }\n  [hidden]{ display:none !important; }\n</style>\n')
    ld = ''
    for block in (jsonld or []):
        ld += '<script type="application/ld+json">\n%s\n</script>\n' % json.dumps(block, indent=1, ensure_ascii=False)
    out = (head + base_style + extra_head + ld + '</head>\n' + set_active_nav(add_learn_nav(nav), path) + '\n\n' + body + '\n\n' + footer + '\n\n' +
           (shared + '\n' if include_shared_scripts else '') + scripts + '\n' + tail)
    dest = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'w', encoding='utf-8') as f:
        f.write(out)
    from stamp_assets import stamp_file  # ?v= fingerprints so phones load new JS/CSS
    stamp_file(dest)
    return dest


def breadcrumbs(items):
    """items: [(name, path_or_None)] -> BreadcrumbList JSON-LD."""
    return {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': n, **({'item': SITE + '/' + p.lstrip('/')} if p is not None else {})}
            for i, (n, p) in enumerate(items)
        ]
    }
