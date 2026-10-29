// End-to-end tests for xp_award and account_delete on the Auth + Firestore + Functions
// emulators (fake "demo-zelos" project). Run from tests/rules: npm run test:functions
// (needs functions/venv: python3.12 -m venv functions/venv && functions/venv/bin/pip install -r functions/requirements.txt)
import assert from 'assert';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, getDocs, query, collection, where } from 'firebase/firestore';
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
r = await call('xp_award', { type: 'lesson', refId: 'rsi' });
ok(!r.awarded && r.reason === 'locked', 'a Chapter 2 lesson pays nothing until Chapter 1 is passed');
r = await call('xp_award', { type: 'mission', refId: `d:${nyDay()}:xp`, amount: 300 });
ok(!r.awarded && r.reason === 'server-counted', 'browsers can no longer claim mission XP (the server counts missions)');
// opening charts counts toward "Analyze 3 stocks", each stock once a day; the server pays the mission
for (const sym of ['AAPL', 'AAPL', 'MSFT']) await call('mission_event', { ev: 'analyze', ref: sym });
ok(!(await call('mission_event', { ev: 'analyze', ref: 'NOTREAL' })).counted, 'a symbol outside the Zelos list does not count');
ok(!(await call('mission_event', { ev: 'trade' })).counted, 'browsers cannot report trades');
let me = (await getDoc(doc(db, 'users', g.uid))).data();
ok(me.missions.day.counts.analyze === 2 && !me.missions.day.done?.analyze && me.xp === 8, 'two different stocks so far, nothing paid yet');
await call('mission_event', { ev: 'analyze', ref: 'NVDA' });
me = (await getDoc(doc(db, 'users', g.uid))).data();
ok(me.missions.day.done.analyze === true && me.xp === 18, 'third stock: "Analyze 3 stocks" done, +10 XP from the server');
await call('mission_event', { ev: 'news', ref: 'fed:fomc' });
me = (await getDoc(doc(db, 'users', g.uid))).data();
ok(me.missions.day.done.news === true && me.xp === 23 && me.missions.streak.days === 1, 'news read: +5 XP and two missions keep the streak');
let mfail = 0; try { await updateDoc(doc(db, 'users', g.uid), { 'missions.day.done.grade': true }); } catch (e) { mfail = 1; }
ok(mfail, 'browsers cannot write mission progress');
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

// --- Help & feedback: signed-in players send (5 a day); only admins read; account deletion removes them
await signOut(auth);
await signInAnonymously(auth);
let fe = null; try { await call('feedback_send', { topic: 'idea', text: 'Guest idea here' }); } catch (x) { fe = x; }
ok(fe && /Sign in/.test(fe.message), 'guests cannot send feedback');
await signOut(auth);
const fbu = (await createUserWithEmailAndPassword(auth, `fb${Date.now()}@example.com`, 'secret123')).user;
fe = null; try { await call('feedback_send', { topic: 'idea', text: 'hi' }); } catch (x) { fe = x; }
ok(fe && /a little more/.test(fe.message), 'too-short feedback refused');
for (let i = 0; i < 5; i++) ok((await call('feedback_send', { topic: 'idea', text: `Idea number ${i + 1} for Zelos`, page: '/help' })).sent === true, `feedback ${i + 1} sent`);
fe = null; try { await call('feedback_send', { topic: 'idea', text: 'One more idea please' }); } catch (x) { fe = x; }
ok(fe && /Try again tomorrow/.test(fe.message), 'sixth message the same day refused');
fe = null; try { await call('feedback_list', {}); } catch (x) { fe = x; }
ok(fe && /Zelos team/.test(fe.message), 'players cannot read feedback');
let fread = 0; try { await getDocs(query(collection(db, 'feedback'), where('uid', '==', fbu.uid))); } catch (x) { fread = 1; }
ok(fread, 'browsers cannot read feedback directly');
await admin('admins/' + fbu.uid, { since: { integerValue: 1 } });
const fl = await call('feedback_list', {});
const mine = fl.items.filter((x) => x.text.startsWith('Idea number'));
ok(mine.length === 5 && mine[0].status === 'new' && mine[0].page === '/help' && mine[0].topic === 'idea', 'admin lists the messages, newest first');
ok((await call('feedback_mark', { id: mine[0].id, status: 'done' })).ok === true, 'admin marks one done');
ok((await call('feedback_list', {})).items.find((x) => x.id === mine[0].id).status === 'done', 'done shows in the list');

