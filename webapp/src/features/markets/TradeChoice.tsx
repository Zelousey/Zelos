/**
 * "How do you want to trade this stock?" (Phase 7, N6). Shown only when you come from a
 * "Find a stock" button (/markets?find=1); everywhere else a stock opens its chart, and inside a
 * battle the battle's own ticket keeps you there. Solo opens the Solo ticket; Battle lists the
 * battles you're in that are running (the room opens on this stock when its rules allow it) or
 * offers a new one. Nothing here trades: each choice opens a screen where you confirm.
 */
import { useId } from 'react';
import { Link } from 'react-router';
import { instrument } from '../../data/universe';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { buttonClass, Sheet } from '../../ui';
import { sortWars, useMyWars } from '../dashboard/social';
import s from './TradeChoice.module.css';

export function TradeChoice({ sym, onClose }: { sym: string | null; onClose: () => void }) {
  const { user, isReal } = useAuth();
  const wars = useMyWars(isReal && user ? user.uid : null);
  const running = wars.status === 'ready' ? sortWars(wars.data).filter((w) => w.status === 'active') : [];
  const s_ = sym ?? '';
  const enc = encodeURIComponent(s_);
  const titleId = useId();
  return (
    <Sheet open={!!sym} onClose={onClose} title={t('find.title', { sym: s_ })} labelledBy={titleId}>
      {sym && (
        <div className={s.body}>
          <p className={s.muted}>{instrument(sym)?.name}</p>
          <section className={s.choice} aria-labelledby="find-solo">
            <h3 id="find-solo">{t('find.solo')}</h3>
            <p>{t('find.solo.body')}</p>
            <Link className={buttonClass({ variant: 'primary', block: true })} to={`/practice/trade/${enc}`}>
              {t('find.solo.go', { sym })}
            </Link>
          </section>
          <section className={s.choice} aria-labelledby="find-battle">
            <h3 id="find-battle">{t('find.battle')}</h3>
            {running.length ? (
              <>
                <p>{t('find.battle.pick')}</p>
                <ul className={s.list}>
                  {running.map((w) => (
                    <li key={w.id}>
                      <Link className={buttonClass({ variant: 'secondary', block: true })} to={`/battles/${encodeURIComponent(w.id)}?sym=${enc}`}>
                        {w.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>{t('find.battle.none')}</p>
            )}
            <Link className={buttonClass({ variant: running.length ? 'ghost' : 'secondary', block: true })} to="/battles">
              {t('find.battle.new')}
            </Link>
          </section>
          <Link className="hit" to={`/markets/${enc}`}>
            {t('find.chart', { sym })} →
          </Link>
        </div>
      )}
    </Sheet>
  );
}
