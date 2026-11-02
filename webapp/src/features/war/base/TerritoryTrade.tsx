/**
 * Trading inside your base (owner 2026-11-02): you came from a territory you hold on a War map
 * (/war/base?war=…&t=…), so its 3 companies are here to buy and sell at War Zone prices. The server
 * checks you still hold the territory for every buy; once you've lost it, the panel says so and
 * you can only sell (owner: sell-only).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { formatMoney } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { LoadingState } from '../../../ui';
import { useWar } from '../lobby';
import { companiesOf, SECTOR_NAME } from '../map';
import { Ticket } from '../Ticket';
import { useWarProfile, useWarQuotes } from '../war';
import s from './Base.module.css';

export function TerritoryTrade({ uid, warId, terr }: { uid: string; warId: string; terr: string }) {
  const war = useWar(warId);
  const profile = useWarProfile(uid);
  const quotes = useWarQuotes();
  const cos = companiesOf(terr);
  const [sym, setSym] = useState(cos[0]?.sym ?? '');
  if (!cos.length) return null;
  if (war.status === 'loading' || profile.status === 'loading') return <LoadingState rows={2} />;
  const w = war.status === 'ready' ? war.data : null;
  const p = profile.status === 'ready' ? profile.data : null;
  const cell = w?.map[terr];
  const holds = !!w && w.status === 'active' && w.phase === 'holding' && cell?.state === 'owned' && cell.owner === uid;
  const q = quotes.status === 'ready' ? quotes.data : null;
  const name = SECTOR_NAME[terr] ?? terr;
  return (
    <section className={s.panel} aria-labelledby="tt-title">
      <div className={s.panelHead}>
        <p id="tt-title" className={s.panelTitle}>
          {t('wbase.tradeTitle', { t: name })}
        </p>
        {w && (
          <Link className={s.small} to={`/war/${w.id}`}>
            {t('wbase.backToMap', { name: w.name })}
          </Link>
        )}
      </div>
      <p className={holds ? s.muted : s.why}>{holds ? t('wbase.tradeHelp', { t: name }) : t('wbase.tradeLost', { t: name })}</p>
      <div className={s.trade}>
        <ul className={s.cos} aria-label={t('wbase.tradeList', { t: name })}>
          {cos.map((c) => {
            const x = q?.prices[c.sym];
            const chg = x && x.ref ? (x.p / x.ref - 1) * 100 : null;
            const held = p?.positions.find((h) => h.sym === c.sym)?.qty ?? 0;
            return (
              <li key={c.sym}>
                <button type="button" className={`${s.co} ${sym === c.sym ? s.coOn : ''}`} aria-pressed={sym === c.sym} onClick={() => setSym(c.sym)}>
                  <span>
                    <b>{c.name}</b>
                    <small>
                      {c.sym}
                      {held ? ` · ${t('wbase.youHold', { n: held })}` : ''}
                    </small>
                  </span>
                  <span className={s.px}>
                    {x ? formatMoney(x.p) : '…'}
                    {chg !== null && <small className={chg >= 0 ? s.up : s.down}>{`${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`}</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {p && <Ticket key={sym} sym={sym} q={q} profile={p} warId={holds ? warId : undefined} />}
      </div>
      <p className={s.fine}>{t('wbase.tradeFine')}</p>
    </section>
  );
}
