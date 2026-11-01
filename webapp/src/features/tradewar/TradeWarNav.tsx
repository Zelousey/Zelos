/**
 * The Trade War section row (N4): Overview · Solo · Battle · War Zone (admins until War opens) ·
 * Leaderboards · Strategies. Plain in-app links, so switching never reloads the page. Each hub
 * screen shows it on top.
 */
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { t } from '../../lib/i18n';
import { useScrollFade } from '../../ui';
import { SECTIONS, sectionFor } from './hub';
import { useAuth } from '../../lib/auth';
import { useCanPost } from '../news/news';
import s from './TradeWarNav.module.css';

export function TradeWarNav() {
  const { pathname } = useLocation();
  const current = sectionFor(pathname);
  const ref = useRef<HTMLElement>(null);
  useScrollFade(ref);
  const { user, isReal } = useAuth();
  const admin = useCanPost(isReal && user ? user.uid : null);
  // keep the current section in view on a narrow phone
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const row = ref.current;
    if (el && row && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2);
  }, [current]);
  return (
    <nav ref={ref} className={s.nav} aria-label={t('hub.nav')}>
      {SECTIONS.filter((x) => x.id !== 'war' || admin).map((x) => (
        <Link key={x.id} to={x.to} className={s.link} aria-current={current === x.id ? 'page' : undefined}>
          {t(x.label)}
        </Link>
      ))}
    </nav>
  );
}

/** Battle's first choice (owner 2026-10-28): a head-to-head duel, or team up as a squad. */
export function BattleKinds() {
  return (
    <section className={s.kinds} aria-labelledby="bt-kinds">
      <h2 id="bt-kinds" className={s.kindsTitle}>
        {t('hub.battle.pick')}
      </h2>
      <div className={s.kindGrid}>
        <Link to="/invite?kind=battle" className={s.kind}>
          <b>{t('hub.battle.duel')}</b>
          <span>{t('hub.battle.duel.body')}</span>
        </Link>
        <Link to="/social" className={s.kind}>
          <b>{t('hub.battle.squad')}</b>
          <span>{t('hub.battle.squad.body')}</span>
        </Link>
      </div>
    </section>
  );
}
