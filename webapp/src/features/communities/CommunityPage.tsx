/**
 * One community (/communities/:cid): its numbers, the founder's milestones, join / invite /
 * leave, and the members leaderboard by XP. Joining when you're already in another community
 * asks the server first, then confirms the switch with you.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Badge, Button, buttonClass, Card, Confirm, EmptyState, ErrorState, LoadingState, PageHeader, useToast } from '../../ui';
import { errorText, shareLink } from '../invites/invites';
import { ACTIVE_DAYS, isSwitchAsk, joinCommunity, leaveCommunity, nextTier, STATES, thisWeek, useBoard, useCommunity, useMembership, type Community } from './communities';
import { Milestones } from './parts';
import s from './Communities.module.css';

const num = (v: number) => v.toLocaleString('en-US');
const inviteUrl = (cid: string) => `${window.location.origin}${import.meta.env.BASE_URL}communities/${encodeURIComponent(cid)}`;

function Actions({ c, uid }: { c: Community; uid: string | null }) {
  const { signInWithGoogle } = useAuth();
  const toast = useToast();
  const m = useMembership(uid);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ask, setAsk] = useState<'switch' | 'leave' | null>(null);
  const [switchText, setSwitchText] = useState('');
  if (!uid)
    return (
      <Card title={t('cm.join', { name: c.name })} pad>
        <Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
          {t('cm.signInToJoin')}
        </Button>
      </Card>
    );
  if (m.status === 'loading') return <LoadingState rows={1} />;
  const member = m.status === 'ready' && m.data.cid === c.id;
  const founder = c.founder === uid;
  async function join(sw: boolean) {
    setBusy(true);
    setMsg(t('cm.joining'));
    try {
      await joinCommunity(c.id, sw);
      setMsg(null);
      toast.show(t('cm.joined', { name: c.name }));
    } catch (e) {
      const text = errorText(e, t('cm.failed'));
      if (isSwitchAsk(text)) {
        setSwitchText(text.slice('SWITCH:'.length));
        setAsk('switch');
        setMsg(null);
      } else setMsg(text);
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setBusy(true);
    try {
      await leaveCommunity();
      setAsk(null);
      toast.show(t('cm.left', { name: c.name }));
    } catch (e) {
      setMsg(errorText(e, t('cm.failed')));
      setAsk(null);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const r = await shareLink(inviteUrl(c.id), t('cm.shareTitle', { name: c.name }), t('cm.shareText', { name: c.name }));
    if (r === 'copied') toast.show(t('cm.copied'));
    else if (r === 'failed') toast.show(t('cm.failed'), 'error');
  }
  return (
    <Card title={member ? t(founder ? 'cm.inviteFounder' : 'cm.inviteFriends') : t('cm.join', { name: c.name })} pad>
      <div className={s.actions}>
        {member ? (
          <>
            <Button variant="primary" onClick={() => void share()}>
              {t('cm.shareLink')}
            </Button>
            <p className={s.fine}>{founder ? t('cm.founderNote', { n: ACTIVE_DAYS }) : m.status === 'ready' && m.data.counted ? t('cm.youCount') : t('cm.comeBack')}</p>
            {!founder && (
              <Button variant="ghost" size="sm" onClick={() => setAsk('leave')}>
                {t('cm.leave')}
              </Button>
            )}
          </>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => void join(false)}>
            {t('cm.joinBtn')}
          </Button>
        )}
        {msg && (
          <p className={s.fine} role="status">
            {msg}
          </p>
        )}
      </div>
      <Confirm open={ask === 'switch'} title={t('cm.switchTitle')} action={t('cm.switchBtn', { name: c.name })} busy={busy} onConfirm={() => void join(true).then(() => setAsk(null))} onClose={() => setAsk(null)}>
        {switchText || t('cm.switchBody')}
      </Confirm>
      <Confirm open={ask === 'leave'} title={t('cm.leaveTitle', { name: c.name })} action={t('cm.leave')} variant="danger" busy={busy} onConfirm={() => void leave()} onClose={() => setAsk(null)}>
        {t('cm.leaveBody')}
      </Confirm>
    </Card>
  );
}

function Board({ cid, uid }: { cid: string; uid: string | null }) {
  const rows = useBoard(cid);
  if (rows.status === 'loading') return <LoadingState rows={4} />;
  if (rows.status !== 'ready') return <p className={s.muted}>{t('cm.loadFailed')}</p>;
  if (!rows.data.length) return <p className={s.muted}>{t('cm.noMembers')}</p>;
  return (
    <ol className={s.board}>
      {rows.data.map((r, i) => (
        <li key={r.uid} className={r.uid === uid ? s.me : undefined}>
          <span className={s.rank}>{i + 1}</span>
          <Link to={`/profile/${encodeURIComponent(r.uid)}`} className={s.who}>
            {r.name}
          </Link>
          <Badge tone={r.founder ? 'accent' : r.counted ? 'up' : 'neutral'}>{t(r.founder ? 'cm.tagFounder' : r.counted ? 'cm.tagCounted' : 'cm.tagNew')}</Badge>
          <span className={s.xpCell}>{t('cm.xp', { n: num(r.xp) })}</span>
        </li>
      ))}
    </ol>
  );
}

export default function CommunityPage() {
  const cid = useParams().cid ?? '';
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const c = useCommunity(cid || null);
  const back = (
    <Link className={buttonClass({ variant: 'secondary' })} to="/communities">
      {t('cm.all')}
    </Link>
  );
  if (c.status === 'loading') return <LoadingState rows={6} />;
  if (c.status === 'missing') return <EmptyState icon="social" title={t('cm.notFound')} body={t('cm.notFoundBody')} actions={back} />;
  if (c.status !== 'ready') return <ErrorState body={t('cm.loadFailed')} />;
  const k = c.data;
  const next = nextTier(k.counted);
  const stats: [string, string][] = [
    [t('cm.statMembers'), num(k.members)],
    [t('cm.statXp'), num(k.xp)],
    [t('cm.statCounted'), num(k.counted)],
    [t('cm.statWeek'), num(k.weeks[thisWeek()] ?? 0)],
  ];
  return (
    <>
      <Link to="/communities" className={s.back}>
        ← {t('cm.all')}
      </Link>
      <PageHeader title={k.name} subtitle={`${STATES[k.state] ?? k.state} · ${t('cm.foundedBy', { name: k.founderName })}${k.title ? ` · ${k.title}` : ''}`} />
      <div className={s.stack}>
        <dl className={s.stats}>
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <Card title={t('cm.milestones')} pad>
          {next && (
            <>
              <p className={s.muted}>{t('cm.toNext', { n: next[0] - k.counted, title: next[2], tokens: num(next[1]) })}</p>
              <progress className={s.progress} max={next[0]} value={k.counted} aria-label={t('cm.progress', { n: k.counted, of: next[0] })} />
            </>
          )}
          <Milestones c={k} />
        </Card>
        <Actions c={k} uid={uid} />
        <Card title={t('cm.leaderboard')} pad>
          <Board cid={k.id} uid={uid} />
        </Card>
      </div>
    </>
  );
}
