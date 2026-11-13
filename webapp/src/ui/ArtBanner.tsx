/**
 * A picture strip at the top of a page (owner 2026-11-13: the Team up and Coaching pictures):
 * the art centred on a soft glow in the page's colour, decorative only.
 */
import s from './ArtBanner.module.css';

export function ArtBanner({ src, width, height, tone = 'blue' }: { src: string; width: number; height: number; tone?: 'blue' | 'duel' }) {
  return (
    <div className={[s.banner, s[tone]].join(' ')} aria-hidden="true">
      <img src={`${import.meta.env.BASE_URL}art/${src}`} alt="" width={width} height={height} decoding="async" />
    </div>
  );
}
