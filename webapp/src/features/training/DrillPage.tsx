/**
 * One drill inside the app (/training/:id): the website's drill page in a frame without its
 * menu (games/zelos-embed.js), with its top scores below. Links inside the drill that lead
 * elsewhere on the site come back to the app.
 */
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { t } from '../../lib/i18n';
import { classicUrl } from '../../lib/platform';
import { useNow } from '../../lib/useNow';
import { Card, Icon } from '../../ui';
import NotFoundPage from '../notfound/NotFoundPage';
import { ScoreList } from './ScoreList';
import { dailyId, drill, embedPath, FUN, isGame } from './training';
import s from './Training.module.css';

/** Where a link clicked inside a drill should go in the app (null: leave the app for that page). */
export function appPathFor(sitePath: string): string | null {
  const p = sitePath.replace(/^\/+/, '');
  if (/^arcade\.html/.test(p)) return '/training';
  if (/^leaderboard\.html/.test(p)) return '/training?tab=boards';
  const g = /^games\/([a-z-]+)\.html/.exec(p);
  if (g && isGame(g[1]!)) return `/training/${g[1]}`;
  if (/^practice\/(index\.html)?$/.test(p)) return '/practice';
  if (/^learn\//.test(p)) return null;
  return null;
}

export default function DrillPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || e.data.zelos !== 'training-nav' || typeof e.data.path !== 'string') return;
      const to = appPathFor(e.data.path);
      if (to) navigate(to);
      else window.location.assign(classicUrl(e.data.path));
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [navigate]);
  if (!isGame(id)) return <NotFoundPage />;
  const d = drill(id);
  const name = d?.name ?? FUN.find((f) => f.id === id)?.name ?? t('tg.daily.short');
  const board = id === 'daily-challenge' ? dailyId(now) : id;
  return (
    <div className={s.drillPage}>
      <div className={s.drillBar}>
        <Link to="/training" className={s.back}>
          <Icon name="back" size={16} /> {t('nav.training')}
        </Link>
        <h1 className={s.drillTitle}>{name}</h1>
        <a className={s.full} href={classicUrl(`games/${id}.html`)}>
          {t('tg.fullScreen')} <Icon name="external" size={12} />
        </a>
      </div>
      <iframe className={s.frame} src={classicUrl(embedPath(id))} title={t('tg.frame', { name })} allow="clipboard-write; web-share" />
      <Card flush title={t('tg.topScores', { name })} actions={<Link className={s.more} to="/training?tab=boards">{t('tg.allBoards')}</Link>}>
        <ScoreList gameId={board} />
      </Card>
    </div>
  );
}
