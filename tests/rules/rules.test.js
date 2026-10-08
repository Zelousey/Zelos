// Security-rules tests for firestore.rules and database.rules.json.
// Run: cd tests/rules && npm ci && npm test   (needs Java for the emulators)
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where } = require('firebase/firestore');
const { ref, set, update, get, push } = require('firebase/database');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

let env;
const real = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } });
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } });

// ---------------------------------------------------------------- Firestore: XP is server-only
test('new user doc may start with xp 0', async () => {
  await assertSucceeds(setDoc(doc(real('alice').firestore(), 'users/alice'), { xp: 0, streakDays: 0, watchlist: [] }));
});
test('new user doc may not start with xp', async () => {
  await assertFails(setDoc(doc(real('alice').firestore(), 'users/alice'), { xp: 5000 }));
});
test('owner cannot change xp, streakDays or lastAlertOpenDate', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users/alice'), { xp: 10, streakDays: 1 }));
  const db = real('alice').firestore();
  await assertFails(updateDoc(doc(db, 'users/alice'), { xp: 99999 }));
  await assertFails(updateDoc(doc(db, 'users/alice'), { streakDays: 400 }));
  await assertFails(updateDoc(doc(db, 'users/alice'), { lastAlertOpenDate: '2026-01-01' }));
  await assertFails(setDoc(doc(db, 'users/alice'), { watchlist: [] })); // overwrite would drop xp
});
test('owner can still edit ordinary fields (merge)', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users/alice'), { xp: 10 }));
  await assertSucceeds(setDoc(doc(real('alice').firestore(), 'users/alice'), { watchlist: ['AAPL'] }, { merge: true }));
});
test('anonymous visitor cannot mint xp either', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users/guest1'), { xp: 0 }));
  await assertFails(updateDoc(doc(anon('guest1').firestore(), 'users/guest1'), { xp: 1000 }));
});
test('nobody reads someone else\'s user doc', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users/alice'), { xp: 1 }));
  await assertFails(getDoc(doc(real('bob').firestore(), 'users/alice')));
});
test('activity ledger: owner reads, nobody writes', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users/alice/activity/a1'), { xp: 5 }));
  const db = real('alice').firestore();
  await assertSucceeds(getDoc(doc(db, 'users/alice/activity/a1')));
  await assertFails(setDoc(doc(db, 'users/alice/activity/x'), { xp: 500 }));
  await assertFails(deleteDoc(doc(db, 'users/alice/activity/a1')));
});
test('xpState is server-only', async () => {
  await assertFails(getDoc(doc(real('alice').firestore(), 'xpState/alice')));
  await assertFails(setDoc(doc(real('alice').firestore(), 'xpState/alice'), { xp: 0 }));
});

// ---------------------------------------------------------------- Firestore: existing guarantees
test('wallets and ledgers are not browser-writable', async () => {
  const db = real('alice').firestore();
  await assertFails(setDoc(doc(db, 'wallets/alice'), { balance: 1e6 }));
  await assertFails(setDoc(doc(db, 'wallets/alice/ledger/x'), { delta: 1e6 }));
});
test('purchases and Square records are server-only', async () => {
  const db = real('alice').firestore();
  await assertFails(getDoc(doc(db, 'purchases/p1')));
  await assertFails(setDoc(doc(db, 'squareCheckouts/o1'), { uid: 'alice' }));
});
test('alerts: public read, no write', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'alerts/a1'), { t: 1 }));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'alerts/a1')));
  await assertFails(setDoc(doc(real('alice').firestore(), 'alerts/a2'), { t: 1 }));
});
test('practice profiles: numbers are server-only, identity is the owner\'s', async () => {
  const db = real('alice').firestore();
  await assertFails(setDoc(doc(db, 'practiceProfiles/alice'), { name: 'Al', equity: 12000 })); // no browser-created profiles
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'practiceProfiles/alice'), { name: 'Al', equity: 10000, trades: 0 }));
  await assertFails(updateDoc(doc(db, 'practiceProfiles/alice'), { equity: 1e9 }));
  await assertFails(updateDoc(doc(db, 'practiceProfiles/alice'), { name: 'Ally', trades: 500 }));
  await assertSucceeds(updateDoc(doc(db, 'practiceProfiles/alice'), { name: 'Ally', username: 'ally', photo: null }));
  await assertSucceeds(updateDoc(doc(db, 'practiceProfiles/alice'), { achievements: ['first-trade'], streak: 3 }));
  await assertFails(updateDoc(doc(db, 'practiceProfiles/alice'), { streak: 1e6 }));
  await assertFails(updateDoc(doc(real('bob').firestore(), 'practiceProfiles/alice'), { name: 'Hacked' }));
  await assertSucceeds(deleteDoc(doc(db, 'practiceProfiles/alice'))); // hide your stats
});
test('practice account and archive: owner reads, nobody writes', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'practiceAccounts/alice'), { cash: 10000 });
    await setDoc(doc(c.firestore(), 'practiceAccounts/alice/history/h1'), { kind: 'fill' });
    await setDoc(doc(c.firestore(), 'practiceArchive/alice'), { equity: 5 });
  });
  const db = real('alice').firestore();
  await assertSucceeds(getDoc(doc(db, 'practiceAccounts/alice')));
  await assertSucceeds(getDoc(doc(db, 'practiceAccounts/alice/history/h1')));
  await assertSucceeds(getDoc(doc(db, 'practiceArchive/alice')));
  await assertFails(updateDoc(doc(db, 'practiceAccounts/alice'), { cash: 1e9 }));
  await assertFails(setDoc(doc(db, 'practiceAccounts/alice/history/x'), { kind: 'fill' }));
  await assertFails(setDoc(doc(db, 'practiceArchive/alice'), { equity: 1e9 }));
  await assertFails(getDoc(doc(real('bob').firestore(), 'practiceAccounts/alice')));
});

