/**
 * Level badges (owner 2026-10-09: "cooler, change when you advance, glow at high levels"),
 * the same design as the website's zelos-levels.js so a badge looks the same everywhere:
 *   the emblem   hexagon in the level's colours with rising candles and an up-chevron;
 *                laurels from Gold (3), wings from Diamond (5), a star crest from Master (6),
 *                level pips along the rim
 *   the frame    levels up with you: Lv 0 plain ring · 1-2 metal rim · 3-4 gold rim, slow spin
 *                and glow · 5-7 double ring with a breathing glow · 8-9 bright rim, orbiting sparks
 *                · 10 prism ring with a rainbow aura. Small badges get just the rim; all motion
 *                stops with "reduce motion".
 */
import { useId, type CSSProperties } from 'react';
import { LEVELS, type Level } from '../../data/levels';
import s from './Levels.module.css';

export const tierOf = (n: number) => (n >= 10 ? 5 : n >= 8 ? 4 : n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0);
const levelAt = (lv: Level | number) => (typeof lv === 'number' ? LEVELS[Math.max(0, Math.min(LEVELS.length - 1, lv))]! : lv);

const HEX = 'M32 4 L56 17.5 V46.5 L32 60 L8 46.5 V17.5 Z';
const INNER = 'M32 10 L50.5 20.5 V43.5 L32 54 L13.5 43.5 V20.5 Z';
const CANDLES = [
  [20, 36, 42, 32, 44],
  [27, 31, 38, 27, 40],
  [34, 27, 33, 22, 36],
  [41, 21, 28, 17, 30],
] as const;

/** The emblem on its own (no frame). */
export function LevelEmblem({ level, size = 24 }: { level: Level | number; size?: number }) {
  const lv = levelAt(level);
  const n = lv.level;
  const [c0, c1, c2] = lv.colors;
  const id = 'zlv' + useId().replace(/:/g, '');
  return (
    <svg className={s.emblem} viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={`Level ${n} · ${lv.name} badge`}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c0} />
          <stop offset="1" stopColor={c1} />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1017" />
          <stop offset="1" stopColor="#1b2130" />
        </linearGradient>
      </defs>
      {n >= 5 && <path d="M8 24 L0 20 L3 30 L0 36 L8 34 Z M56 24 L64 20 L61 30 L64 36 L56 34 Z" fill={`url(#${id}g)`} opacity="0.9" />}
      {n >= 3 &&
        [0, 1, 2, 3, 4].map((k) => {
          const y = 44 - k * 6;
          return (
            <g key={k} fill={c0} opacity="0.8">
              <ellipse cx={9 - k * 0.2} cy={y} rx="2.2" ry="3.6" transform={`rotate(-28 ${9 - k * 0.2} ${y})`} />
              <ellipse cx={55 + k * 0.2} cy={y} rx="2.2" ry="3.6" transform={`rotate(28 ${55 + k * 0.2} ${y})`} />
            </g>
          );
        })}
      <path d={HEX} fill={`url(#${id}g)`} stroke={c2} strokeOpacity="0.55" strokeWidth="1.2" />
      <path d={INNER} fill={`url(#${id}f)`} />
      {CANDLES.map((cd, i) => {
        const col = n === 0 ? '#6c7380' : i === 3 ? c2 : c0;
        return (
          <g key={i}>
            <line x1={cd[0] + 2} y1={cd[3]} x2={cd[0] + 2} y2={cd[4]} stroke={col} strokeWidth="1.2" />
            <rect x={cd[0]} y={cd[1]} width="4" height={cd[2] - cd[1]} rx="0.6" fill={col} />
          </g>
        );
      })}
      {n > 0 && (
        <g fill="none" stroke={c2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 30 L28 22 L34 26 L46 15" />
          <path d="M41 14.5 L46.5 14.5 L46.5 20" />
        </g>
      )}
      {n >= 6 && <path d="M32 0.5 L33.6 4 L37.4 4.3 L34.5 6.7 L35.4 10.4 L32 8.4 L28.6 10.4 L29.5 6.7 L26.6 4.3 L30.4 4 Z" fill={c2} stroke={c1} strokeWidth="0.6" />}
      {[0, 1, 2, 3, 4].map((p) => (
        <circle key={p} cx={22 + p * 5} cy="49" r="1.6" fill={p < (n > 5 ? n - 5 : n) ? c2 : '#4a505c'} />
      ))}
    </svg>
  );
}

/** The badge in its tier frame: the frame and its glow level up with you. */
export function LevelBadge({ level, size = 48 }: { level: Level | number; size?: number }) {
  const lv = levelAt(level);
  const t = tierOf(lv.level);
  const sm = size < 40;
  const [c0, c1, c2] = lv.colors;
  const style = { width: size, height: size, '--c0': c0, '--c1': c1, '--c2': c2, '--glow': `${c0}88` } as CSSProperties;
  return (
    <span className={[s.frame, s[`t${t}`], sm && s.sm].filter(Boolean).join(' ')} style={style} title={`Level ${lv.level} · ${lv.name}`} data-tier={t}>
      <span className={s.inner}>
        <LevelEmblem level={lv} size={Math.round(size * 0.66)} />
      </span>
      {t >= 4 && !sm && (
        <span className={s.orbit} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
}
