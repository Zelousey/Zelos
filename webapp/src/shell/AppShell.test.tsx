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

  it('shows every listed module in the sidebar and the five phone tabs', async () => {
    renderAt('/dashboard');
    const navs = await screen.findAllByRole('navigation', { name: 'Main' });
    const side = navs[0]!;
    for (const name of ['Dashboard', 'Market', 'Trade War', 'Alerts', 'News', 'Practice', 'Options', 'Crypto', 'Squads & friends', 'Missions & XP', 'Arcade', 'Profile', 'Settings']) {
      expect(within(side).getByRole('link', { name: new RegExp(`^${name.replace(/[&]/g, '\\$&')}`) })).toBeInTheDocument();
    }
    expect(within(side).queryByRole('link', { name: /Real Trading|Charts/ })).not.toBeInTheDocument();
    const tabbar = navs[1]!;
    expect(within(tabbar).getAllByRole('link').map((a) => a.textContent?.replace(/, new posts$/, ''))).toEqual(['Dashboard', 'Market', 'Trade War', 'Alerts', 'News']);
    expect(within(tabbar).queryByRole('button')).not.toBeInTheDocument();
  });

  it('Practice highlights the Trade War tab', async () => {
    renderAt('/practice');
    const tabbar = (await screen.findAllByRole('navigation', { name: 'Main' }))[1]!;
    expect(within(tabbar).getByRole('link', { name: 'Trade War' }).className).toMatch(/active/);
  });

  it('a module still on the classic site shows a hand-off to that page', async () => {
    renderAt('/alerts');
    const link = await screen.findByRole('link', { name: /Open Alerts/ });
    expect(link).toHaveAttribute('href', '/alert-history.html');
  });

  it('Trade War is a hub: practice account plus the competitive parts', async () => {
    renderAt('/trade-war');
    expect(await screen.findByRole('heading', { name: /Your practice account/ })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /Battles/ })).toHaveAttribute('href', '/practice/war.html');
    expect(within(main).getByRole('link', { name: /^Squads/ })).toHaveAttribute('href', '/practice/squads.html');
  });

  it('/real is not part of the app', async () => {
    renderAt('/real');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
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

  it('the ☰ menu opens a sheet listing everything that is not a tab', async () => {
    renderAt('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    const sheet = await screen.findByRole('dialog', { name: 'Menu', hidden: true });
    expect(within(sheet).getByRole('link', { name: 'Practice', hidden: true })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Settings', hidden: true })).toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: 'Dashboard', hidden: true })).not.toBeInTheDocument();
  });
});
