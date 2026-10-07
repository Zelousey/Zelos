/** Loading placeholders. Show the shape of what's coming instead of a spinner. */
import s from './Skeleton.module.css';

export function Skeleton({ width = '100%', height = 14, radius, className }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return <span aria-hidden className={[s.sk, className].filter(Boolean).join(' ')} style={{ width, height, borderRadius: radius }} />;
}

export function SkeletonRows({ rows = 4, height = 18 }: { rows?: number; height?: number }) {
  return (
    <div className={s.rows} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} width={`${92 - (i % 3) * 14}%`} />
      ))}
    </div>
  );
}
