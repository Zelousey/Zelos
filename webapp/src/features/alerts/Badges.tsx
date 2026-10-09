import { t } from '../../lib/i18n';
import { Badge } from '../../ui';
import { OUTCOMES } from '../strategies/strategies';
import type { Alert } from './alerts';

export function StatusBadge({ a }: { a: Alert }) {
  if (a.status === 'qualified') return <Badge tone="accent">{t('al.status.qualified')}</Badge>;
  if (a.status === 'watching') return <Badge tone="gold">{t('al.status.watching')}</Badge>;
  return <Badge>{t('al.status.none')}</Badge>;
}

export function ResultBadge({ a }: { a: Alert }) {
  if (!a.result) return null;
  const tone = a.result === 'hit-target' ? 'up' : a.result === 'stopped-out' ? 'down' : 'neutral';
  return <Badge tone={tone}>{OUTCOMES[a.result]}</Badge>;
}
