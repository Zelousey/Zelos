/**
 * One great mind (/minds/:id): the big red card, short lessons each ending in "Use it in
 * trading", real quotes (each with its source, a plain-words version and what it means for
 * trading), the head-to-heads they are in, and the daily quote (FOLLOW_COST tokens / 30 days).
 * ?q=<quote id> (from a daily-quote notification) opens on that quote.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { useUserDoc } from '../../data/userDoc';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Button, Card, EmptyState, Icon, useToast } from '../../ui';
import { errorMessage } from '../practice/actions';
import { useWalletDoc } from '../strategies/strategies';
import { FigureCard } from './MindCard';
import { figureById, figureProgress, FOLLOW_COST, MODERN_NOTE, FOLLOW_DAYS, followFigure, lessonPath, lessonRef, scrollTasks, STEP_XP, type Figure } from './minds';
import { ReadButton } from './ReadButton';
import s from './Minds.module.css';

export function FigurePage() {
  const { id = '' } = useParams();
  const f = figureById(id);
  if (!f) return <EmptyState icon="learn" title={t('hm.missing')} actions={<Link to="/minds">{t('hm.back')}</Link>} />;
  return <Figure key={f.id} f={f} />;
}

function Figure({ f }: { f: Figure }) {
  const { user, isReal } = useAuth();
  const me = useUserDoc(isReal && user ? user.uid : null);
  const done = me.status === 'ready' ? me.data.mindsDone : [];
  const [params] = useSearchParams();
  const focus = params.get('q');
  const quoteRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    quoteRef.current?.scrollIntoView({ block: 'center' });
  }, []);
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
        <p className={s.fine}>{t('hm.progress', { n: figureProgress(f, done), of: f.lessons.length })}</p>
      </header>

      <FollowBox f={f} />

      <section aria-labelledby="hm-story">
        <h2 id="hm-story" className={s.h2}>
          {t('hm.story')}
        </h2>
        <Card pad>
          {f.story.map((p) => (
            <p key={p} className={s.p}>
              {p}
            </p>
          ))}
        </Card>
      </section>

      <section aria-labelledby="hm-carried">
        <h2 id="hm-carried" className={s.h2}>
          {t('hm.carried')}
        </h2>
        <p className={s.fine}>{t('hm.carriedNote')}</p>
        <ul className={s.accounts}>
          {f.carried.map((c) => (
            <li key={c.title}>
              <Card as="article" pad>
                <h3 className={s.h3}>{c.title}</h3>
                <p className={s.p}>{c.text}</p>
                <p className={s.source}>— {c.source}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {f.studied.length > 0 && (
        <section aria-labelledby="hm-studied">
          <h2 id="hm-studied" className={s.h2}>
            {t('hm.studied')}
          </h2>
          <ul className={s.accounts}>
            {f.studied.map((x) => (
              <li key={x.title}>
                <Card as="article" pad>
                  <h3 className={s.h3}>{x.title}</h3>
                  <p className={s.p}>{x.text}</p>
                  <p className={s.source}>— {x.source}</p>
                  {x.figures.map((id) => {
                    const o = figureById(id);
                    return o ? (
                      <Link key={id} className={s.seeAlso} to={`/minds/${id}`}>
                        {t('hm.meet', { name: o.name })} →
                      </Link>
                    ) : null;
                  })}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="hm-lessons">
        <h2 id="hm-lessons" className={s.h2}>
          {t('hm.lessons', { name: f.name.split(' ')[0]! })}
        </h2>
        <ol className={s.lessons}>
          {f.lessons.map((l, i) => {
            const ref = lessonRef(f.id, l.id);
            if (l.scroll) {
              // a scroll lesson plays on its own page; here it's a card that opens it
              return (
                <li key={l.id}>
                  <Link to={lessonPath(f.id, l.id)} className={s.playCard}>
                    <span className={s.kicker}>{t('hm.lessonN', { n: i + 1 })} · {t('sl.interactive')}</span>
                    <h3 className={s.h3}>{l.title}</h3>
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
                  <h3 className={s.h3}>{l.title}</h3>
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
      </section>

      <section aria-labelledby="hm-quotes">
        <h2 id="hm-quotes" className={s.h2}>
          {t('hm.quotes', { name: f.name.split(' ')[0]! })}
        </h2>
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
      </section>

      {f.thenNow && (
        <section aria-labelledby="hm-now">
          <h2 id="hm-now" className={s.h2}>
            {t('hm.thenNow', { name: f.name.split(' ')[0]!, modern: f.thenNow.modern })}
          </h2>
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
        </section>
      )}

    </div>
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
  const first = f.name.split(' ')[0]!;
  return (
    <Card pad className={s.follow}>
      <div className={s.followText}>
        <span className={s.followIcon} aria-hidden>
          <Icon name="bell" size={18} />
        </span>
        <div>
          <b>{t('hm.followTitle', { name: first })}</b>
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
              toast.show(t('hm.followed', { name: first, days: FOLLOW_DAYS }), 'success');
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
