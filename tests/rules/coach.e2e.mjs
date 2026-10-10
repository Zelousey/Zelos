// End-to-end tests for Coach / Learn (functions/main.py coach_*, invite kind "coach") on the
// Auth + Firestore + Functions emulators. Started by run-functions-e2e.sh.
import assert from 'assert';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const P = 'demo-zelos';
const app = initializeApp({ apiKey: 'demo', projectId: P, authDomain: P + '.firebaseapp.com' }, 'coach');
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
const fns = getFunctions(app); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
const fails = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(e.message || e.code) : true; } };
const BASE = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const admin = (path, fields) => fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
const adminGet = (path) => fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => (r.status === 200 ? r.json() : null));
const xpOf = async (uid) => Number((await adminGet('users/' + uid))?.fields?.xp?.integerValue ?? 0);
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok   ' + m); };
const t0 = Date.now();
const as = async (email) => { await signOut(auth); return (await signInWithEmailAndPassword(auth, email, 'secret123')).user; };

// a new coach can't coach yet; at 150 XP they can
const C = (await createUserWithEmailAndPassword(auth, `coach${t0}@example.com`, 'secret123')).user;
await admin('traders/' + C.uid, { name: { stringValue: 'Jordan' } });
await admin('users/' + C.uid, { xp: { integerValue: '40' } });
ok(await fails(() => call('invite_create', { kind: 'coach' }), /Level 3/), 'coaching unlocks at Level 3 (Gold)');
await admin('users/' + C.uid, { xp: { integerValue: '200' } });
const inv = await call('invite_create', { kind: 'coach' });
ok(/^[A-Za-z0-9]{10}$/.test(inv.code), 'Gold coach gets a coach link');
ok(await fails(() => call('xp_award', { type: 'coach-task', refId: 'trade:abcdef12' }).then((r) => { if (!r.awarded) throw new Error('refused'); }), /refused/), 'browsers cannot claim coaching XP');

// the student accepts
const S = (await createUserWithEmailAndPassword(auth, `student${t0}@example.com`, 'secret123')).user;
await admin('traders/' + S.uid, { name: { stringValue: 'Maya' } });
const acc = await call('invite_accept', { code: inv.code });
const cid = acc.coachingId;
ok(acc.kind === 'coach' && cid === `${C.uid}_${S.uid}`, 'accepting a coach invite starts coaching');
const cdoc = (await getDoc(doc(db, 'coachings', cid))).data();
ok(cdoc.status === 'active' && cdoc.coach === C.uid && cdoc.studentName === 'Maya' && cdoc.summary, 'the student can read their coaching');
ok(await fails(() => setDoc(doc(db, 'coachings', cid), { status: 'ended' })), 'browsers cannot write coachings');
ok(await fails(() => call('coach_task', { coachingId: cid, kind: 'trade', n: 2, days: 7 }), /Only the coach/), 'students cannot set tasks');

// the coach sets tasks; the student's chart views move the analyze task
await as(`coach${t0}@example.com`);
const t1 = await call('coach_task', { coachingId: cid, kind: 'analyze', n: 2, days: 7 });
const t2 = await call('coach_task', { coachingId: cid, kind: 'custom', text: 'Read the stop-loss guide', days: 3 });
await call('coach_task', { coachingId: cid, kind: 'news', n: 1, days: 1 });
ok(await fails(() => call('coach_task', { coachingId: cid, kind: 'trade', n: 1, days: 1 }), /3 open tasks/), 'at most 3 open tasks');
ok(await fails(() => call('coach_task', { coachingId: cid, kind: 'xp', n: 100 }), /Pick a task/), 'no XP-farming task kinds');
const coachXp0 = await xpOf(C.uid);
await as(`student${t0}@example.com`);
const studentXp0 = await xpOf(S.uid);
await call('mission_event', { ev: 'analyze', ref: 'AAPL' });
await call('mission_event', { ev: 'analyze', ref: 'AAPL' }); // same stock: counts once
let task = (await getDoc(doc(db, 'coachings', cid, 'tasks', t1.taskId))).data();
ok(task.progress === 1 && task.status === 'open', 'one stock so far (the same stock twice counts once)');
await call('mission_event', { ev: 'analyze', ref: 'MSFT' });
task = (await getDoc(doc(db, 'coachings', cid, 'tasks', t1.taskId))).data();
ok(task.status === 'done' && task.progress === 2, 'second stock: task done');
ok((await xpOf(S.uid)) - studentXp0 >= 10 && (await xpOf(C.uid)) - coachXp0 === 5, 'student +10 XP (plus any mission XP), coach +5');

// custom task: student ticks, coach confirms; XP only once a day; coach gets nothing
await call('coach_task_update', { coachingId: cid, taskId: t2.taskId, action: 'tick' });
ok((await getDoc(doc(db, 'coachings', cid, 'tasks', t2.taskId))).data().status === 'review', 'custom task waits for the coach');
await as(`coach${t0}@example.com`);
const cXp = await xpOf(C.uid);
await call('coach_task_update', { coachingId: cid, taskId: t2.taskId, action: 'confirm' });
ok((await xpOf(C.uid)) === cXp, 'confirming a custom task pays the coach nothing');
const t3 = await call('coach_task', { coachingId: cid, kind: 'custom', text: 'Watch the market open', days: 1 });
await as(`student${t0}@example.com`);
await call('coach_task_update', { coachingId: cid, taskId: t3.taskId, action: 'tick' });
const sXp = await xpOf(S.uid);
await as(`coach${t0}@example.com`);
await call('coach_task_update', { coachingId: cid, taskId: t3.taskId, action: 'confirm' });
ok((await xpOf(S.uid)) === sXp, 'a second custom task the same day pays no XP (no farming)');

