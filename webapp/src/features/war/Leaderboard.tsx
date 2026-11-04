/**
 * The weekly War Zone leaderboards (owner 2026-11-04): everyone in this season's Open zones ranked
 * together by War Score, and Rookie zones on their own board. The server rebuilds them once an hour
 * (functions/warboard.py → warMarket/board); a new season starts every Monday 9 am ET.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import type { DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { t } from '../../lib/i18n';
import { Card, Tabs } from '../../ui';
import s from './War.module.css';

type Row = { uid: string; name: string; zone: string; zoneId: string; score: number; ret: number; rank: number };
type Board = { top: Row[]; ranks: Record<string, number>; total: number };
export type Boards = { season: string; at: number; open: Board; rookie: Board };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
function parseBoard(v: unknown): Board {
  const b = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const top = (Array.isArray(b.top) ? b.top : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof (r as Record<string, unknown>).uid === 'string')
    .map((r) => ({ uid: r.uid as string, name: typeof r.name === 'string' ? r.name.slice(0, 24) : 'Trader', zone: typeof r.zone === 'string' ? r.zone : '', zoneId: typeof r.zoneId === 'string' ? r.zoneId : '', score: num(r.score), ret: num(r.ret), rank: num(r.rank) }));
  const ranks: Record<string, number> = {};
  for (const [k, n] of Object.entries((b.ranks && typeof b.ranks === 'object' ? b.ranks : {}) as Record<string, unknown>)) if (typeof n === 'number') ranks[k] = n;
  return { top, ranks, total: num(b.total) };
}
export const parseBoards = (d: DocumentData): Boards => ({ season: typeof d.season === 'string' ? d.season : '', at: num(d.at), open: parseBoard(d.open), rookie: parseBoard(d.rookie) });
const useBoards = () => useLiveDoc('warMarket/board', parseBoards);

export function Leaderboard({ uid }: { uid: string }) {
  const live = useBoards();
  const b = live.status === 'ready' ? live.data : null;
  const [kind, setKind] = useState<'open' | 'rookie' | null>(null);
  if (!b || (!b.open.total && !b.rookie.total)) return null; // nothing to rank yet this season
  const shown = kind ?? (b.rookie.ranks[uid] && !b.open.ranks[uid] ? 'rookie' : 'open');
  const board = b[shown];
  const mine = board.ranks[uid];
  return (
    <Card title={t('wlb.title')} subtitle={t('wlb.sub')} flush aria-label={t('wlb.title')}>
      <div className={s.lbHead}>
        <Tabs
          label={t('wlb.title')}
          value={shown}
          onChange={setKind}
          items={[
            { value: 'open', label: t('wlb.open') },
            { value: 'rookie', label: t('wlb.rookie') },
          ]}
        />
        <p className={s.lbYou} role="status">
          {mine ? t('wlb.you', { n: mine.toLocaleString('en-US'), of: board.total.toLocaleString('en-US') }) : t('wlb.notOn')}
        </p>
      </div>
      {board.top.length ? (
        <ol className={s.lbList} aria-label={t(shown === 'open' ? 'wlb.openList' : 'wlb.rookieList')}>
          {board.top.map((r) => (
            <li key={r.uid} className={r.uid === uid ? s.lbMe : undefined}>
              <span className={s.lbRank}>#{r.rank}</span>
              <span className={s.lbName}>
                <b>{r.uid === uid ? t('wlb.youName', { name: r.name }) : r.name}</b>
                <small>{r.zoneId ? <Link to={`/war/${r.zoneId}`}>{r.zone}</Link> : r.zone}</small>
              </span>
              <span className={s.lbScore}>
                <b>{r.score.toFixed(1)}</b>
                <small className={r.ret >= 0 ? s.up : s.down}>{`${r.ret >= 0 ? '+' : ''}${r.ret.toFixed(2)}%`}</small>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={s.lbEmpty}>{t('wlb.empty')}</p>
      )}
    </Card>
  );
}
