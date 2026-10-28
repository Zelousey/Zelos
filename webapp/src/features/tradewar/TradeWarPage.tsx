/**
 * Trade War (/trade-war): the hub for everything you play (Phase 5).
 *
 *   /trade-war           opens Solo, the Overview or the mode picker (hub.ts → pickStart)
 *   /trade-war/overview  your battles and squads, recent results, leaderboard, strategies
 *   /trade-war/solo      your Solo account (the one virtual $10,000 practice account)
 *
 * Battle, Squad, Leaderboards and Strategies are their own screens with the same section
 * row on top (TradeWarNav). War and Chaos stay out until they're built.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router';
import { useQuotes } from '../../data/markets';
import { useAuth } from '../../lib/auth';
import { formatMoney, formatSignedMoney } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Button, buttonClass, Card, EmptyState, Icon, LoadingState, PageHeader, Skeleton, Stat, useToast, type IconName } from '../../ui';
import { clock } from '../battles/parts';
import { nyDay } from '../charts/series';
import { LeaderboardCard } from '../dashboard/Panels';
import { sortWars, useMyProfile, useMyRank, useMyWars, type War } from '../dashboard/social';
import { useVolMap } from '../options/model';
import { usePracticeAccount, valueAccount } from '../practice/account';
import { useMySquadList } from '../social/squads';
import { StrategiesPromo } from '../strategies/StrategiesPromo';
import { inSoloSession, pickStart } from './hub';
import { TradeWarNav } from './TradeWarNav';
import s from './TradeWar.module.css';

const dir = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat';
const BRAND = `${import.meta.env.BASE_URL}icons/icon-192.png`;

export default function TradeWarModule() {
  return (
    <Routes>
      <Route index element={<Start />} />
      <Route path="overview" element={<Overview />} />
      <Route path="solo" element={<Solo />} />
      <Route path="*" element={<Navigate to="/trade-war" replace />} />
    </Routes>
  );
}

/** The hub page frame: title, the section row, then the section. */
function Hub({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title={t('nav.tradeWar')} subtitle={t('tw.subtitle')} />
      <TradeWarNav />
      <div className={s.stack}>{children}</div>
    </>
  );
}

/** Your battles, live; `open` counts the ones that haven't finished (lobby, draft or running). */
function useBattles() {
  const { user, isReal, ready } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const wars = useMyWars(uid);
  const list = wars.status === 'ready' ? sortWars(wars.data) : [];
  const open = !ready ? null : !uid ? 0 : wars.status === 'loading' ? null : list.filter((w) => w.status !== 'ended').length;
  return { uid, wars, list, open };
}

function Start() {
  const { open } = useBattles();
  const [solo] = useState(inSoloSession);
  const where = pickStart({ soloSession: solo, active: open });
  if (where === 'solo') return <Navigate to="/trade-war/solo" replace />;
  if (where === 'overview') return <Overview />;
  if (where === 'modes') return <Modes />;
  return (
    <Hub>
      <LoadingState rows={4} />
    </Hub>
  );
}

const MODES: { id: string; icon: IconName; title: MessageKey; body: MessageKey; to: string }[] = [
  { id: 'solo', icon: 'practice', title: 'hub.mode.solo', body: 'hub.mode.solo.body', to: '/trade-war/solo' },
  { id: 'battle', icon: 'war', title: 'hub.mode.battle', body: 'hub.mode.battle.body', to: '/battles' },
];

