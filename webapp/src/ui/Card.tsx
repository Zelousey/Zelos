/**
 * Card: the surface every panel, widget and list sits on.
 * Use <Card title=… actions=…> for a panel with a header, or bare <Card pad> for a box.
 * <Card group title=…> is a section of a page (e.g. Settings → Account): the title is a small
 * plain heading above the panel, so it reads as a heading and never as a button.
 */
import type { HTMLAttributes, ReactNode } from 'react';
import s from './Card.module.css';

type Props = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  pad?: boolean;
  flush?: boolean;
  /** a page section: plain heading above, the panel below */
  group?: boolean;
  interactive?: boolean;
  as?: 'section' | 'div' | 'article';
};

export function Card({ title, subtitle, actions, pad, flush, group, interactive, as: Tag = 'section', className, children, ...rest }: Props) {
  if (group)
    return (
      <Tag className={[s.group, className].filter(Boolean).join(' ')} {...rest}>
        {title != null && (
          <header className={s.groupHead}>
            <div>
              <h2 className={s.groupTitle}>{title}</h2>
              {subtitle != null && <div className={s.groupSub}>{subtitle}</div>}
            </div>
            {actions != null && <div className={s.actions}>{actions}</div>}
          </header>
        )}
        <div className={[s.card, flush ? s.flush : s.body].join(' ')}>{children}</div>
      </Tag>
    );
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