// ---------------------------------------------------------------- Realtime DB: arcade scores
const score = (uid, extra) => Object.assign({ name: 'Al', score: 100, ts: Date.now(), uid }, extra || {});
async function post(ctx, uid, entry, game) {
  const db = ctx.database();
  const key = push(ref(db, 'scores/' + (game || 'bull-run'))).key;
  return update(ref(db), { ['scores/' + (game || 'bull-run') + '/' + key]: entry, ['lastPost/' + uid]: { '.sv': 'timestamp' } });
}
test('arcade: signed-out visitors cannot post', async () => {
  const db = env.unauthenticatedContext().database();
  const { uid, ...entry } = score('x'); // the shape the old rules accepted
  await assertFails(set(push(ref(db, 'scores/bull-run')), entry));
});
test('arcade: a (guest) user can post with their uid', async () => {
  await assertSucceeds(post(anon('g1'), 'g1', score('g1')));
});
test('arcade: second post within 10 seconds is refused', async () => {
  await assertSucceeds(post(anon('g2'), 'g2', score('g2')));
  await assertFails(post(anon('g2'), 'g2', score('g2')));
});
test('arcade: cannot post as someone else', async () => {
  await assertFails(post(anon('g3'), 'g3', score('someone-else')));
});
test('arcade: scores stay capped', async () => {
  await assertFails(post(anon('g4'), 'g4', score('g4', { score: 999999 })));
  await assertFails(post(anon('g5'), 'g5', score('g5', { score: 600 }), 'daily-2026-10-07'));
});
test('arcade: post without lastPost stamp is refused', async () => {
  const db = anon('g6').database();
  await assertFails(set(push(ref(db, 'scores/bull-run')), score('g6')));
});
test('arcade: leaderboard is public', async () => {
  await assertSucceeds(get(ref(env.unauthenticatedContext().database(), 'scores/bull-run')));
});

// ---------------------------------------------------------------- Zelos News: public read, server write
test('news: anyone can read posts; nobody can write them from the browser', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'news/p1'), { section: 'zelos', title: 'Hello', body: ['x'], date: '2026-10-08' });
  });
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'news/p1')));
  await assertFails(setDoc(doc(real('alice').firestore(), 'news/p2'), { section: 'zelos', title: 'fake' }));
  await assertFails(updateDoc(doc(real('alice').firestore(), 'news/p1'), { title: 'edited' }));
  await assertFails(deleteDoc(doc(real('alice').firestore(), 'news/p1')));
  await assertFails(getDoc(doc(real('alice').firestore(), 'admins/alice')));
});

test('missions are counted by the server: browsers cannot write them', async () => {
  await assertFails(setDoc(doc(real('alice').firestore(), 'users/alice'), { xp: 0, missions: { day: { done: { trade: true } } } }));
  await assertSucceeds(setDoc(doc(real('alice').firestore(), 'users/alice'), { xp: 0, watchlist: [] }));
  await assertFails(updateDoc(doc(real('alice').firestore(), 'users/alice'), { 'missions.day.done.trade': true }));
  await assertSucceeds(updateDoc(doc(real('alice').firestore(), 'users/alice'), { watchlist: ['AAPL'] }));
});

// ---------------------------------------------------------------- invites + referrals: server-written
test('invites: anyone can open one by its code; only the server writes them', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'invites/Abcdefgh23'), { kind: 'join', from: 'alice', fromName: 'Alice', status: 'open' });
    await setDoc(doc(c.firestore(), 'invites/Abcdefgh23/accepts/bob'), { at: 1 });
  });
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'invites/Abcdefgh23')));
  await assertSucceeds(getDocs(query(collection(real('alice').firestore(), 'invites'), where('from', '==', 'alice'))));
  await assertFails(getDocs(query(collection(real('bob').firestore(), 'invites'), where('from', '==', 'alice'))));
  await assertFails(setDoc(doc(real('alice').firestore(), 'invites/Fake123456'), { kind: 'join', from: 'alice', status: 'open' }));
  await assertFails(updateDoc(doc(real('alice').firestore(), 'invites/Abcdefgh23'), { uses: 0 }));
  await assertFails(getDoc(doc(real('bob').firestore(), 'invites/Abcdefgh23/accepts/bob')));
  await assertFails(getDoc(doc(real('alice').firestore(), 'inviteState/alice')));
});
test('referrals: browsers can no longer create them; the two people involved can read', async () => {
  await assertFails(setDoc(doc(real('bob').firestore(), 'referrals/bob'), { referrer: 'alice', createdAt: 1 }));
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'referrals/bob'), { referrer: 'alice', createdAt: 1 });
  });
  await assertSucceeds(getDoc(doc(real('bob').firestore(), 'referrals/bob')));
  await assertSucceeds(getDoc(doc(real('alice').firestore(), 'referrals/bob')));
  await assertFails(getDoc(doc(real('carol').firestore(), 'referrals/bob')));
});

(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zelos',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
    database: { rules: fs.readFileSync(path.join(__dirname, '../../database.rules.json'), 'utf8'), host: '127.0.0.1', port: 9000 },
  });
  let failed = 0;
  for (const [name, fn] of tests) {
    await env.clearFirestore();
    await env.clearDatabase();
    try { await fn(); console.log('  ok   ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e && e.message)); }
  }
  await env.cleanup();
  console.log(`\n${tests.length - failed}/${tests.length} rules tests passed`);
  assert.strictEqual(failed, 0);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
