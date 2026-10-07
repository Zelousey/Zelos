import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRoutes } from '../app/router';
import { ToastProvider } from '../ui';

const authState = { ready: true, user: null as null | { uid: string; isAnonymous: boolean; displayName: string; email: string; photoURL: null }, isReal: false, signInWithGoogle: vi.fn(async () => {}), signOut: vi.fn(async () => {}) };
vi.mock('../lib/auth', () => ({ useAuth: () => authState }));
const inbox = { items: [] as unknown[], unread: 0, error: false, markAllRead: vi.fn(async () => {}) };
vi.mock('./useInbox', () => ({ useInbox: () => inbox }));
// screens' market data: stay "loading" (no network in unit tests)
vi.mock('../data/liveDoc', () => ({ useLiveDoc: () => ({ status: 'loading' }) }));

// jsdom lacks <dialog>.showModal; the Sheet falls back to the open attribute.
function renderAt(path: string) {
  const router = createMemoryRouter(buildRoutes(), { initialEntries: [path] });
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return router;
}

describe('AppShell', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isReal = false;
    inbox.unread = 0;
    inbox.items = [];
  });

  it('redirects / to the dashboard', async () => {
    const router = renderAt('/');
    await screen.findAllByRole('heading', { name: 'Dashboard' });
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('shows every module in the sidebar, grouped, and the four phone tabs plus More', async () => {
    renderAt('/dashboard');
    const navs = await screen.findAllByRole('navigation', { name: 'Main' });
    const side = navs[0]!;
    for (const name of ['Dashboard', 'Markets', 'Charts', 'Practice', 'Real Trading', 'Trade War', 'Alerts', 'Options', 'Crypto', 'Social', 'Missions & XP', 'Arcade', 'Profile', 'Settings']) {
      expect(within(side).getByRole('link', { name })).toBeInTheDocument();
    }
    const tabbar = navs[1]!;
    expect(within(tabbar).getAllByRole('link').map((a) => a.textContent)).toEqual(['Dashboard', 'Markets', 'Practice', 'Alerts']);
    expect(within(tabbar).getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('a module still on the classic site shows a hand-off to that page', async () => {
    renderAt('/trade-war');
    const link = await screen.findByRole('link', { name: /Open Trade War/ });
    expect(link).toHaveAttribute('href', '/practice/war.html');
  });

  it('a planned module says it is coming', async () => {
    renderAt('/crypto');
    expect(await screen.findByText('Crypto is coming soon')).toBeInTheDocument();
  });

  it('navigates without reloading: clicking a sidebar link swaps the screen', async () => {
    const router = renderAt('/dashboard');
    const side = (await screen.findAllByRole('navigation', { name: 'Main' }))[0]!;
    await userEvent.click(within(side).getByRole('link', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Theme' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/settings');
  });

  it('unknown paths show Not found inside the shell', async () => {
    renderAt('/does-not-exist');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBe(2);
  });

  it('guests see Sign in; the bell shows the unread count when signed in', async () => {
    renderAt('/dashboard');
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('signed-in: unread badge on the bell, no Sign in button', async () => {
    authState.user = { uid: 'u1', isAnonymous: false, displayName: 'Ada', email: 'a@x.io', photoURL: null };
    authState.isReal = true;
    inbox.unread = 3;
    renderAt('/dashboard');
    expect(await screen.findByRole('button', { name: /Open notifications \(3 unread\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('More opens a sheet listing the modules that are not tabs', async () => {
    renderAt('/dashboard');
    const tabbar = (await screen.findAllByRole('navigation', { name: 'Main' }))[1]!;
    await userEvent.click(within(tabbar).getByRole('button', { name: 'More' }));
    const sheet = await screen.findByRole('dialog', { name: 'More', hidden: true });
    expect(within(sheet).getByRole('link', { name: 'Trade War', hidden: true })).toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: 'Dashboard', hidden: true })).not.toBeInTheDocument();
  });
});
