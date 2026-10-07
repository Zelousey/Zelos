// npm run test:e2e [-- playwright args]: start the Firebase emulators (fake demo-zelos
// project, config in ../firebase.rules-test.json), run Playwright inside them, stop them.
// Auth + Firestore always; the Python Cloud Functions too when functions/venv exists
// (CI creates it), so the practice-account flow runs against the real functions.
// Extra arguments go to Playwright (e.g. a spec file or --project=phone).
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webapp = resolve(here, '..');
const root = resolve(webapp, '..');
const quote = (a) => `'${String(a).replace(/'/g, `'\\''`)}'`;
const withFunctions = existsSync(join(root, 'functions/venv/bin/python'));
const env = { ...process.env, E2E_FUNCTIONS: withFunctions ? '1' : '0' };
const cleanup = [];

if (withFunctions) {
  // The Admin SDK wants a credential file even when everything goes to emulators: make a
  // throwaway one (random key, fake project) and dummy values for the declared secrets.
  const tmp = mkdtempSync(join(tmpdir(), 'zelos-e2e-'));
  cleanup.push(() => rmSync(tmp, { recursive: true, force: true }));
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  writeFileSync(join(tmp, 'sa.json'), JSON.stringify({ type: 'service_account', project_id: 'demo-zelos', private_key_id: 'x', private_key: privateKey, client_email: 'fake@demo-zelos.iam.gserviceaccount.com', client_id: '1', token_uri: 'https://oauth2.googleapis.com/token' }));
  env.GOOGLE_APPLICATION_CREDENTIALS = join(tmp, 'sa.json');
  const secretFile = join(root, 'functions/.secret.local');
  if (!existsSync(secretFile)) {
    const names = [...new Set([...readFileSync(join(root, 'functions/main.py'), 'utf8').matchAll(/secrets=\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1])))];
    writeFileSync(secretFile, names.map((n) => `${n}=dummy`).join('\n') + '\n');
    cleanup.push(() => rmSync(secretFile, { force: true }));
  }
}

const inner = `cd ${quote(webapp)} && npx playwright test ${process.argv.slice(2).map(quote).join(' ')}`;
const only = withFunctions ? 'auth,firestore,functions' : 'auth,firestore';
const r = spawnSync(resolve(webapp, 'node_modules/.bin/firebase'), ['emulators:exec', '--project', 'demo-zelos', '--config', 'firebase.rules-test.json', '--only', only, inner], { cwd: root, stdio: 'inherit', env });
cleanup.forEach((f) => f());
process.exit(r.status ?? 1);
