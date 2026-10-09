/**
 * Trade War: the home for everything you play. Your Practice account (the solo virtual
 * $10,000) sits on top, then the competitive parts: battles, squads, leaderboards and
 * missions. Battles, squads, leaderboards and missions still run on the website for now;
 * they move into the app in later steps.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuotes } from '../../data/markets';
import { useAuth } from '../../lib/auth';
import { formatMoney, formatSignedMoney } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { classicUrl } from '../../lib/platform';
import { Badge, Button, buttonClass, Card, Icon, PageHeader, Skeleton, Stat, useToast, type IconName } from '../../ui';
import { nyDay } from '../charts/series';
import { usePracticeAccount, valueAccount } from '../practice/account';
import { StrategiesPromo } from '../strategies/StrategiesPromo';
import s from './TradeWar.module.css';

const dir = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat';

const COMPETE: { icon: IconName; title: MessageKey; body: MessageKey; href?: string; to?: string }[] = [
  { icon: 'war', title: 'tw.battles', body: 'tw.battles.body', href: 'practice/war.html' },
  { icon: 'social', title: 'tw.squads', body: 'tw.squads.body', to: '/social' },
  { icon: 'markets', title: 'tw.leaderboard', body: 'tw.leaderboard.body', to: '/leaderboard' },
  { icon: 'missions', title: 'tw.missions', body: 'tw.missions.body', to: '/missions' },
];

export default function TradeWarPage() {
  return (
    <>
      <PageHeader title={t('nav.tradeWar')} subtitle={t('tw.subtitle')} />
      <div className={s.stack}>
        <PracticeCard />
        <Link to="/invite" className={s.inviteBanner}>
          <span className={s.tileIcon}>
            <Icon name="invite" size={22} />
          </span>
          <span className={s.tileText}>
            <b>{t('nav.invite')}</b>
            <span>{t('tw.invite.body')}</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </Link>
        <StrategiesPromo />
        <section aria-labelledby="tw-compete">
          <h2 id="tw-compete" className={s.sectionTitle}>
            {t('tw.compete')}
          </h2>
          <div className={s.grid}>
            {COMPETE.map((c) => {
              const inner = (
                <>
                  <span className={s.tileIcon}>
                    <Icon name={c.icon} size={22} />
                  </span>
                  <span className={s.tileText}>
                    <b>{t(c.title)}</b>
                    <span>{t(c.body)}</span>
                    {c.href && (
                      <small>
                        {t('tw.onSite')} <Icon name="external" size={12} />
                      </small>
                    )}
                  </span>
                </>
              );
              return c.to ? (
                <Link key={c.title} className={s.tile} to={c.to}>
                  {inner}
                </Link>
              ) : (
                <a key={c.title} className={s.tile} href={classicUrl(c.href!)}>
                  {inner}
                </a>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

function PracticeCard() {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  const uid = isReal && user ? user.uid : null;
  const acct = usePracticeAccount(uid);
  const quotes = useQuotes();
  const qs = useMemo(() => (quotes.status === 'ready' ? quotes.data.quotes : {}), [quotes]);
  const [today] = useState(() => nyDay(Date.now()));
  const data = acct.status === 'ready' ? acct.data : null;
  const v = useMemo(() => (data ? valueAccount(data, qs, today) : null), [data, qs, today]);

  const head = (
    <div className={s.practiceHead}>
      <h2 className={s.practiceTitle}>
        <Icon name="practice" size={20} /> {t('tw.practice.title')}
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
        <Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
          {t('auth.signInWithGoogle')}
        </Button>
      </div>
    );
  } else if (acct.status === 'error') {
    body = <p className={s.muted}>{t('state.error.body')}</p>;
  } else if (!v || !data) {
    body = (
      <div className={s.cta}>
        <p>{t('tw.practice.none')}</p>
        <Link className={buttonClass({ variant: 'primary' })} to="/practice">
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
            <Link className={buttonClass({ variant: 'primary' })} to="/practice">
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
