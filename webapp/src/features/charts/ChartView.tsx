/**
 * <ChartView>: the shared chart engine in a React component.
 *
 * Creates one engine instance per canvas, feeds it the series for the chosen timeframe,
 * and destroys it when the screen closes. While new data loads, the previous drawing
 * stays (dimmed) instead of flashing a skeleton. Pan (drag), zoom (wheel / pinch on the
 * engine's own handlers) and the crosshair legend come from the engine.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { Bar } from '../../data/markets';
import { engine, toSeries, type Forecast, type TradeChart } from './engine';
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
};

export function ChartView({ sym, seriesKey, bars, live, intraday, range, style, refPrice, forecast, onForecastEdit, loading, label }: ChartViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<TradeChart | null>(null);
  const series = useMemo(() => (bars.length ? toSeries(sym, seriesKey, bars, { live, intraday }) : null), [sym, seriesKey, bars, live, intraday]);

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

  // a new range on the same series only moves the window
  useEffect(() => {
    chartRef.current?.setRange(range);
  }, [range]);

  return (
    <div className={[s.wrap, loading && series && s.dim].filter(Boolean).join(' ')}>
      <canvas ref={canvasRef} className={s.canvas} role="img" aria-label={label} />
    </div>
  );
}
