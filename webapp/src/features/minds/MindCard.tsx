/**
 * The red cards (owner's reference images, 2026-10-22): a black-and-white portrait on red, the
 * name in bold capitals, a dark pill bottom-right. A pair card melts two portraits into each
 * other in the middle (an SVG ripple on the seam).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { figureById, portraitUrl, type Figure, type Pair } from './minds';
import s from './Minds.module.css';

export function Portrait({ figure, className }: { figure: Figure; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className={[s.portrait, s.initials, className].filter(Boolean).join(' ')} aria-hidden>
        {figure.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
      </span>
    );
  }
  return <img className={[s.portrait, className].filter(Boolean).join(' ')} src={portraitUrl(figure)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

export function FigureCard({ figure, pill, big, to }: { figure: Figure; pill: string; big?: boolean; to?: string }) {
  const body = (
    <>
      <Portrait figure={figure} />
      <span className={s.cardName}>{figure.name}</span>
      <span className={s.pill}>{pill}</span>
    </>
  );
  const cls = [s.card, big && s.cardBig].filter(Boolean).join(' ');
  return to ? (
    <Link className={cls} to={to} aria-label={`${figure.name}, ${figure.role}. ${pill}`}>
      {body}
    </Link>
  ) : (
    <div className={cls} role="img" aria-label={`${figure.name}, ${figure.role}`}>
      {body}
    </div>
  );
}

export function PairCard({ pair, pill, big, to }: { pair: Pair; pill: string; big?: boolean; to?: string }) {
  const a = figureById(pair.a)!;
  const b = figureById(pair.b)!;
  const body = (
    <>
      <span className={s.pairFaces} aria-hidden>
        <Portrait figure={a} className={s.left} />
        <Portrait figure={b} className={s.right} />
        <Portrait figure={b} className={s.melt} />
      </span>
      <span className={s.cardName}>{pair.title}</span>
      <span className={s.pill}>{pill}</span>
    </>
  );
  const cls = [s.card, s.pairCard, big && s.cardBig].filter(Boolean).join(' ');
  return to ? (
    <Link className={cls} to={to} aria-label={`${pair.title}. ${pill}`}>
      {body}
    </Link>
  ) : (
    <div className={cls} role="img" aria-label={pair.title}>
      {body}
    </div>
  );
}

/** The ripple the pair cards use on the seam between the two faces (rendered once per page). */
export function MeltFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <filter id="hm-melt">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves="2" seed="7" />
        <feDisplacementMap in="SourceGraphic" scale="28" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