// --- safety (App Store 1.2): chat filter, report, block
await signOut(auth);
const troll = (await createUserWithEmailAndPassword(auth, `troll${Date.now()}@example.com`, 'secret123')).user;
await signOut(auth);
const rep = (await createUserWithEmailAndPassword(auth, `rep${Date.now()}@example.com`, 'secret123')).user;
const str = (x) => ({ stringValue: x });
await admin('squads/sqSafe1', { owner: str(troll.uid), name: str('Safe squad'), members: { arrayValue: { values: [str(troll.uid), str(rep.uid)] } } });
await admin('squads/sqSafe1/messages/m1', { author: str(troll.uid), name: str('Bad'), text: str('you are a b1tch, sell') });
let masked = null;
for (let i = 0; i < 40 && !masked; i++) {
  const m = await adminGet('squads/sqSafe1/messages/m1');
  if (m?.fields?.filtered) masked = m.fields.text.stringValue;
  else await new Promise((res) => setTimeout(res, 250));
}
ok(masked === 'you are a ****** sell', `the chat filter masks blocked words (${masked})`);
ok((await call('report_content', { kind: 'chat', target: troll.uid, where: 'sqSafe1/m1', reason: 'harassment', note: 'rude' })).ok, 'a chat message can be reported');
const reports = await fetch(`http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents/reports`, { headers: { Authorization: 'Bearer owner' } }).then((x) => x.json());
const saved = (reports.documents || []).map((d) => d.fields).find((f) => f.reporter.stringValue === rep.uid);
ok(saved && saved.content.mapValue.fields.text.stringValue === 'you are a ****** sell' && saved.status.stringValue === 'open', 'the report keeps a copy of the message');
let re1 = null; try { await call('report_content', { kind: 'chat', target: rep.uid, where: 'sqSafe1/m1', reason: 'spam' }); } catch (x) { re1 = x; }
ok(re1, 'reporting someone as the author of a message they did not write is refused');
re1 = null; try { await call('report_content', { kind: 'profile', target: rep.uid, reason: 'spam' }); } catch (x) { re1 = x; }
ok(re1 && /yourself/.test(re1.message), 'you cannot report yourself');
await setDoc(doc(db, 'users', rep.uid), { blocked: [troll.uid] }, { merge: true });
await signOut(auth);
await signInWithEmailAndPassword(auth, troll.email, 'secret123');
re1 = null; try { await call('tw_challenge', { to: rep.uid, buyIn: 1000, days: 1, name: 'Duel' }); } catch (x) { re1 = x; }
ok(re1 && /Chapter 1 quiz/.test(re1.message), 'challenges stay locked until Trading 101 Chapter 1 is passed');
await fetch(`http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents/users/${troll.uid}?updateMask.fieldPaths=learnPassed`, {
  method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { learnPassed: { mapValue: { fields: { basics: { integerValue: '1' } } } } } }) });
re1 = null; try { await call('tw_challenge', { to: rep.uid, buyIn: 1000, days: 1, name: 'Duel' }); } catch (x) { re1 = x; }
ok(re1 && /can.t challenge/.test(re1.message), 'someone you blocked cannot challenge you');

// --- Hall of Minds: lessons pay 10 XP once; daily quotes cost 15 tokens for 30 days
r = await call('xp_award', { type: 'mind', refId: 'livermore:sit' });
ok(r.awarded, 'a Hall of Minds lesson pays XP');
r = await call('xp_award', { type: 'mind', refId: 'livermore:sit' });
ok(!r.awarded, 'but only once');
// scroll lessons (owner 2026-10-23) pay 2 XP a task instead, once each
r = await call('xp_award', { type: 'mind-step', refId: 'napoleon:speed:march' });
ok(r.awarded && r.xp - r.before === 2, 'a scroll-lesson step pays 2 XP');
r = await call('xp_award', { type: 'mind-step', refId: 'napoleon:speed:march' });
ok(!r.awarded, 'once');
r = await call('xp_award', { type: 'mind', refId: 'napoleon:speed' });
ok(!r.awarded, 'and the scroll lesson itself is not paid again at the end');
await admin('wallets/' + troll.uid, { balance: { integerValue: 20 } });
r = await call('minds_follow', { figure: 'napoleon' });
ok(r.charged === 15 && r.balance === 5 && r.mindQuotes.napoleon > Date.now() + 29 * 864e5, 'daily quotes from Napoleon: 15 tokens for 30 days');
re1 = null; try { await call('minds_follow', { figure: 'napoleon' }); } catch (x) { re1 = x; }
ok(re1 && /need 15 tokens and have 5/.test(re1.message), 'not enough tokens is refused with the numbers');
re1 = null; try { await call('minds_follow', { figure: 'elon' }); } catch (x) { re1 = x; }
ok(re1 && /isn.t in the Hall of Minds/.test(re1.message), 'only figures in the Hall can be followed');

