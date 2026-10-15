/**
 * Routes, generated from app/modules.ts.
 *
 *   /app/                 → /app/dashboard
 *   /app/<module>/*       → the module's screen
 *   anything else         → Not found
 *
 * Browser-history URLs (/app/markets/AAPL), so links are shareable and map 1:1 to
 * future iOS universal links. GitHub Pages has no SPA fallback, so the site's 404.html
 * sends unknown /app/… paths back here as /app/?r=<path> and restoreRedirect() puts
 * the real path back before the router starts.
 */
import { lazy } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppShell } from '../shell/AppShell';
import { DEFAULT_PATH, MODULES } from './modules';

const NotFoundPage = lazy(() => import('../features/notfound/NotFoundPage'));


export function buildRoutes(): RouteObject[] {
  return [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to={`/${DEFAULT_PATH}`} replace /> },
        ...MODULES.map((m) => {
          const Screen = lazy(m.load);
          return { path: `${m.path}/*`, element: <Screen /> };
        }),
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ];
}

export const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export function createAppRouter() {
  return createBrowserRouter(buildRoutes(), { basename: BASENAME });
}

/** Undo the 404.html hop: /app/?r=%2Fapp%2Fmarkets%2FAAPL → /app/markets/AAPL. Only same-app paths are accepted. */
export function restoreRedirect(loc: Location = window.location, hist: History = window.history, base: string = import.meta.env.BASE_URL): void {
  const r = new URLSearchParams(loc.search).get('r');
  if (!r) return;
  if (r.startsWith(base) && !r.startsWith('//') && !/[\\\s]/.test(r)) hist.replaceState(null, '', r);
  else hist.replaceState(null, '', base);
}
