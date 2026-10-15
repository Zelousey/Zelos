/**
 * Settings (App Store readiness, 2026-10-15): everything is inside the app (profile,
 * notifications, tokens) apart from the Privacy Policy and Terms, which open the public pages.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('settings: in-app account links, Privacy Policy and Terms', async ({ page }) => {
  await page.goto('settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', 'https://agentictrading.info/privacy.html');
  await expect(page.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', 'https://agentictrading.info/terms.html');
  await expect(page.getByText('Zelos is a simulated trading game with virtual money.')).toBeVisible();
  // nothing sends you to the website to manage your account
  await expect(page.getByText(/My Zelos|classic site/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.getByRole('link', { name: 'Notifications' }).click();
  await expect(page).toHaveURL(/\/alerts\?tab=notify$/);
});
