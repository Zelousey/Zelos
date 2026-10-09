/**
 * Profile (/profile = yours, /profile/:uid = anyone's; owner 2026-10-09): the website's trader
 * profile in the app. Picture, name, @username, bio and level; the Trade War account and its
 * numbers, the match record, best trades and achievements. Visitors can share, challenge and
 * add a friend; on your own profile you edit it and see your tokens (only you see those).
 * The app is the simulated competition, so the website's Real Trading card isn't shown here.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { levelFor } from '../../data/levels';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { formatDate, formatMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { classicUrl, isNative } from '../../lib/platform';
import { useNow } from '../../lib/useNow';
import { Badge, Button, buttonClass, Card, EmptyState, ErrorState, LoadingState, Stat, useToast } from '../../ui';
import { LevelBadge } from '../dashboard/LevelBadge';
import { ACHIEVEMENTS } from '../dashboard/progress';
import { useIdentity, useMyProfile, type Identity, type Ranked } from '../dashboard/social';
import { errorText, shareLink } from '../invites/invites';
import { STRATEGIES } from '../strategies/strategies';
import { TokensSheet, useTokens } from '../strategies/Tokens';
import { ChallengeSheet } from './ChallengeSheet';
import { EditProfileSheet } from './EditProfileSheet';
import { addFriend, groupEarned, isWarGroup, removeFriend, useLooks, useWarRecord, type Looks, type WarRecord } from './profile';
import { Coin } from '../tokens/Coin';
import s from './Profile.module.css';

const money = (v: number) => formatMoney(v, { digits: 2 });
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const tone = (v: number) => (v >= 0 ? s.up : s.down);
const day = (d: string | null) => (d ? formatDate(`${d}T12:00:00Z`, { year: true }) : '–');

/** The public link to a profile (the app on the public site, also from inside the native app). */
export const profileUrl = (uid: string) => `${isNative() ? 'https://agentictrading.info/app/' : `${location.origin}${import.meta.env.BASE_URL}`}profile/${encodeURIComponent(uid)}`;

export default function ProfilePage({ uid }: { uid: string | null }) {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  const me = isReal && user ? user.uid : null;
  const target = uid ?? me;
  if (!ready) return <LoadingState rows={6} />;
  if (!target)
    return (
      <EmptyState
        icon="profile"
        title={t('pf.yours')}
        body={t('pf.signIn')}
        actions={
          <>
            <Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
              {t('auth.signInWithGoogle')}
            </Button>
            <Link className={buttonClass({ variant: 'ghost' })} to="/leaderboard">
              {t('nav.leaderboard')}
            </Link>
          </>
        }
      />
    );
  return <ProfileView key={target} uid={target} me={me} googleName={user?.displayName ?? ''} googlePhoto={user?.photoURL ?? null} />;
}

function ProfileView({ uid, me, googleName, googlePhoto }: { uid: string; me: string | null; googleName: string; googlePhoto: string | null }) {
  const mine = uid === me;
  const prof = useMyProfile(uid);
  const ident = useIdentity(uid);
  const record = useWarRecord(uid);
  const looks = useLooks(uid);
  const myDoc = useUserDoc(me);
  const [editing, setEditing] = useState(false);

  if (prof.status === 'loading' || ident.status === 'loading') return <LoadingState rows={8} />;
  if (prof.status === 'error' && ident.status === 'error') return <ErrorState />;
  const p = prof.status === 'ready' ? prof.data : null;
  const id = ident.status === 'ready' ? ident.data : null;
  const editor = mine && editing && (
    <EditProfileSheet open onClose={() => setEditing(false)} uid={uid} initial={{ name: id?.name || p?.name || googleName.split(' ')[0] || '', username: id?.username ?? p?.username ?? null, bio: id?.bio ?? '', avatar: id?.avatar ?? p?.photo ?? null, fallbackPhoto: googlePhoto }} />
  );
  if (!p && !id)
    return (
      <>
        <EmptyState
          icon="profile"
          title={mine ? t('pf.yours') : t('pf.notFound')}
          body={mine ? t('pf.empty.mine') : t('pf.empty.other')}
          actions={
            mine ? (
              <>
                <Button variant="primary" onClick={() => setEditing(true)}>
                  {t('pf.setUp')}
                </Button>
                <Link className={buttonClass({ variant: 'secondary' })} to="/practice">
                  {t('pf.enterWar')}
                </Link>
              </>
            ) : (
              <Link className={buttonClass({ variant: 'secondary' })} to="/leaderboard">
                {t('nav.leaderboard')}
              </Link>
            )
          }
        />
        {editor}
      </>
    );

  const myData = mine && myDoc.status === 'ready' ? myDoc.data : null;
  const xp = Math.max(p?.xp ?? 0, myData?.xp ?? 0);
  const earned = [...(p?.achievements ?? []), ...Object.keys(myData?.progress?.achievements ?? {})];
  const friends = myDoc.status === 'ready' ? myDoc.data.friends : myDoc.status === 'loading' ? null : []; // no users doc yet: no friends
  return (
    <div className={s.page}>
      <Header uid={uid} mine={mine} me={me} p={p} id={id} looks={looks.status === 'ready' ? looks.data : null} xp={xp} isFriend={friends ? friends.includes(uid) : null} onEdit={() => setEditing(true)} />
      {mine && <TokensCard />}
      <WarCard p={p} mine={mine} />
      {record.status === 'ready' && record.data.played > 0 && <RecordCard r={record.data} />}
      {p?.detail && <Details p={p} />}
      <Achievements ids={earned} />
      {p?.detail && <Tables p={p} />}
      <p className={s.fine}>{t('pf.fine')}</p>
      {editor}
    </div>
  );
}

