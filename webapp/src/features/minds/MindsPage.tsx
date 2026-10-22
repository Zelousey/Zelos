/**
 * Hall of Minds (/minds): a grid of red cards, one per great mind, with head-to-head pairs mixed
 * in (owner 2026-10-22). Free to read; every lesson pays XP once.
 */
import { useAuth } from '../../lib/auth';
import { useUserDoc } from '../../data/userDoc';
import { t } from '../../lib/i18n';
import { PageHeader } from '../../ui';
import { FigureCard, MeltFilter, PairCard } from './MindCard';
import { figureProgress, pairRef, TILES } from './minds';
import s from './Minds.module.css';

export function MindsPage() {
  const { user, isReal } = useAuth();
  const me = useUserDoc(isReal && user ? user.uid : null);
  const done = me.status === 'ready' ? me.data.mindsDone : [];
  return (
    <>
      <PageHeader title={t('nav.minds')} subtitle={t('hm.sub')} />
      <MeltFilter />
      <ul className={s.grid} aria-label={t('nav.minds')}>
        {TILES.map((tile) =>
          tile.kind === 'figure' ? (
            <li key={tile.figure.id}>
              <FigureCard
                figure={tile.figure}
                to={`/minds/${tile.figure.id}`}
                pill={t('hm.lessonsPill', { n: figureProgress(tile.figure, done), of: tile.figure.lessons.length })}
              />
              <p className={s.under}>
                <b>{tile.figure.role}</b> · {tile.figure.years}
              </p>
            </li>
          ) : (
            <li key={tile.pair.id}>
              <PairCard pair={tile.pair} to={`/minds/vs/${tile.pair.id}`} pill={done.includes(pairRef(tile.pair.id)) ? t('hm.read') : t('hm.vs')} />
              <p className={s.under}>{tile.pair.tagline}</p>
            </li>
          ),
        )}
      </ul>
      <p className={s.fine}>{t('hm.more')}</p>
    </>
  );
}
