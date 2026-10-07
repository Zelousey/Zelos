/** A small confirmation dialog built on Sheet: message, Cancel, and one action button. */
import type { ReactNode } from 'react';
import { t } from '../lib/i18n';
import { Button } from './Button';
import { Sheet } from './Sheet';

export function Confirm({ open, title, children, action, variant = 'primary', busy, onConfirm, onClose }: { open: boolean; title: ReactNode; children: ReactNode; action: ReactNode; variant?: 'primary' | 'danger' | 'buy' | 'sell'; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} placement="center" labelledBy="confirm-title">
      <div style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>{children}</div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={busy} aria-busy={busy}>
            {action}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
