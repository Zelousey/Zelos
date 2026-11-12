/**
 * Drawing on the stock chart (owner's chart plan, step 3, 2026-11-12): a Draw menu (trend line,
 * ray, arrow, horizontal line and ray, vertical line, rectangle, text, in four colours) and a
 * Measure tool (price change and %, bars, days and volume between two points). Drawings are
 * pinned to bar dates and prices, so they stay put when you zoom or change timeframe, and are
 * saved on this device per stock. The engine draws them (practice-chart.js, shapes).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { readJSON, writeString } from '../../lib/storage';
import { t, type MessageKey } from '../../lib/i18n';
import { Button, Field, Icon, Sheet, type IconName } from '../../ui';
import { SHAPE_POINTS, type Shape, type ShapeColor, type ShapeKind, type ShapePoint } from './engine';
import s from './DrawTools.module.css';

const KEY = (sym: string) => `zelosAppDrawings:${sym}`;
const MAX = 60;

export const DRAW_TOOLS: [ShapeKind, IconName, MessageKey][] = [
  ['line', 'dTrend', 'draw.line'],
  ['ray', 'dRay', 'draw.ray'],
  ['arrow', 'dArrow', 'draw.arrow'],
  ['hline', 'dHline', 'draw.hline'],
  ['hray', 'dHray', 'draw.hray'],
  ['vline', 'dVline', 'draw.vline'],
  ['box', 'dBox', 'draw.box'],
  ['text', 'dText', 'draw.text'],
];
/** forecasting extras (owner's step 6): what-if bars and anchored VWAP */
export const FORECAST_TOOLS: [ShapeKind, IconName, MessageKey][] = [
  ['avwap', 'dAvwap', 'draw.avwap'],
  ['pattern', 'dPattern', 'draw.pattern'],
  ['ghost', 'dGhost', 'draw.ghost'],
];
const COLORS: [ShapeColor, MessageKey][] = [
  ['blue', 'draw.c.blue'],
  ['green', 'draw.c.green'],
  ['red', 'draw.c.red'],
  ['gold', 'draw.c.gold'],
];
const HINT: Partial<Record<ShapeKind, MessageKey>> = { measure: 'draw.hint.measure', avwap: 'draw.hint.avwap', pattern: 'draw.hint.pattern', ghost: 'draw.hint.ghost' };
const SWATCH: Record<ShapeColor, string> = { blue: 'var(--accent)', green: 'var(--bull)', red: 'var(--danger)', gold: 'var(--gold)' };

/** Saved drawings for a stock (the measure box is never saved). */
export function loadDrawings(sym: string): Shape[] {
  const v = readJSON<unknown>(KEY(sym), []);
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Shape => !!x && typeof x === 'object' && typeof (x as Shape).k === 'string' && (x as Shape).k !== 'measure' && Array.isArray((x as Shape).pts) && (x as Shape).pts.length === SHAPE_POINTS[(x as Shape).k]).slice(-MAX);
}

