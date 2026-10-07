/**
 * Sparkline for stat tiles: one series, no axes, no legend (the tile's label names it).
 * Muted line, latest point in the accent (dataviz: de-emphasis hue + current in accent).
 * The tile's numbers carry the information; the line is decoration with an
 * accessible summary, and the full chart (with crosshair) is one tap away.
 */
export function Sparkline({ values, width = 120, height = 36, label }: { values: number[]; width?: number; height?: number; label: string }) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return <svg width={width} height={height} aria-hidden />;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={d} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
      <circle cx={x(pts.length - 1)} cy={y(last)} r={3} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
