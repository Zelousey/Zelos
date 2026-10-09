/**
 * Leaderboard (/leaderboard; owner 2026-10-09): the Trade War boards from the website in the app.
 * All-time by account value, Weekly and Monthly by % return, the Season (by % return, P&L,
 * biggest win, XP or winning streak) and Friends. The top 50, your row highlighted, and your
 * place even when you're further down. Arcade game boards come with the Arcade page.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useUserDoc } from '../../data/userDoc';
import { levelFor } from '../../data/levels';
import { useAuth } from '../../lib/auth';
import { formatMoney } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { classicUrl } from '../../lib/platform';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, Tabs } from '../../ui';
import { useMyProfile, type Ranked } from '../dashboard/social';
import { boardField, SEASON_CATS, useBoard, useFriendsBoard, useRank, type BoardId, type SeasonCat } from './board';
import { nyToday, seasonFor } from './periods';
import s from './Leaderboard.module.css';

const money = (v: number) => formatMoney(v, { digits: 0 });
const signedMoney = (v: number) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

/** The headline number of a row on a board. */
function fmt(board: BoardId, cat: SeasonCat, v: number | null): string {
  if (v == null) return '—';
  if (board === 'all') return money(v);
  if (board !== 'season' || cat === 'pct') return pct(v);
  if (cat === 'pnl' || cat === 'bestWin') return signedMoney(v);
  if (cat === 'xp') return `${Math.round(v).toLocaleString('en-US')} XP`;
  return t('lb.wins', { n: Math.round(v) });
}

export default function LeaderboardPage() {
  const [params, setParams] = useSearchParams();
  const season = seasonFor(nyToday());
  const boards: BoardId[] = ['all', 'week', 'month', ...(season ? (['season'] as BoardId[]) : []), 'friends'];
  const board = (boards.find((b) => b === params.get('b')) ?? 'all') as BoardId;
  const cat = (SEASON_CATS.find((c) => c === params.get('c')) ?? 'pct') as SeasonCat;
  const set = (b: BoardId, c: SeasonCat = cat) => setParams(b === 'all' ? {} : b === 'season' ? { b, c } : { b }, { replace: true });
  return (
    <>
      <PageHeader title={t('nav.leaderboard')} subtitle={t('lb.subtitle')} />
      <div className={s.tabs}>
        <Tabs label={t('nav.leaderboard')} value={board} onChange={(b) => set(b)} items={boards.map((b) => ({ value: b, label: b === 'season' && season ? season.name : t(`lb.tab.${b}` as MessageKey) }))} />
      </div>
      {board === 'season' && season && (
        <div className={s.season}>
          <p>
            <b>
              {season.name} · {season.title}
            </b>{' '}
            <span className={s.muted}>
              {season.start} → {season.end}
            </span>
          </p>
          <Tabs label={t('lb.cat')} value={cat} onChange={(c) => set('season', c)} items={SEASON_CATS.map((c) => ({ value: c, label: t(`lb.cat.${c}` as MessageKey) }))} />
        </div>
      )}
      {board === 'friends' ? <FriendsBoard /> : <Board board={board} cat={cat} />}
      <p className={s.fine}>{t('lb.fine')}</p>
    </>
  );
}

function Board({ board, cat }: { board: BoardId; cat: SeasonCat }) {
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const rows = useBoard(board, cat);
  const mine = useMyProfile(uid);
  const f = boardField(board, cat);
  const me = mine.status === 'ready' ? mine.data : null;
  const myValue = me ? f.value(me) : null;
  const rank = useRank(f.path, myValue);
  if (rows.status === 'loading') return <LoadingState rows={8} />;
  if (rows.status === 'error') return <ErrorState compact />;
  const list = rows.status === 'ready' ? rows.data : [];
  const inTop = !!uid && list.some((r) => r.uid === uid);
  return (
    <Card flush title={t(`lb.title.${board}` as MessageKey)} subtitle={uid ? (me ? (rank ? t('lb.you', { n: rank }) : t('lb.youUnranked')) : t('lb.noAccount')) : t('lb.signIn')}>
      {!list.length ? (
        <EmptyState icon="war" body={t(board === 'all' ? 'lb.empty' : 'lb.emptyPeriod')} compact />
      ) : (
        <ol className={s.list}>
          {list.map((r, i) => (
            <Row key={r.uid} r={r} place={i + 1} value={fmt(board, cat, f.value(r))} me={r.uid === uid} />
          ))}
          {me && !inTop && rank && myValue != null && <Row r={me} place={rank} value={fmt(board, cat, myValue)} me gap />}
        </ol>
      )}
    </Card>
  );
}

function FriendsBoard() {
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const me = useUserDoc(uid);
  const friends = useMemo(() => (me.status === 'ready' ? me.data.friends : []), [me]);
  const rows = useFriendsBoard(uid, friends);
  if (!uid) return <EmptyState icon="social" body={t('lb.friends.signIn')} />;
  if (rows == null || me.status === 'loading') return <LoadingState rows={6} />;
  if (rows.length <= 1)
    return (
      <EmptyState
        icon="social"
        body={t('lb.friends.empty')}
        actions={
          <a className={s.more} href={classicUrl('practice/squads.html')}>
            {t('dash.squads')} →
          </a>
        }
      />
    );
  return (
    <Card flush title={t('lb.title.friends')}>
      <ol className={s.list}>
        {rows.map((r, i) => (
          <Row key={r.uid} r={r} place={i + 1} value={pct(r.growthPct)} me={r.uid === uid} />
        ))}
      </ol>
    </Card>
  );
}

function Row({ r, place, value, me, gap }: { r: Ranked; place: number; value: string; me?: boolean; gap?: boolean }) {
  const medal = place === 1 ? s.gold : place === 2 ? s.silver : place === 3 ? s.bronze : '';
  const lv = levelFor(r.xp).level;
  return (
    <li className={[me && s.me, gap && s.gap].filter(Boolean).join(' ')} value={place}>
      <a href={classicUrl(`practice/profile.html?u=${encodeURIComponent(r.uid)}`)} className={s.row}>
        <span className={[s.place, medal].filter(Boolean).join(' ')}>{place}</span>
        {r.photo ? <img className={s.avatar} src={r.photo} alt="" width={36} height={36} referrerPolicy="no-referrer" loading="lazy" /> : <span className={s.avatar} aria-hidden>{r.name.slice(0, 1).toUpperCase()}</span>}
        <span className={s.who}>
          <b>
            {r.name}
            {me && <span className={s.youTag}>{t('lb.youTag')}</span>}
          </b>
          <small>
            {t('lb.level', { n: lv.level, name: lv.name })} · {t('lb.trades', { n: r.trades })}
            {r.tradeStreak > 1 ? ` · 🔥 ${r.tradeStreak}` : ''}
          </small>
        </span>
        <span className={s.value}>{value}</span>
      </a>
    </li>
  );
}
