// npm run test:e2e [-- playwright args]: start the Auth + Firestore emulators (fake
// demo-zelos project, config in ../firebase.rules-test.json), run Playwright inside them,
// stop them. Any extra arguments go to Playwright (e.g. a spec file or --project=phone).
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webapp = resolve(here, '..');
const quote = (a) => `'${String(a).replace(/'/g, `'\\''`)}'`;
const inner = `cd ${quote(webapp)} && npx playwright test ${process.argv.slice(2).map(quote).join(' ')}`;
const firebase = resolve(webapp, 'node_modules/.bin/firebase');
const r = spawnSync(firebase, ['emulators:exec', '--project', 'demo-zelos', '--config', 'firebase.rules-test.json', '--only', 'auth,firestore', inner], { cwd: resolve(webapp, '..'), stdio: 'inherit' });
process.exit(r.status ?? 1);
