/**
 * GSAP + ScrollTrigger for scroll-driven lessons (owner 2026-10-23: pinned slides you scroll
 * through, starting with Hall of Minds). Import gsap, ScrollTrigger and useGSAP from here, never
 * from 'gsap' directly, so the plugin is always registered once. useGSAP (from @gsap/react)
 * scopes animations to a component and reverts them on unmount, which also keeps React's
 * StrictMode double-mount from leaving stray triggers behind.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };
