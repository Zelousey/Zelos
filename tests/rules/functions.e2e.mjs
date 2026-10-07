// End-to-end tests for xp_award and account_delete on the Auth + Firestore + Functions
// emulators (fake "demo-zelos" project). Run from tests/rules: npm run test:functions
// (needs functions/venv: python3.12 -m venv functions/venv && functions/venv/bin/pip install -r functions/requirements.txt)
import assert from 'assert';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const P = 'demo-zelos';
const app = initializeApp({ apiKey: 'demo', projectId: P, authDomain: P + '.firebaseapp.com' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
const fns = getFunctions(app); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
const admin = (path, fields) => fetch(`http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents/${path}`, {
  method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
const adminGet = (path) => fetch(`http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.status === 200 ? r.json() : null);
const nyDay = (o = 0) => { const d = new Date(Date.now() + o * 864e5); return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); };

let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok   ' + m); };

await admin('alerts/swing-1', { t: { integerValue: 1 } });

// --- guest earns XP through the server
const g = (await signInAnonymously(auth)).user;
let r = await call('xp_award', { type: 'daily-checkin', refId: nyDay() });
ok(r.awarded && r.xp === 3, 'guest daily check-in: +3 from the server');
r = await call('xp_award', { type: 'daily-checkin', refId: nyDay() });
ok(!r.awarded && r.xp === 3, 'same check-in twice: not paid again');
r = await call('xp_award', { type: 'alert-open', refId: 'swing-1' });
ok(r.awarded && r.xp === 8 && r.streakDays === 1, 'opening a real alert: +5 and streak starts');
r = await call('xp_award', { type: 'alert-open', refId: 'no-such-alert' });
ok(!r.awarded, 'opening a made-up alert pays nothing');
r = await call('xp_award', { type: 'mission', refId: `d:${nyDay()}:xp`, amount: 300 });
ok(r.awarded && r.xp === 28, 'mission amount comes from the server table (20), not the browser (300)');
r = await call('xp_award', { type: 'achievement', refId: 'free-money' });
ok(!r.awarded && r.reason === 'bad-ref', 'unknown achievement refused');
let fails = 0; try { await updateDoc(doc(db, 'users', g.uid), { xp: 99999 }); } catch (e) { fails = 1; }
ok(fails, 'browser write of xp is refused by the rules');
const act = await getDoc(doc(db, 'users', g.uid, 'activity', 'daily-checkin:' + nyDay()));
ok(act.exists() && act.data().xp === 3, 'activity ledger written by the server, readable by the owner');
for (let i = 1; i <= 10; i++) await call('xp_award', { type: 'practice-trade', refId: `${nyDay()}:${i}` });
r = await call('xp_award', { type: 'practice-trade', refId: `${nyDay()}:11` });
ok(!r.awarded, '11th practice trade of the day pays nothing');

// --- account deletion
await signOut(auth);
const u = (await createUserWithEmailAndPassword(auth, 'del@example.com', 'secret123')).user;
await setDoc(doc(db, 'users', u.uid), { xp: 0, watchlist: ['AAPL'] });
await call('xp_award', { type: 'daily-checkin' });
await setDoc(doc(db, 'practiceProfiles', u.uid), { name: 'Del', equity: 10000 });
await admin('wallets/' + u.uid, { balance: { integerValue: 7 } });
await admin('purchases/sq_1', { uid: { stringValue: u.uid } });
const arr = (...v) => ({ arrayValue: { values: v.map((x) => ({ stringValue: x })) } });
await admin('squads/s1', { owner: { stringValue: u.uid }, members: arr(u.uid, 'other'), names: { mapValue: { fields: { [u.uid]: { stringValue: 'Del' }, other: { stringValue: 'O' } } } } });
await admin('squads/s2', { owner: { stringValue: u.uid }, members: arr(u.uid), code: { stringValue: 'ABCDEF' } });
await admin('squadCodes/ABCDEF', { squad: { stringValue: 's2' } });
await admin('usernames/deluser', { uid: { stringValue: u.uid } });
let err = null; try { await call('account_delete', {}); } catch (e) { err = e; }
ok(err && /invalid-argument/.test(err.code), 'delete without confirmation refused');
r = await call('account_delete', { confirm: 'DELETE' });
ok(r.deleted, 'account_delete succeeds with a fresh sign-in');
ok(!(await adminGet('users/' + u.uid)), 'users doc gone');
ok(!(await adminGet('users/' + u.uid + '/activity/daily-checkin:' + nyDay())), 'activity gone');
ok(!(await adminGet('practiceProfiles/' + u.uid)), 'public practice profile gone');
ok(!(await adminGet('wallets/' + u.uid)), 'wallet gone');
ok(!!(await adminGet('purchases/sq_1')), 'purchase record kept');
const s1 = await adminGet('squads/s1');
ok(s1 && s1.fields.owner.stringValue === 'other' && s1.fields.members.arrayValue.values.length === 1 && !(u.uid in s1.fields.names.mapValue.fields), 'shared squad: left, ownership handed on');
ok(!(await adminGet('squads/s2')) && !(await adminGet('squadCodes/ABCDEF')), 'solo squad and its room code deleted');
ok(!(await adminGet('usernames/deluser')), 'username released');
const users = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${P}/accounts`, { headers: { Authorization: 'Bearer owner' } }).then((x) => x.json()).catch(() => null);
const lookup = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${P}/accounts:lookup`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: [u.uid] }) }).then((x) => x.json());
ok(!lookup.users, 'Firebase Auth user deleted');

console.log(`\n${pass} end-to-end checks passed`);
process.exit(0);
