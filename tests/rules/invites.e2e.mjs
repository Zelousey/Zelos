// End-to-end tests for invites and referrals (functions/main.py invite_* / referral_claim)
// on the Auth + Firestore + Functions emulators (fake "demo-zelos" project).
// Started by run-functions-e2e.sh.
import assert from 'assert';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const P = 'demo-zelos';
const app = initializeApp({ apiKey: 'demo', projectId: P, authDomain: P + '.firebaseapp.com' }, 'invites');
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
const fns = getFunctions(app); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
const fails = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(e.message || e.code) : true; } };
const admin = (path, fields) => fetch(`http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents/${path}`, {
  method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
const adminGet = (path) => fetch(`http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.status === 200 ? r.json() : null);
const S = (v) => ({ stringValue: v });
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok   ' + m); };
const inbox = async (uid) => (await getDocs(query(collection(db, 'users', uid, 'inbox'), orderBy('at', 'desc')))).docs.map((d) => d.data());
const xpOf = async (uid) => Number((await adminGet('users/' + uid))?.fields?.xp?.integerValue ?? 0);
const t0 = Date.now();

// guests can't invite
await signInAnonymously(auth);
ok(await fails(() => call('invite_create', { kind: 'join' }), /account/), 'guests are asked to make an account first');
await signOut(auth);

// host
const A = (await createUserWithEmailAndPassword(auth, `host${t0}@example.com`, 'secret123')).user;
await admin('traders/' + A.uid, { name: S('Ada'), username: S('ada_' + (t0 % 1e6)) });
const war = await call('tw_create', { name: 'Friday Showdown', buyIn: 1000, days: 1, maxPlayers: 4 });
const battle = await call('invite_create', { kind: 'battle', warId: war.warId });
ok(/^[A-Za-z0-9]{10}$/.test(battle.code) && battle.url.endsWith('/app/i/' + battle.code), 'battle invite link: ' + battle.url);
const j1 = await call('invite_create', { kind: 'join' });
const j2 = await call('invite_create', { kind: 'join' });
ok(j2.code === j1.code && j2.reused, 'one reusable "join Zelos" link per person');
await admin('squads/sqInv1', { name: S('Night Owls'), owner: S(A.uid), members: { arrayValue: { values: [S(A.uid)] } } });
const squad = await call('invite_create', { kind: 'squad', squadId: 'sqInv1' });
ok(await fails(() => call('invite_create', { kind: 'squad', squadId: 'notMySquad1' }), /doesn't exist|squad you're in/), "can't invite to a squad you're not in");
ok(await fails(() => call('invite_create', { kind: 'prank' }), /Battle, Team up/), 'unknown invite kinds refused');
ok(await fails(() => call('invite_accept', { code: battle.code }), /your own invite/), "can't accept your own invite");
ok(await fails(() => setDoc(doc(db, 'invites', 'Fake123456'), { kind: 'join', from: A.uid, status: 'open' })), 'browsers cannot write invites');
await signOut(auth);

// anyone can preview an invite by its code (the link page, before sign-in)
const pre = await getDoc(doc(db, 'invites', battle.code));
ok(pre.exists() && pre.data().fromName === 'Ada' && pre.data().warName === 'Friday Showdown' && pre.data().buyIn === 1000, 'signed-out preview shows who invited you to what');

// a new player gets the battle invite in their bell, then accepts
const B = (await createUserWithEmailAndPassword(auth, `bee${t0}@example.com`, 'secret123')).user;
const bName = 'bee_' + (t0 % 1e6);
await admin('usernames/' + bName, { uid: S(B.uid) });
await admin('traders/' + B.uid, { name: S('Bee'), username: S(bName) });
ok(await fails(() => setDoc(doc(db, 'referrals', B.uid), { referrer: A.uid, createdAt: Date.now() })), 'browsers cannot write referrals any more');
await signOut(auth);
await signInWithEmail(`host${t0}@example.com`);
ok((await call('invite_send', { code: battle.code, to: '@' + bName })).sent, 'invite sent to @username');
ok((await call('invite_send', { code: battle.code, to: bName })).already, 'sending the same invite twice is a no-op');
ok(await fails(() => call('invite_send', { code: battle.code, to: 'nobody_here_x' }), /Nobody on Zelos/), 'unknown username explained');
await signOut(auth);
await signInWithEmail(`bee${t0}@example.com`);
const bell = (await inbox(B.uid)).find((n) => n.action?.type === 'invite');
ok(bell && bell.action.code === battle.code && bell.action.kind === 'battle' && /Ada invited you to a Trade War/.test(bell.title), 'the bell item carries an Accept action');
let r = await call('invite_accept', { code: battle.code });
ok(r.kind === 'battle' && r.warId === war.warId && r.referral && r.xp === 50, 'accept: joined the battle, referral recorded, +50 XP');
const w = await adminGet('tradeWars/' + war.warId);
ok(w.fields.players.arrayValue.values.map((v) => v.stringValue).includes(B.uid), 'the new player is in the Trade War lobby');
const ref = await adminGet('referrals/' + B.uid);
ok(ref && ref.fields.referrer.stringValue === A.uid && ref.fields.via.stringValue === battle.code, 'referrals/{new player} names the inviter (server-written)');
ok((await xpOf(B.uid)) === 50 && (await xpOf(A.uid)) === 50, 'both sides got the referral XP from the server');
r = await call('invite_accept', { code: battle.code });
ok(r.again && !r.referral && (await xpOf(A.uid)) === 50, 'accepting again pays nothing twice');
const bUser = await adminGet('users/' + B.uid);
ok(bUser.fields.friends.arrayValue.values.some((v) => v.stringValue === A.uid), 'inviter and new player are friends');
await signOut(auth);

// squad invite: joins right away, the owner is told; the classic ?ref= path is server-side too
const C = (await createUserWithEmailAndPassword(auth, `cee${t0}@example.com`, 'secret123')).user;
r = await call('invite_accept', { code: squad.code });
ok(r.kind === 'squad' && r.squadId === 'sqInv1' && r.referral, 'squad invite: joined, referral recorded');
const sq = await adminGet('squads/sqInv1');
ok(sq.fields.members.arrayValue.values.map((v) => v.stringValue).includes(C.uid), 'new member added by the server');
r = await call('referral_claim', { ref: A.uid });
ok(!r.recorded, 'a referral is recorded only once');
await signOut(auth);
const D = (await createUserWithEmailAndPassword(auth, `dee${t0}@example.com`, 'secret123')).user;
r = await call('referral_claim', { ref: A.uid });
ok(r.recorded && (await xpOf(D.uid)) === 50, "the website's ?ref= link records the referral on the server");
await signOut(auth);
await signInWithEmail(`host${t0}@example.com`);
const aBell = await inbox(A.uid);
ok(aBell.some((n) => /joined Night Owls/.test(n.title)), 'squad owner told someone joined');
ok(aBell.filter((n) => /joined Zelos from your invite/.test(n.title)).length === 3, 'inviter told each time a friend joined Zelos (3)');

// cancelling a link stops it
await call('invite_cancel', { code: squad.code });
await signOut(auth);
await createUserWithEmailAndPassword(auth, `eee${t0}@example.com`, 'secret123');
ok(await fails(() => call('invite_accept', { code: squad.code }), /cancelled/), 'a cancelled invite says so');
ok(await fails(() => call('invite_accept', { code: 'nope/../x' }), /isn't valid/), 'bad codes refused');
await signOut(auth);

// Trade War challenges now put Accept / Decline in the bell
await signInWithEmail(`host${t0}@example.com`);
await call('tw_challenge', { to: B.uid, buyIn: 1000, days: 1, name: 'Duel' });
await signOut(auth);
await signInWithEmail(`bee${t0}@example.com`);
const ch = (await inbox(B.uid)).find((n) => n.action?.type === 'tw');
ok(ch && /^[A-Za-z0-9]{20}$/.test(ch.action.id), 'challenge notification carries its twInvite id');
r = await call('tw_respond', { inviteId: ch.action.id, accept: false });
ok(r.status === 'declined', 'declining from the bell works');
await signOut(auth);

console.log('\n%d invite checks passed', pass);

async function signInWithEmail(email) {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  await signInWithEmailAndPassword(auth, email, 'secret123');
}
