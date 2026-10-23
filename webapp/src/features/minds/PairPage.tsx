/** A head-to-head (/minds/vs/:id): two greats side by side, round by round, and the lesson for traders. */
import { Link, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { useUserDoc } from '../../data/userDoc';
import { t } from '../../lib/i18n';
import { Card, EmptyState } from '../../ui';
import { PairCard } from './MindCard';
import { figureById, pairById, pairRef } from './minds';
import { ReadButton } from './ReadButton';
import s from './Minds.module.css';

export function PairPage() {
  const { id = '' } = useParams();
  const p = pairById(id);
  const { user, isReal } = useAuth();
  const me = useUserDoc(isReal && user ? user.uid : null);
  if (!p) return <EmptyState icon="learn" title={t('hm.missing')} actions={<Link to="/minds">{t('hm.back')}</Link>} />;
  const a = figureById(p.a)!;
  const b = figureById(p.b)!;
  const done = me.status === 'ready' && me.data.mindsDone.includes(pairRef(p.id));
  return (
    <div className={s.page}>
      <Link className={s.back} to="/minds">
        ← {t('hm.back')}
      </Link>
      <PairCard pair={p} big pill={t('hm.vs')} />
      <header className={s.heroText}>
        <span className={s.kicker}>{t('hm.headToHead')}</span>
        <h1 className={s.title}>{p.title}</h1>
        <p className={s.lead}>{p.tagline}</p>
      </header>
      <Card pad>
        <table className={s.vs}>
          <caption className="visually-hidden">{p.title}</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">{t('hm.topic')}</span>
              </th>
              <th scope="col">
                <Link to={`/minds/${a.id}`}>{a.name}</Link>
              </th>
              <th scope="col">
                <Link to={`/minds/${b.id}`}>{b.name}</Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {p.rounds.map((r) => (
              <tr key={r.topic}>
                <th scope="row">{r.topic}</th>
                <td>{r.a}</td>
                <td>{r.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className={s.trading}>
        <b>{t('hm.inTrading')}</b>
        <p>{p.takeaway}</p>
      </div>
      <div className={s.readRow}>
        <ReadButton refId={pairRef(p.id)} done={done} />
      </div>
    </div>
  );
}
