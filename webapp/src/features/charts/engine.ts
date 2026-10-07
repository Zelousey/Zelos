/**
 * The chart engine shared with the classic site (practice/practice-chart.js), bundled into
 * the app. One engine means the app and the classic pages draw identical charts and keep
 * the same indicator, style and colour preferences (stored in localStorage by the engine).
 *
 * The engine is plain JavaScript that registers `window.ZelosTradeChart`; these types cover
 * the parts the app uses.
 */
import '../../../../practice/practice-chart.js';
import type { Bar } from '../../data/markets';

export type EngineSeries = { sym: string; key: string; d: string[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[]; n: number; live?: boolean; intraday?: boolean };
export type Indicator = { id: string; label: string };
export type Forecast = { entry: number; sl: number | null; tp: number | null; label?: string; side?: 'buy' | 'sell'; editable?: boolean };

export interface TradeChart {
  setSeries(s: EngineSeries, bars?: number | 'all'): void;
  setRange(bars: number | 'all'): void;
  setStyle(style: 'line' | 'candles'): void;
  toggle(id: string, on?: boolean): void;
  zoom(factor: number, x?: number): void;
  draw(): void;
  destroy(): void;
  style: 'line' | 'candles';
  show: Record<string, boolean>;
  refPrice: number | null;
  lines: { price: number; label: string; color?: string }[];
  forecast: Forecast | null;
  onForecastEdit: ((f: Forecast, which: 'sl' | 'tp') => void) | null;
  empty: string | null;
}

type EngineGlobal = {
  TradeChart: new (canvas: HTMLCanvasElement) => TradeChart;
  computeIndicators: (s: EngineSeries) => EngineSeries;
  INDICATORS: Indicator[];
};

export function engine(): EngineGlobal {
  const g = (window as unknown as { ZelosTradeChart?: EngineGlobal }).ZelosTradeChart;
  if (!g) throw new Error('chart engine not loaded');
  return g;
}

export function toSeries(sym: string, key: string, bars: Bar[], extra: { live?: boolean; intraday?: boolean } = {}): EngineSeries {
  const s: EngineSeries = { sym, key, d: [], o: [], h: [], l: [], c: [], v: [], n: bars.length, ...extra };
  for (const b of bars) {
    s.d.push(b[0]);
    s.o.push(b[1]);
    s.h.push(b[2]);
    s.l.push(b[3]);
    s.c.push(b[4]);
    s.v.push(b[5]);
  }
  return engine().computeIndicators(s);
}
