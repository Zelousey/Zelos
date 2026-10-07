/**
 * Card: the surface every panel, widget and list sits on.
 * Use <Card title=… actions=…> for a panel with a header, or bare <Card pad> for a box.
 */
import type { HTMLAttributes, ReactNode } from 'react';
import s from './Card.module.css';

type Props = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  pad?: boolean;
  flush?: boolean;
  interactive?: boolean;
  as?: 'section' | 'div' | 'article';
};

export function Card({ title, subtitle, actions, pad, flush, interactive, as: Tag = 'section', className, children, ...rest }: Props) {
  const cls = [s.card, pad && !title && s.pad, interactive && s.interactive, className].filter(Boolean).join(' ');
  return (
    <Tag className={cls} {...rest}>
      {title != null && (
        <header className={s.head}>
          <div>
            <h2 className={s.title}>{title}</h2>
            {subtitle != null && <div className={s.subtitle}>{subtitle}</div>}
          </div>
          {actions != null && <div className={s.actions}>{actions}</div>}
        </header>
      )}
      {title != null ? <div className={flush ? s.flush : s.body}>{children}</div> : children}
    </Tag>
  );
}
