/**
 * Squads & friends (/social; owner 2026-10-09): the website's Trading Squads page plus your
 * friends list. Squads: make one, join with a room code, open yours. Friends: add a trader by
 * @username, see how they're doing, open their profile.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { levelFor } from '../../data/levels';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { formatMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Button, Card, EmptyState, Field, LoadingState, PageHeader, Tabs, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { unlockQuietly } from '../missions/missions';
import { addFriend, removeFriend } from '../profile/profile';
import { createSquad, findRoomCode, uidForUsername, useMySquadList, useProfiles } from './squads';
import s from './Social.module.css';

type Tab = 'squads' | 'friends';

export default function SocialPage() {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'friends' ? 'friends' : 'squads';
  const uid = isReal && user ? user.uid : null;
  return (
    <>
      <PageHeader title={t('nav.social')} subtitle={t('sq.subtitle')} />
      <div className={s.tabs}>
        <Tabs label={t('nav.social')} value={tab} onChange={(v) => setParams(v === 'squads' ? {} : { tab: v }, { replace: true })} items={[{ value: 'squads', label: t('sq.tab.squads') }, { value: 'friends', label: t('sq.tab.friends') }]} />
      </div>
      {!ready ? (
        <LoadingState rows={4} />
      ) : !uid ? (
        <EmptyState
          icon="social"
          body={t('sq.signIn')}
          actions={
            <Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
              {t('auth.signInWithGoogle')}
            </Button>
          }
        />
      ) : tab === 'squads' ? (
        <Squads uid={uid} displayName={user?.displayName ?? null} />
      ) : (
        <Friends uid={uid} />
      )}
      <p className={s.fine}>{t('sq.fine')}</p>
    </>
  );
}

function Squads({ uid, displayName }: { uid: string; displayName: string | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const list = useMySquadList(uid);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'code' | null>(null);
  const [err, setErr] = useState<{ at: 'create' | 'code'; msg: string } | null>(null);
  const now = useNow();
  async function run(at: 'create' | 'code', fn: () => Promise<string>) {
    setBusy(at);
    setErr(null);
    try {
      navigate(`/social/${encodeURIComponent(await fn())}`);
    } catch (e) {
      setErr({ at, msg: errorText(e, t('sq.failed')) });
      setBusy(null);
    }
  }
  return (
    <div className={s.page}>
      <Card pad className={s.hero}>
        <span className={s.kicker}>{t('sq.kicker')}</span>
        <h2 className={s.heroTitle}>{t('sq.hero.title')}</h2>
        <p className={s.muted}>{t('sq.hero.body')}</p>
      </Card>
      <div className={s.two}>
        <Card title={t('sq.create')}>
          <form
            className={s.inline}
            onSubmit={(e) => {
              e.preventDefault();
              void run('create', () => createSquad(uid, displayName, name).then((id) => (void unlockQuietly(uid, 'squad-up', 'Squad Up', toast.show), id)));
            }}
          >
            <Field label={t('sq.create.name')} value={name} maxLength={32} placeholder={t('sq.create.placeholder')} onChange={(e) => setName(e.target.value)} error={err?.at === 'create' ? err.msg : undefined} />
            <Button type="submit" variant="primary" disabled={busy != null || !name.trim()}>
              {t('sq.create.go')}
            </Button>
          </form>
        </Card>
        <Card title={t('sq.code')}>
          <form
            className={s.inline}
            onSubmit={(e) => {
              e.preventDefault();
              void run('code', () => findRoomCode(code));
            }}
          >
            <Field label={t('sq.code.label')} value={code} maxLength={8} placeholder="K7QX2M" autoCapitalize="characters" spellCheck={false} onChange={(e) => setCode(e.target.value.toUpperCase())} error={err?.at === 'code' ? err.msg : undefined} hint={err?.at === 'code' ? undefined : t('sq.code.hint')} />
            <Button type="submit" variant="secondary" disabled={busy != null || !code.trim()}>
              {t('sq.code.go')}
            </Button>
          </form>
        </Card>
      </div>
      <Card flush title={t('sq.mine')}>
        {list.status === 'loading' ? (
          <LoadingState rows={2} />
        ) : list.status === 'ready' && list.data.length ? (
          <ul className={s.list}>
            {list.data.map((q) => (
              <li key={q.id}>
                <Link to={`/social/${encodeURIComponent(q.id)}`} className={s.row}>
                  <span className={s.rowIcon} aria-hidden="true">
                    👥
                  </span>
                  <span className={s.who}>
                    <b>{q.name}</b>
                    <small>{t('sq.members', { n: q.members.length })}</small>
                  </span>
                  <span className={s.tag}>{q.comp && now < q.comp.end ? t('sq.compOn') : q.owner === uid ? t('sq.owner') : t('sq.member')}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="social" body={t('sq.none')} compact />
        )}
      </Card>
    </div>
  );
}

function Friends({ uid }: { uid: string }) {
  const toast = useToast();
  const me = useUserDoc(uid);
  const friends = useMemo(() => (me.status === 'ready' ? me.data.friends : []), [me]);
  const profs = useProfiles(friends);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const id = await uidForUsername(handle);
      if (id === uid) throw new Error(t('sq.friends.self'));
      if (friends.includes(id)) throw new Error(t('sq.friends.already'));
      const r = await addFriend(uid, id);
      toast.show(r.mutual ? t('sq.friends.mutual') : t('sq.friends.added'));
      setHandle('');
    } catch (e2) {
      setErr(errorText(e2, t('sq.failed')));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.page}>
      <Card title={t('sq.friends.add')}>
        <form className={s.inline} onSubmit={add}>
          <Field label={t('sq.friends.username')} prefix="@" value={handle} maxLength={21} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setHandle(e.target.value.toLowerCase())} error={err ?? undefined} hint={err ? undefined : t('sq.friends.hint')} />
          <Button type="submit" variant="primary" disabled={busy || !handle.trim()}>
            {t('sq.friends.addGo')}
          </Button>
        </form>
      </Card>
      <Card flush title={t('sq.friends.title', { n: friends.length })} actions={friends.length ? <Link className={s.more} to="/leaderboard?b=friends">{t('sq.friends.board')}</Link> : undefined}>
        {me.status === 'loading' || (friends.length > 0 && !profs) ? (
          <LoadingState rows={3} />
        ) : friends.length ? (
          <ul className={s.list}>
            {friends.map((f) => {
              const p = profs?.[f];
              const lv = p ? levelFor(p.xp).level : null;
              return (
                <li key={f} className={s.friend}>
                  <Link to={`/profile/${encodeURIComponent(f)}`} className={s.row}>
                    {p?.photo ? <img className={s.avatar} src={p.photo} alt="" width={36} height={36} referrerPolicy="no-referrer" loading="lazy" /> : <span className={s.avatar} aria-hidden="true">{(p?.name ?? '?').slice(0, 1).toUpperCase()}</span>}
                    <span className={s.who}>
                      <b>{p?.name ?? t('sq.friends.private')}</b>
                      <small>{p ? `${p.username ? `@${p.username} · ` : ''}${t('lb.level', { n: lv!.level, name: lv!.name })}` : t('sq.friends.noStats')}</small>
                    </span>
                    {p && (
                      <span className={s.num}>
                        {formatMoney(p.equity, { digits: 0 })} <small className={p.growthPct >= 0 ? s.up : s.down}>{`${p.growthPct >= 0 ? '+' : ''}${p.growthPct.toFixed(1)}%`}</small>
                      </span>
                    )}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('sq.friends.removeName', { name: p?.name ?? t('sq.friends.private') })}
                    onClick={() =>
                      void removeFriend(uid, f)
                        .then(() => toast.show(t('sq.friends.removed')))
                        .catch(() => toast.show(t('sq.failed'), 'error'))
                    }
                  >
                    {t('sq.friends.remove')}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon="social" body={t('sq.friends.none')} compact />
        )}
      </Card>
    </div>
  );
}
