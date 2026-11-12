/**
 * Search any Zelos stock from any screen (design pass 3, 2026-11-12). Lives in the desktop top bar:
 * type a symbol or a company, pick with the arrow keys and Enter (or click), and the stock's page
 * opens. "/" jumps here from anywhere unless you're typing somewhere else. With an empty box it
 * lists the stocks you looked at last. Phones keep Market's own search.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuotes } from '../data/markets';
import { instrument, searchUniverse, type Instrument } from '../data/universe';
import { recentSymbols } from '../features/markets/useLastSymbol';
import { formatPercent, formatPrice } from '../lib/format';
import { t } from '../lib/i18n';
import { Icon } from '../ui';
import s from './TopSearch.module.css';

const MAX = 8;

/** Matches, best first: the exact symbol, then symbols that start with it, then company names. */
export function rankMatches(q: string): Instrument[] {
  const needle = q.trim().toUpperCase();
  if (!needle) return [];
  const score = (i: Instrument) => (i.sym === needle ? 0 : i.sym.startsWith(needle) ? 1 : i.name.toUpperCase().startsWith(needle) ? 2 : 3);
  return searchUniverse(needle)
    .map((i) => [score(i), i] as const)
    .sort((a, b) => a[0] - b[0] || a[1].sym.localeCompare(b[1].sym))
    .slice(0, MAX)
    .map(([, i]) => i);
}

export function TopSearch() {
  const navigate = useNavigate();
  const quotes = useQuotes();
  const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [recent, setRecent] = useState<string[]>([]);

  const rows = useMemo(() => {
    if (q.trim()) return rankMatches(q);
    return recent.map((sym) => instrument(sym)).filter((i): i is Instrument => !!i).slice(0, 6);
  }, [q, recent]);

  // "/" focuses the search unless you're already typing somewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // a click outside closes the list
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const go = (sym: string) => {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    navigate(`/markets/${encodeURIComponent(sym)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (rows.length ? (a + 1) % rows.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (rows.length ? (a - 1 + rows.length) % rows.length : 0));
    } else if (e.key === 'Enter') {
      const pick = rows[active] ?? rows[0];
      if (pick) {
        e.preventDefault();
        go(pick.sym);
      }
    } else if (e.key === 'Escape') {
      if (q) setQ('');
      else {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  const showList = open && (rows.length > 0 || q.trim().length > 0);
  const optId = (i: number) => `${listId}-o${i}`;

  return (
    <div className={s.box} ref={boxRef}>
      <div className={s.field}>
        <Icon name="search" size={16} className={s.icon} />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={t('top.search')}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && rows[active] ? optId(active) : undefined}
          placeholder={t('top.search.placeholder')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            setRecent(recentSymbols());
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="go"
        />
        {!q && (
          <kbd className={s.kbd} aria-hidden="true">
            /
          </kbd>
        )}
      </div>
      {showList && (
        <div className={s.pop}>
          {!q.trim() && <div className={s.head}>{t('top.search.recent')}</div>}
          <ul id={listId} role="listbox" aria-label={t('top.search')} className={s.list}>
            {rows.map((r, i) => {
              const qt = qs[r.sym];
              const ch = qt?.chPct;
              return (
                <li
                  key={r.sym}
                  id={optId(i)}
                  role="option"
                  aria-selected={i === active}
                  className={s.opt}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => go(r.sym)}
                >
                  <b className={s.sym}>{r.sym}</b>
                  <span className={s.name}>{r.name}</span>
                  <span className={s.price}>{qt?.c != null ? formatPrice(qt.c) : ''}</span>
                  <span className={[s.ch, ch == null ? '' : ch >= 0 ? 'up' : 'down'].join(' ')}>{ch != null ? formatPercent(ch) : ''}</span>
                </li>
              );
            })}
          </ul>
          {q.trim() && !rows.length && <p className={s.none}>{t('top.search.none', { q: q.trim() })}</p>}
        </div>
      )}
    </div>
  );
}
