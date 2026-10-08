/** The level badge: a hexagon in the level's colours with its number (same idea as the classic badge). */
import { useId } from 'react';
import type { Level } from '../../data/levels';

export function LevelBadge({ level, size = 56 }: { level: Level; size?: number }) {
  const id = useId().replace(/:/g, '');
  const [a, b, c] = level.colors;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${level.name} level badge`}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <path d="M32 3 L57 17 V47 L32 61 L7 47 V17 Z" fill={`url(#g${id})`} />
      <path d="M32 9 L51.5 20 V44 L32 55 L12.5 44 V20 Z" fill="none" stroke={c} strokeOpacity="0.55" strokeWidth="1.5" />
      <text x="32" y="39" textAnchor="middle" fontFamily="var(--mono)" fontWeight="700" fontSize="20" fill={c}>
        {level.level}
      </text>
    </svg>
  );
}
