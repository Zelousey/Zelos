/**
 * A price change: signed percent (and optionally signed money), coloured by direction.
 * The sign (+/−) is always shown, so the colour is never the only signal.
 */
import { direction, formatPercent, formatSignedMoney } from '../lib/format';

export function Change({ pct, abs, className }: { pct: number | null | undefined; abs?: number | null; className?: string }) {
  const dir = direction(pct ?? abs);
  return (
    <span className={['num', dir === 'up' ? 'up' : dir === 'down' ? 'down' : '', className].filter(Boolean).join(' ')}>
      {abs != null && <>{formatSignedMoney(abs)} </>}
      {formatPercent(pct)}
    </span>
  );
}
