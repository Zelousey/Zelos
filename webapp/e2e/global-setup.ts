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
}
