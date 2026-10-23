/**
 * The battle clash (owner 2026-10-23, mock-up H): a blue sword (bulls) and a red sword (bears)
 * swing in and clash over faint candles. Plays when a battle goes live and again before the
 * results, once per battle per person (localStorage), skippable, and not shown with reduced
 * motion. Purely cosmetic: nothing about the battle waits on it.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { t } from '../../lib/i18n';
import { useMediaQuery } from '../../lib/useMediaQuery';
import s from './BattleClash.module.css';

export type ClashStage = 'start' | 'end';

const RUN_MS = 3000;
const OFF_KEY = 'zelosClashOff'; // set by the e2e setup so other tests aren't covered by it

const key = (id: string, stage: ClashStage) => `zelosClash:${id}:${stage}`;

function seen(id: string, stage: ClashStage): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === '1' || localStorage.getItem(key(id, stage)) === '1';
  } catch {
    return true;
  }
}

const CANDLES: [number, boolean][] = [[60, true], [90, true], [50, false], [110, true], [70, false], [130, true], [60, false], [150, true], [90, false], [170, true], [80, false], [120, true]];

function Sword({ tone }: { tone: 'bull' | 'bear' }) {
  const c = tone === 'bull'
    ? { light: '#e0ecff', dark: '#8fb0d9', guard: '#1d4ed8', guardDark: '#1e3a8a', grip: '#0f172a', wrap: '#60a5fa' }
    : { light: '#ffe4e1', dark: '#d9a09a', guard: '#dc2626', guardDark: '#7f1d1d', grip: '#1c0a0a', wrap: '#f87171' };
  return (
    <g filter={`url(#clash-glow-${tone})`}>
      <polygon points="-19,-62 -16,-360 0,-432 0,-62" fill={c.light} />
      <polygon points="0,-62 0,-432 16,-360 19,-62" fill={c.dark} />
      <polyline points="-19,-62 -16,-360 0,-432 16,-360 19,-62" fill="none" stroke="#fff" strokeWidth="1.6" />
      <line x1="0" y1="-80" x2="0" y2="-340" stroke={c.dark} strokeWidth="3" opacity=".55" />
      <polygon points="-74,-66 -60,-78 60,-78 74,-66 60,-54 -60,-54" fill={c.guard} />
      <polygon points="-74,-66 74,-66 60,-54 -60,-54" fill={c.guardDark} />
      <rect x="-10" y="-54" width="20" height="62" rx="4" fill={c.grip} />
      {[-44, -34, -24, -14, -4, 6].map((y) => (
        <line key={y} x1="-10" y1={y} x2="10" y2={y - 8} stroke={c.wrap} strokeWidth="3" />
      ))}
      <polygon points="0,8 14,18 0,32 -14,18" fill={c.guard} />
      <polygon points="0,8 14,18 0,18 -14,18" fill={c.guardDark} />
    </g>
  );
}

export function BattleClash({ battleId, stage }: { battleId: string; stage: ClashStage }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [show, setShow] = useState(() => !seen(battleId, stage));
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!show || reduced) return;
    try {
      localStorage.setItem(key(battleId, stage), '1');
    } catch {
      /* private mode: it may play again next time */
    }
    const a = window.setTimeout(() => setLeaving(true), RUN_MS);
    const b = window.setTimeout(() => setShow(false), RUN_MS + 400);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [show, reduced, battleId, stage]);
  if (!show || reduced) return null;
  const close = () => {
    setLeaving(true);
    window.setTimeout(() => setShow(false), 300);
  };
  return (
    <div className={[s.overlay, leaving && s.leaving].filter(Boolean).join(' ')} onClick={close} data-testid="battle-clash">
      <svg className={s.stage} viewBox="0 0 880 560" aria-hidden>
        <defs>
          {(['bull', 'bear'] as const).map((tone) => (
            <filter key={tone} id={`clash-glow-${tone}`} x="-50%" y="-20%" width="200%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="b" />
              <feFlood floodColor={tone === 'bull' ? '#3b82f6' : '#ef4444'} floodOpacity=".75" />
              <feComposite in2="b" operator="in" result="g" />
              <feMerge>
                <feMergeNode in="g" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>
        <polygon points="560,560 880,120 880,200 640,560" fill="#ef4444" opacity=".12" />
        <polygon points="0,420 280,0 330,0 40,460" fill="#3b82f6" opacity=".12" />
        {CANDLES.map(([h, up], i) => {
          const x = 70 + i * 66;
          const top = up ? 420 - h - i * 14 : 400 - i * 12;
          const col = up ? '#22c55e' : '#ef4444';
          return (
            <g key={i} opacity=".28">
              <line x1={x + 11} y1={top - 18} x2={x + 11} y2={top + h + 18} stroke={col} strokeWidth="2" />
              <rect x={x} y={top} width="22" height={h} fill={col} />
            </g>
          );
        })}
        <g transform="translate(300 474)">
          <g className={s.left}>
            <Sword tone="bull" />
          </g>
        </g>
        <g transform="translate(580 474)">
          <g className={s.right}>
            <Sword tone="bear" />
          </g>
        </g>
        <g transform="translate(440 266)">
          {Array.from({ length: 12 }, (_, i) => (
            <g key={i} transform={`rotate(${i * 30})`}>
              <polygon className={s.ray} points="0,-6 120,0 0,6" fill="#fde68a" />
            </g>
          ))}
          <circle className={s.flash} r="46" fill="#fff" />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i * 2 * Math.PI) / 16 + (i % 2 ? 0.2 : 0);
            const d = 90 + ((i * 37) % 70);
            const style = { '--dx': `${Math.round(d * Math.cos(a))}px`, '--dy': `${Math.round(d * Math.sin(a))}px` } as CSSProperties;
            return <circle key={i} className={s.spark} r={2.5 + (i % 3)} fill={['#ffffff', '#93c5fd', '#fca5a5', '#fde68a'][i % 4]} style={style} />;
          })}
        </g>
        <text className={s.title} x="440" y="68" textAnchor="middle">BULLS VS BEARS</text>
        <text className={s.side} x="60" y="520" fill="#93c5fd">BULLS</text>
        <text className={s.side} x="820" y="520" textAnchor="end" fill="#fca5a5">BEARS</text>
      </svg>
      <p className={s.sub}>{t(stage === 'start' ? 'bt.clashStart' : 'bt.clashEnd')}</p>
      <button type="button" className={s.skip} onClick={close}>
        {t('hm.skip')}
      </button>
    </div>
  );
}
