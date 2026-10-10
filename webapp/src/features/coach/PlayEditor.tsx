/**
 * Draw up a play (/coach/:id/play/new, coach only): pick a stock and a timeframe, draw on the
 * live chart (line, arrow, price level, box, label; four colours; undo and clear), give it a
 * title and a note, and send it. The student gets "Your coach drew up a play" in the bell.
 */
import { useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { UNIVERSE } from '../../data/universe';
import { useAuth } from '../../lib/auth';
import { t, type MessageKey } from '../../lib/i18n';
import { Button, Card, Confirm, EmptyState, Field, LoadingState, PageHeader, Sheet, Tabs, useToast } from '../../ui';
import { ChartView } from '../charts/ChartView';
import type { Shape, ShapeColor, ShapeKind } from '../charts/engine';
import { TIMEFRAMES, type Timeframe } from '../charts/series';
import { useSymbolBars } from '../charts/useSymbolBars';
import { errorText } from '../invites/invites';
import { useCoaching } from './coach';
import { MAX_NOTE, MAX_SHAPES, MAX_TITLE, PLAY_TFS, sendPlay } from './plays';
import s from './Plays.module.css';

const TOOLS: (ShapeKind | null)[] = [null, 'line', 'arrow', 'hline', 'box', 'text'];
const COLORS: ShapeColor[] = ['blue', 'green', 'red', 'gold'];

export default function PlayEditor() {
  const id = useParams().id ?? '';
  const { user, isReal } = useAuth();
  const c = useCoaching(/^[A-Za-z0-9_-]{6,260}$/.test(id) ? id : null);
  if (!isReal || !user) return <EmptyState icon="missions" body={t('co.signIn')} />;
  if (c.status === 'loading') return <LoadingState rows={6} />;
  if (c.status !== 'ready' || !c.data || c.data.coach !== user.uid || c.data.status !== 'active')
    return (
      <EmptyState
        icon="missions"
        body={t('play.coachOnly')}
        actions={
          <Link to={`/coach/${id}`} className={s.back}>
            ← {t('play.back')}
          </Link>
        }
      />
    );
  return <Editor coachingId={id} student={c.data.studentName} />;
}

function Editor({ coachingId, student }: { coachingId: string; student: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [sym, setSym] = useState('AAPL');
  const [tf, setTf] = useState<Timeframe>('D');
  const [tool, setTool] = useState<ShapeKind | null>('line');
  const [color, setColor] = useState<ShapeColor>('blue');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [labelAt, setLabelAt] = useState<Shape | null>(null);
  const [labelText, setLabelText] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { built, loading } = useSymbolBars(sym, tf);
  const tfDef = TIMEFRAMES.find((x) => x.id === tf)!;
  const symId = useId();
  const labelTitle = useId();
  const full = shapes.length >= MAX_SHAPES;

  const add = (sh: Shape) => {
    if (full) return toast.show(t('play.full', { n: MAX_SHAPES }), 'error');
    if (sh.k === 'text') {
      setLabelText('');
      setLabelAt(sh);
    } else setShapes((x) => [...x, sh]);
  };
  // drawings belong to one chart: switching stock or timeframe starts over (after asking)
  const [pending, setPending] = useState<(() => void) | null>(null);
  const changeChart = (fn: () => void) => {
    if (shapes.length) return setPending(() => fn);
    fn();
  };

  async function send() {
    setBusy(true);
    try {
      const { playId } = await sendPlay({ coachingId, sym, tf, title: title.trim(), note: note.trim(), shapes });
      toast.show(t('play.sent', { name: student }), 'success');
      navigate(`/coach/${coachingId}/play/${playId}`);
    } catch (e) {
      toast.show(errorText(e, t('co.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link to={`/coach/${coachingId}`} className={s.back}>
        ← {t('play.back')}
      </Link>
      <PageHeader title={t('play.new', { name: student })} subtitle={t('play.newSub')} keepOnPhone />
      <div className={s.layout}>
        <Card flush>
          <div className={s.controls}>
            <label className={s.select} htmlFor={symId}>
              {t('opt.stock')}
              <select id={symId} value={sym} onChange={(e) => changeChart(() => setSym(e.target.value))}>
                {UNIVERSE.map((i) => (
                  <option key={i.sym} value={i.sym}>
                    {i.sym} · {i.name}
                  </option>
                ))}
              </select>
            </label>
            <Tabs label={t('chart.timeframe')} value={tf} onChange={(v) => changeChart(() => setTf(v))} items={PLAY_TFS.map((id) => ({ value: id, label: TIMEFRAMES.find((z) => z.id === id)!.label }))} />
          </div>
          <div className={s.toolbar} role="toolbar" aria-label={t('play.tools')}>
            <div className={s.group}>
              {TOOLS.map((k) => (
                <button key={k ?? 'move'} type="button" className={s.tool} aria-pressed={tool === k} onClick={() => setTool(k)}>
                  {t(`play.tool.${k ?? 'move'}` as MessageKey)}
                </button>
              ))}
            </div>
            <div className={s.group} role="radiogroup" aria-label={t('play.color')}>
              {COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={t(`play.color.${c}` as MessageKey)} className={[s.swatch, s[c]].join(' ')} onClick={() => setColor(c)} />
              ))}
            </div>
            <div className={s.group}>
              <button type="button" className={s.tool} disabled={!shapes.length} onClick={() => setShapes((x) => x.slice(0, -1))}>
                {t('play.undo')}
              </button>
              <button type="button" className={s.tool} disabled={!shapes.length} onClick={() => setShapes([])}>
                {t('play.clear')}
              </button>
            </div>
          </div>
          <div className={s.chart}>
            {built.bars.length === 0 && !loading ? (
              <EmptyState icon="chart" body={t('chart.noData', { sym })} compact />
            ) : (
              <ChartView sym={sym} seriesKey={`${sym}:${tf}:play`} bars={built.bars} live={built.live} intraday={built.intraday} range={tfDef.def} style="candles" loading={loading} label={t('play.chartLabel', { sym, n: shapes.length })} shapes={shapes} drawTool={tool} drawColor={color} onDrawn={add} />
            )}
          </div>
          <p className={s.hint}>{tool ? t(`play.hint.${tool}` as MessageKey) : t('play.hint.move')} · {t('play.count', { n: shapes.length, max: MAX_SHAPES })}</p>
        </Card>
        <Card pad>
          <form
            className={s.form}
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Field label={t('play.title')} value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} placeholder={t('play.titleEg')} />
            <label className={s.textarea}>
              {t('play.note')}
              <textarea value={note} maxLength={MAX_NOTE} rows={4} onChange={(e) => setNote(e.target.value)} placeholder={t('play.noteEg')} />
            </label>
            <Button type="submit" variant="primary" size="lg" disabled={busy || !title.trim() || !shapes.length}>
              {t('play.send', { name: student })}
            </Button>
            {!shapes.length && <p className={s.hint}>{t('play.drawFirst')}</p>}
          </form>
        </Card>
      </div>
      <Confirm
        open={!!pending}
        title={t('play.clearTitle')}
        action={t('play.clear')}
        variant="danger"
        onClose={() => setPending(null)}
        onConfirm={() => {
          setShapes([]);
          pending?.();
          setPending(null);
        }}
      >
        <p>{t('play.clearConfirm')}</p>
      </Confirm>
      <Sheet open={!!labelAt} onClose={() => setLabelAt(null)} title={t('play.labelTitle')} placement="center" labelledBy={labelTitle}>
        <form
          className={s.labelForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (labelAt && labelText.trim()) setShapes((x) => [...x, { ...labelAt, text: labelText.trim().slice(0, 80) }]);
            setLabelAt(null);
          }}
        >
          <Field label={t('play.labelText')} value={labelText} maxLength={80} autoFocus onChange={(e) => setLabelText(e.target.value)} />
          <Button type="submit" variant="primary" disabled={!labelText.trim()}>
            {t('play.addLabel')}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
