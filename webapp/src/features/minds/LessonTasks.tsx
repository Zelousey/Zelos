/**
 * The tasks that end a scroll-lesson slide (owner 2026-10-23: "you have to do something to
 * continue"): hold a button to march, answer a question, drag Napoleon over the Alps, drag a buy
 * line onto a level. Every drag has a button that does the same (WCAG 2.5.7), and holding works
 * with Space or Enter. onDone fires once, when the task is complete.
 */
import { useEffect, useRef, useState } from 'react';
import { t } from '../../lib/i18n';
import { Button } from '../../ui';
import type { ScrollTask } from './minds';
import s from './ScrollLesson.module.css';

type Props<K extends ScrollTask['kind']> = { task: Extract<ScrollTask, { kind: K }>; done: boolean; onDone: () => void; portrait: string };

export function LessonTask({ task, done, onDone, portrait }: { task: ScrollTask; done: boolean; onDone: () => void; portrait: string }) {
  if (task.kind === 'hold') return <HoldTask task={task} done={done} onDone={onDone} portrait={portrait} />;
  if (task.kind === 'quiz') return <QuizTask task={task} done={done} onDone={onDone} portrait={portrait} />;
  if (task.kind === 'drag') return <AlpsTask task={task} done={done} onDone={onDone} portrait={portrait} />;
  return <LevelTask task={task} done={done} onDone={onDone} portrait={portrait} />;
}

const HOLD_MS = 1800;

