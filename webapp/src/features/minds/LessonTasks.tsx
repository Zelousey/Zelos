/**
 * The tasks that end a scroll-lesson slide (owner 2026-10-23: "you have to do something to
 * continue"): hold a button (march, rally), answer a question, drag Napoleon over the Alps, drag a
 * buy line onto a level, drag items into one place, find something in a painting, drag to the one
 * right zone, pick the right few. Every drag can also be done by tapping (WCAG 2.5.7), and holding
 * works with Space or Enter. onDone fires once, when the task is complete.
 */
import { useEffect, useRef, useState } from 'react';
import { t } from '../../lib/i18n';
import { Button } from '../../ui';
import { mindImageUrl, type ScrollTask } from './minds';
import s from './ScrollLesson.module.css';

type Props<K extends ScrollTask['kind']> = { task: Extract<ScrollTask, { kind: K }>; done: boolean; onDone: () => void; portrait: string };

export function LessonTask({ task, done, onDone, portrait }: { task: ScrollTask; done: boolean; onDone: () => void; portrait: string }) {
  if (task.kind === 'hold') return <HoldTask task={task} done={done} onDone={onDone} portrait={portrait} />;
  if (task.kind === 'quiz') return <QuizTask task={task} done={done} onDone={onDone} portrait={portrait} />;
  if (task.kind === 'drag') return <AlpsTask task={task} done={done} onDone={onDone} portrait={portrait} />;
  if (task.kind === 'collect') return <CollectTask task={task} done={done} onDone={onDone} portrait={portrait} />;
  if (task.kind === 'tap') return <TapTask task={task} done={done} onDone={onDone} portrait={portrait} />;
  if (task.kind === 'target') return <TargetTask task={task} done={done} onDone={onDone} portrait={portrait} />;
  if (task.kind === 'pick') return <PickTask task={task} done={done} onDone={onDone} portrait={portrait} />;
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
      {task.scene === 'rally' ? (
        <div className={s.morale} role="img" aria-label={t('sl.rallyMeter', { pct: Math.round(p * 100), from: task.from ?? t('sl.scared'), to: task.to ?? t('sl.ready') })}>
          <span>{task.from ?? t('sl.scared')}</span>
          <div className={s.moraleBar}>
            <i style={{ width: `${Math.round(p * 100)}%` }} />
          </div>
          <span>{task.to ?? t('sl.ready')}</span>
        </div>
      ) : (
      <svg className={s.map} viewBox="0 0 320 120" role="img" aria-label={t('sl.marchMap', { pct: Math.round(p * 100), to: task.to ?? t('sl.italy') })}>
        <path d="M30 80 C 90 40, 160 110, 280 60" className={s.route} />
        <text x="22" y="104" className={s.mapLabel}>
          {task.from ?? t('sl.france')}
        </text>
        <text x="262" y="92" className={s.mapLabel}>
          {task.to ?? t('sl.italy')}
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
      )}
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

/** Drag the figure (their portrait) over the Alps or a river: Napoleon to Italy, Caesar over the Rubicon. */
function AlpsTask({ task, done, onDone, portrait }: Props<'drag'>) {
  const zone = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const [over, setOver] = useState(false);
  return (
    <div className={s.task}>
      <div className={s.alps}>
        <span className={s.alpsLabel}>{task.from ?? t('sl.france')}</span>
        {task.scene === 'river' ? (
          <svg className={s.river} viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden>
            <path d="M34 0 C 58 16, 24 36, 44 60 L 80 60 C 62 36, 96 16, 72 0 Z" />
            <path d="M48 9 q 5 -3 10 0 M42 30 q 5 -3 10 0 M56 48 q 5 -3 10 0" className={s.ripple} />
          </svg>
        ) : (
          <svg className={s.peaks} viewBox="0 0 120 60" aria-hidden>
            <path d="M0 60 L22 18 L34 34 L52 6 L70 36 L84 20 L120 60 Z" />
            <path d="M44 20 L52 6 L60 20 Z M18 26 L22 18 L27 27 Z" className={s.snow} />
          </svg>
        )}
        <div ref={zone} className={[s.drop, over && s.dropOver, done && s.dropDone].filter(Boolean).join(' ')}>
          <span className={s.alpsLabel}>{task.to ?? t('sl.italy')}</span>
          {done && <img src={portrait} alt="" className={s.token} />}
        </div>
        {!done && (
          <img
            src={portrait}
            alt={task.who ?? t('sl.napoleon')}
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


/** Drag the right items into one place, one by one; a wrong one bounces back. Tapping an item does the same. */
function CollectTask({ task, done, onDone }: Props<'collect'>) {
  const zone = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<string[]>(done ? task.items.filter((i) => !i.wrong).map((i) => i.label) : []);
  const [drag, setDrag] = useState<{ label: string; x: number; y: number; sx: number; sy: number } | null>(null);
  const [over, setOver] = useState(false);
  const [note, setNote] = useState('');
  const need = task.items.filter((i) => !i.wrong).length;
  function put(item: { label: string; wrong?: boolean }) {
    if (done || placed.includes(item.label)) return;
    if (item.wrong) return setNote(task.wrong ?? t('sl.notThatOne'));
    setNote('');
    const next = [...placed, item.label];
    setPlaced(next);
    if (next.length === need) onDone();
  }
  return (
    <div className={s.task}>
      <div className={s.collect}>
        <div className={s.tokens}>
          {task.items.filter((i) => !placed.includes(i.label)).map((item) => (
            <button
              key={item.label}
              type="button"
              className={[s.chip, drag?.label === item.label && s.dragging].filter(Boolean).join(' ')}
              style={drag?.label === item.label ? { transform: `translate(${drag.x - drag.sx}px, ${drag.y - drag.sy}px) scale(1.06)` } : undefined}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setDrag({ label: item.label, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
              }}
              onPointerMove={(e) => {
                if (drag?.label !== item.label) return;
                setDrag({ ...drag, x: e.clientX, y: e.clientY });
                setOver(inside(zone.current, e.clientX, e.clientY, 10));
              }}
              onPointerUp={(e) => {
                if (drag?.label !== item.label) return;
                const moved = Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 8;
                setDrag(null);
                setOver(false);
                // a tap (no real drag) puts it in too, so this works without dragging
                if (!moved || inside(zone.current, e.clientX, e.clientY, 10)) put(item);
              }}
              onPointerCancel={() => {
                setDrag(null);
                setOver(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  put(item);
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div ref={zone} className={[s.drop, s.dropWide, over && s.dropOver, placed.length === need && s.dropDone].filter(Boolean).join(' ')}>
          <span className={s.alpsLabel}>{task.target}</span>
          <div className={s.placed}>
            {placed.map((l) => (
              <span key={l} className={s.chipIn}>
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className={s.hint} role="status">
        {placed.length === need ? task.done : note || task.label}
      </p>
    </div>
  );
}

/** Find it in the painting: the spots are buttons over the picture; a tap anywhere else says look again. */
function TapTask({ task, done, onDone }: Props<'tap'>) {
  const [msg, setMsg] = useState('');
  const [hit, setHit] = useState<string | null>(done ? (task.spots.find((x) => x.right)?.label ?? null) : null);
  return (
    <div className={s.task}>
      <figure className={s.tapPic} onClick={() => !hit && setMsg(task.miss)}>
        <img src={mindImageUrl(task.image)} alt={t('sl.alt', { credit: task.credit.split(',')[0]! })} draggable={false} />
        {task.spots.map((sp) => (
          <button
            key={sp.label}
            type="button"
            aria-label={sp.label}
            disabled={!!hit}
            className={[s.spot, hit === sp.label && s.spotHit].filter(Boolean).join(' ')}
            style={{ left: `${sp.x * 100}%`, top: `${sp.y * 100}%`, width: `${sp.w * 100}%`, height: `${sp.h * 100}%` }}
            onClick={(e) => {
              e.stopPropagation();
              if (sp.right) {
                setHit(sp.label);
                setMsg('');
                onDone();
              } else setMsg(task.miss);
            }}
          />
        ))}
        <figcaption className={s.credit}>{task.credit}</figcaption>
      </figure>
      <p className={s.hint} role="status">
        {hit ? task.done : msg || task.label}
      </p>
    </div>
  );
}

/** Drag your token to the right zone; each zone is a button too. A wrong zone explains why. */
function TargetTask({ task, done, onDone }: Props<'target'>) {
  const zones = useRef<(HTMLButtonElement | null)[]>([]);
  const [drag, setDrag] = useState<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const [at, setAt] = useState<number | null>(done ? task.zones.findIndex((z) => z.right) : null);
  const [over, setOver] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const right = at !== null && !!task.zones[at]?.right;
  function choose(i: number) {
    if (right) return;
    setAt(i);
    if (task.zones[i]!.right) {
      setMsg('');
      onDone();
    } else setMsg(task.zones[i]!.why ?? t('sl.tryAgain'));
  }
  const zoneAt = (x: number, y: number) => zones.current.findIndex((el) => inside(el, x, y, 6));
  return (
    <div className={s.task}>
      <div className={s.battle}>
        <div className={s.zones}>
          {task.zones.map((z, i) => (
            <button
              key={z.label}
              ref={(el) => {
                zones.current[i] = el;
              }}
              type="button"
              className={[s.zone, over === i && s.dropOver, at === i && (z.right ? s.dropDone : s.zoneWrong)].filter(Boolean).join(' ')}
              disabled={right}
              onClick={() => choose(i)}
            >
              <span>{z.label}</span>
              {at === i && <b className={s.troops}>{task.token}</b>}
            </button>
          ))}
        </div>
        {!right && (
          <span
            role="img"
            aria-label={t('sl.dragToken', { token: task.token })}
            className={[s.troops, s.troopsStart, drag && s.dragging].filter(Boolean).join(' ')}
            style={drag ? { transform: `translate(${drag.x - drag.sx}px, ${drag.y - drag.sy}px) scale(1.08)` } : undefined}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setDrag({ x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              setDrag({ ...drag, x: e.clientX, y: e.clientY });
              const i = zoneAt(e.clientX, e.clientY);
              setOver(i < 0 ? null : i);
            }}
            onPointerUp={(e) => {
              if (!drag) return;
              setDrag(null);
              setOver(null);
              const i = zoneAt(e.clientX, e.clientY);
              if (i >= 0) choose(i);
            }}
            onPointerCancel={() => {
              setDrag(null);
              setOver(null);
            }}
          >
            {task.token}
          </span>
        )}
      </div>
      <p className={s.hint} role="status">
        {right ? task.done : msg || task.label}
      </p>
    </div>
  );
}

/** Choose exactly `need` options; all of them must be right ones. */
function PickTask({ task, done, onDone }: Props<'pick'>) {
  const [sel, setSel] = useState<string[]>(done ? task.options.filter((o) => o.right).map((o) => o.label) : []);
  const [checked, setChecked] = useState(done);
  const ok = checked && sel.length === task.need && sel.every((l) => task.options.find((o) => o.label === l)?.right);
  return (
    <fieldset className={s.task}>
      <legend className={s.question}>{task.label}</legend>
      <div className={s.picks}>
        {task.options.map((o) => {
          const on = sel.includes(o.label);
          return (
            <button
              key={o.label}
              type="button"
              aria-pressed={on}
              disabled={ok}
              className={[s.option, on && s.optionOn, checked && on && (o.right ? s.right : s.wrong)].filter(Boolean).join(' ')}
              onClick={() => {
                setChecked(false);
                setSel(on ? sel.filter((l) => l !== o.label) : sel.length < task.need ? [...sel, o.label] : sel);
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {!ok && (
        <Button
          size="sm"
          disabled={sel.length !== task.need}
          onClick={() => {
            setChecked(true);
            if (sel.every((l) => task.options.find((o) => o.label === l)?.right)) onDone();
          }}
        >
          {t('sl.check', { n: sel.length, of: task.need })}
        </Button>
      )}
      <p className={s.feedback} role="status">
        {ok ? task.why : checked ? t('sl.pickAgain') : ''}
      </p>
    </fieldset>
  );
}
