/**
 * The chart beside the Options trade card (owner 2026-11-10): a button on the left of the card
 * opens the stock's chart in a small window that floats over the page, so it stays in sight while
 * you scroll the card. Hold its top bar to drag it anywhere on the screen; its spot is remembered.
 */
import { useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { readString, writeString } from '../../lib/storage';
import { Button, Change, Icon, Tabs } from '../../ui';
import { ChartView } from '../charts/ChartView';
import { TIMEFRAMES, type Timeframe } from '../charts/series';
import { useSymbolBars } from '../charts/useSymbolBars';
import s from './FloatingChart.module.css';

const POS_KEY = 'zelosOptChartPos';
const TFS: Timeframe[] = ['15m', 'D'];
type Pos = { x: number; y: number };

function startPos(): Pos {
  try {
    const p = JSON.parse(readString(POS_KEY) ?? 'null') as Pos | null;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
  } catch {
    /* ignore */
  }
  return { x: Math.max(8, window.innerWidth - 440), y: 96 };
}

const clamp = (p: Pos, w: number, h: number): Pos => ({
  x: Math.min(Math.max(0, p.x), Math.max(0, window.innerWidth - w)),
  y: Math.min(Math.max(0, p.y), Math.max(0, window.innerHeight - Math.min(h, 60))),
});

/** The button for the card's left side, and the window it opens. */
export function ChartButton({ sym }: { sym: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={open ? 'primary' : 'secondary'} size="sm" className={s.open} aria-pressed={open} onClick={() => setOpen((x) => !x)}>
        <Icon name="chart" size={16} /> {open ? t('optChart.hide') : t('optChart.show')}
      </Button>
      {open && <FloatingChart sym={sym} onClose={() => setOpen(false)} />}
    </>
  );
}

function FloatingChart({ sym, onClose }: { sym: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>(startPos);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [tf, setTf] = useState<Timeframe>('15m');
  const tfDef = TIMEFRAMES.find((x) => x.id === tf)!;
  const { quote, built, loading } = useSymbolBars(sym, tf);

  // keep it on screen when the window is resized
  useEffect(() => {
    const on = () => {
      const r = box.current?.getBoundingClientRect();
      if (r) setPos((p) => clamp(p, r.width, r.height));
    };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return; // the close button isn't a handle
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const r = box.current?.getBoundingClientRect();
    setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }, r?.width ?? 420, r?.height ?? 300));
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    writeString(POS_KEY, JSON.stringify(pos));
  };
  // arrow keys move it too (the handle is focusable)
  const key = (e: RKeyboardEvent<HTMLDivElement>) => {
    const d = e.shiftKey ? 40 : 12;
    const moves: Record<string, Pos> = { ArrowLeft: { x: -d, y: 0 }, ArrowRight: { x: d, y: 0 }, ArrowUp: { x: 0, y: -d }, ArrowDown: { x: 0, y: d } };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    const r = box.current?.getBoundingClientRect();
    const next = clamp({ x: pos.x + m.x, y: pos.y + m.y }, r?.width ?? 420, r?.height ?? 300);
    setPos(next);
    writeString(POS_KEY, JSON.stringify(next));
  };

  return (
    <div ref={box} className={s.win} style={{ left: pos.x, top: pos.y }} role="dialog" aria-modal="false" aria-label={t('optChart.title', { sym })}>
      <div className={s.handle} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key} tabIndex={0} aria-label={t('optChart.move')}>
        <Icon name="menu" size={14} />
        <b className={s.sym}>{sym}</b>
        {quote?.c != null && <span className={s.price}>{formatPrice(quote.c)}</span>}
        <Change pct={quote?.chPct} />
        <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')} onClick={onClose} className={s.close}>
          <Icon name="close" size={16} />
        </Button>
      </div>
      <div className={s.tfs}>
        <Tabs label={t('chart.timeframe')} value={tf} onChange={setTf} items={TFS.map((x) => ({ value: x, label: TIMEFRAMES.find((z) => z.id === x)!.label }))} />
      </div>
      <div className={s.chart}>
        <ChartView sym={sym} seriesKey={`opt-float:${sym}:${tf}`} bars={built.bars} live={built.live} intraday={built.intraday} range={tfDef.def} style="candles" loading={loading} label={t('chart.label', { sym, tf: tfDef.label })} />
      </div>
    </div>
  );
}
