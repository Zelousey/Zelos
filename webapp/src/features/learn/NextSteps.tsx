/** What to do next for your level (quiz result, dashboard card). */
import { Link } from 'react-router';
import { t, type MessageKey } from '../../lib/i18n';
import { Icon, type IconName } from '../../ui';
import type { Level } from './quiz';
import s from './Learn.module.css';

type Step = { to: string; icon: IconName; title: MessageKey; body: MessageKey };
export const STEPS: Record<Level, Step[]> = {
  beginner: [
    { to: '/learn', icon: 'learn', title: 'ns.learn', body: 'ns.learn.body' },
    { to: '/markets/AAPL', icon: 'practice', title: 'ns.firstTrade', body: 'ns.firstTrade.body' },
    { to: '/invite', icon: 'war', title: 'ns.quickBattle', body: 'ns.quickBattle.body' },
  ],
  learning: [
    { to: '/learn/basics/stops', icon: 'learn', title: 'ns.stops', body: 'ns.stops.body' },
    { to: '/invite', icon: 'war', title: 'ns.battle', body: 'ns.battle.body' },
    { to: '/training', icon: 'arcade', title: 'ns.training', body: 'ns.training.body' },
  ],
  experienced: [
    { to: '/invite', icon: 'war', title: 'ns.battle', body: 'ns.battle.body' },
    { to: '/strategies', icon: 'signal', title: 'ns.strategies', body: 'ns.strategies.body' },
    { to: '/options', icon: 'options', title: 'ns.options', body: 'ns.options.body' },
  ],
};

export function NextSteps({ level }: { level: Level }) {
  return (
    <ul className={s.steps}>
      {STEPS[level].map((x) => (
        <li key={x.title}>
          <Link to={x.to} className={s.stepLink}>
            <span className={s.stepIcon}>
              <Icon name={x.icon} size={20} />
            </span>
            <span className={s.stepText}>
              <b>{t(x.title)}</b>
              <span>{t(x.body)}</span>
            </span>
            <Icon name="chevronRight" size={16} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