// ---------------------------------------------------------------- header
function Name({ name, looks }: { name: string; looks: Looks | null }) {
  const style: CSSProperties | undefined = looks?.color ? { color: looks.color } : undefined;
  return (
    <h1 className={s.name}>
      <span className={looks?.prism ? s.prism : undefined} style={style}>
        {name}
      </span>
      {looks?.badge && <span aria-hidden="true"> {looks.badge}</span>}
      {looks?.founder && (
        <span className={s.founder} title={looks.founder.of ? t('pf.founderOf', { title: looks.founder.title, of: looks.founder.of }) : undefined}>
          {looks.founder.icon} {looks.founder.title}
        </span>
      )}
    </h1>
  );
}

function Header({ uid, mine, me, p, id, looks, xp, isFriend, onEdit }: { uid: string; mine: boolean; me: string | null; p: Ranked | null; id: Identity | null; looks: Looks | null; xp: number; isFriend: boolean | null; onEdit: () => void }) {
  const name = (id?.username && id.name) || p?.name || id?.name || 'Trader';
  const photo = id?.avatar ?? p?.photo ?? null;
  const lv = levelFor(xp);
  const streak = p?.detail?.streak ?? 0;
  const since = p?.detail?.since;
  return (
    <Card className={s.head}>
      {looks?.banner && <div className={s.banner} style={{ background: looks.banner }} aria-hidden="true" />}
      <div className={s.headMain}>
        <div className={s.pics}>
          {photo ? <img className={s.photo} src={photo} alt="" width={88} height={88} referrerPolicy="no-referrer" /> : <span className={s.photo} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
          <span className={s.badge}>
            <LevelBadge level={lv.level} size={40} />
          </span>
        </div>
        <div className={s.who}>
          <span className={s.kicker}>{mine ? t('pf.kicker.mine') : t('pf.kicker')}</span>
          <Name name={name} looks={looks} />
          {id?.username && <p className={s.handle}>@{id.username}</p>}
        </div>
      </div>
      {id?.bio ? <p className={s.bio}>{id.bio}</p> : mine && !id?.username ? <p className={s.hint}>{t('pf.hint')}</p> : null}
      <ul className={s.tags} aria-label={t('pf.about')}>
        <li>
          <b>{t('pf.level', { n: lv.level.level })}</b> {lv.level.name}
        </li>
        <li>{t('pf.xp', { n: xp.toLocaleString('en-US') })}</li>
        {streak > 0 && <li>{t('pf.streak', { n: streak })}</li>}
        {since && <li>{t('pf.since', { date: new Date(since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) })}</li>}
        {p && <li className={s.warTag}>{t('pf.warTag', { v: money(p.equity) })}</li>}
        {looks?.community && (
          <li>
            <a href={classicUrl(`communities.html?c=${encodeURIComponent(looks.community.cid)}`)}>
              🏘️ {looks.community.name}
              {looks.community.state ? ` · ${looks.community.state}` : ''}
            </a>
          </li>
        )}
      </ul>
      <Actions uid={uid} mine={mine} me={me} name={name} p={p} isFriend={isFriend} onEdit={onEdit} />
    </Card>
  );
}

function Actions({ uid, mine, me, name, p, isFriend, onEdit }: { uid: string; mine: boolean; me: string | null; name: string; p: Ranked | null; isFriend: boolean | null; onEdit: () => void }) {
  const { signInWithGoogle } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [challenging, setChallenging] = useState(false);
  async function share() {
    const text = p ? t('pf.share.war', { name, v: money(p.equity) }) : t('pf.share.text', { name });
    const r = await shareLink(profileUrl(uid), t('pf.share.title', { name }), text);
    if (r === 'copied') toast.show(t('pf.share.copied'));
  }
  async function friend() {
    if (!me) return void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'));
    setBusy(true);
    try {
      if (isFriend) {
        await removeFriend(me, uid);
        toast.show(t('pf.friend.removed', { name }));
      } else {
        const r = await addFriend(me, uid);
        toast.show(r.mutual ? t('pf.friend.mutual', { name }) : t('pf.friend.added', { name }));
      }
    } catch (e) {
      toast.show(errorText(e, t('pf.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.actions}>
      {mine ? (
        <>
          <Button variant="primary" size="sm" onClick={onEdit}>
            {t('pf.edit')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void share()}>
            {t('pf.share')}
          </Button>
          <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} to="/settings">
            {t('nav.settings')}
          </Link>
        </>
      ) : (
        <>
          <Button variant="primary" size="sm" onClick={() => (me ? setChallenging(true) : void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error')))}>
            {t('pf.challenge')}
          </Button>
          <Button variant="secondary" size="sm" disabled={busy || (!!me && isFriend == null)} aria-pressed={!!isFriend} onClick={() => void friend()}>
            {isFriend ? t('pf.friend.yes') : t('pf.friend.add')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void share()}>
            {t('pf.share')}
          </Button>
        </>
      )}
      {challenging && <ChallengeSheet open onClose={() => setChallenging(false)} to={uid} toName={name} />}
    </div>
  );
}

// ---------------------------------------------------------------- your tokens (only you)
function TokensCard() {
  const tk = useTokens();
  const now = useNow();
  const [sheet, setSheet] = useState(false);
  const passes = STRATEGIES.flatMap((x) => {
    const until = tk.wallet?.passes[x.id];
    return until && until > now ? [{ name: x.name, until }] : [];
  });
  return (
    <Card pad className={s.tokens}>
      <div className={s.tokensTop}>
        <div>
          <span className={s.kicker}>
            {t('pf.tokens')} <span className={s.private}>{t('pf.tokens.private')}</span>
          </span>
          <b className={s.balance}>
            <Coin size={22} /> {tk.balance == null ? '…' : tk.balance.toLocaleString('en-US')}
          </b>
        </div>
        <div className={s.row}>
          <Button variant="secondary" size="sm" onClick={() => setSheet(true)}>
            {t('st.getTokens')}
          </Button>
          <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} to="/strategies">
            {t('nav.strategies')}
          </Link>
          <a className={buttonClass({ variant: 'ghost', size: 'sm' })} href={classicUrl('tokens.html')}>
            {t('pf.looks')}
          </a>
        </div>
      </div>
      <p className={s.muted}>{passes.length ? t('pf.passes', { list: passes.map((x) => `${x.name} (${formatDate(x.until)})`).join(' · ') }) : t('pf.noPasses')}</p>
      <TokensSheet open={sheet} onClose={() => setSheet(false)} info={tk.info} balance={tk.balance} />
    </Card>
  );
}

// ---------------------------------------------------------------- Trade War
function WarCard({ p, mine }: { p: Ranked | null; mine: boolean }) {
  const best = p?.detail?.bestTrades[0];
  return (
    <Card pad title={t('pf.war')} actions={<Badge tone="accent">{t('pf.virtual')}</Badge>}>
      {p ? (
        <>
          <div className={s.bal}>
            <b>{money(p.equity)}</b>
            <span className={tone(p.growthPct)}>{t('pf.growth', { v: pct(p.growthPct) })}</span>
          </div>
          <div className={s.mini}>
            <Stat size="sm" label={t('pf.virtualTrades')} value={String(p.detail?.virtualTrades ?? p.trades)} />
            <Stat size="sm" label={t('pf.tradeStreak')} value={p.tradeStreak ? `🔥 ${p.tradeStreak}` : '–'} />
            <Stat size="sm" label={t('pf.bestWin')} value={best ? `${signed(best.pnl)} ${best.sym}` : '–'} direction={best ? 'up' : undefined} />
            <Stat size="sm" label={t('pf.netPnl')} value={signed(p.netPnl)} direction={p.netPnl >= 0 ? 'up' : 'down'} />
          </div>
          <p className={s.muted}>{t('pf.war.fine')}</p>
        </>
      ) : mine ? (
        <p className={s.muted}>
          {t('pf.war.none.mine')} <Link to="/practice">{t('pf.enterWar')}</Link>
        </p>
      ) : (
        <p className={s.muted}>{t('pf.war.none')}</p>
      )}
    </Card>
  );
}

function RecordCard({ r }: { r: WarRecord }) {
  const wr = r.played ? Math.round((r.wins / r.played) * 100) : 0;
  return (
    <Card pad title={t('pf.record')}>
      <div className={s.mini}>
        <Stat size="sm" label={t('pf.record.played')} value={String(r.played)} />
        <Stat size="sm" label={t('pf.record.wins')} value={String(r.wins)} direction="up" />
        <Stat size="sm" label={t('pf.record.losses')} value={String(r.losses)} direction="down" />
        <Stat size="sm" label={t('pf.record.surrenders')} value={String(r.surrenders)} />
      </div>
      <p className={s.muted}>
        {t('pf.record.rate', { n: wr })}
        {r.surrenders ? ` ${t('pf.record.incl', { n: r.surrenders })}` : ''}
      </p>
      {r.recent.length > 0 && (
        <ul className={s.recent}>
          {r.recent.map((x) => (
            <li key={x.w}>
              <a href={classicUrl(`practice/war.html?w=${encodeURIComponent(x.w)}`)}>
                {x.rank === 1 && !x.surrendered ? '🏆 ' : x.surrendered ? '🏳️ ' : ''}
                {x.name}
              </a>
              <small>{x.surrendered ? t('pf.record.surrendered') : `${x.rank === 1 ? t('pf.record.won') : t('pf.record.lost')} · #${x.rank} ${t('pf.of')} ${x.of}${x.pnlPct != null ? ` · ${pct(x.pnlPct)}` : ''}`}</small>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Details({ p }: { p: Ranked }) {
  const d = p.detail!;
  const best = d.bestTrades[0];
  return (
    <>
      <Card pad title={t('pf.details')}>
        <div className={s.stats}>
          <Stat size="sm" label={t('pf.d.start')} value={money(d.start)} />
          <Stat size="sm" label={t('pf.d.growth')} value={pct(p.growthPct)} direction={p.growthPct >= 0 ? 'up' : 'down'} />
          <Stat size="sm" label={t('pf.d.net')} value={signed(p.netPnl)} direction={p.netPnl >= 0 ? 'up' : 'down'} hint={t('pf.d.netHint')} />
          <Stat size="sm" label={t('pf.d.winStreak')} value={String(d.winStreakBest)} />
          <Stat size="sm" label={t('pf.d.peak')} value={money(d.peakEquity)} />
          <Stat size="sm" label={t('pf.d.resets')} value={String(d.resets)} />
          <Stat size="sm" label={t('pf.d.closed')} value={String(p.trades)} />
          <Stat size="sm" label={t('pf.d.wl')} value={`${d.wins} / ${d.losses}`} />
          <Stat size="sm" label={t('pf.d.winRate')} value={p.trades ? `${p.winRate}%` : '–'} />
          <Stat size="sm" label={t('pf.d.realized')} value={signed(d.realized)} direction={d.realized >= 0 ? 'up' : 'down'} />
          <Stat size="sm" label={t('pf.d.avgWin')} value={d.wins ? signed(d.avgWin) : '–'} direction={d.wins ? 'up' : undefined} />
          <Stat size="sm" label={t('pf.d.avgLoss')} value={d.losses ? signed(d.avgLoss) : '–'} direction={d.losses ? 'down' : undefined} />
        </div>
      </Card>
      {best && (
        <Card pad className={s.best}>
          <span className={s.bestTag}>★ {t('pf.best')}</span>
          <div className={s.bestMain}>
            <b>{best.label}</b>
            <span className={s.up}>
              {signed(best.pnl)} <small>({pct(best.pct)})</small>
            </span>
          </div>
          <div className={s.bestRow}>
            <span>
              {t('pf.invested')} <b>{money(best.invested)}</b>
            </span>
            <span>
              {t('pf.entry')} <b>{best.entry?.toFixed(2) ?? '–'}</b>
            </span>
            <span>
              {t('pf.exit')} <b>{best.exit?.toFixed(2) ?? '–'}</b>
            </span>
            <span>{best.openDay ? `${day(best.openDay)} → ${day(best.closeDay)}` : `${t('pf.closed')} ${day(best.closeDay)}`}</span>
          </div>
        </Card>
      )}
    </>
  );
}

function Achievements({ ids }: { ids: string[] }) {
  const groups = useMemo(() => groupEarned(ids), [ids]);
  const n = groups.reduce((a, g) => a + g.items.length, 0);
  return (
    <Card pad title={t('pf.ach')} subtitle={t('pf.ach.count', { n, of: ACHIEVEMENTS.length })}>
      {n ? (
        groups.map((g) => (
          <div key={g.group} className={s.achGroup}>
            <h3 className={s.sub}>
              {g.group} {isWarGroup(g.group) && <Badge tone="accent">{t('pf.tradeWar')}</Badge>}
            </h3>
            <ul className={s.achs}>
              {g.items.map((a) => (
                <li key={a.id} className={s.ach}>
                  <span className={s.achIcon} aria-hidden="true">
                    {a.icon}
                  </span>
                  <span>
                    <b>{a.label}</b>
                    <small>{a.desc}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className={s.muted}>{t('pf.ach.none')}</p>
      )}
    </Card>
  );
}

function Tables({ p }: { p: Ranked }) {
  const d = p.detail!;
  return (
    <div className={s.cols}>
      <Card pad title={t('pf.biggest')}>
        {d.bestTrades.length ? (
          <div className={s.tableWrap} tabIndex={0} role="region" aria-label={t('pf.biggest')}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">{t('pf.t.ticker')}</th>
                  <th scope="col">{t('pf.invested')}</th>
                  <th scope="col">{t('pf.t.profit')}</th>
                  <th scope="col">{t('pf.t.gain')}</th>
                  <th scope="col">{t('pf.entry')}</th>
                  <th scope="col">{t('pf.exit')}</th>
                  <th scope="col">{t('pf.t.dates')}</th>
                </tr>
              </thead>
              <tbody>
                {d.bestTrades.map((x, i) => (
                  <tr key={i}>
                    <th scope="row">{x.label}</th>
                    <td>{money(x.invested)}</td>
                    <td className={s.up}>{signed(x.pnl)}</td>
                    <td className={s.up}>{pct(x.pct)}</td>
                    <td>{x.entry?.toFixed(2) ?? '–'}</td>
                    <td>{x.exit?.toFixed(2) ?? '–'}</td>
                    <td>
                      <small>{x.openDay ? `${day(x.openDay)} → ${day(x.closeDay)}` : day(x.closeDay)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={s.muted}>{t('pf.biggest.none')}</p>
        )}
      </Card>
      <Card pad title={t('pf.most')}>
        {d.mostTraded.length ? (
          <ol className={s.syms}>
            {d.mostTraded.map((x) => (
              <li key={x.sym}>
                <Link to={`/markets/${encodeURIComponent(x.sym)}`}>{x.sym}</Link> <small>{t('pf.nTrades', { n: x.trades })}</small>
                <span className={tone(x.pnl)}>{signed(x.pnl)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={s.muted}>{t('pf.most.none')}</p>
        )}
        <h3 className={s.sub}>{t('pf.top')}</h3>
        {d.topStocks.length ? (
          <ol className={s.syms}>
            {d.topStocks.map((x) => (
              <li key={x.sym}>
                <Link to={`/markets/${encodeURIComponent(x.sym)}`}>{x.sym}</Link>
                <span className={s.up}>{signed(x.pnl)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={s.muted}>{t('pf.top.none')}</p>
        )}
        <h3 className={s.sub}>{t('pf.resets')}</h3>
        {d.resetHistory.length ? (
          <ol className={s.syms} reversed>
            {[...d.resetHistory].reverse().map((r, k) => (
              <li key={k}>
                <span>
                  #{d.resetHistory.length - k} · {day(r.day)}
                </span>
                <span>{t('pf.resetFrom', { v: money(r.equityBefore) })}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={s.muted}>{t('pf.resets.none')}</p>
        )}
      </Card>
    </div>
  );
}
