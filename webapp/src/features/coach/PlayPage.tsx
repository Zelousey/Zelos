/**
 * One play (/coach/:id/play/:playId), for the coach and the student: the coach's drawings on
 * the live chart of that stock and timeframe, the title and note, Buy / Sell to act on it in
 * Practice, and the comments (either side). Opened from "Your coach drew up a play" in the bell.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Button, buttonClass, Card, EmptyState, Field, LoadingState, PageHeader, useToast } from '../../ui';
import { ChartView } from '../charts/ChartView';
import { TIMEFRAMES } from '../charts/series';
import { useSymbolBars } from '../charts/useSymbolBars';
import { errorText } from '../invites/invites';
import { useCoaching } from './coach';
import { commentPlay, MAX_COMMENT, usePlay, type Play } from './plays';
import s from './Plays.module.css';

export default function PlayPage() {
  const { id = '', playId = '' } = useParams();
  const { user, isReal } = useAuth();
  const okIds = /^[A-Za-z0-9_-]{6,260}$/.test(id) && /^[A-Za-z0-9]{10,40}$/.test(playId);
  const c = useCoaching(okIds ? id : null);
  const p = usePlay(okIds && c.status === 'ready' ? id : null, okIds ? playId : null);
  if (!isReal || !user) return <EmptyState icon="missions" body={t('co.signIn')} />;
  if (c.status === 'loading' || (c.status === 'ready' && p.status === 'loading')) return <LoadingState rows={6} />;
  if (c.status !== 'ready' || !c.data || p.status !== 'ready' || !p.data)
    return (
      <EmptyState
        icon="missions"
        body={t('play.missing')}
        actions={
          <Link to={`/coach/${id}`} className={s.back}>
            ← {t('play.back')}
          </Link>
        }
      />
    );
  return <View play={p.data} coachingId={id} uid={user.uid} active={c.data.status === 'active'} />;
}

function View({ play, coachingId, uid, active }: { play: Play; coachingId: string; uid: string; active: boolean }) {
  const { built, loading } = useSymbolBars(play.sym, play.tf);
  const tfDef = TIMEFRAMES.find((x) => x.id === play.tf)!;
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await commentPlay({ coachingId, playId: play.id, text: text.trim() });
      setText('');
    } catch (err) {
      toast.show(errorText(err, t('co.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  const trade = `/practice/trade/${encodeURIComponent(play.sym)}`;
  return (
    <>
      <Link to={`/coach/${coachingId}`} className={s.back}>
        ← {t('play.back')}
      </Link>
      <PageHeader title={play.title} subtitle={t('play.by', { name: play.fromName, sym: play.sym, tf: tfDef.label, when: formatRelative(play.at) })} keepOnPhone />
      <div className={s.layout}>
        <Card flush>
          <div className={s.chart}>
            {built.bars.length === 0 && !loading ? (
              <EmptyState icon="chart" body={t('chart.noData', { sym: play.sym })} compact />
            ) : (
              <ChartView sym={play.sym} seriesKey={`${play.sym}:${play.tf}:play-view`} bars={built.bars} live={built.live} intraday={built.intraday} range={tfDef.def} style="candles" loading={loading} label={t('play.chartLabel', { sym: play.sym, n: play.shapes.length })} shapes={play.shapes} />
            )}
          </div>
          <p className={s.hint}>{t('play.liveHint')}</p>
        </Card>
        <div className={s.side}>
          {play.note && (
            <Card pad title={t('play.note')}>
              <p className={s.noteText}>{play.note}</p>
            </Card>
          )}
          <div className={s.tradeBtns}>
            <Link className={buttonClass({ variant: 'buy', size: 'lg', block: true })} to={`${trade}?side=buy`} aria-label={t('trade.buyLabelPlay', { sym: play.sym })}>
              {t('trade.buy')} {play.sym}
            </Link>
            <Link className={buttonClass({ variant: 'sell', size: 'lg', block: true })} to={`${trade}?side=sell`} aria-label={t('trade.sellLabelPlay', { sym: play.sym })}>
              {t('trade.sell')} {play.sym}
            </Link>
          </div>
          <Card title={t('play.comments', { n: play.comments.length })}>
            {play.comments.length === 0 ? (
              <p className={s.muted}>{t('play.noComments')}</p>
            ) : (
              <ul className={s.comments}>
                {play.comments.map((cm, i) => (
                  <li key={i} className={cm.from === uid ? s.mine : undefined}>
                    <span className={s.commentHead}>
                      <b>{cm.fromName}</b> <span className={s.muted}>{formatRelative(cm.at)}</span>
                    </span>
                    <span>{cm.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {active && (
              <form className={s.commentForm} onSubmit={send}>
                <Field label={t('play.addComment')} value={text} maxLength={MAX_COMMENT} onChange={(e) => setText(e.target.value)} />
                <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
                  {t('co.send')}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