/** Hold to march: your army (blue) races the supply wagons (grey) across the map. */
function HoldTask({ task, done, onDone }: Props<'hold'>) {
  const [p, setP] = useState(done ? 1 : 0);
  const prog = useRef(done ? 1 : 0);
  const holding = useRef(false);
  const last = useRef(0);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  // letting go slowly drains the bar, so a few short taps don't add up to a march
  function tick(now: number) {
    const dt = now - (last.current || now);
    last.current = now;
    const v = prog.current;
    const n = holding.current ? Math.min(1, v + dt / HOLD_MS) : Math.max(0, v - dt / (HOLD_MS * 3));
    prog.current = n;
    setP(n);
    if (n >= 1) {
      holding.current = false;
      onDone();
    } else if (holding.current || n > 0) raf.current = requestAnimationFrame(tick);
  }
  function start() {
    if (done || holding.current || prog.current >= 1) return;
    holding.current = true;
    last.current = 0;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
  }
  const stop = () => {
    holding.current = false;
  };
  const army = 30 + p * 250;
  const wagons = 30 + p * 110;
  return (
    <div className={s.task}>
      <svg className={s.map} viewBox="0 0 320 120" role="img" aria-label={t('sl.marchMap', { pct: Math.round(p * 100) })}>
        <path d="M30 80 C 90 40, 160 110, 280 60" className={s.route} />
        <text x="22" y="104" className={s.mapLabel}>
          {t('sl.france')}
        </text>
        <text x="262" y="92" className={s.mapLabel}>
          {t('sl.italy')}
        </text>
        <g transform={`translate(${wagons} 26)`} className={s.wagons}>
          <rect x="-11" y="-7" width="22" height="13" rx="2" />
          <circle cx="-6" cy="8" r="3" />
          <circle cx="6" cy="8" r="3" />
        </g>
        <text x={wagons} y="14" textAnchor="middle" className={s.mapTiny}>
          {t('sl.wagons')}
        </text>
        <g transform={`translate(${army} ${70 - Math.sin(p * Math.PI) * 14})`} className={s.army}>
          <circle r="9" />
          <path d="M-4 1 L0 -5 L4 1 Z" fill="#fff" />
        </g>
      </svg>
      <button
        type="button"
        className={s.hold}
        disabled={done}
        style={{ ['--p' as string]: p }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span>{done ? task.done : task.label}</span>
      </button>
    </div>
  );
}

/** Pick an answer; a wrong one explains nothing yet, so you think again. */
function QuizTask({ task, done, onDone }: Props<'quiz'>) {
  const [pick, setPick] = useState<number | null>(done ? task.answer : null);
  const right = pick === task.answer;
  return (
    <fieldset className={s.task}>
      <legend className={s.question}>{task.question}</legend>
      <div className={s.options}>
        {task.options.map((o, i) => (
          <button
            key={o}
            type="button"
            className={[s.option, pick === i && (right ? s.right : s.wrong)].filter(Boolean).join(' ')}
            aria-pressed={pick === i}
            disabled={done || right}
            onClick={() => {
              setPick(i);
              if (i === task.answer) onDone();
            }}
          >
            {o}
          </button>
        ))}
      </div>
      <p className={s.feedback} role="status">
        {pick === null ? '' : right ? task.why : t('sl.tryAgain')}
      </p>
    </fieldset>
  );
}

function inside(el: Element | null, x: number, y: number, pad = 0) {
  const r = el?.getBoundingClientRect();
  return !!r && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

/** Drag Napoleon (his portrait) from France over the Alps and drop him in Italy. */
function AlpsTask({ task, done, onDone, portrait }: Props<'drag'>) {
  const zone = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const [over, setOver] = useState(false);
  return (
    <div className={s.task}>
      <div className={s.alps}>
        <span className={s.alpsLabel}>{t('sl.france')}</span>
        <svg className={s.peaks} viewBox="0 0 120 60" aria-hidden>
          <path d="M0 60 L22 18 L34 34 L52 6 L70 36 L84 20 L120 60 Z" />
          <path d="M44 20 L52 6 L60 20 Z M18 26 L22 18 L27 27 Z" className={s.snow} />
        </svg>
        <div ref={zone} className={[s.drop, over && s.dropOver, done && s.dropDone].filter(Boolean).join(' ')}>
          <span className={s.alpsLabel}>{t('sl.italy')}</span>
          {done && <img src={portrait} alt="" className={s.token} />}
        </div>
        {!done && (
          <img
            src={portrait}
            alt={t('sl.napoleon')}
            draggable={false}
            className={[s.token, s.tokenStart, drag && s.dragging].filter(Boolean).join(' ')}
            style={drag ? { transform: `translate(${drag.x - drag.sx}px, ${drag.y - drag.sy}px) scale(1.08)` } : undefined}
            onPointerDown={(e) => {
              e.preventDefault(); // no text selection or native image drag while you carry him
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setDrag({ x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              setDrag({ ...drag, x: e.clientX, y: e.clientY });
              setOver(inside(zone.current, e.clientX, e.clientY, 12));
            }}
            onPointerUp={(e) => {
              setDrag(null);
              setOver(false);
              if (inside(zone.current, e.clientX, e.clientY, 12)) onDone();
            }}
            onPointerCancel={() => {
              setDrag(null);
              setOver(false);
            }}
          />
        )}
      </div>
      <p className={s.hint}>{done ? task.done : task.label}</p>
      {!done && (
        <Button variant="ghost" size="sm" onClick={onDone}>
          {task.tap}
        </Button>
      )}
    </div>
  );
}

/** A price falling toward support: drag your buy line onto the level before it gets there. */
function LevelTask({ task, done, onDone }: Props<'level'>) {
  const svg = useRef<SVGSVGElement>(null);
  const LEVEL = 92;
  const [y, setY] = useState(done ? LEVEL : 30);
  const [dragging, setDragging] = useState(false);
  const toY = (clientY: number) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return y;
    return Math.max(14, Math.min(126, ((clientY - r.top) / r.height) * 140));
  };
  const price = 'M8 30 L40 44 L62 36 L90 58 L112 52 L140 72 L162 66 L190 84';
  return (
    <div className={s.task}>
      <svg
        ref={svg}
        className={s.chart}
        viewBox="0 0 300 140"
        role="img"
        aria-label={t('sl.levelChart')}
        onPointerMove={(e) => dragging && setY(toY(e.clientY))}
        onPointerUp={(e) => {
          if (!dragging) return;
          setDragging(false);
          // judge where the finger let go, not the last drawn position (a quick release can beat the redraw)
          if (Math.abs(toY(e.clientY) - LEVEL) <= 7) {
            setY(LEVEL);
            onDone();
          } else setY(toY(e.clientY));
        }}
      >
        <line x1="0" x2="300" y1={LEVEL} y2={LEVEL} className={s.support} />
        <text x="296" y={LEVEL + 14} textAnchor="end" className={s.mapTiny}>
          {t('sl.support')}
        </text>
        <path d={done ? `${price} L214 ${LEVEL} L236 70 L262 52 L292 40` : price} className={s.price} />
        <g
          className={[s.buyLine, dragging && s.dragging, done && s.lineDone].filter(Boolean).join(' ')}
          transform={`translate(0 ${done ? LEVEL : y})`}
          onPointerDown={(e) => {
            if (done) return;
            e.preventDefault();
            (e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId);
            setDragging(true);
          }}
        >
          <rect x="0" y="-14" width="300" height="28" fill="transparent" />
          <line x1="0" x2="300" y1="0" y2="0" />
          <rect x="6" y="-11" width="70" height="22" rx="11" />
          <text x="41" y="4" textAnchor="middle">
            {t('sl.buy')}
          </text>
        </g>
      </svg>
      <p className={s.hint}>{done ? task.done : task.label}</p>
      {!done && (
        <Button variant="ghost" size="sm" onClick={() => { setY(LEVEL); onDone(); }}>
          {task.tap}
        </Button>
      )}
    </div>
  );
}

