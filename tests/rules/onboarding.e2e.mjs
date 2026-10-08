// End-to-end tests for the app's first sign-in (functions/main.py profile_setup) on the
// Auth + Firestore + Functions emulators. Started by run-functions-e2e.sh.
import assert from 'assert';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const P = 'demo-zelos';
const app = initializeApp({ apiKey: 'demo', projectId: P, authDomain: P + '.firebaseapp.com' }, 'onboarding');
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
const fns = getFunctions(app); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
const fails = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(e.message || e.code) : true; } };
const BASE = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const adminGet = (path) => fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => (r.status === 200 ? r.json() : null));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok   ' + m); };
const t0 = Date.now();
const u1 = `ob${String(t0).slice(-8)}`;

const A = (await createUserWithEmailAndPassword(auth, `ob-a${t0}@example.com`, 'secret123')).user;
const r = await call('profile_setup', { name: '  Ada  ', username: '@' + u1.toUpperCase(), experience: 'new' });
ok(r.name === 'Ada' && r.username === u1 && r.awarded && r.xp === 25, 'name and @username saved, +25 XP');
ok((await getDoc(doc(db, 'usernames', u1))).data()?.uid === A.uid, '@username reserved for them');
const tr = (await getDoc(doc(db, 'traders', A.uid))).data();
ok(tr.name === 'Ada' && tr.username === u1, 'public profile has the name and @username');
const ud = (await adminGet('users/' + A.uid)).fields;
ok(ud.experience.stringValue === 'new' && ud.onboard.mapValue.fields.profile.booleanValue === true, 'experience and the checklist step saved');
const again = await call('profile_setup', { name: 'Ada L', username: u1 });
ok(!again.awarded && again.name === 'Ada L', 'saving again: no second XP');

// someone else can't take it; reserved and bad names are refused
await signOut(auth);
const B = (await createUserWithEmailAndPassword(auth, `ob-b${t0}@example.com`, 'secret123')).user;
ok(await fails(() => call('profile_setup', { name: 'Bo', username: u1 }), /taken/), '@username already taken');
ok(await fails(() => call('profile_setup', { name: 'Bo', username: 'admin' }), /reserved/), 'reserved @username refused');
ok(await fails(() => call('profile_setup', { name: 'Bo', username: 'b o' }), /3–20/), 'bad @username refused');
ok(await fails(() => call('profile_setup', { name: 'Bo', username: 'bo' + u1, experience: 'god' }), /New, Some/), 'unknown experience refused');
ok(!(await getDoc(doc(db, 'traders', B.uid))).exists(), 'nothing saved on a refusal');

// changing @username releases the old one
await signOut(auth);
await signInWithEmailAndPassword(auth, `ob-a${t0}@example.com`, 'secret123');
await call('profile_setup', { name: 'Ada', username: u1 + 'x' });
ok(!(await getDoc(doc(db, 'usernames', u1))).exists() && (await getDoc(doc(db, 'usernames', u1 + 'x'))).data()?.uid === A.uid, 'new @username taken, old one released');

// making an invite ticks "Invite a friend"
await call('invite_create', { kind: 'join' });
ok((await adminGet('users/' + A.uid)).fields.onboard.mapValue.fields.invited.booleanValue === true, 'making an invite ticks Invite a friend');

// guests can't
await signOut(auth);
ok(await fails(() => call('profile_setup', { name: 'X', username: 'xxx_' + u1 }), /Sign in|account/i), 'signed-out people are refused');
console.log(`${pass} onboarding checks passed`);
process.exit(0);
