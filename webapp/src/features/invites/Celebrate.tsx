/**
 * The accept animation: a check that pops in with a burst of confetti in the Zelos colours.
 * Pure CSS (no library); people who ask for reduced motion get a still check.
 */
import s from './Invites.module.css';

const PIECES = 14;

export function Celebrate() {
  return (
    <div className={s.celebrate} aria-hidden>
      {Array.from({ length: PIECES }, (_, i) => (
        <i key={i} style={{ '--a': `${(360 / PIECES) * i}deg`, '--d': `${70 + (i % 3) * 18}px`, '--c': ['var(--accent)', 'var(--gold)', 'var(--bull)', 'var(--violet)'][i % 4] } as React.CSSProperties} />
      ))}
      <span className={s.ring} />
      <span className={s.check}>
        <svg viewBox="0 0 24 24" width="40" height="40">
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
