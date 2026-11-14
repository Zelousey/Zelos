import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
/** YYYY-MM-DD date arithmetic (calendar days, UTC noon so DST never shifts a day). */
export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** An expiration in a list: "Today · expires 4:00 PM ET" for same-day contracts, else "Nov 20 · 6 days". */
export function expLabel(exp: string, today: string): string {
  if (exp === today) return t('opt.todayExp');
  const n = Math.round((Date.parse(exp + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 864e5);
  return `${formatDate(exp + 'T12:00:00Z')} · ${t('opt.days', { n })}`;
}
