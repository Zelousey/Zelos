/**
 * One great mind (owner 2026-10-24: "a little dashboard … instead of having one long page"):
 * /minds/:id is the big red card, the daily quote and six tiles, and each tile opens a short page
 * of its own (/minds/:id/story, carried, learned, lessons, quotes, now):
 * - their story and how they carried themselves, each with a picture;
 * - who they learned from, with those figures' red cards linking to their pages;
 * - lessons (each ending in "Use it in trading"; scroll lessons open on their own page);
 * - real quotes, each with its source, a plain-words version and what it means for trading;
 * - then & now: a words-only comparison with someone today (no modern faces).
 * A section page swipes (or arrows) to the next and previous one.
 * ?q=<quote id> (from a daily-quote notification) opens the quotes page on that quote.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { useUserDoc } from '../../data/userDoc';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useNow } from '../../lib/useNow';
import { Badge, Button, Card, EmptyState, Icon, useToast } from '../../ui';
import { errorMessage } from '../practice/actions';
import { useWalletDoc } from '../strategies/strategies';
import { FigureCard, Portrait } from './MindCard';
import {
  figureById, figureProgress, FOLLOW_COST, FOLLOW_DAYS, followFigure, lessonPath, lessonRef, mindImageUrl, MODERN_NOTE, scrollTasks, sectionPath, sectionsOf, STEP_XP, SECTIONS,
  type Figure, type Picture, type Section,
} from './minds';
import { ReadButton } from './ReadButton';
import s from './Minds.module.css';

const first = (f: Figure) => f.name.split(' ')[0]!;
const isSection = (x: string): x is Section => (SECTIONS as readonly string[]).includes(x);

/** The section's heading, on its page and its tile. */
function sectionTitle(f: Figure, x: Section) {
  switch (x) {
    case 'story':
      return t('hm.story');
    case 'carried':
      return t('hm.carried');
    case 'learned':
      return t('hm.studied');
    case 'lessons':
      return t('hm.lessons', { name: first(f) });
    case 'quotes':
      return t('hm.quotes', { name: first(f) });
    case 'now':
      return t('hm.thenNow', { name: first(f), modern: f.thenNow?.modern ?? '' });
  }
}

function useDone() {
  const { user, isReal } = useAuth();
  const me = useUserDoc(isReal && user ? user.uid : null);
  return me.status === 'ready' ? me.data.mindsDone : [];
}

export function FigurePage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const f = figureById(id);
  if (!f) return <EmptyState icon="learn" title={t('hm.missing')} actions={<Link to="/minds">{t('hm.back')}</Link>} />;
  // a daily-quote notification links /minds/:id?q=…: that's on the quotes page now
  const q = params.get('q');
  if (q) return <Navigate to={`${sectionPath(f.id, 'quotes')}?q=${encodeURIComponent(q)}`} replace />;
  return <Dashboard key={f.id} f={f} />;
}

export function FigureSectionPage() {
  const { id = '', section = '' } = useParams();
  const f = figureById(id);
  if (!f) return <EmptyState icon="learn" title={t('hm.missing')} actions={<Link to="/minds">{t('hm.back')}</Link>} />;
  if (!isSection(section) || !sectionsOf(f).includes(section)) return <Navigate to={`/minds/${f.id}`} replace />;
  return <SectionPage key={`${f.id}/${section}`} f={f} section={section} />;
}

