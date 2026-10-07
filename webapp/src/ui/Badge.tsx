/** Small label/pill. `tone` carries meaning: up/down for moves, accent for modes, count for unread numbers. */
import type { ReactNode } from 'react';
import s from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'up' | 'down' | 'gold' | 'violet' | 'count';

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={[s.badge, tone !== 'neutral' && s[tone], className].filter(Boolean).join(' ')}>{children}</span>;
}
