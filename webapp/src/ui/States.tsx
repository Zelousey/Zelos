/**
 * The three standard non-content states. Every screen uses these instead of inventing
 * its own, so "nothing here", "couldn't load" and "loading" always look the same.
 */
import type { ReactNode } from 'react';
import { t } from '../lib/i18n';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { SkeletonRows } from './Skeleton';
import s from './States.module.css';

type Base = { title?: ReactNode; body?: ReactNode; actions?: ReactNode; compact?: boolean };

export function EmptyState({ icon = 'inbox', title, body, actions, compact }: Base & { icon?: IconName }) {
  return (
    <div className={[s.state, compact && s.compact].filter(Boolean).join(' ')}>
      <div className={s.icon}>
        <Icon name={icon} />
      </div>
      {title != null && <div className={s.title}>{title}</div>}
      {body != null && <div className={s.body}>{body}</div>}
      {actions != null && <div className={s.actions}>{actions}</div>}
    </div>
  );
}

export function ErrorState({ title = t('state.error.title'), body = t('state.error.body'), onRetry, actions, compact }: Base & { onRetry?: () => void }) {
  return (
    <div role="alert" className={[s.state, s.danger, compact && s.compact].filter(Boolean).join(' ')}>
      <div className={s.icon}>
        <Icon name="alertTriangle" />
      </div>
      <div className={s.title}>{title}</div>
      <div className={s.body}>{body}</div>
      {(onRetry || actions) && (
        <div className={s.actions}>
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              {t('state.retry')}
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <SkeletonRows rows={rows} />
    </div>
  );
}
