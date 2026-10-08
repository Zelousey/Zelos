/**
 * Seeds the Firestore emulator with the market fixtures (a trimmed copy of real
 * markets/* docs) before the browser tests run. Writes go to the local emulator's fake
 * "demo-zelos" project only.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';

type V = Record<string, unknown>;
function enc(v: unknown): V {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, enc(x)])) } };
}

export default async function globalSetup() {
  const docs = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/markets.json'), 'utf8')) as Record<string, Record<string, unknown>>;
  // start from an empty database every run
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-zelos/databases/(default)/documents', { method: 'DELETE' });
  for (const [id, data] of Object.entries(docs)) {
    const r = await fetch(`${BASE}/markets/${id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }),
    });
    if (!r.ok) throw new Error(`seeding markets/${id} failed: ${r.status} ${await r.text()}`);
  }
  // official market news (what refresh_official_news writes), dated relative to now
  const now = Date.now();
  const official = {
    updatedAt: new Date(now).toISOString(),
    items: [
      { id: 'sec:aapl', kind: 'filing', source: 'SEC filing', sym: 'AAPL', form: '8-K', title: 'AAPL: new 8-K filing', detail: '2.02 Results of Operations and Financial Condition', url: 'https://www.sec.gov/Archives/edgar/data/320193/x-index.htm', at: now - 3600e3 },
      { id: 'fed:fomc', kind: 'fed', source: 'Federal Reserve', title: 'Federal Reserve issues FOMC statement', detail: 'Monetary Policy', url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary.htm', at: now - 7200e3 },
      { id: 'sec:tsla', kind: 'filing', source: 'SEC filing', sym: 'TSLA', form: '8-K', title: 'TSLA: new 8-K filing', detail: '8.01 Other Events', url: 'https://www.sec.gov/Archives/edgar/data/1318605/y-index.htm', at: now - 9000e3 },
    ],
  };
  const r = await fetch(`${BASE}/markets/officialNews`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(official).map(([k, v]) => [k, enc(v)])) }),
  });
  if (!r.ok) throw new Error(`seeding markets/officialNews failed: ${r.status}`);
}