// --- Training Ground hints: 3 tokens, only in Where's the Stop? and Grade the Setup
await admin('wallets/' + troll.uid, { balance: { integerValue: 4 } });
r = await call('drill_hint', { drill: 'stop-drill' });
ok(r.charged === 3 && r.balance === 1, 'a drill hint costs 3 tokens');
re1 = null; try { await call('drill_hint', { drill: 'grade-the-setup' }); } catch (x) { re1 = x; }
ok(re1 && /need 3 tokens and have 1/.test(re1.message), 'not enough tokens for a hint');
re1 = null; try { await call('drill_hint', { drill: 'daily-challenge' }); } catch (x) { re1 = x; }
ok(re1 && /aren.t available in this drill/.test(re1.message), 'no hints in the Daily Challenge');
// --- XP booster: 25 tokens, double XP from lessons for 24 hours
await admin('wallets/' + troll.uid, { balance: { integerValue: 30 } });
r = await call('xp_boost', {});
ok(r.charged === 25 && r.balance === 5 && r.xpBoostUntil > Date.now() + 23 * 36e5, 'XP booster: 25 tokens for 24 hours');
r = await call('xp_award', { type: 'mind', refId: 'edison:work' });
ok(r.awarded && r.xp - r.before === 20, 'a lesson pays double while it runs');
r = await call('xp_award', { type: 'daily-checkin', refId: nyDay() });
ok(!r.awarded || r.xp - r.before === 3, 'the daily check-in is not doubled');
re1 = null; try { await call('xp_boost', {}); } catch (x) { re1 = x; }
ok(re1 && /need 25 tokens and have 5/.test(re1.message), 'not enough tokens for another booster');
// --- Last Man Standing revive: 20 tokens, once, back with the money you had
const fv = (x) => x === null ? { nullValue: null } : typeof x === 'string' ? { stringValue: x } : typeof x === 'boolean' ? { booleanValue: x }
  : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x })
  : Array.isArray(x) ? { arrayValue: { values: x.map(fv) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, fv(y)])) } };
const seed = (path, o) => admin(path, Object.fromEntries(Object.entries(o).map(([k, y]) => [k, fv(y)])));
const lmsWar = 'revivewarxyz';
const others = ['rv1', 'rv2', 'rv3'];
await seed('tradeWars/' + lmsWar, {
  name: 'Revive night', host: 'rv1', status: 'active', players: [troll.uid, ...others], names: { [troll.uid]: 'Troll' },
  lms: { floorPct: 10, cutHours: 6 }, alive: others, outs: [{ uid: troll.uid, name: 'Troll', reason: 'floor', at: 1, pnlPct: -11, place: 4 }],
  endAt: Date.now() + 864e5, startAt: Date.now() - 36e5, buyIn: 1000, days: 1, maxPlayers: 4, rules: {}, modes: {},
});
await seed(`tradeWars/${lmsWar}/accounts/${troll.uid}`, { name: 'Troll', start: 1000, cash: 890, equity: 890, pnl: -110, pnlPct: -11, losses: 2, out: true, outReason: 'floor', place: 4 });
await admin('wallets/' + troll.uid, { balance: { integerValue: 19 } });
re1 = null; try { await call('tw_revive', { warId: lmsWar }); } catch (x) { re1 = x; }
ok(re1 && /need 20 tokens and have 19/.test(re1.message), 'a revive needs 20 tokens');
await admin('wallets/' + troll.uid, { balance: { integerValue: 45 } });
r = await call('tw_revive', { warId: lmsWar });
ok(r.charged === 20 && r.balance === 25, 'revive: 20 tokens');
const rw = (await getDoc(doc(db, 'tradeWars', lmsWar))).data();
const ra = (await getDoc(doc(db, 'tradeWars', lmsWar, 'accounts', troll.uid))).data();
ok(rw.alive.includes(troll.uid) && rw.outs.length === 0 && rw.reviveSafe.includes(troll.uid), 'back among the traders still standing, safe from the next cut');
ok(ra.out === false && ra.equity === 890 && ra.reviveBase === 890 && ra.start === 1000, 'with the money they had; rankings still count from the start');
re1 = null; try { await call('tw_revive', { warId: lmsWar }); } catch (x) { re1 = x; }
ok(re1 && /still in this battle/.test(re1.message), 'cannot revive while still in');

