/** The Z token coin (the website's image), at any size. */
import { COIN_URL } from './coin';

export function Coin({ size = 14, className }: { size?: number; className?: string }) {
  return <span data-coin aria-hidden="true" className={className} style={{ display: 'inline-block', flex: 'none', width: size, height: size, background: `url("${COIN_URL}") center/contain no-repeat`, verticalAlign: '-0.15em' }} />;
}
