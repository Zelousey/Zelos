/**
 * The live globe with the stock exchanges open right now (regular hours, from each
 * exchange's own time zone). Used on the Market tab and the Dashboard.
 */
import { useMemo } from 'react';
import { exchangesNow } from '../../data/exchanges';
import { t } from '../../lib/i18n';
import { useMediaQuery, PHONE_QUERY } from '../../lib/useMediaQuery';
import { useNow } from '../../lib/useNow';
import { Globe } from './Globe';
import s from './WorldMarkets.module.css';

export function useOpenExchanges() {
  const now = useNow();
  const ex = useMemo(() => exchangesNow(new Date(now)), [now]);
  const open = ex.filter((x) => x.open);
  return { all: ex, open, summary: open.length ? t('dash.globe.open', { n: open.length, total: ex.length }) : t('dash.globe.none') };
}

/** The globe plus exchange chips: the open ones, or the big six when everything is closed. */
export function WorldMarkets({ height, phoneHeight = 300, all = false }: { height: number; phoneHeight?: number; all?: boolean }) {
  const phone = useMediaQuery(PHONE_QUERY);
  const { all: ex, open } = useOpenExchanges();
  const shown = all ? [...ex].sort((a, b) => Number(b.open) - Number(a.open)) : open.length ? open : ex.filter((x) => ['NYSE', 'LSE', 'TSE', 'HKEX', 'XETRA', 'NSE'].includes(x.id));
  return (
    <>
      <Globe label={t('dash.globe.label')} height={phone ? phoneHeight : height} />
      <ul className={s.exchanges} aria-label={t('world.exchanges')}>
        {shown.map((x) => (
          <li key={x.id} title={`${x.name}, ${x.city}: ${x.label}`}>
            <span className={[s.dot, x.open && s.open].filter(Boolean).join(' ')} aria-hidden />
            <b>{x.id}</b> <span className={s.muted}>{x.city}</span> <span className={x.open ? 'up' : s.muted}>{x.open ? t('world.open') : t('world.closed')}</span>
          </li>
        ))}
      </ul>
      <p className={s.note}>{t('dash.globe.note')}</p>
    </>
  );
}
