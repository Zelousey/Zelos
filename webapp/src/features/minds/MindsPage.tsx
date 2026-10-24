/**
 * Hall of Minds (/minds): a grid of red cards, one per great mind (owner 2026-10-22), with tabs for
 * the market legends and the rest of history. The book animation (BookIntro) plays from MindsModule.
 * Free to read; every lesson pays XP once.
 */
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useUserDoc } from '../../data/userDoc';
import { t } from '../../lib/i18n';
import { PageHeader, Tabs } from '../../ui';
import { FigureCard } from './MindCard';
import { figureProgress, ORDERED, type Group } from './minds';
import s from './Minds.module.css';

export function MindsPage() {
  const { user, isReal } = useAuth();
  const me = useUserDoc(isReal && user ? user.uid : null);
  const done = me.status === 'ready' ? me.data.mindsDone : [];
  const [group, setGroup] = useState<'all' | Group>('all');
  const shown = ORDERED.filter((f) => group === 'all' || f.group === group);
  return (
    <>
      <PageHeader title={t('nav.minds')} subtitle={t('hm.sub')} />
      <div className={s.groupTabs}>
        <Tabs
          label={t('hm.groups')}
          value={group}
          onChange={setGroup}
          items={[
            { value: 'all', label: t('hm.all') },
            { value: 'markets', label: t('hm.markets') },
            { value: 'history', label: t('hm.history') },
          ]}
        />
      </div>
      <ul className={s.grid} aria-label={t('nav.minds')}>
        {shown.map((f) => (
          <li key={f.id}>
            <FigureCard figure={f} to={`/minds/${f.id}`} pill={t('hm.lessonsPill', { n: figureProgress(f, done), of: f.lessons.length })} />
            <p className={s.under}>
              <b>{f.role}</b> · {f.years}
            </p>
          </li>
        ))}
      </ul>
      <p className={s.fine}>{t('hm.more')}</p>
      <p className={s.fine}>{t('hm.credits')}</p>
    </>
  );
}
