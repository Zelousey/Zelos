/**
 * <ChartView>: the shared chart engine in a React component.
 *
 * Creates one engine instance per canvas, feeds it the series for the chosen timeframe,
 * and destroys it when the screen closes. While new data loads, the previous drawing
 * stays (dimmed) instead of flashing a skeleton. Pan (drag), zoom (wheel / pinch on the
 * engine's own handlers) and the crosshair legend come from the engine.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Bar } from '../../data/markets';
import { engine, SHAPE_POINTS, toSeries, type Forecast, type Shape, type ShapeColor, type ShapeKind, type TradeChart } from './engine';
import { ChartTools, type ToolsActions } from './ChartTools';
import s from './ChartView.module.css';

export type ChartViewProps = {
  sym: string;
  seriesKey: string;
  bars: Bar[];
  live?: boolean;
  intraday?: boolean;
  range: number | 'all';
  style: 'line' | 'candles';
  refPrice?: number | null;
  forecast?: Forecast | null;
  onForecastEdit?: (f: Forecast, which: 'sl' | 'tp') => void;
  loading?: boolean;
  label: string;
  /** coach plays: drawings shown on the chart */
  shapes?: Shape[];
  /** while set, pointer input draws this kind of shape instead of panning the chart */
  drawTool?: ShapeKind | null;
  drawColor?: ShapeColor;
  onDrawn?: (s: Shape) => void;
  /** show the chart tools (indicators, Fibonacci, price alerts) under the chart */
  tools?: boolean;
};

export function ChartView({ sym, seriesKey, bars, live, intraday, range, style, refPrice, forecast, onForecastEdit, loading, label, shapes, drawTool, drawColor = 'blue', onDrawn, tools }: ChartViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<TradeChart | null>(null);
  // chart tools: Fibonacci, placing an alert, and this symbol's alerts (rev bumps when the store changes)
  const [fib, setFib] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [rev, setRev] = useState(0);
  const alerts = useMemo(() => (tools && rev >= 0 ? engine().alerts.forSym(sym) : []), [tools, sym, rev]); // rev: re-read after a change
  const series = useMemo(() => (bars.length ? toSeries(sym, seriesKey, bars, { live, intraday }) : null), [sym, seriesKey, bars, live, intraday]);
  const last = series ? (series.c[series.n - 1] ?? null) : null;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const chart = new (engine().TradeChart)(cv);
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const c = chartRef.current;
    if (!c) return;
    if (c.style !== style) c.setStyle(style);
    c.refPrice = refPrice ?? null;
    c.forecast = forecast ?? null;
    c.onForecastEdit = onForecastEdit ?? null;
    if (series) {
      c.empty = null;
      c.setSeries(series, range);
    } else c.draw();
  }, [series, style, refPrice, forecast, onForecastEdit, range]);

  useEffect(() => {
    const c = chartRef.current;
    if (!c) return;
    c.shapes = shapes ?? [];
    c.draw();
  }, [shapes]);

  // chart tools: the engine draws Fibonacci and alert lines, and reports taps and drags
  useEffect(() => {
    const c = chartRef.current;
    if (!c || !tools) return;
    const store = engine().alerts;
    const bump = () => setRev((r) => r + 1);
    c.fib = fib;
    c.placing = placing ? 'alert' : null;
    c.alerts = alerts;
    c.onPlaceAlert = (price) => {
      store.add(sym, price, last);
      setPlacing(false);
      bump();
    };
    c.onAlertMove = (a) => {
      store.update(a.id, a.price, last);
      bump();
    };
    c.draw();
    const onStorage = (e: StorageEvent) => e.key === 'zelosTwAlerts' && bump();
    window.addEventListener('storage', onStorage);
    window.addEventListener('zelos:alerts', bump);
    return () => {
      c.onPlaceAlert = null;
      c.onAlertMove = null;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('zelos:alerts', bump);
    };
  }, [tools, fib, placing, alerts, sym, last]);
  const act: ToolsActions = {
    readShow: () => ({ ...(chartRef.current?.show ?? {}) }),
    toggle: (id, on) => chartRef.current?.toggle(id, on),
    flipFib: () => setFib((v) => !v),
    flipPlacing: () => setPlacing((v) => !v),
    remove: (id) => {
      engine().alerts.remove(id);
      window.dispatchEvent(new Event('zelos:alerts'));
    },
  };

  // drawing: one point (level, label) on tap; two points (line, arrow, box) by dragging
  const draft = useRef<Shape | null>(null);
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const c = chartRef.current;
    const r = canvasRef.current?.getBoundingClientRect();
    return c && r ? c.pointAt(e.clientX - r.left, e.clientY - r.top) : null;
  };
  const setDraft = (sh: Shape | null) => {
    draft.current = sh;
    const c = chartRef.current;
    if (c) {
      c.shapeDraft = sh;
      c.draw();
    }
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!drawTool) return;
    const pt = at(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (SHAPE_POINTS[drawTool] === 1) onDrawn?.({ k: drawTool, c: drawColor, pts: [pt] });
    else setDraft({ k: drawTool, c: drawColor, pts: [pt, pt] });
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = draft.current;
    const pt = d && at(e);
    if (d && pt) setDraft({ ...d, pts: [d.pts[0]!, pt] });
  };
  const up = () => {
    const d = draft.current;
    setDraft(null);
    if (d && (d.pts[0]!.d !== d.pts[1]!.d || d.pts[0]!.p !== d.pts[1]!.p)) onDrawn?.(d);
  };

  // a new range on the same series only moves the window
  useEffect(() => {
    chartRef.current?.setRange(range);
  }, [range]);

  const view = (
    <div className={[s.wrap, loading && series && s.dim].filter(Boolean).join(' ')}>
      <canvas ref={canvasRef} className={s.canvas} role="img" aria-label={label} />
      {drawTool && <div className={s.drawLayer} data-testid="draw-layer" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDraft(null)} />}
    </div>
  );
  if (!tools) return view;
  return (
    <div className={s.withTools}>
      {view}
      <ChartTools sym={sym} state={{ fib, placing, alerts }} act={act} />
    </div>
  );
}
