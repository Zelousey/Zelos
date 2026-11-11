/**
 * A choice you tap (owner 2026-11-10: modes and options should look like buttons, not a list of
 * text): an icon tile, a title, one line on what it is, and a "Start" cue. A link card when it
 * leads somewhere; with no `to` it's a plain info tile (no arrow, not tappable).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from './Icon';
import s from './ChoiceCard.module.css';

export function ChoiceCard({ to, icon, title, body, cta, tone = 'accent', badge }: { to?: string; icon: IconName; title: string; body: ReactNode; cta?: string; tone?: 'accent' | 'gold' | 'violet' | 'up'; badge?: string }) {
  const inner = (
    <>
      <span className={[s.icon, s[tone]].join(' ')} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <span className={s.text}>
        <span className={s.title}>
          {title}
          {badge && <span className={s.badge}>{badge}</span>}
        </span>
        <span className={s.body}>{body}</span>
      </span>
      {to && (
        <span className={s.cta} aria-hidden="true">
          {cta && <span className={s.ctaText}>{cta}</span>}
          <Icon name="chevronRight" size={18} />
        </span>
      )}
    </>
  );
  return to ? (
    <Link to={to} className={[s.card, s.link, s[`edge_${tone}`]].join(' ')}>
      {inner}
    </Link>
  ) : (
    <div className={[s.card, s.info].join(' ')}>{inner}</div>
  );
}

/** A list of ChoiceCards. */
export function ChoiceList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className={s.list} aria-label={label}>
      {children}
    </ul>
  );
}
