/**
 * The squad goal's progress bar, livelier the closer the squad gets (owner 2026-10-09):
 *   0–25% calm fill · 25–50% a moving shimmer · 50–75% faster shimmer and a glow ·
 *   75–99% a pulsing glow with sparks at the tip · 100% gold with a confetti burst.
 * Milestones at 25/50/75% light up as they're passed and the number counts up.
 * Everything holds still for people who ask for reduced motion.
 */
import { useEffect, useState } from 'react';
import { t } from '../../lib/i18n';
import s from './GoalBar.module.css';

export type Tier = 0 | 1 | 2 | 3 | 4;
export const tierFor = (pct: number): Tier => (pct >= 100 ? 4 : pct >= 75 ? 3 : pct >= 50 ? 2 : pct >= 25 ? 1 : 0);
export const TIER_ICON = ['🌱', '✨', '🔥', '🚀', '🏆'] as const;
const MILESTONES = [25, 50, 75];
const CONFETTI = Array.from({ length: 14 }, (_, i) => i);

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Count from 0 up to `to` over ~0.9s (instantly with reduced motion). */
function useCountUp(to: number) {
  const [v, setV] = useState(() => (reduced() ? to : 0));
  useEffect(() => {
    const dur = reduced() ? 0 : 900;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = dur ? Math.min(1, (now - start) / dur) : 1;
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return v;
}

export function GoalBar({ pct, avg, target }: { pct: number; avg: number; target: number }) {
  const p = Math.max(0, Math.min(100, pct));
  const tier = tierFor(p);
  const shown = useCountUp(avg);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true)); // slide the fill in from 0
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className={[s.wrap, s[`t${tier}`]].join(' ')} data-tier={tier}>
      <div className={s.head}>
        <span className={s.icon} aria-hidden="true">
          {TIER_ICON[tier]}
        </span>
        <b className={[s.num, avg >= 0 ? s.up : s.down].join(' ')}>
          {`${shown >= 0 ? '+' : ''}${shown.toFixed(2)}%`} <small>{t('sq.goal.of', { n: target })}</small>
        </b>
        <span className={s.cheer}>{t(`sq.goal.cheer${tier}` as 'sq.goal.cheer0')}</span>
      </div>
      <div className={s.bar} role="progressbar" aria-label={t('sq.goal.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)} aria-valuetext={t('sq.goal.valueText', { n: Math.round(p) })}>
        <i className={s.fill} style={{ width: `${grown ? p.toFixed(1) : 0}%` }}>
          {tier >= 3 && (
            <span className={s.sparks} aria-hidden="true">
              <em />
              <em />
              <em />
            </span>
          )}
        </i>
        {MILESTONES.map((m) => (
          <span key={m} className={[s.mark, p >= m && s.markOn].filter(Boolean).join(' ')} style={{ left: `${m}%` }} aria-hidden="true" />
        ))}
      </div>
      {tier === 4 && (
        <div className={s.confetti} aria-hidden="true">
          {CONFETTI.map((i) => (
            <i key={i} style={{ left: `${(i * 7.3 + 3) % 100}%`, animationDelay: `${(i % 7) * 0.08}s`, background: ['#f2c14e', '#3ecb7c', '#4a86ff', '#ff6fb5', '#a78bfa'][i % 5] }} />
          ))}
        </div>
      )}
    </div>
  );
}
