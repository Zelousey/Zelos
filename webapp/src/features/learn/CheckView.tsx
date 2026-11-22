/**
 * One quick-check question, in a lesson or in review (research review 2026-11-22: vary the
 * practice). Three kinds (chapters.ts Check):
 *   pick   choose an answer; a "spot the pattern" question shows an unlabelled chart
 *   level  tap the level on the chart where the stop, target, entry or neckline goes
 *   order  tap the steps in order; tap a placed step to take it (and the ones after it) back
 * `answer` is what was submitted (null while answering); `right` is the right answer once known
 * (a lesson knows it; review gets it from the server).
 */
import { useState, type Ref } from 'react';
import { t } from '../../lib/i18n';
import { Button } from '../../ui';
import { sameAnswer, shownOrder, type Answer, type Check, type LevelCheck, type OrderCheck } from './chapters';
import { Scene } from './Scene';
import s from './Learn.module.css';

type Props = { check: Check; answer: Answer | null; right: Answer | null; onAnswer: (a: Answer) => void; headRef?: Ref<HTMLHeadingElement>; kicker?: string; busy?: boolean };

export function CheckView({ check, answer, right, onAnswer, headRef, kicker = t('ln.quickCheck'), busy }: Props) {
  const shown = answer != null && right != null;
  const ok = shown ? sameAnswer(answer, right) : null;
  const why = !shown ? null : check.kind === 'order' ? check.why : (check.why[answer as number] ?? '');
  return (
    <>
      <div className={s.stage}>
        {check.kind === 'level' ? (
          <LevelChart check={check} answer={answer as number | null} right={right as number | null} onAnswer={onAnswer} busy={busy} />
        ) : (
          <Scene art={(check.kind !== 'order' && check.art) || { k: 'big', top: check.kind === 'order' ? '1 · 2 · 3' : '?', bottom: kicker.toUpperCase() }} />
        )}
      </div>
      <div className={s.say} aria-live="polite">
        <span className={s.kicker}>
          {kicker}
          {check.kind === 'level' ? ` · ${t('ck.level')}` : check.kind === 'order' ? ` · ${t('ck.order')}` : ''}
        </span>
        <h2 ref={headRef} tabIndex={-1}>
          {check.q}
        </h2>
        {check.kind === 'order' ? (
          <OrderSteps check={check} answer={answer as number[] | null} right={right as number[] | null} onAnswer={onAnswer} busy={busy} />
        ) : check.kind === 'level' ? (
          answer == null && <p className={s.muted}>{t('ck.levelHint')}</p>
        ) : (
          <div className={s.opts} role="group" aria-label={t('ln.answers')}>
            {check.opts.map((o, i) => {
              const cls = !shown ? '' : i === right ? s.optRight : i === answer ? s.optWrong : '';
              return (
                <button key={i} type="button" className={[s.opt, cls].join(' ')} disabled={answer != null || busy} aria-pressed={answer === i} onClick={() => onAnswer(i)}>
                  <span>{o}</span>
                  <span aria-hidden="true">{!shown ? '' : i === right ? '✓' : i === answer ? '✗' : ''}</span>
                </button>
              );
            })}
          </div>
        )}
        {why != null && <p className={[s.why, ok ? s.whyOk : s.whyNo].join(' ')}>{why}</p>}
      </div>
    </>
  );
}

/** The chart with each level as a full-width tap target on its line (the stage is 4:3, like the drawing). */
function LevelChart({ check, answer, right, onAnswer, busy }: { check: LevelCheck; answer: number | null; right: number | null; onAnswer: (a: number) => void; busy?: boolean }) {
  const shown = answer != null && right != null;
  return (
    <div className={s.levelWrap} role="group" aria-label={t('ck.levels')}>
      <Scene art={{ k: 'chart', pts: check.pts, ...(check.title ? { title: check.title } : {}) }} />
      {check.levels.map((l, i) => {
        const state = !shown ? '' : i === right ? s.levelRight : i === answer ? s.levelWrong : s.levelDim;
        return (
          <button
            key={i}
            type="button"
            className={[s.level, state].join(' ')}
            style={{ top: `${((250 - l.y * 1.75) / 300) * 100}%` }}
            disabled={answer != null || busy}
            aria-pressed={answer === i}
            onClick={() => onAnswer(i)}
          >
            <span className={s.levelTag}>
              {l.label}
              {shown && i === right ? ' ✓' : shown && i === answer ? ' ✗' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function OrderSteps({ check, answer, right, onAnswer, busy }: { check: OrderCheck; answer: number[] | null; right: number[] | null; onAnswer: (a: number[]) => void; busy?: boolean }) {
  const [placed, setPlaced] = useState<number[]>([]);
  const seq = answer ?? placed;
  const pool = shownOrder(check.steps.length).filter((i) => !seq.includes(i));
  const done = answer != null;
  return (
    <div className={s.order}>
      <ol className={s.orderList} aria-label={t('ck.yourOrder')}>
        {check.steps.map((_, slot) => {
          const i = seq[slot];
          const st = done && right != null && i != null ? (i === right[slot] ? s.optRight : s.optWrong) : '';
          return (
            <li key={slot}>
              {i == null ? (
                <span className={s.orderEmpty} aria-hidden="true">
                  {slot + 1}
                </span>
              ) : (
                <button type="button" className={[s.opt, s.orderItem, st].join(' ')} disabled={done || busy} onClick={() => setPlaced((p) => p.slice(0, p.indexOf(i)))} aria-label={t('ck.takeBack', { n: slot + 1, step: check.steps[i]! })}>
                  <b aria-hidden="true">{slot + 1}</b>
                  <span>{check.steps[i]}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {pool.length > 0 && (
        <div className={s.opts} role="group" aria-label={t('ck.steps')}>
          {pool.map((i) => (
            <button key={i} type="button" className={s.opt} disabled={done || busy} onClick={() => setPlaced((p) => [...p, i])}>
              <span>{check.steps[i]}</span>
            </button>
          ))}
        </div>
      )}
      {!done && pool.length === 0 && (
        <Button variant="secondary" block disabled={busy} onClick={() => onAnswer(placed)}>
          {t('ck.checkOrder')}
        </Button>
      )}
      {done && right != null && !sameAnswer(answer, right) && (
        <div className={s.orderRight}>
          <span className={s.kicker}>{t('ck.rightOrder')}</span>
          <ol aria-label={t('ck.rightOrder')}>
            {right.map((i) => (
              <li key={i}>{check.steps[i]}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
