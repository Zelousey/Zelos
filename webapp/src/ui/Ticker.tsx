/**
 * A live price that flashes green or red for a moment when it ticks up or down (design pass 5),
 * so a changing number catches the eye without moving anything. Off with reduced motion.
 */
import { useState, type ReactNode } from 'react';
import s from './Ticker.module.css';

export function Ticker({ value, children, className }: { value: number | null | undefined; children: ReactNode; className?: string }) {
  const [prev, setPrev] = useState(value);
  const [flash, setFlash] = useState<{ dir: 'up' | 'down'; n: number } | null>(null);
  // compare with the last value during render (React's pattern for state that follows a prop)
  if (value !== prev) {
    setPrev(value);
    if (value != null && prev != null) setFlash({ dir: value > prev ? 'up' : 'down', n: (flash?.n ?? 0) + 1 });
  }
  return (
    // a new key restarts the animation on every tick
    <span key={flash?.n ?? 0} className={[s.t, flash && (flash.dir === 'up' ? s.up : s.down), className].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}
