/**
 * The Trade War section row (N4): Overview · Solo · Battle · Squad · Leaderboards · Strategies.
 * Plain in-app links, so switching never reloads the page. Each hub screen shows it on top,
 * and it remembers the section you're on so the Trade War tab can reopen Solo (hub.ts).
 */
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { t } from '../../lib/i18n';
import { useScrollFade } from '../../ui';
import { noteSection, SECTIONS, sectionFor } from './hub';
import s from './TradeWarNav.module.css';

export function TradeWarNav() {
  const { pathname } = useLocation();
  const current = sectionFor(pathname);
  const ref = useRef<HTMLElement>(null);
  useScrollFade(ref);
  useEffect(() => {
    if (current) noteSection(current);
  }, [current]);
  // keep the current section in view on a narrow phone
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const row = ref.current;
    if (el && row && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2);
  }, [current]);
  return (
    <nav ref={ref} className={s.nav} aria-label={t('hub.nav')}>
      {SECTIONS.map((x) => (
        <Link key={x.id} to={x.to} className={s.link} aria-current={current === x.id ? 'page' : undefined}>
          {t(x.label)}
        </Link>
      ))}
    </nav>
  );
}
