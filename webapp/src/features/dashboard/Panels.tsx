/**
 * The dashboard's panels. Each one reads real, server-written data (or the person's own
 * progress) and has its own loading, empty and signed-out state, so one slow source never
 * blanks the page.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { levelFor } from '../../data/levels';
import type { Loadable } from '../../data/liveDoc';
import { useMovers, useQuotes, useSnapshot, type Quote } from '../../data/markets';
import { instrument, INDEX_ETFS } from '../../data/universe';
import { formatMoney, formatPercent, formatPrice, formatSignedMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { classicUrl } from '../../lib/platform';
import { useNow } from '../../lib/useNow';
import { Badge, buttonClass, Card, Change, EmptyState, ErrorState, Icon, LoadingState, Skeleton, Sparkline, Stat, Tabs } from '../../ui';
import { nyDay } from '../charts/series';
import { useOpenExchanges, WorldMarkets } from '../markets/WorldMarkets';
import { MarketList } from '../markets/MarketRow';
import { SectorBars } from '../markets/Sectors';
import { usePracticeAccount, valueAccount } from '../practice/account';
import { LevelBadge } from './LevelBadge';
import { achievementsView, missionsView, STREAK_NEED, type Progress, type XpLog } from './progress';
import { sortWars, useMyWars, useTopTraders, type Identity, type Ranked } from './social';
import s from './DashboardPage.module.css';

const dir = (n: number | null | undefined) => (n == null || n === 0 ? 'flat' : n > 0 ? 'up' : 'down') as 'up' | 'down' | 'flat';
const MoreLink = ({ to, href, children }: { to?: string; href?: string; children: string }) =>
  to ? (
    <Link to={to} className={s.more}>
      {children} →
    </Link>
  ) : (
    <a href={href} className={s.more}>
      {children} →
    </a>
  );

// ------------------------------------------------------------------ signed out
export function WelcomeCard({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Card pad className={s.welcome}>
      <Badge tone="accent">{t('practice.virtual')}</Badge>
      <h2 className={s.welcomeTitle}>{t('dash.welcome.title')}</h2>
      <p className={s.welcomeBody}>{t('dash.welcome.body')}</p>
      <div className={s.row}>
        <button type="button" className={buttonClass({ variant: 'primary' })} onClick={onSignIn}>
          {t('dash.welcome.cta')}
        </button>
        <Link to="/trade-war" className={buttonClass({ variant: 'secondary' })}>
          {t('nav.tradeWar')}
        </Link>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ trader card
export function TraderCard({ uid, identity, xp, streak, rank, badges, totalBadges }: { uid: string; identity: Identity | null; xp: number | null; streak: number; rank: number | null; badges: number; totalBadges: number }) {
  const lv = xp == null ? null : levelFor(xp);
  return (
    <Card pad className={s.trader} aria-label={t('dash.trader')}>
      <div className={s.traderHead}>
        {lv ? <LevelBadge level={lv.level} size={60} /> : <Skeleton width={60} height={60} />}
        <div className={s.traderId}>
          <span className={s.kicker}>{lv ? t('dash.trader.level', { level: lv.level.level, title: lv.level.title }) : ' '}</span>
          <b className={s.traderName}>{identity?.name || lv?.level.name || t('dash.trader')}</b>
          {identity?.username && <span className={s.muted}>@{identity.username}</span>}
        </div>
        {identity?.avatar && <img className={s.avatar} src={identity.avatar} alt="" width={40} height={40} referrerPolicy="no-referrer" />}
      </div>
      {lv && (
        <>
          <div className={s.xpBar} role="progressbar" aria-label={t('dash.trader.toNext', { n: lv.toNext, name: lv.next?.name ?? '' })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lv.progress * 100)}>
            <i style={{ width: `${Math.max(3, lv.progress * 100).toFixed(1)}%`, background: `linear-gradient(90deg, ${lv.level.colors[1]}, ${lv.level.colors[0]})` }} />
          </div>
          <div className={s.xpLine}>
            <span>{t('dash.trader.xp', { xp: (xp ?? 0).toLocaleString('en-US') })}</span>
            <span>{lv.next ? t('dash.trader.toNext', { n: lv.toNext.toLocaleString('en-US'), name: lv.next.name }) : t('dash.trader.max')}</span>
          </div>
        </>
      )}
      <div className={s.traderStats}>
        <Stat size="sm" label={t('dash.trader.streak')} value={streak ? `🔥 ${streak}` : '0'} />
        <Stat size="sm" label={t('dash.trader.rank')} value={rank ? `#${rank.toLocaleString('en-US')}` : '–'} />
        <Stat size="sm" label={t('dash.trader.badges')} value={`${badges}/${totalBadges}`} />
      </div>
      <div className={s.row}>
        <a className={buttonClass({ variant: 'secondary', size: 'sm' })} href={classicUrl(`practice/profile.html?u=${encodeURIComponent(uid)}`)}>
          {t('dash.trader.profile')}
        </a>
        <a className={buttonClass({ variant: 'ghost', size: 'sm' })} href={classicUrl('leaderboard.html#practice')}>
          {t('tw.leaderboard')}
        </a>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ Trade War account
export function AccountCard({ uid }: { uid: string }) {
  const acct = usePracticeAccount(uid);
  const quotes = useQuotes();
  const qs = useMemo<Record<string, Quote>>(() => (quotes.status === 'ready' ? quotes.data.quotes : {}), [quotes]);
  const [today] = useState(() => nyDay(Date.now()));
  const data = acct.status === 'ready' ? acct.data : null;
  const v = useMemo(() => (data ? valueAccount(data, qs, today) : null), [data, qs, today]);
  const top = v ? [...v.rows].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)).slice(0, 3) : [];

  let body;
  if (acct.status === 'loading') body = <Skeleton height={120} />;
  else if (acct.status === 'error') body = <ErrorState compact />;
  else if (!v || !data)
    body = (
      <div className={s.cta}>
        <p>{t('tw.practice.none')}</p>
        <Link className={buttonClass({ variant: 'primary' })} to="/practice">
          {t('tw.practice.start')}
        </Link>
      </div>
    );
  else
    body = (
      <>
        <div className={s.kpis}>
          <Stat label={t('tw.value')} value={<span className={s.big}>{formatMoney(v.equity)}</span>} />
          <Stat label={t('tw.today')} value={formatSignedMoney(v.dayPnl)} direction={dir(v.dayPnl)} delta={null} />
          <Stat label={t('tw.total')} value={formatSignedMoney(v.netPnl)} direction={dir(v.netPnl)} delta={null} />
        </div>
        <div className={s.sub}>{t('dash.account.positions')}</div>
        {top.length ? (
          <ul className={s.positions}>
            {top.map((p) => (
              <li key={p.sym}>
                <Link to={`/markets/${p.sym}`} className={s.posRow}>
                  <b>{p.sym}</b>
                  <span className={s.muted}>
                    {p.qty} @ {formatPrice(p.avg)}
                  </span>
                  <span className={dir(p.pnl)}>
                    {formatSignedMoney(p.pnl)} <small>({formatPercent(p.pnlPct)})</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.muted}>{t('dash.account.noPositions')}</p>
        )}
        <div className={s.rowEnd}>
          <span className={s.muted}>{t('tw.holdings', { positions: data.positions.length, orders: data.orders.length })}</span>
          <span className={s.row}>
            <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} to="/markets">
              {t('tw.practice.trade')}
            </Link>
            <Link className={buttonClass({ variant: 'primary', size: 'sm' })} to="/practice">
              {t('tw.practice.open')}
            </Link>
          </span>
        </div>
      </>
    );
  return (
    <Card className={s.account} title={t('dash.account')} actions={<Badge tone="accent">{t('practice.virtual')}</Badge>}>
      {body}
    </Card>
  );
}

// ------------------------------------------------------------------ globe
export function GlobePanel() {
  const { summary } = useOpenExchanges();
  return (
    <Card className={s.globe} title={t('dash.globe')} subtitle={summary} actions={<MoreLink to="/markets">{t('nav.market')}</MoreLink>}>
      <WorldMarkets height={420} />
    </Card>
  );
}

// ------------------------------------------------------------------ missions
export function MissionsCard({ progress, xpLog }: { progress: Progress | null; xpLog: XpLog }) {
  const now = useNow();
  const m = missionsView(progress, xpLog, now);
  return (
    <Card className={s.missions} title={t('dash.missions')} actions={m.streak ? <Badge tone="gold">🔥 {m.streak}</Badge> : undefined} flush>
      <ul className={s.missionList}>
        {m.daily.map((x) => (
          <li key={x.id} className={x.done ? s.done : undefined}>
            <span className={s.check} aria-hidden>
              {x.done ? '✓' : ''}
            </span>
            {x.href?.startsWith('/') ? <Link to={x.href}>{x.label}</Link> : x.href ? <a href={classicUrl(x.href)}>{x.label}</a> : <span>{x.label}</span>}
            <span className={s.count} aria-label={`${x.count} of ${x.goal}${x.done ? ', done' : ''}`}>
              {x.count}/{x.goal}
            </span>
            <span className={s.xp}>+{x.xp}</span>
          </li>
        ))}
      </ul>
      <div className={s.foot}>
        <span>{t('dash.missions.foot', { done: m.doneToday, need: STREAK_NEED, weekly: m.weekly.filter((w) => w.done).length, total: m.weekly.length })}</span>
        <MoreLink href={classicUrl('practice/index.html?tab=progress')}>{t('dash.missions.weekly')}</MoreLink>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ leaderboard
export function LeaderboardCard({ uid, rank, me }: { uid: string | null; rank: number | null; me: Ranked | null }) {
  const top = useTopTraders();
  const rows = top.status === 'ready' ? top.data : [];
  const inTop = !!uid && rows.some((r) => r.uid === uid);
  return (
    <Card className={s.board} title={t('dash.board')} actions={<MoreLink href={classicUrl('leaderboard.html#practice')}>{t('dash.board.all')}</MoreLink>} flush>
      {top.status === 'loading' ? (
        <LoadingState rows={5} />
      ) : top.status === 'error' ? (
        <ErrorState compact />
      ) : !rows.length ? (
        <EmptyState icon="war" body={t('dash.board.empty')} compact />
      ) : (
        <ol className={s.boardList}>
          {rows.map((r, i) => (
            <BoardRow key={r.uid} r={r} place={i + 1} me={r.uid === uid} />
          ))}
          {!inTop && me && rank && <BoardRow r={me} place={rank} me gap />}
        </ol>
      )}
      <div className={s.foot}>
        <span>{rank ? t('dash.board.you', { rank: rank.toLocaleString('en-US') }) : uid ? t('dash.trader.unranked') : t('tw.practice.signIn')}</span>
      </div>
    </Card>
  );
}

function BoardRow({ r, place, me, gap }: { r: Ranked; place: number; me?: boolean; gap?: boolean }) {
  const medal = place === 1 ? s.gold : place === 2 ? s.silver : place === 3 ? s.bronze : '';
  return (
    <li className={[me && s.me, gap && s.gap].filter(Boolean).join(' ')} value={place}>
      <a href={classicUrl(`practice/profile.html?u=${encodeURIComponent(r.uid)}`)} className={s.boardRow}>
        <span className={[s.place, medal].filter(Boolean).join(' ')}>{place}</span>
        {r.photo ? <img className={s.boardAvatar} src={r.photo} alt="" width={24} height={24} referrerPolicy="no-referrer" loading="lazy" /> : <span className={s.boardAvatar} aria-hidden>{r.name.slice(0, 1).toUpperCase()}</span>}
        <span className={s.boardName}>{r.name}</span>
        <span className={s.boardEq}>{formatMoney(r.equity, { digits: 0 })}</span>
        <Change pct={r.growthPct} className={s.boardPct} />
      </a>
    </li>
  );
}

// ------------------------------------------------------------------ Trade Wars
export function WarsCard({ uid }: { uid: string | null }) {
  const wars = useMyWars(uid);
  const now = useNow();
  const list = wars.status === 'ready' ? sortWars(wars.data).slice(0, 4) : [];
  const actions = (
    <div className={s.row}>
      <Link className={buttonClass({ variant: 'primary', size: 'sm' })} to="/invite?kind=battle">
        + {t('dash.wars.start')}
      </Link>
      <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} to="/invite">
        {t('nav.invite')}
      </Link>
      <a className={buttonClass({ variant: 'ghost', size: 'sm' })} href={classicUrl('practice/squads.html')}>
        {t('dash.squads')}
      </a>
    </div>
  );
  return (
    <Card className={s.wars} title={t('dash.wars')} actions={<MoreLink to="/trade-war">{t('nav.tradeWar')}</MoreLink>}>
      {!uid ? (
        <p className={s.muted}>{t('dash.wars.signedOut')}</p>
      ) : wars.status === 'loading' ? (
        <LoadingState rows={3} />
      ) : wars.status === 'error' ? (
        <ErrorState compact />
      ) : !list.length ? (
        <p className={s.muted}>{t('dash.wars.empty')}</p>
      ) : (
        <ul className={s.warList}>
          {list.map((w) => (
            <li key={w.id}>
              <a href={classicUrl(`practice/war.html?w=${encodeURIComponent(w.id)}`)} className={s.warRow}>
                <Icon name="war" size={16} />
                <span className={s.boardName}>{w.name}</span>
                {w.status === 'active' ? (
                  <Badge tone="up">{t('dash.wars.live', { h: Math.max(0, Math.ceil((w.endAt - now) / 36e5)) })}</Badge>
                ) : w.status === 'lobby' ? (
                  <Badge>{t('dash.wars.lobby', { n: w.players, max: w.maxPlayers })}</Badge>
                ) : w.status === 'draft' ? (
                  <Badge tone="violet">{t('dash.wars.draft')}</Badge>
                ) : (
                  <Badge tone={w.myRank === 1 ? 'gold' : 'neutral'}>{w.myRank ? t('dash.wars.place', { rank: w.myRank, n: w.of }) : t('dash.wars.finished')}</Badge>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
      {actions}
    </Card>
  );
}

// ------------------------------------------------------------------ achievements
export function AchievementsCard({ progress, publicIds }: { progress: Progress | null; publicIds: string[] }) {
  const a = achievementsView(progress, publicIds);
  return (
    <Card className={s.ach} title={t('dash.ach')} subtitle={t('dash.ach.count', { n: a.unlocked.length, total: a.total })} actions={<MoreLink href={classicUrl('practice/index.html?tab=progress')}>{t('dash.board.all')}</MoreLink>}>
      {a.unlocked.length > 0 && (
        <ul className={s.badges}>
          {a.unlocked.slice(0, 12).map((x) => (
            <li key={x.id} title={`${x.label}: ${x.desc}`}>
              <span className={s.hex} aria-hidden>
                {x.icon}
              </span>
              <span className="visually-hidden">{x.label}</span>
            </li>
          ))}
        </ul>
      )}
      {a.next.length > 0 && (
        <>
          <div className={s.sub}>{t('dash.ach.next')}</div>
          <ul className={s.nextList}>
            {a.next.map((x) => (
              <li key={x.id}>
                <span className={[s.hex, s.locked].join(' ')} aria-hidden>
                  {x.icon}
                </span>
                <span>
                  <b>{x.label}</b>
                  <span className={s.muted}>{x.desc}</span>
                </span>
                <span className={s.xp}>+{x.xp}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ movers
type MoverTab = 'gainers' | 'losers' | 'actives';
export function MoversCard() {
  const movers = useMovers();
  const [tab, setTab] = useState<MoverTab>('gainers');
  return (
    <Card className={s.movers} title={t('dash.movers')} subtitle={t('dash.movers.scope')} flush>
      <div className={s.tabsPad}>
        <Tabs label={t('dash.movers')} value={tab} onChange={setTab} stretch items={[{ value: 'gainers', label: t('dash.movers.gainers') }, { value: 'losers', label: t('dash.movers.losers') }, { value: 'actives', label: t('dash.movers.actives') }]} />
      </div>
      {movers.status === 'loading' ? (
        <LoadingState rows={5} />
      ) : movers.status === 'error' ? (
        <ErrorState compact />
      ) : movers.status === 'missing' || movers.data[tab].length === 0 ? (
        <EmptyState icon="markets" body={t('dash.movers.empty')} compact />
      ) : (
        <MarketList rows={movers.data[tab].slice(0, 5)} label={t(`dash.movers.${tab}`)} />
      )}
      <div className={s.foot}>
        <span />
        <Link to="/markets">{t('dash.allMarkets')} →</Link>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ US market: indexes + sectors
export function MarketCard() {
  const quotes = useQuotes();
  const snapshot = useSnapshot();
  const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
  const tiles = INDEX_ETFS.map(({ sym, label }) => {
    const snap = snapshot.status === 'ready' ? snapshot.data.items[sym] : undefined;
    const spark = snapshot.status === 'ready' ? (snapshot.data.spark[sym]?.points.map((p) => p.c) ?? []) : [];
    const q = qs[sym];
    return { sym, label, price: q?.c ?? snap?.price ?? null, pct: q?.chPct ?? snap?.pct ?? null, spark };
  });
  return (
    <Card className={s.market} title={t('dash.market')} subtitle={t('dash.indexesNote')}>
      <div className={s.marketGrid}>
        <section className={s.tiles} aria-label={t('dash.indexes')}>
          {tiles.map((x) => (
            <Link key={x.sym} to={`/markets/${x.sym}`} className={s.tile} aria-label={`${x.label} (${x.sym}) ${formatPrice(x.price)} ${formatPercent(x.pct)} today`}>
              {quotes.status === 'loading' && snapshot.status === 'loading' ? (
                <Skeleton height={48} />
              ) : (
                <Stat size="sm" label={`${x.label} · ${x.sym}`} value={formatPrice(x.price)} delta={<>{formatPercent(x.pct)} today</>} direction={dir(x.pct)} />
              )}
              <Sparkline values={x.spark} width={96} height={32} label={`${x.label}, last month`} />
            </Link>
          ))}
        </section>
        <section>
          <div className={s.sub}>{t('dash.sectors')}</div>
          <SectorBars />
        </section>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ watchlist
export function WatchlistCard({ watch }: { watch: Loadable<string[]> }) {
  const quotes = useQuotes();
  const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
  const rows = watch.status === 'ready' ? watch.data.map((sym) => ({ sym, name: instrument(sym)?.name ?? '', price: qs[sym]?.c, chPct: qs[sym]?.chPct })) : [];
  return (
    <Card className={s.watch} title={t('dash.watchlist')} flush>
      {watch.status === 'loading' ? <LoadingState rows={4} /> : rows.length === 0 ? <EmptyState icon="markets" body={t('dash.watchlist.empty')} compact /> : <MarketList rows={rows.slice(0, 8)} label={t('dash.watchlist')} />}
    </Card>
  );
}
