/**
 * Your token activity (wallets/{uid}/ledger, server-written, readable only by you), newest first:
 * the last 15 lines, or in the Token Store (`more`) pages of 25 with "Show more".
 */
import { useState } from 'react';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { useLiveQuery } from '../../data/liveQuery';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Button } from '../../ui';
import s from './Strategies.module.css';

type Line = { id: string; note: string; amount: number; at: number };

const PAGE = 25;

export function TokenHistory({ more = false }: { more?: boolean }) {
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const [n, setN] = useState(more ? PAGE : 15);
  const rows = useLiveQuery(
    uid ? `ledger:${uid}:${n}` : null,
    () => query(collection(db(), 'wallets', uid!, 'ledger'), orderBy('at', 'desc'), limit(n)),
    (id, d): Line => ({ id, note: String(d.note || d.type || '').slice(0, 120), amount: Number(d.amount) || 0, at: Number(d.at) || 0 }),
  );
  if (!uid) return null;
  return (
    <section className={s.history} aria-labelledby="tok-hist">
      <h3 id="tok-hist">{t(more ? 'tok.historyAll' : 'tok.history')}</h3>
      {rows.status === 'loading' ? (
        <p className={s.muted}>{t('st.loading')}</p>
      ) : rows.status !== 'ready' ? (
        <p className={s.muted}>{t('tok.historyFailed')}</p>
      ) : !rows.data.length ? (
        <p className={s.muted}>{t('tok.historyNone')}</p>
      ) : (
        <ul>
          {rows.data.map((r) => (
            <li key={r.id}>
              <span>
                {r.note}
                <small>{formatRelative(r.at)}</small>
              </span>
              <b className={r.amount >= 0 ? s.plus : s.minus}>
                {r.amount >= 0 ? '+' : ''}
                {r.amount}
              </b>
            </li>
          ))}
        </ul>
      )}
      {more && rows.status === 'ready' && rows.data.length >= n && (
        <Button variant="secondary" size="sm" onClick={() => setN(n + PAGE)}>
          {t('tok.more')}
        </Button>
      )}
    </section>
  );
}
