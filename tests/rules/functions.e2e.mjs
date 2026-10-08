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
await admin('practiceProfiles/' + u.uid, { name: { stringValue: 'Del' }, equity: { integerValue: '10000' } });
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

// --- practice account (server-side)
await signOut(auth);
await admin('markets/quotes', { quotes: { mapValue: { fields: { AAPL: { mapValue: { fields: { c: { doubleValue: 100 }, t: { integerValue: String(Math.floor(Date.now() / 1000)) } } } } } } } });
const p = (await createUserWithEmailAndPassword(auth, 'trader@example.com', 'secret123')).user;
// an old browser-written account to archive
await setDoc(doc(db, 'users', p.uid), { xp: 0, practice: { cash: 999999, summary: { equity: 999999 }, trades: [{ sym: 'AAPL', pnl: 5, qty: 1 }, 'junk'] } });
r = await call('practice_account', {});
ok(r.created, 'practice account opened');
r = await call('practice_account', {});
ok(!r.created, 'opening again changes nothing');
const acct = (await getDoc(doc(db, 'practiceAccounts', p.uid))).data();
ok(acct.cash === 10000 && acct.openOrders === 0, 'fresh $10,000, whatever the old browser account said');
const arc = (await getDoc(doc(db, 'practiceArchive', p.uid))).data();
ok(arc && arc.verified === false && arc.equity === 999999 && arc.trades.length === 1, 'old account archived read-only and marked unverified');
const prof = await adminGet('practiceProfiles/' + p.uid);
ok(prof && Number(prof.fields.equity.integerValue ?? prof.fields.equity.doubleValue) === 10000 && prof.fields.source.stringValue === 'server', 'public profile written by the server');
const bad = async (data, re, msg) => { let e = null; try { await call('practice_order', data); } catch (x) { e = x; } ok(e && re.test(e.message), msg); };
await bad({ sym: 'ZZZZ', side: 'buy', qty: 1 }, /stock list/, 'unknown symbol refused');
await bad({ sym: 'AAPL', side: 'buy', qty: 101 }, /buying power/, 'more than the cash refused (price comes from the server)');
await bad({ sym: 'AAPL', side: 'sell', qty: 1 }, /don't own/, 'no shorting');
await bad({ sym: 'AAPL', side: 'buy', qty: 1, bracket: { sl: 120 } }, /below the entry/, 'bad stop-loss refused');
r = await call('practice_order', { sym: 'AAPL', side: 'buy', qty: 10, type: 'limit', limit: 95, tif: 'gtc', bracket: { sl: 90, tp: 110 }, price: 1 });
ok(r.order && r.order.limit === 95 && r.order.qty === 10 && !('price' in r.order), 'limit order with bracket accepted; extra fields ignored');
let a2 = (await getDoc(doc(db, 'practiceAccounts', p.uid))).data();
ok(a2.openOrders === 1 && a2.cash === 10000, 'order is open; cash untouched until it fills');
let blocked = 0;
try { await updateDoc(doc(db, 'practiceAccounts', p.uid), { cash: 1e9 }); } catch (e) { blocked = 1; }
ok(blocked, 'browser cannot change the practice account');
r = await call('practice_cancel', { orderId: r.order.id });
a2 = (await getDoc(doc(db, 'practiceAccounts', p.uid))).data();
ok(r.cancelled && a2.openOrders === 0, 'order cancelled');
let e2 = null; try { await call('practice_reset', {}); } catch (x) { e2 = x; } ok(e2 && /below/.test(e2.message), 'reset only below $2,500');
await call('practice_settings', { publicProfile: false });
ok(!(await adminGet('practiceProfiles/' + p.uid)), 'hiding stats removes the public profile');
await call('practice_settings', { publicProfile: true });
ok(!!(await adminGet('practiceProfiles/' + p.uid)), 'showing stats brings it back');
await signOut(auth);
await signInAnonymously(auth);
let e3 = null; try { await call('practice_account', {}); } catch (x) { e3 = x; } ok(e3 && /account/.test(e3.message), 'guests must create an account first');


// --- practice: an old browser account with odd data still opens cleanly
await signOut(auth);
const odd = (await createUserWithEmailAndPassword(auth, 'odd@example.com', 'secret123')).user;
await setDoc(doc(db, 'users', odd.uid), { xp: 0, practice: { cash: 'lots', trades: 7, summary: 'x' } });
r = await call('practice_account', {});
ok(r.created === true, 'odd classic practice data does not stop opening the account');

// --- Zelos News: only admins post; anyone reads
await signOut(auth);
const nw = (await createUserWithEmailAndPassword(auth, 'news@example.com', 'secret123')).user;
r = await call('news_can_post', {});
ok(r.admin === false, 'regular account cannot post news');
let ne = null; try { await call('news_save', { section: 'zelos', title: 'x', body: 'y' }); } catch (x) { ne = x; }
ok(ne && /Zelos team/.test(ne.message), 'news_save refused for non-admins');
await admin('admins/' + nw.uid, { since: { integerValue: 1 } });
ok((await call('news_can_post', {})).admin === true, 'admin can post');
const post = await call('news_save', { section: 'zelos', title: 'Big update', body: 'Para one.\n\nPara two.', featured: true, link: { to: '/trade-war', label: 'Go' } });
let nd = (await getDoc(doc(db, 'news', post.id))).data();
ok(nd.title === 'Big update' && nd.body.length === 2 && nd.featured && nd.link.to === '/trade-war' && nd.by === nw.uid, 'post saved with paragraphs and link');
await call('news_save', { id: post.id, section: 'zelos', title: 'Big update', body: 'Para one.' });
nd = (await getDoc(doc(db, 'news', post.id))).data();
ok(!nd.link && !nd.featured && nd.body.length === 1, 'edit removes the link and featured flag');
ne = null; try { await call('news_save', { section: 'voices', title: 'Fed', voice: { platform: 'x', url: 'https://evil.com/1', author: 'A', quote: 'q' } }); } catch (x) { ne = x; }
ok(ne && /x\.com/.test(ne.message), 'voice post needs a real x.com link');
const v = await call('news_save', { section: 'voices', title: 'Rates', voice: { platform: 'x', url: 'https://x.com/federalreserve/status/1', author: 'Federal Reserve', quote: 'Rates unchanged.' } });
const f2 = await call('news_save', { section: 'market', title: 'Second featured', body: 'b', featured: true });
const f1 = await call('news_save', { section: 'market', title: 'Third featured', body: 'b', featured: true });
ok(!(await getDoc(doc(db, 'news', f2.id))).data().featured && (await getDoc(doc(db, 'news', f1.id))).data().featured, 'only one post is featured at a time');
await signOut(auth);
ok((await getDoc(doc(db, 'news', v.id))).data().voice.author === 'Federal Reserve', 'signed-out visitors can read news');
let nwrite = 0; try { await setDoc(doc(db, 'news', 'fake1'), { title: 'x' }); } catch (x) { nwrite = 1; }
ok(nwrite, 'browsers cannot write news directly');
await signInAnonymously(auth);
ne = null; try { await call('news_delete', { id: v.id }); } catch (x) { ne = x; }
ok(ne, 'guests cannot delete news');

console.log(`\n${pass} end-to-end checks passed`);
process.exit(0);