export function useDrawTools(sym: string) {
  const [saved, setSaved] = useState<Shape[]>(() => loadDrawings(sym));
  const [measure, setMeasure] = useState<Shape | null>(null);
  const [tool, setTool] = useState<ShapeKind | null>(null);
  const [color, setColor] = useState<ShapeColor>('blue');
  const [menu, setMenu] = useState(false);
  const [textAt, setTextAt] = useState<ShapePoint | null>(null);
  const [text, setText] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const save = (list: Shape[]) => {
    const next = list.slice(-MAX);
    setSaved(next);
    writeString(KEY(sym), JSON.stringify(next));
  };

  // a click outside the menu closes it; Esc leaves the tool
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menu]);
  useEffect(() => {
    if (!tool && !menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(false);
      setTool(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, menu]);

  const onDrawn = (drawn: Shape) => {
    let sh = drawn;
    if (sh.k === 'measure') {
      setMeasure(sh);
      setTool(null);
      return;
    }
    // anchored VWAP and a bars pattern are pinned to real bars; a ghost feed points into the future
    if (sh.k === 'avwap' || sh.k === 'pattern') sh = { ...sh, pts: sh.pts.map((q) => ({ d: q.d, p: q.p })) };
    if (sh.k === 'ghost' && !sh.pts[0]?.f) sh = { ...sh, pts: [{ ...sh.pts[0]!, f: 10 }] };
    if (sh.k === 'text') {
      setTextAt(sh.pts[0]!);
      setText('');
      setTool(null);
      return;
    }
    save([...saved, sh]);
    setTool(null); // one drawing per pick, then the chart pans again (like a trading app)
  };

  const pick = (k: ShapeKind) => {
    setMenu(false);
    setMeasure(null);
    setTool((cur) => (cur === k ? null : k));
  };

  const toolKey: MessageKey | undefined = tool === 'measure' ? 'draw.measure' : [...DRAW_TOOLS, ...FORECAST_TOOLS].find((x) => x[0] === tool)?.[2];
  const twoPoint = tool ? SHAPE_POINTS[tool] === 2 : false;

  const buttons: ReactNode = (
    <>
      <div className={s.menuWrap} ref={menuRef}>
        <Button size="sm" variant={tool && tool !== 'measure' ? 'primary' : 'ghost'} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          <Icon name="pencil" size={16} /> {t('draw.title')}
        </Button>
        {menu && (
          <div className={s.menu} role="menu" aria-label={t('draw.title')}>
            {DRAW_TOOLS.map(([k, icon, label]) => (
              <button key={k} type="button" role="menuitemradio" aria-checked={tool === k} className={s.item} onClick={() => pick(k)}>
                <Icon name={icon} size={18} />
                <span>{t(label)}</span>
              </button>
            ))}
            <div className={s.groupLabel}>{t('draw.forecastGroup')}</div>
            {FORECAST_TOOLS.map(([k, icon, label]) => (
              <button key={k} type="button" role="menuitemradio" aria-checked={tool === k} className={s.item} onClick={() => pick(k)}>
                <Icon name={icon} size={18} />
                <span>{t(label)}</span>
              </button>
            ))}
            <div className={s.colors} role="radiogroup" aria-label={t('draw.color')}>
              {COLORS.map(([c, label]) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={t(label)} title={t(label)} className={s.swatch} style={{ background: SWATCH[c] }} onClick={() => setColor(c)} />
              ))}
            </div>
            {saved.length > 0 && (
              <div className={s.manage}>
                <button type="button" role="menuitem" className={s.item} onClick={() => save(saved.slice(0, -1))}>
                  <Icon name="undo" size={18} />
                  <span>{t('draw.undo')}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={s.item}
                  onClick={() => {
                    save([]);
                    setMeasure(null);
                    setMenu(false);
                  }}
                >
                  <Icon name="trash" size={18} />
                  <span>{t('draw.clear', { n: saved.length })}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <Button size="sm" variant={tool === 'measure' ? 'primary' : 'ghost'} aria-pressed={tool === 'measure'} onClick={() => pick('measure')}>
        <Icon name="ruler" size={16} /> {t('draw.measure')}
      </Button>
    </>
  );

  const note: ReactNode = tool ? (
    <p className={s.note} role="status">
      <b>{toolKey ? t(toolKey) : ''}</b> {t(HINT[tool] ?? (twoPoint ? 'draw.hint.drag' : 'draw.hint.tap'))}{' '}
      <button type="button" className={s.cancel} onClick={() => setTool(null)}>
        {t('draw.cancel')}
      </button>
    </p>
  ) : measure ? (
    <p className={s.note} role="status">
      {t('draw.measured')}{' '}
      <button type="button" className={s.cancel} onClick={() => setMeasure(null)}>
        {t('draw.hide')}
      </button>
    </p>
  ) : null;

  const textSheet: ReactNode = (
    <Sheet open={!!textAt} onClose={() => setTextAt(null)} title={t('draw.text')} labelledBy="draw-text-title">
      <form
        className={s.textForm}
        onSubmit={(e) => {
          e.preventDefault();
          const v = text.trim().slice(0, 60);
          if (v && textAt) save([...saved, { k: 'text', c: color, pts: [textAt], text: v }]);
          setTextAt(null);
        }}
      >
        <Field label={t('draw.textLabel')} value={text} onChange={(e) => setText(e.target.value)} maxLength={60} autoFocus />
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          {t('draw.add')}
        </Button>
      </form>
    </Sheet>
  );

  return { shapes: measure ? [...saved, measure] : saved, tool, color, onDrawn, buttons, note, textSheet };
}