// --- Battle slots: 3 open battles free (the revive battle is one), 15 tokens for each one past that
const mk = (extra) => call('tw_create', { name: 'Slot test', buyIn: 1000, days: 1, maxPlayers: 4, ...(extra ? { extraSlot: true } : {}) });
r = await mk(); ok(r.warId && r.charged === 0, 'a 2nd open battle is free');
const slot2 = r.warId;
r = await mk(); ok(r.warId && r.charged === 0, 'a 3rd open battle is free');
re1 = null; try { await mk(); } catch (x) { re1 = x; }
ok(re1 && /3 open battles/.test(re1.message) && re1.details?.reason === 'battle-slot' && re1.details?.cost === 15, 'a 4th asks first, with the price for the app');
r = await mk(true);
ok(r.charged === 15 && (await adminGet('wallets/' + troll.uid)).fields.balance.integerValue === '10', 'and costs 15 tokens once you say yes');
const slotWar = 'slotlobbyxyz';
await seed('tradeWars/' + slotWar, { name: 'Open lobby', host: 'rv1', status: 'lobby', players: ['rv1'], names: { rv1: 'Rv' }, buyIn: 1000, days: 1, maxPlayers: 4, rules: {}, modes: {} });
re1 = null; try { await call('tw_join', { warId: slotWar }); } catch (x) { re1 = x; }
ok(re1 && re1.details?.reason === 'battle-slot', 'joining a 5th asks too');
re1 = null; try { await call('tw_join', { warId: slotWar, extraSlot: true }); } catch (x) { re1 = x; }
ok(re1 && /need 15 tokens and have 10/.test(re1.message), 'and needs the tokens');
ok(!(await getDoc(doc(db, 'tradeWars', slotWar))).data().players.includes(troll.uid), 'a refused join leaves the lobby as it was');
for (const w of [lmsWar, slot2]) await admin(`tradeWars/${w}?updateMask.fieldPaths=status`, { status: { stringValue: w === lmsWar ? 'ended' : 'cancelled' } });
r = await call('tw_join', { warId: slotWar });
ok(r.charged === 0 && (await getDoc(doc(db, 'tradeWars', slotWar))).data().players.includes(troll.uid), 'finished and cancelled battles free their slots');