// the coach sees trades and reacts to one
await admin(`practiceAccounts/${S.uid}/history/trade0001`, { kind: { stringValue: 'trade' }, sym: { stringValue: 'NVDA' }, pnl: { doubleValue: 42.5 }, pct: { doubleValue: 4.1 }, qty: { integerValue: '5' }, entry: { doubleValue: 100 }, exit: { doubleValue: 104.1 }, at: { integerValue: String(Date.now()) } });
const sum = await call('coach_refresh', { coachingId: cid });
ok(sum.summary.trades.length === 1 && sum.summary.trades[0].sym === 'NVDA' && sum.summary.trades[0].id === 'trade0001', 'the coach sees the student\'s individual trades');
await call('coach_note', { coachingId: cid, text: 'Good exit, you took profit at plan.', reaction: 'good', tradeId: 'trade0001' });
ok(await fails(() => call('coach_note', { coachingId: cid, reaction: 'bad', tradeId: 'nottheirs1' }), /recent trades/), 'reactions only on the student\'s own trades');
await as(`student${t0}@example.com`);
const notes = (await getDocs(collection(db, 'coachings', cid, 'notes'))).docs.map((d) => d.data());
ok(notes.some((n) => n.reaction === 'good' && n.trade?.sym === 'NVDA' && n.role === 'coach'), 'the student sees the reaction on their trade');
const bell = (await getDocs(collection(db, 'users', S.uid, 'inbox'))).docs.map((d) => d.data().title);
ok(bell.some((t) => /Jordan on your NVDA trade: Good move/.test(t)), 'and gets it in the bell');
await call('coach_note', { coachingId: cid, text: 'Thanks coach!' });

// chart plays (owner 2026-10-10): the coach draws on a chart, the student is told and can comment
const play = { coachingId: cid, sym: 'AAPL', tf: 'D', title: 'Buy the retest', note: 'Wait for a close above the line.', shapes: [{ k: 'hline', c: 'green', pts: [{ d: '2026-10-01', p: 230 }], text: 'entry' }, { k: 'arrow', c: 'gold', pts: [{ d: '2026-09-20', p: 220 }, { d: '2026-10-01', p: 231 }] }] };
ok(await fails(() => call('coach_play', play), /Only the coach/), 'students cannot draw up plays');
await as(`coach${t0}@example.com`);
ok(await fails(() => call('coach_play', { ...play, sym: 'NOPE' }), /Zelos list/), 'plays are on Zelos stocks only');
const { playId } = await call('coach_play', play);
await as(`student${t0}@example.com`);
const pd = (await getDoc(doc(db, 'coachings', cid, 'plays', playId))).data();
ok(pd.title === 'Buy the retest' && pd.shapes.length === 2 && pd.shapes[0].pts[0].p === 230 && pd.fromName === 'Jordan', 'the student can open the play with its drawings');
const inbox = (await getDocs(collection(db, 'users', S.uid, 'inbox'))).docs.map((d) => d.data());
ok(inbox.some((n) => n.title === 'Your coach drew up a play: Buy the retest' && n.link === `app/coach/${cid}/play/${playId}`), '"Your coach drew up a play" lands in the bell and opens the play');
ok(await fails(() => setDoc(doc(db, 'coachings', cid, 'plays', 'fake1234567'), { title: 'x' })), 'browsers cannot write plays');
await call('coach_play_comment', { coachingId: cid, playId, text: 'Got it, waiting for the close.' });
ok((await getDoc(doc(db, 'coachings', cid, 'plays', playId))).data().comments[0].role === 'student', 'the student comments on the play');
const coachBell = (await adminGet('users/' + C.uid + '/inbox'))?.documents?.map((d) => d.fields.title.stringValue) ?? [];
ok(coachBell.some((t) => /Maya commented on Buy the retest/.test(t)), 'and the coach is told');

// a second coach can't take a student who already has one; the student ends coaching
const mine = await getDocs(query(collection(db, 'coachings'), where('student', '==', S.uid)));
ok(mine.size === 1, 'the student can list their coaching');
await call('coach_end', { coachingId: cid });
ok((await getDoc(doc(db, 'coachings', cid))).data().status === 'ended', 'the student can end coaching');
ok(await fails(() => call('coach_note', { coachingId: cid, text: 'hi' }), /ended/), 'no notes after it ended');
const stats = await adminGet('coaches/' + C.uid);
ok(Number(stats.fields.tasksDone.integerValue) === 1 && !stats.fields.badge, 'coach stats: 1 task done, no badge yet (needs 5)');
await signOut(auth);
console.log('\n%d coaching checks passed', pass);
