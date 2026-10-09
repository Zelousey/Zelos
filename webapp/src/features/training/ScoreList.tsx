/** Live top scores for one game (scores/<gameId> in the Realtime Database). Your own rows are highlighted. */
import { useAuth } from '../../lib/auth';
import { formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { EmptyState, ErrorState, LoadingState } from '../../ui';
import { useTopScores } from './training';
import s from './Training.module.css';

export function ScoreList({ gameId, n = 10 }: { gameId: string; n?: number }) {
  const rows = useTopScores(gameId, n);
  const { user } = useAuth();
  const now = useNow();
  if (rows === null) return <LoadingState rows={4} />;
  if (rows === 'error') return <ErrorState compact />;
  if (!rows.length) return <EmptyState icon="arcade" body={t('tg.board.empty')} compact />;
  return (
    <ol className={s.scores}>
      {rows.map((r, i) => (
        <li key={r.key} className={user && r.uid === user.uid ? s.me : undefined}>
          <span className={[s.place, i < 3 && s[`p${i + 1}`]].filter(Boolean).join(' ')}>{i + 1}</span>
          <span className={s.who}>
            <b>{r.name}</b>
            {r.ts > 0 && <small>{formatRelative(r.ts, now)}</small>}
          </span>
          <span className={s.score}>{r.score.toLocaleString('en-US')}</span>
        </li>
      ))}
    </ol>
  );
}
