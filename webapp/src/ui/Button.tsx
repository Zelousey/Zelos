/**
 * Button. One component for every button in the app.
 *  variant: primary (main action) · secondary · ghost (toolbar/quiet) · danger ·
 *           buy / sell (trade tickets only, so those colours always mean a trade)
 *  size: sm · md · lg (lg = 44px tall, the minimum touch target on phones)
 * Renders an <a> when `href` is given so links look like buttons without nesting.
 */
import { haptic } from '../lib/haptics';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import s from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'buy' | 'sell';
type Size = 'sm' | 'md' | 'lg';
type Common = { variant?: Variant; size?: Size; block?: boolean; iconOnly?: boolean; children?: ReactNode };

export function buttonClass({ variant = 'secondary', size = 'md', block, iconOnly }: Common, extra?: string): string {
  return [s.btn, s[variant], size !== 'md' && s[size], block && s.block, iconOnly && s.icon, extra].filter(Boolean).join(' ');
}

export function Button({ variant, size, block, iconOnly, className, type = 'button', onClick, ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  // Buy and Sell buttons give a small buzz on phones that can (lib/haptics.ts; off in Settings)
  const click: typeof onClick = variant === 'buy' || variant === 'sell' ? (e) => (haptic('tap'), onClick?.(e)) : onClick;
  return <button type={type} className={buttonClass({ variant, size, block, iconOnly }, className)} onClick={click} {...rest} />;
}

export function ButtonLink({ variant, size, block, iconOnly, className, ...rest }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={buttonClass({ variant, size, block, iconOnly }, className)} {...rest} />;
}