// --- Rematch (Phase 9, F19 / S8): challenge the same opponents again with edited settings; one per player, old battle untouched
const oldWar = 'rematchold12';
const foe = 'rematchFoe0001';
await seed('tradeWars/' + oldWar, { name: 'Old fight', host: troll.uid, status: 'ended', players: [troll.uid, foe], names: { [troll.uid]: 'Troll', [foe]: 'Foe' }, buyIn: 1000, days: 1, maxPlayers: 2, rules: {}, modes: {}, results: [] });
const oldBefore = JSON.stringify((await adminGet('tradeWars/' + oldWar)).fields);
await admin('wallets/' + troll.uid, { balance: { integerValue: 30 } });
const ask = { warId: oldWar, name: 'Old fight rematch', buyIn: 1000, days: 3, lms: { floorPct: 10 }, extraSlot: true };
const [rm1, rm2] = await Promise.all([call('tw_rematch', ask), call('tw_rematch', ask)]);
ok(rm1.warId && rm1.warId === rm2.warId && [rm1.again, rm2.again].filter(Boolean).length === 1, 'a double tap makes one rematch');
const rmw = (await getDoc(doc(db, 'tradeWars', rm1.warId))).data();
ok(rmw.status === 'lobby' && rmw.rematchOf === oldWar && rmw.invited.join() === foe && rmw.days === 3 && rmw.lms.floorPct === 10 && rmw.name === 'Old fight rematch', 'it is a new match challenging the same opponent, with the edited settings');
ok(JSON.stringify((await adminGet('tradeWars/' + oldWar)).fields) === oldBefore, 'the old battle is untouched');
ok((await getDoc(doc(db, 'tradeWars', oldWar, 'rematches', troll.uid))).data().warId === rm1.warId, 'the room can find your rematch');
r = await call('tw_rematch', ask);
ok(r.again && r.warId === rm1.warId && r.charged === 0, 'asking again opens the same rematch and charges nothing');
re1 = null; try { await call('tw_rematch', { ...ask, warId: slotWar }); } catch (x) { re1 = x; }
ok(re1 && /once this battle has ended/.test(re1.message), 'no rematch before a battle ends');
await seed('tradeWars/rematchnot12', { name: 'Not mine', host: foe, status: 'ended', players: [foe, 'rematchFoe0002'], buyIn: 1000, days: 1, maxPlayers: 2, rules: {}, modes: {} });
re1 = null; try { await call('tw_rematch', { ...ask, warId: 'rematchnot12' }); } catch (x) { re1 = x; }
ok(re1 && /Only the players/.test(re1.message), 'only its players can ask for a rematch');

// --- Squad rulesets (Phase 10): a squad battle starts from Free-for-all or Fantasy Draft (pick timer 30/45/60 s)
const rsSquad = 'rulesquad123';
await seed('squads/' + rsSquad, { name: 'Rule desk', owner: troll.uid, members: [troll.uid, foe], names: { [troll.uid]: 'Troll', [foe]: 'Foe' }, config: {} });
await admin('wallets/' + troll.uid, { balance: { integerValue: 50 } });
r = await call('tw_challenge', { squadId: rsSquad, ruleset: 'draft', name: 'Draft night', buyIn: 1000, days: 3, modes: { draftPicks: 3, draftSecs: 30 }, extraSlot: true });
const rsw = (await getDoc(doc(db, 'tradeWars', r.warId))).data();
ok(rsw.ruleset === 'draft' && rsw.modes.draft.picks === 3 && rsw.modes.draft.secs === 30 && rsw.squadId === rsSquad, 'a Fantasy Draft squad battle keeps its ruleset and a 30-second pick timer');
r = await call('tw_challenge', { squadId: rsSquad, ruleset: 'ffa', name: 'Open night', buyIn: 1000, days: 3, extraSlot: true });
ok((await getDoc(doc(db, 'tradeWars', r.warId))).data().ruleset === 'ffa', 'and a Free-for-all one');
re1 = null; try { await call('tw_challenge', { squadId: rsSquad, ruleset: 'ffa', name: 'Mixed', buyIn: 1000, days: 3, modes: { draftPicks: 3 } }); } catch (x) { re1 = x; }
ok(re1 && /Free-for-all needs it off/.test(re1.message), 'a ruleset must agree with the settings');
await admin('wallets/' + troll.uid, { balance: { integerValue: 50 } });
r = await call('tw_challenge', { squadId: rsSquad, ruleset: 'lms', name: 'Last night', buyIn: 1000, days: 3, lms: { floorPct: 10 }, extraSlot: true });
const lmw = (await getDoc(doc(db, 'tradeWars', r.warId))).data();
ok(lmw.ruleset === 'lms' && lmw.lms.floorPct === 10, 'a squad Last Man Standing battle (rules checked at the market close)');
re1 = null; try { await call('tw_challenge', { squadId: rsSquad, ruleset: 'lms', name: 'No rules', buyIn: 1000, days: 3 }); } catch (x) { re1 = x; }
ok(re1 && /at least one elimination rule/.test(re1.message), 'squad Last Man Standing needs a rule');
re1 = null; try { await call('tw_challenge', { to: foe, ruleset: 'ffa', name: 'Duel', buyIn: 1000, days: 3 }); } catch (x) { re1 = x; }
ok(re1 && /for squad battles/.test(re1.message), 'rulesets are only for squad battles');

console.log(`\n${pass} end-to-end checks passed`);
process.exit(0);
