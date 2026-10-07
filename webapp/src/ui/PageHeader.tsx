
import type { ReactNode } from 'react';
import s from './PageHeader.module.css';

/**
 * The title row at the top of a screen (h1 + optional subtitle and actions).
 * On phones the top bar already names the screen, so the h1 is visually hidden there
 * unless `keepOnPhone` is set (e.g. a symbol page whose title is the ticker).
 */
export function PageHeader({ title, subtitle, actions, keepOnPhone }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; keepOnPhone?: boolean }) {
  return (
    <div className={[s.head, keepOnPhone && s.keep].filter(Boolean).join(' ')}>
      <div>
        <h1 className={s.title}>{title}</h1>
        {subtitle != null && <p className={s.sub}>{subtitle}</p>}
      </div>
      {actions != null && <div className={s.actions}>{actions}</div>}
    </div>
  );
}