/** Solo / Battle (N3; owner 2026-10-28: Squad lives inside Battle, the War zone shows once it's built). */
function ModeGrid() {
  return (
    <ul className={s.modes} aria-label={t('hub.modes')}>
      {MODES.map((m) => (
        <li key={m.id}>
          <Link to={m.to} className={s.mode}>
            <span className={s.tileIcon}>
              <Icon name={m.icon} size={22} />
            </span>
            <span className={s.tileText}>
              <b>{t(m.title)}</b>
              <span>{t(m.body)}</span>
            </span>
            <Icon name="chevronRight" size={18} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** C: nothing running yet, so pick how you want to play. */
function Modes() {
  return (
    <Hub>
      <section className={s.pick} aria-labelledby="tw-pick">
        <img className={s.pickArt} src={BRAND} alt="" width={72} height={72} />
        <h2 id="tw-pick" className={s.pickTitle}>
          {t('hub.pick.title')}
        </h2>
        <p className={s.muted}>{t('hub.pick.body')}</p>
        <ModeGrid />
      </section>
      <StrategiesPromo />
    </Hub>
  );
}

function Solo() {
  return (
    <Hub>
      <PracticeCard />
      <p className={s.fine}>{t('hub.solo.fine')}</p>
      <StrategiesPromo />
    </Hub>
  );
}

/** F13: the Trade Wars Dashboard. Every number says which mode it belongs to (M6). */
function Overview() {
  const { uid, wars, list, open } = useBattles();
  const squads = useMySquadList(uid);
  const mine = useMyProfile(uid);
  const me = mine.status === 'ready' ? mine.data : null;
  const rank = useMyRank(me?.equity ?? null);
  const now = useNow(30_000);
  const running = list.filter((w) => w.status !== 'ended');
  const done = list.filter((w) => w.status === 'ended').slice(0, 3);
  const squadList = squads.status === 'ready' ? squads.data : [];
  return (
    <Hub>
      <Summary uid={uid} live={running.filter((w) => w.status === 'active').length} waiting={running.filter((w) => w.status !== 'active').length} squads={uid && squads.status === 'ready' ? squadList.length : null} loading={open === null} />
      <section aria-labelledby="tw-open">
        <h2 id="tw-open" className={s.sectionTitle}>
          {t('hub.open')}
        </h2>
        <div className={s.columns}>
          <Card flush title={t('hub.open.battles')} actions={<Link className="hit" to="/battles">{t('hub.all')}</Link>}>
            {!uid ? (
              <EmptyState icon="war" body={t('bt.signIn')} compact />
            ) : wars.status === 'loading' ? (
              <LoadingState rows={2} />
            ) : !running.length ? (
              <EmptyState icon="war" body={t('hub.open.battles.none')} compact actions={<Link className={buttonClass({ variant: 'primary', size: 'sm' })} to="/invite?kind=battle">{t('bt.new')}</Link>} />
            ) : (
              <ul className={s.rows}>
                {running.map((w) => (
                  <BattleRow key={w.id} w={w} now={now} />
                ))}
              </ul>
            )}
          </Card>
          <Card flush title={t('hub.open.squads')} actions={<Link className="hit" to="/social">{t('hub.all')}</Link>}>
            {!uid ? (
              <EmptyState icon="social" body={t('sq.signIn')} compact />
            ) : squads.status === 'loading' ? (
              <LoadingState rows={2} />
            ) : !squadList.length ? (
              <EmptyState icon="social" body={t('hub.open.squads.none')} compact actions={<Link className={buttonClass({ variant: 'secondary', size: 'sm' })} to="/social">{t('hub.squad.start')}</Link>} />
            ) : (
              <ul className={s.rows}>
                {squadList.map((q) => (
                  <li key={q.id}>
                    <Link to={`/social/${encodeURIComponent(q.id)}`} className={s.row}>
                      <Icon name="social" size={16} />
                      <b className={s.rowName}>{q.name}</b>
                      <span className={s.muted}>{t('hub.members', { n: q.members.length })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>
      <section aria-labelledby="tw-start">
        <h2 id="tw-start" className={s.sectionTitle}>
          {t('hub.start')}
        </h2>
        <ModeGrid />
      </section>
      {done.length > 0 && (
        <section aria-labelledby="tw-recent">
          <h2 id="tw-recent" className={s.sectionTitle}>
            {t('hub.recent')}
          </h2>
          <Card flush>
            <ul className={s.rows}>
              {done.map((w) => (
                <BattleRow key={w.id} w={w} now={now} />
              ))}
            </ul>
          </Card>
        </section>
      )}
      <div className={s.columns}>
        <div className={s.board}>
          <p className={s.scope}>{t('hub.board.scope')}</p>
          <LeaderboardCard uid={uid} rank={rank} me={me} />
        </div>
        <StrategiesPromo />
      </div>
    </Hub>
  );
}

function Summary({ uid, live, waiting, squads, loading }: { uid: string | null; live: number; waiting: number; squads: number | null; loading: boolean }) {
  const { openSignIn } = useAuth();
  const toast = useToast();
  const acct = usePracticeAccount(uid);
  const quotes = useQuotes();
  const qs = useMemo(() => (quotes.status === 'ready' ? quotes.data.quotes : {}), [quotes]);
  const [today] = useState(() => nyDay(Date.now()));
  const vols = useVolMap();
  const data = acct.status === 'ready' ? acct.data : null;
  const v = useMemo(() => (data ? valueAccount(data, qs, today, vols) : null), [data, qs, today, vols]);
  if (!uid)
    return (
      <Card pad className={s.cta}>
        <p>{t('hub.signIn')}</p>
        <Button variant="primary" onClick={() => void openSignIn().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
          {t('auth.signIn')}
        </Button>
      </Card>
    );
  const n = (x: number | null) => (loading || x === null ? '…' : String(x));
  return (
    <Card pad aria-label={t('hub.summary')}>
      <div className={s.summary}>
        <Stat label={<Scoped mode="hub.solo" what="hub.sum.value" />} value={v ? formatMoney(v.equity) : acct.status === 'loading' ? '…' : <Link to="/trade-war/solo">{t('hub.sum.none')}</Link>} />
        <Stat label={<Scoped mode="hub.battle" what="hub.sum.live" />} value={n(live)} />
        <Stat label={<Scoped mode="hub.battle" what="hub.sum.waiting" />} value={n(waiting)} />
        <Stat label={<Scoped mode="hub.squad" what="hub.sum.squads" />} value={n(squads)} />
      </div>
    </Card>
  );
}

/** "Solo · Account value": which mode a number belongs to, always said. */
function Scoped({ mode, what }: { mode: MessageKey; what: MessageKey }) {
  return (
    <>
      <span className={s.scopeTag}>{t(mode)}</span> · {t(what)}
    </>
  );
}

function BattleRow({ w, now }: { w: War; now: number }) {
  return (
    <li>
      <Link to={`/battles/${encodeURIComponent(w.id)}`} className={s.row}>
        <Icon name="war" size={16} />
        <b className={s.rowName}>{w.name}</b>
        <span className={s.muted}>
          {w.status === 'active' ? t('bt.endsIn', { t: clock(w.endAt - now) }) : w.status === 'ended' ? (w.myRank ? t('bt.finished', { rank: w.myRank, of: w.of }) : t('bt.status.ended')) : t('bt.playersShort', { n: w.players, max: w.maxPlayers })}
        </span>
        <Badge tone={w.status === 'active' ? 'up' : w.status === 'ended' ? 'neutral' : 'accent'}>{t(`bt.status.${w.status}`)}</Badge>
      </Link>
    </li>
  );
}

function PracticeCard() {
  const { user, isReal, ready, openSignIn } = useAuth();
  const toast = useToast();
  const uid = isReal && user ? user.uid : null;
  const acct = usePracticeAccount(uid);
  const quotes = useQuotes();
  const qs = useMemo(() => (quotes.status === 'ready' ? quotes.data.quotes : {}), [quotes]);
  const [today] = useState(() => nyDay(Date.now()));
  const data = acct.status === 'ready' ? acct.data : null;
  const vols = useVolMap();
  const v = useMemo(() => (data ? valueAccount(data, qs, today, vols) : null), [data, qs, today, vols]);

  const head = (
    <div className={s.practiceHead}>
      <h2 className={s.practiceTitle}>
        <Icon name="practice" size={20} /> {t('hub.solo.title')}
      </h2>
      <Badge tone="accent">{t('practice.virtual')}</Badge>
    </div>
  );

  let body;
  if (!ready || (uid && acct.status === 'loading')) {
    body = <Skeleton height={72} />;
  } else if (!uid) {
    body = (
      <div className={s.cta}>
        <p>{t('tw.practice.signIn')}</p>
        <Button variant="primary" onClick={() => void openSignIn().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
          {t('auth.signIn')}
        </Button>
      </div>
    );
  } else if (acct.status === 'error') {
    body = <p className={s.muted}>{t('state.error.body')}</p>;
  } else if (!v || !data) {
    body = (
      <div className={s.cta}>
        <p>{t('tw.practice.none')}</p>
        <Link className={buttonClass({ variant: 'primary' })} to="/dashboard">
          {t('tw.practice.start')}
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <div className={s.kpis}>
          <Stat label={t('tw.value')} value={<span className={s.big}>{formatMoney(v.equity)}</span>} />
          <Stat label={t('tw.today')} value={formatSignedMoney(v.dayPnl)} direction={dir(v.dayPnl)} delta={null} />
          <Stat label={t('tw.total')} value={formatSignedMoney(v.netPnl)} direction={dir(v.netPnl)} delta={null} />
        </div>
        <div className={s.practiceFoot}>
          <span className={s.muted}>{t('tw.holdings', { positions: data.positions.length, orders: data.orders.length })}</span>
          <span className={s.actions}>
            <Link className={buttonClass({ variant: 'secondary' })} to="/markets">
              {t('tw.practice.trade')}
            </Link>
            <Link className={buttonClass({ variant: 'primary' })} to="/dashboard">
              {t('tw.practice.open')}
            </Link>
          </span>
        </div>
      </>
    );
  }
  return (
    <Card pad className={s.practice}>
      {head}
      {body}
    </Card>
  );
}
