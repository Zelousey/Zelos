/**
 * Signing in (App Store guideline 4.8): every "Sign in" opens one sheet offering Continue with
 * Apple and Continue with Google, equally prominent, with the Terms and Privacy Policy.
 * (The providers' own pop-ups can't run in CI; the tests sign in with the emulator instead.)
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('Sign in offers Apple and Google, with the Terms', async ({ page }) => {
  await page.goto('battles');
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
  const sheet = page.getByRole('dialog', { name: 'Sign in to Zelos' });
  await expect(sheet).toBeVisible();
  const apple = sheet.getByRole('button', { name: 'Continue with Apple' });
  const google = sheet.getByRole('button', { name: 'Continue with Google' });
  await expect(apple).toBeVisible();
  await expect(google).toBeVisible();
  await sheet.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((x) => x.finished))); // the sheet grows in as it opens: measure once it's done
  const [a, g] = [(await apple.boundingBox())!, (await google.boundingBox())!];
  expect(a.y).toBeLessThan(g.y); // Apple first
  expect(Math.abs(a.width - g.width)).toBeLessThan(2); // same size
  expect(Math.abs(a.height - g.height)).toBeLessThan(2);
  await expect(sheet.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', 'https://agentictrading.info/terms.html');
  await expect(sheet.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', 'https://agentictrading.info/privacy.html');
  expect((await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
});
