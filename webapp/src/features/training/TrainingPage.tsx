/**
 * Training Ground (/training; the website's arcade.html, renamed by the owner 2026-10-09):
 * drills on real charts that train spotting setups, placing stops and setting targets, today's
 * Daily Challenge, and the drill leaderboards.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { t, type MessageKey } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { buttonClass, Card, PageHeader, Tabs } from '../../ui';
import { lsGet } from '../welcome/welcome';
import { dailyId, DRILLS, FUN, SKILLS, useTopScores, type Drill, type Skill } from './training';
import { ScoreList } from './ScoreList';
import s from './Training.module.css';

type Tab = 'drills' | 'boards';

export default function TrainingPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'boards' ? 'boards' : 'drills';
  return (
    <>
      <PageHeader title={t('nav.training')} subtitle={t('tg.subtitle')} />
      <div className={s.tabs}>
        <Tabs label={t('nav.training')} value={tab} onChange={(v) => setParams(v === 'drills' ? {} : { tab: v }, { replace: true })} items={[{ value: 'drills', label: t('tg.tab.drills') }, { value: 'boards', label: t('tg.tab.boards') }]} />
      </div>
      {tab === 'drills' ? <Drills /> : <Boards />}
      <p className={s.fine}>{t('tg.fine')}</p>
    </>
  );
}

function Drills() {
  const [skill, setSkill] = useState<Skill | null>(null);
  const list = skill ? DRILLS.filter((d) => d.skills.includes(skill)) : DRILLS;
  return (
    <div className={s.page}>
      <Daily />
      <div className={s.skills} role="group" aria-label={t('tg.skills')}>
        <span className={s.kicker}>{t('tg.skills')}</span>
        <button type="button" className={[s.skill, !skill && s.skillOn].filter(Boolean).join(' ')} aria-pressed={!skill} onClick={() => setSkill(null)}>
          {t('tg.skill.all')}
        </button>
        {SKILLS.map((k) => (
          <button key={k} type="button" className={[s.skill, skill === k && s.skillOn].filter(Boolean).join(' ')} aria-pressed={skill === k} onClick={() => setSkill(skill === k ? null : k)}>
            {t(`tg.skill.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      <div className={s.grid}>
        {list.map((d) => (
          <DrillCard key={d.id} d={d} />
        ))}
      </div>
      <p className={s.fun}>
        {t('tg.fun')}{' '}
        {FUN.map((f, i) => (
          <span key={f.id}>
            {i > 0 && ' · '}
            <Link to={`/training/${f.id}`}>
              {f.icon} {f.name}
            </Link>
          </span>
        ))}
      </p>
    </div>
  );
}

function Daily() {
  const now = useNow();
  const id = dailyId(now);
  const played = !!lsGet(`zdc-${id.slice(6)}`);
  const top = useTopScores(id, 1);
  const best = Array.isArray(top) && top[0] ? top[0] : null;
  return (
    <Link to="/training/daily-challenge" className={s.daily}>
      <span className={s.kicker}>
        <span className={s.dot} aria-hidden="true" /> {t('tg.daily.kicker', { date: id.slice(6) })}
      </span>
      <b className={s.dailyTitle}>{t('tg.daily.title')}</b>
      <span className={s.muted}>{t('tg.daily.body')}</span>
      <span className={s.dailyFoot}>
        <span className={buttonClass({ variant: 'primary', size: 'sm' })}>{played ? t('tg.daily.again') : t('tg.daily.play')}</span>
        {played && <span className={s.done}>✓ {t('tg.daily.played')}</span>}
        {best && <span className={s.muted}>{t('tg.daily.best', { name: best.name, n: best.score })}</span>}
      </span>
    </Link>
  );
}

function DrillCard({ d }: { d: Drill }) {
  const top = useTopScores(d.id, 1);
  const best = Array.isArray(top) && top[0] ? top[0] : null;
  return (
    <Card pad className={[s.card, s[d.tone]].join(' ')}>
      <div className={s.cardHead}>
        <span className={s.icon} aria-hidden="true">
          {d.icon}
        </span>
        <div>
          <span className={s.kicker}>{d.tag}</span>
          <h2 className={s.cardTitle}>{d.name}</h2>
        </div>
      </div>
      <p className={s.desc}>{d.desc}</p>
      <div className={s.learn}>
        <span className={s.kicker}>{t('tg.learn')}</span>
        <ul>
          {d.learn.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <div className={s.tags}>
        {d.skills.map((k) => (
          <span key={k} className={s.tag}>
            {t(`tg.skill.${k}` as MessageKey)}
          </span>
        ))}
      </div>
      <div className={s.cardFoot}>
        <Link className={buttonClass({ variant: 'primary', size: 'sm' })} to={`/training/${d.id}`}>
          {t('tg.play')}
        </Link>
        {best && <span className={s.muted}>{t('tg.top', { name: best.name, n: best.score })}</span>}
      </div>
    </Card>
  );
}

function Boards() {
  const now = useNow();
  const boards = [{ id: dailyId(now), name: t('tg.daily.short') }, ...DRILLS.map((d) => ({ id: d.id, name: d.name })), ...FUN.map((f) => ({ id: f.id, name: f.name }))];
  const [pick, setPick] = useState(boards[1]!.id);
  const id = boards.some((b) => b.id === pick) ? pick : boards[0]!.id;
  return (
    <Card flush title={t('tg.boards')}>
      <div className={s.boardTabs}>
        <Tabs label={t('tg.boards')} value={id} onChange={setPick} items={boards.map((b) => ({ value: b.id, label: b.name }))} />
      </div>
      <ScoreList gameId={id} n={20} />
    </Card>
  );
}
