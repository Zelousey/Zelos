/**
 * Help & feedback (/help; Phase 8, F22 + F23). Easy to find (menu, Settings), never in the way:
 *   - your first steps (the same checklist as the Dashboard, shown here even when hidden)
 *   - how Zelos works: short answers with a link to the place that does it
 *   - send feedback: saved on the server (feedback_send, 5 a day; owner 2026-10-28)
 *   - /help/feedback: the team's list of messages (admins only; the server checks)
 */
import { useEffect, useId, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { parseUserDoc, useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { callFunction } from '../../lib/firebase';
import { formatRelative } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { Badge, Button, buttonClass, Card, EmptyState, ErrorState, LoadingState, PageHeader, tourSeen, useToast } from '../../ui';
import { useIdentity } from '../dashboard/social';
import { useCanPost } from '../news/news';
import { usePracticeAccount } from '../practice/account';
import { TOURS } from '../tutorials/tours';
import { FirstSteps } from '../welcome/FirstSteps';
import s from './Help.module.css';

export default function HelpModule() {
  return (
    <Routes>
      <Route index element={<HelpPage />} />
      <Route path="feedback" element={<FeedbackAdmin />} />
    </Routes>
  );
}

const HOWTO: { q: MessageKey; a: MessageKey; to: string; go: MessageKey }[] = [
  { q: 'help.q.money', a: 'help.a.money', to: '/trade-war/solo', go: 'help.go.solo' },
  { q: 'help.q.trade', a: 'help.a.trade', to: '/markets?find=1', go: 'help.go.find' },
  { q: 'help.q.battle', a: 'help.a.battle', to: '/battles', go: 'help.go.battle' },
  { q: 'help.q.learn', a: 'help.a.learn', to: '/learn', go: 'help.go.learn' },
  { q: 'help.q.prices', a: 'help.a.prices', to: '/markets', go: 'help.go.market' },
  { q: 'help.q.tokens', a: 'help.a.tokens', to: '/tokens', go: 'help.go.tokens' },
  { q: 'help.q.alerts', a: 'help.a.alerts', to: '/alerts?tab=notify', go: 'help.go.notify' },
  { q: 'help.q.delete', a: 'help.a.delete', to: '/settings', go: 'help.go.settings' },
];

function HelpPage() {
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const admin = useCanPost(uid); // the same team list (admins/{uid}) that posts news
  return (
    <>
      <PageHeader title={t('nav.help')} subtitle={t('help.subtitle')} />
      <div className={s.stack}>
        {uid && <MyFirstSteps uid={uid} />}
        <section aria-labelledby="help-how">
          <h2 id="help-how" className={s.h2}>
            {t('help.how')}
          </h2>
          <div className={s.faq}>
            {HOWTO.map((x) => (
              <details key={x.q} className={s.item}>
                <summary>{t(x.q)}</summary>
                <p>{t(x.a)}</p>
                <Link className="hit" to={x.to}>
                  {t(x.go)} →
                </Link>
              </details>
            ))}
          </div>
        </section>
        <section aria-labelledby="help-tours">
          <h2 id="help-tours" className={s.h2}>
            {t('help.tours')}
          </h2>
          <ul className={s.tours}>
            {TOURS.map((x) => (
              <li key={x.id}>
                <Card pad>
                  <div className={s.row}>
                    <span>
                      <b>{t(x.title)}</b> {tourSeen(x.id) && <Badge tone="up">{t('help.tours.seen')}</Badge>}
                      <span className={s.tourBody}>{t(x.body)}</span>
                    </span>
                    <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} to={x.replay} aria-label={`${t('help.tours.replay')}: ${t(x.title)}`}>
                      {t('help.tours.replay')}
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
        <Feedback uid={uid} />
        {admin && (
          <p className={s.fine}>
            <Link className="hit" to="/help/feedback">
              {t('help.fb.team')} →
            </Link>
          </p>
        )}
        <p className={s.fine}>{t('help.fine')}</p>
      </div>
    </>
  );
}

/** F22: the Dashboard's first-steps checklist, findable here even after Hide. */
function MyFirstSteps({ uid }: { uid: string }) {
  const userDoc = useUserDoc(uid);
  const identity = useIdentity(uid);
  const acct = usePracticeAccount(uid);
  const me = userDoc.status === 'ready' ? userDoc.data : userDoc.status === 'missing' ? parseUserDoc({}) : null;
  if (!me || identity.status === 'loading' || acct.status === 'loading') return null;
  return <FirstSteps uid={uid} me={me} hasUsername={identity.status === 'ready' && !!identity.data.username} hasAccount={acct.status === 'ready' && !!acct.data} inHelp />;
}

const TOPICS = ['idea', 'problem', 'question', 'other'] as const;
type Topic = (typeof TOPICS)[number];
const MAX = 1000;

function Feedback({ uid }: { uid: string | null }) {
  const { openSignIn } = useAuth();
  const toast = useToast();
  const { pathname } = useLocation();
  const [topic, setTopic] = useState<Topic>('idea');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await callFunction<{ topic: Topic; text: string; page: string }, { sent: boolean }>('feedback_send', { topic, text, page: pathname });
      setSent(true);
      setText('');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('help.fb.failed'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={t('help.fb.title')} subtitle={t('help.fb.sub')}>
      {!uid ? (
        <div className={s.row}>
          <p className={s.muted}>{t('help.fb.signIn')}</p>
          <Button variant="primary" onClick={() => void openSignIn().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
            {t('auth.signIn')}
          </Button>
        </div>
      ) : sent ? (
        <div className={s.row}>
          <p role="status">{t('help.fb.thanks')}</p>
          <Button variant="ghost" onClick={() => setSent(false)}>
            {t('help.fb.another')}
          </Button>
        </div>
      ) : (
        <form className={s.form} onSubmit={send}>
          <fieldset className={s.topics}>
            <legend>{t('help.fb.topic')}</legend>
            {TOPICS.map((x) => (
              <label key={x} className={s.topic}>
                <input type="radio" name={`${id}-topic`} value={x} checked={topic === x} onChange={() => setTopic(x)} />
                {t(`help.fb.topic.${x}` as MessageKey)}
              </label>
            ))}
          </fieldset>
          <label className={s.label} htmlFor={`${id}-text`}>
            {t('help.fb.message')}
          </label>
          <textarea id={`${id}-text`} className={s.text} value={text} maxLength={MAX} rows={5} onChange={(e) => setText(e.target.value)} aria-describedby={`${id}-count`} />
          <div className={s.row}>
            <small id={`${id}-count`} className={s.muted}>
              {t('help.fb.count', { n: text.length, max: MAX })}
            </small>
            <Button type="submit" variant="primary" disabled={busy || text.trim().length < 5}>
              {busy ? t('help.fb.sending') : t('help.fb.send')}
            </Button>
          </div>
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          <p className={s.fine}>{t('help.fb.privacy')}</p>
        </form>
      )}
    </Card>
  );
}

type Item = { id: string; topic: string; text: string; page: string | null; createdAt: number; status: 'new' | 'done'; name: string };

/** The team's feedback list. The page is only linked for admins; feedback_list refuses everyone else. */
function FeedbackAdmin() {
  const toast = useToast();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; msg: string } | { status: 'ready'; items: Item[] }>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    callFunction<Record<string, never>, { items: Item[] }>('feedback_list', {})
      .then((r) => live && setState({ status: 'ready', items: r.items }))
      .catch((e: unknown) => live && setState({ status: 'error', msg: e instanceof Error ? e.message : '' }));
    return () => {
      live = false;
    };
  }, [tick]);
  async function mark(id: string, status: 'new' | 'done') {
    try {
      await callFunction('feedback_mark', { id, status });
      setTick((x) => x + 1);
    } catch {
      toast.show(t('help.fb.failed'), 'error');
    }
  }
  return (
    <>
      <PageHeader title={t('help.fb.team')} subtitle={t('help.fb.teamSub')} />
      {state.status === 'loading' ? (
        <LoadingState rows={4} />
      ) : state.status === 'error' ? (
        <ErrorState body={state.msg || undefined} />
      ) : !state.items.length ? (
        <EmptyState icon="inbox" body={t('help.fb.none')} />
      ) : (
        <ul className={s.inbox}>
          {state.items.map((x) => (
            <li key={x.id}>
              <Card pad className={x.status === 'done' ? s.done : undefined}>
                <div className={s.meta}>
                  <Badge tone={x.topic === 'problem' ? 'down' : x.topic === 'idea' ? 'accent' : 'neutral'}>{t(`help.fb.topic.${TOPICS.includes(x.topic as Topic) ? x.topic : 'other'}` as MessageKey)}</Badge>
                  <b>{x.name}</b>
                  <span className={s.muted}>
                    {formatRelative(x.createdAt)}
                    {x.page ? ` · ${x.page}` : ''}
                  </span>
                </div>
                <p className={s.msg}>{x.text}</p>
                <Button size="sm" variant={x.status === 'done' ? 'ghost' : 'secondary'} onClick={() => void mark(x.id, x.status === 'done' ? 'new' : 'done')}>
                  {x.status === 'done' ? t('help.fb.reopen') : t('help.fb.done')}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
