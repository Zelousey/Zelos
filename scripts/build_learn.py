"""Builds the /learn/ articles and the Learn hub.

    python3 scripts/build_learn.py

Article content lives in scripts/page-src/learn/articles_*.py. Every page
is plain server-rendered HTML (no client-side rendering), with Article,
FAQPage and BreadcrumbList structured data.
"""
import html
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'page-src', 'learn'))
from site_shell import render, breadcrumbs, SITE  # noqa: E402
from articles_a import ARTICLES as A  # noqa: E402
from articles_b import ARTICLES as B  # noqa: E402

ARTICLES = A + B
BY_SLUG = {a['slug']: a for a in ARTICLES}
UPDATED = '2026-09-24'
AUTHOR = {'@type': 'Organization', 'name': 'Zelos', 'url': SITE + '/'}

STRATEGIES = {
    'swing': ('Swing Trader', '../swing-trader.html', 'pullbacks, bull flags and breakout retests'),
    'breakout': ('Breakout Rider', '../breakout-rider.html', 'stocks clearing resistance and holding it'),
    'options': ('Options Scanner', '../options-scanner.html', 'long call and put ideas, 30–45 DTE'),
}
GAMES = {
    'grade-the-setup': 'Grade the Setup',
    'stop-drill': "Where's the Stop?",
    'chart-replay': 'Chart Replay',
}
HEAD = '<link rel="stylesheet" href="../zelos-theme.css">\n<link rel="stylesheet" href="learn.css">\n'


def words(h):
    return len(re.sub(r'<[^>]+>', ' ', h).split())


