/** Markets: the Zelos stock list with live prices, search and group filters. Rows open the chart. */
import { useMemo, useState } from 'react';
import { useQuotes } from '../../data/markets';
import { groups, searchUniverse, UNIVERSE } from '../../data/universe';
import { t } from '../../lib/i18n';
import { Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, Tabs } from '../../ui';
import { MarketList } from './MarketRow';
import { StatusLine } from './StatusLine';
import s from './MarketsPage.module.css';

export default function MarketsPage() {
  const quotes = useQuotes();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const rows = useMemo(() => {
    const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
    return searchUniverse(q)
      .filter((i) => group === 'all' || i.group === group)
      .map((i) => ({ sym: i.sym, name: i.name, price: qs[i.sym]?.c, chPct: qs[i.sym]?.chPct }));
  }, [quotes, q, group]);

  return (
    <>
      <PageHeader title={t('nav.markets')} />
      <div className={s.tools}>
        <label className={s.search}>
          <Icon name="search" size={18} />
          <span className="visually-hidden">{t('markets.search')}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('markets.searchPlaceholder')} autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="search" />
        </label>
        <Tabs label={t('markets.search')} value={group} onChange={setGroup} items={[{ value: 'all', label: t('markets.all') }, ...groups().map((g) => ({ value: g, label: g }))]} />
      </div>
      <StatusLine quotes={quotes} />
      <Card>
        {quotes.status === 'loading' ? (
          <LoadingState rows={8} />
        ) : quotes.status === 'error' ? (
          <ErrorState compact />
        ) : rows.length === 0 ? (
          <EmptyState icon="search" title={t('markets.empty', { q })} compact />
        ) : (
          <MarketList rows={rows} label={t('nav.markets')} />
        )}
        <p className={s.scope}>{t('markets.scope', { count: UNIVERSE.length })}</p>
      </Card>
    </>
  );
}
