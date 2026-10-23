import { render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { gsap, ScrollTrigger, useGSAP } from './gsap';

function Pinned() {
  const box = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.to('.slide', { opacity: 1, scrollTrigger: { trigger: '.slide', pin: true, start: 'top top', end: '+=500', scrub: true } });
  }, { scope: box });
  return (
    <div ref={box}>
      <div className="slide">Napoleon</div>
    </div>
  );
}

describe('gsap', () => {
  // without registerPlugin, gsap ignores scrollTrigger: {...} and no trigger is made
  it('ScrollTrigger is registered: a pinned slide makes a trigger, and unmounting removes it', () => {
    const { unmount } = render(<Pinned />);
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    unmount();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
