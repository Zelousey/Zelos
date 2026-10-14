/** Company research on the stock page (markets/research_<SYM>, SEC EDGAR data kept by the server). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';

test('the stock page shows company research and insider trades', async ({ page }) => {
  const now = Math.floor(Date.now() / 1000);
  await fetch(`${BASE}/markets/research_MSFT`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        symbol: { stringValue: 'MSFT' }, name: { stringValue: 'Microsoft Corp' }, source: { stringValue: 'SEC EDGAR' }, fetchedAt: { integerValue: String(now) },
        profile: { mapValue: { fields: { industry: { stringValue: 'Services-Prepackaged Software' }, exchange: { stringValue: 'Nasdaq' }, website: { stringValue: 'https://www.microsoft.com' }, fiscalYearEnd: { stringValue: '0630' }, state: { stringValue: 'WA' } } } },
        financials: { mapValue: { fields: { year: { stringValue: '2025' }, revenue: { doubleValue: 281.7e9 }, netIncome: { doubleValue: 101.8e9 }, eps: { doubleValue: 13.64 } } } },
        metrics: { mapValue: { fields: { pe: { doubleValue: 29.6 }, margin: { doubleValue: 0.3614 } } } },
        insiders: { arrayValue: { values: [{ mapValue: { fields: { date: { stringValue: '2026-10-01' }, who: { stringValue: 'Jane Doe' }, role: { stringValue: 'CFO' }, buy: { booleanValue: false }, shares: { doubleValue: 1000 }, price: { doubleValue: 401.5 } } } }] } },
      },
    }),
  });
  await page.goto('markets/MSFT');
  const card = page.getByRole('region', { name: 'Company research' });
  await expect(card).toContainText('Services-Prepackaged Software');
  await expect(card).toContainText('29.6');
  await expect(card).toContainText('36.1%');
  await expect(card).toContainText('Jane Doe');
  await expect(card).toContainText('Sold 1,000 @ $401.50');
  await expect(card.getByRole('link', { name: 'www.microsoft.com' })).toHaveAttribute('href', 'https://www.microsoft.com');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id)).toEqual([]);
});