def article_page(a):
    name, href, blurb = STRATEGIES[a['strategy']]
    mins = max(3, round(words(a['body']) / 220))
    faq_html = ''.join('<div class="lr-faq-item"><h3>%s</h3><p>%s</p></div>' % (html.escape(q), html.escape(ans))
                       for q, ans in a['faq'])
    related = ''.join('<a class="lr-card" href="%s.html"><b>%s</b><span>%s</span></a>' % (
        r, html.escape(BY_SLUG[r]['title']), html.escape(BY_SLUG[r]['desc'][:110].rsplit(' ', 1)[0] + '…'))
        for r in a['related'] if r in BY_SLUG)
    game = ''
    if a.get('game'):
        gslug, gline = a['game']
        game = ('<a class="lr-practice" href="../games/%s.html"><span class="lr-kicker">Practice it free</span>'
                '<b>%s</b><span>%s on real historical charts, with the ticker hidden. &rarr;</span></a>') % (gslug, GAMES[gslug], gline)
    body = f'''<main class="lr-shell">
  <nav class="lr-crumbs" aria-label="Breadcrumb"><a href="../index.html">Zelos</a> / <a href="index.html">Learn</a> / <span>{html.escape(a['title'])}</span></nav>
  <article class="lr-article">
    <header>
      <h1>{html.escape(a['title'])}</h1>
      <p class="lr-meta">Updated <time datetime="{UPDATED}">September 24, 2026</time> · {mins} min read · Educational, not investment advice</p>
    </header>
    {a['body'].strip()}
    {game}
    <aside class="lr-cta">
      <div><b>Want Zelos to run this scan automatically?</b>
      <span>{name} applies these rules to the market on a schedule and publishes an alert only when a setup qualifies: {blurb}.</span></div>
      <a class="btn btn-primary" href="{href}">Try {name} &rarr;</a>
    </aside>
    <section class="lr-faq"><h2>Frequently asked questions</h2>{faq_html}</section>
  </article>
  <section class="lr-related"><h2>Keep learning</h2><div class="lr-grid">{related}</div></section>
  <p class="lr-disclaimer">This article is general education about trading concepts. It isn't personalized investment advice, and no strategy is guaranteed to be profitable. Trading involves risk, including loss of principal. See the <a href="../terms.html">terms</a> for Zelos's full risk disclosure.</p>
</main>'''
    path = 'learn/%s.html' % a['slug']
    ld = [
        {'@context': 'https://schema.org', '@type': 'Article', 'headline': a['title'], 'description': a['desc'],
         'url': SITE + '/' + path, 'mainEntityOfPage': SITE + '/' + path, 'datePublished': UPDATED, 'dateModified': UPDATED,
         'author': AUTHOR, 'publisher': AUTHOR, 'image': SITE + '/og-image.png', 'inLanguage': 'en-US',
         'about': a['title'], 'isAccessibleForFree': True},
        {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': ans}} for q, ans in a['faq']]},
        breadcrumbs([('Zelos', ''), ('Learn', 'learn/index.html'), (a['title'], None)]),
    ]
    render(path, a['seo_title'], a['desc'], body, HEAD, '', jsonld=ld, og_type='article')


GROUPS = [
    ('Pullbacks & swing setups', ['what-is-a-pullback-trading-strategy', 'how-to-identify-a-bull-flag', 'how-to-find-stocks-near-support', 'best-indicators-for-swing-trading']),
    ('Breakouts & momentum', ['how-to-trade-breakouts', 'what-is-a-breakout-retest', 'how-to-find-stocks-before-a-breakout', 'how-to-scan-stocks-for-momentum']),
    ('Risk management', ['what-is-reward-to-risk-ratio', 'how-to-use-stop-losses-in-swing-trading']),
    ('Options', ['how-to-find-options-with-30-45-dte', 'what-is-an-options-scanner']),
    ('Scanners & AI', ['how-does-an-ai-stock-scanner-work', 'ai-stock-screener-vs-traditional-screener']),
]


def hub():
    secs = ''
    for title, slugs in GROUPS:
        cards = ''.join('<a class="lr-card" href="%s.html"><b>%s</b><span>%s</span></a>' % (
            s, html.escape(BY_SLUG[s]['title']), html.escape(BY_SLUG[s]['desc'])) for s in slugs)
        secs += '<section class="lr-group"><h2>%s</h2><div class="lr-grid">%s</div></section>' % (title, cards)
    assert sum(len(s) for _, s in GROUPS) == len(ARTICLES)
    body = f'''<main class="lr-shell">
  <nav class="lr-crumbs" aria-label="Breadcrumb"><a href="../index.html">Zelos</a> / <span>Learn</span></nav>
  <header class="lr-hub-head">
    <span class="lr-kicker">Free trading education</span>
    <h1>Learn swing trading, breakouts and risk, one clear rule at a time</h1>
    <p>Plain-English guides to the setups and risk rules that Zelos's scanners are built on. Each one ends with a way to practice it on real charts in the <a href="../arcade.html">Zelos Arcade</a>.</p>
  </header>
  {secs}
  <section class="lr-group"><h2>Reference</h2><div class="lr-grid">
    <a class="lr-card" href="../ai-knowledge-catalog.html"><b>Knowledge catalog &amp; glossary</b><span>Definitions of every term used in Zelos alerts, the scoring engine, and a strategy comparison.</span></a>
    <a class="lr-card" href="../scan/index.html"><b>Daily market scans</b><span>Each trading day's scan: conditions, what was scanned, what was rejected and why, and the alert that qualified.</span></a>
    <a class="lr-card" href="../alert-history.html"><b>Alert history</b><span>Every published alert and its outcome, winners and losers.</span></a>
  </div></section>
  <p class="lr-disclaimer">General education only. Not personalized investment advice.</p>
</main>'''
    items = [{'@type': 'ListItem', 'position': i + 1, 'url': SITE + '/learn/%s.html' % a['slug'], 'name': a['title']} for i, a in enumerate(ARTICLES)]
    ld = [{'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Zelos Learn', 'url': SITE + '/learn/index.html',
           'description': 'Free guides to swing trading setups, breakouts, stop-losses, reward-to-risk and options scanning.',
           'mainEntity': {'@type': 'ItemList', 'itemListElement': items}},
          breadcrumbs([('Zelos', ''), ('Learn', None)])]
    render('learn/index.html', 'Learn Swing Trading: Free Guides to Setups, Stops & Scanners | Zelos',
           'Free, plain-English guides to pullbacks, breakouts, bull flags, support, stop-losses, reward-to-risk, options DTE and AI stock scanners.',
           body, HEAD, '', jsonld=ld)


if __name__ == '__main__':
    for a in ARTICLES:
        for r in a['related']:
            assert r in BY_SLUG, (a['slug'], r)
        article_page(a)
    hub()
    print('built %d articles + hub' % len(ARTICLES))