function Dashboard({ f }: { f: Figure }) {
  const done = useDone();
  const read = figureProgress(f, done);
  const tiles: Record<Section, { visual: ReactNode; line: string }> = {
    story: { visual: <TilePicture p={f.pictures.story} />, line: f.tagline },
    carried: { visual: <TilePicture p={f.pictures.carried} />, line: f.carried.map((c) => c.title).join(' · ') },
    learned: {
      visual: <Teachers f={f} />,
      line: f.studied.map((x) => x.title).join(' · '),
    },
    lessons: {
      visual: (
        <span className={s.tileBig} aria-hidden>
          {read}/{f.lessons.length}
        </span>
      ),
      line: t('hm.lessonsDone', { n: read, of: f.lessons.length }),
    },
    quotes: {
      visual: (
        <span className={s.tileQuote} aria-hidden>
          “{f.quotes[0]?.text}”
        </span>
      ),
      line: t('hm.quoteCount', { n: f.quotes.length }),
    },
    now: {
      visual: (
        <span className={s.tileNow} aria-hidden>
          <b>{f.name}</b>
          <i>↔</i>
          <b>{f.thenNow?.modern}</b>
        </span>
      ),
      line: t('hm.thenNowLine'),
    },
  };
  return (
    <div className={s.page}>
      <Link className={s.back} to="/minds">
        ← {t('hm.back')}
      </Link>
      <FigureCard figure={f} big pill={f.years} />
      <header className={s.heroText}>
        <span className={s.kicker}>{f.role}</span>
        <h1 className={s.title}>{f.name}</h1>
        <p className={s.lead}>{f.tagline}</p>
        <p className={s.fine}>{t('hm.progress', { n: read, of: f.lessons.length })}</p>
      </header>

      <FollowBox f={f} />

      <nav aria-label={t('hm.about', { name: f.name })}>
        <ul className={s.tiles}>
          {sectionsOf(f).map((x) => (
            <li key={x}>
              <Link to={sectionPath(f.id, x)} className={s.tile}>
                <span className={s.tileVisual}>{tiles[x].visual}</span>
                <span className={s.tileText}>
                  <b className={s.tileTitle}>{x === 'now' ? t('hm.thenNowTile') : sectionTitle(f, x)}</b>
                  <span className={s.tileLine}>{tiles[x].line}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** A tile's picture: the painting, cropped to fill, faces near the top. */
function TilePicture({ p }: { p: Picture }) {
  return <img className={s.tilePic} src={mindImageUrl(p.image)} alt="" decoding="async" loading="lazy" />;
}

/** The teachers' portraits on red; a teacher who isn't a figure here shows their picture, or their name. */
function Teachers({ f }: { f: Figure }) {
  const people = f.studied.flatMap((x) => x.figures.map((id) => figureById(id)).filter((o): o is Figure => !!o));
  if (people.length) {
    return (
      <span className={s.tileTeachers}>
        {people.slice(0, 3).map((o) => (
          <span key={o.id} className={s.tileFace}>
            <Portrait figure={o} />
          </span>
        ))}
      </span>
    );
  }
  const pic = f.studied.find((x) => x.picture)?.picture;
  if (pic) return <TilePicture p={pic} />;
  // no portrait or picture: their names, like a book's title page
  return (
    <span className={s.tileQuote} aria-hidden>
      {f.studied.map((x) => x.title).join(' · ')}
    </span>
  );
}

/** A picture on a section page, with its credit under it. */
function Pic({ p }: { p: Picture }) {
  return (
    <figure className={s.pic}>
      <img src={mindImageUrl(p.image)} alt={t('hm.picAlt', { credit: p.credit.split(',')[0]! })} decoding="async" />
      <figcaption className={s.picCredit}>{p.credit}</figcaption>
    </figure>
  );
}

const SWIPE = 60;

function SectionPage({ f, section }: { f: Figure; section: Section }) {
  const list = sectionsOf(f);
  const i = list.indexOf(section);
  const prev = list[i - 1];
  const next = list[i + 1];
  const navigate = useNavigate();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [params] = useSearchParams();
  // which side the page slides in from (set by the move that opened it)
  const from = (useLocation().state as { from?: string } | null)?.from ?? '';
  const go = (to: Section | undefined, dir: 'left' | 'right') => to && navigate(sectionPath(f.id, to), { state: { from: dir } });
  // a sideways swipe moves to the next or previous section (owner 2026-10-24: pages, not one long scroll)
  const touch = useRef<{ x: number; y: number } | null>(null);
  const focus = params.get('q');
  return (
    <div
      className={[s.page, !reduced && from === 'right' && s.inRight, !reduced && from === 'left' && s.inLeft].filter(Boolean).join(' ')}
      onTouchStart={(e) => {
        const p = e.touches[0]!;
        touch.current = { x: p.clientX, y: p.clientY };
      }}
      onTouchEnd={(e) => {
        const a = touch.current;
        touch.current = null;
        const p = e.changedTouches[0];
        if (!a || !p) return;
        const dx = p.clientX - a.x;
        const dy = p.clientY - a.y;
        if (Math.abs(dx) < SWIPE || Math.abs(dx) < 2 * Math.abs(dy)) return;
        if (dx < 0) go(next, 'right');
        else go(prev, 'left');
      }}
    >
      <Link className={s.back} to={`/minds/${f.id}`}>
        ← {f.name}
      </Link>
      <header className={s.heroText}>
        <span className={s.kicker}>
          {f.name} · {t('hm.partOf', { n: i + 1, of: list.length })}
        </span>
        <h1 className={s.title}>{sectionTitle(f, section)}</h1>
      </header>

      {section === 'story' && <Story f={f} />}
      {section === 'carried' && <Carried f={f} />}
      {section === 'learned' && <Learned f={f} />}
      {section === 'lessons' && <Lessons f={f} />}
      {section === 'quotes' && <Quotes f={f} focus={focus} />}
      {section === 'now' && <ThenNow f={f} />}

      <nav className={s.sectionNav} aria-label={t('hm.sections')}>
        {prev ? (
          <Link to={sectionPath(f.id, prev)} state={{ from: 'left' }} className={s.sectionPrev}>
            <span className={s.kicker}>← {t('hm.prevPart')}</span>
            <b>{prev === 'now' ? t('hm.thenNowTile') : sectionTitle(f, prev)}</b>
          </Link>
        ) : (
          <Link to={`/minds/${f.id}`} className={s.sectionPrev}>
            <span className={s.kicker}>← {t('hm.prevPart')}</span>
            <b>{f.name}</b>
          </Link>
        )}
        {next ? (
          <Link to={sectionPath(f.id, next)} state={{ from: 'right' }} className={s.sectionNext}>
            <span className={s.kicker}>{t('hm.nextPart')} →</span>
            <b>{next === 'now' ? t('hm.thenNowTile') : sectionTitle(f, next)}</b>
          </Link>
        ) : (
          <Link to={`/minds/${f.id}`} className={s.sectionNext}>
            <span className={s.kicker}>{t('hm.lastPart')}</span>
            <b>{t('hm.backToAll', { name: first(f) })}</b>
          </Link>
        )}
      </nav>
    </div>
  );
}

function Story({ f }: { f: Figure }) {
  return (
    <>
      <Pic p={f.pictures.story} />
      <Card pad>
        {f.story.map((p) => (
          <p key={p} className={s.p}>
            {p}
          </p>
        ))}
      </Card>
    </>
  );
}

function Carried({ f }: { f: Figure }) {
  return (
    <>
      <Pic p={f.pictures.carried} />
      <p className={s.fine}>{t('hm.carriedNote')}</p>
      <ul className={s.accounts}>
        {f.carried.map((c) => (
          <li key={c.title}>
            <Card as="article" pad>
              <h2 className={s.h3}>{c.title}</h2>
              <p className={s.p}>{c.text}</p>
              <p className={s.source}>— {c.source}</p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

function Learned({ f }: { f: Figure }) {
  return (
    <ul className={s.studied}>
      {f.studied.map((x) => (
        <li key={x.title}>
          <Card as="article" pad>
            <h2 className={s.h3}>{x.title}</h2>
            <p className={s.p}>{x.text}</p>
            <p className={s.source}>— {x.source}</p>
            {x.picture && !x.figures.length && <Pic p={x.picture} />}
            {x.figures.length > 0 && (
              <ul className={s.meetList}>
                {x.figures.map((id) => {
                  const o = figureById(id);
                  return o ? (
                    <li key={id}>
                      <FigureCard figure={o} to={`/minds/${id}`} pill={t('hm.meet', { name: first(o) }) + ' →'} />
                    </li>
                  ) : null;
                })}
              </ul>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Lessons({ f }: { f: Figure }) {
  const done = useDone();
  return (
    <ol className={s.lessons}>
      {f.lessons.map((l, i) => {
        const ref = lessonRef(f.id, l.id);
        if (l.scroll) {
          // a scroll lesson plays on its own page; here it's a card that opens it
          return (
            <li key={l.id}>
              <Link to={lessonPath(f.id, l.id)} className={s.playCard}>
                <span className={s.kicker}>
                  {t('hm.lessonN', { n: i + 1 })} · {t('sl.interactive')}
                </span>
                <h2 className={s.h3}>{l.title}</h2>
                <p className={s.p}>{t('sl.cardBody', { n: scrollTasks(l).length, xp: STEP_XP })}</p>
                <span className={s.playGo}>{done.includes(ref) ? t('sl.again') : t('sl.start')} →</span>
              </Link>
            </li>
          );
        }
        return (
          <li key={l.id}>
            <Card as="article" pad>
              <span className={s.kicker}>{t('hm.lessonN', { n: i + 1 })}</span>
              <h2 className={s.h3}>{l.title}</h2>
              {l.text.map((p) => (
                <p key={p} className={s.p}>
                  {p}
                </p>
              ))}
              <div className={s.trading}>
                <b>{t('hm.inTrading')}</b>
                <p>{l.trading}</p>
              </div>
              <div className={s.readRow}>
                <ReadButton refId={ref} done={done.includes(ref)} />
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

function Quotes({ f, focus }: { f: Figure; focus: string | null }) {
  const quoteRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // a frame later: the shell scrolls each new page to its top first
    const id = requestAnimationFrame(() => quoteRef.current?.scrollIntoView({ block: 'center' }));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <>
      <p className={s.fine}>{t('hm.quotesNote')}</p>
      <ul className={s.quotes}>
        {f.quotes.map((q) => (
          <li key={q.id} ref={q.id === focus ? quoteRef : undefined} className={q.id === focus ? s.quoteFocus : undefined}>
            <Card as="article" pad>
              <blockquote className={s.quote}>“{q.text}”</blockquote>
              <p className={s.source}>— {q.source}</p>
              <dl className={s.explainList}>
                <div>
                  <dt>{t('hm.plain')}</dt>
                  <dd>{q.plain}</dd>
                </div>
                <div className={s.tradingRow}>
                  <dt>{t('hm.inTrading')}</dt>
                  <dd>{q.trading}</dd>
                </div>
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Words only (owner 2026-10-24): no picture of the modern person, and a note that they don't endorse Zelos. */
function ThenNow({ f }: { f: Figure }) {
  if (!f.thenNow) return null;
  return (
    <Card pad>
      {f.thenNow.text.map((p) => (
        <p key={p} className={s.p}>
          {p}
        </p>
      ))}
      <div className={s.trading}>
        <b>{t('hm.inTrading')}</b>
        <p>{f.thenNow.trading}</p>
      </div>
      <p className={s.fine}>{MODERN_NOTE}</p>
    </Card>
  );
}

/** Daily quotes from this figure: FOLLOW_COST tokens for 30 days (renewing adds 30 more). */
function FollowBox({ f }: { f: Figure }) {
  const { user, isReal, openSignIn } = useAuth();
  const wallet = useWalletDoc(isReal && user ? user.uid : null);
  const w = wallet.status === 'ready' ? wallet.data : null;
  const now = useNow(60000);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const until = w?.mindQuotes[f.id] ?? 0;
  const on = until > now;
  const name = first(f);
  return (
    <Card pad className={s.follow}>
      <div className={s.followText}>
        <span className={s.followIcon} aria-hidden>
          <Icon name="bell" size={18} />
        </span>
        <div>
          <b>{t('hm.followTitle', { name })}</b>
          <p className={s.fine}>{on ? t('hm.followOn', { date: formatDate(until) }) : t('hm.followBody', { cost: FOLLOW_COST, days: FOLLOW_DAYS })}</p>
        </div>
      </div>
      {!isReal || !user ? (
        <Button size="sm" variant="secondary" onClick={() => void openSignIn()}>
          {t('hm.signIn')}
        </Button>
      ) : (
        <Button
          size="sm"
          variant={on ? 'secondary' : 'primary'}
          disabled={busy || wallet.status !== 'ready'}
          onClick={async () => {
            setBusy(true);
            try {
              await followFigure(f.id);
              toast.show(t('hm.followed', { name, days: FOLLOW_DAYS }), 'success');
            } catch (e) {
              toast.show(errorMessage(e), 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          {on ? t('hm.renew', { cost: FOLLOW_COST }) : t('hm.follow', { cost: FOLLOW_COST })}
        </Button>
      )}
      {on && <Badge tone="up">{t('hm.following')}</Badge>}
    </Card>
  );
}
