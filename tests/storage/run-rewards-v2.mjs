import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const modulePath = process.env.STORAGE_TEST_PG_MODULE;
const databaseUrl = process.env.STORAGE_TEST_DATABASE_URL;
if (!modulePath || !databaseUrl) throw new Error('Set STORAGE_TEST_PG_MODULE and a disposable local STORAGE_TEST_DATABASE_URL');
const parsed = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) throw new Error('Only a disposable local PostgreSQL server is allowed');
const { default: pg } = await import(modulePath);
const admin = new pg.Client({ connectionString: databaseUrl });
await admin.connect();
const databaseName = `storage_rewards_${Date.now()}`;
await admin.query(`create database ${databaseName}`);
await admin.end();
parsed.pathname = `/${databaseName}`;
const pool = new pg.Pool({ connectionString: parsed.href, max: 24 });
try {
  for (const file of ['supabase/app_settings.sql', 'supabase/classword.sql', 'supabase/library_competition.sql', 'supabase/storage_v2.sql', 'supabase/storage_today_friend_v2.sql', 'supabase/storage_rewards_v2.sql', 'tests/storage/rewards-v2.sql', 'tests/storage/today-friend-v2.sql']) {
    await pool.query(await fs.readFile(file, 'utf8'));
    console.log(`PASS ${file}`);
  }
  await pool.query(`update public.storage_control set active=true,maintenance=false;
    insert into public.wallet_accounts(student_number,balance,opening_balance) select n,100,100 from generate_series(1,23)n;
    insert into public.storage_resources(resource_key,category,owner_number,value) values
    ('/classDonation/enabled','classDonation',null,'{"kind":"value","parentKey":"/classDonation","member":"enabled","data":true}'),
    ('/classDonation/targetAmount','classDonation',null,'{"kind":"value","parentKey":"/classDonation","member":"targetAmount","data":500}'),
    ('/classDonation/totalAmount','classDonation',null,'{"kind":"value","parentKey":"/classDonation","member":"totalAmount","data":0}');`);
  const rewards = await Promise.all(Array.from({ length: 23 }, async (_, index) => {
    const student = index + 1;
    const args = [student, '2099-02-01', 'classword_quiz_correct', `quiz-${student}`, 2];
    const first = await pool.query('select public.claim_weekly_mission_reward_v2($1,$2,$3,$4,$5) result', args);
    const replay = await pool.query('select public.claim_weekly_mission_reward_v2($1,$2,$3,$4,$5) result', args);
    assert.equal(replay.rows[0].result.awarded, false);
    assert.equal(replay.rows[0].result.balance, first.rows[0].result.balance);
    const letter = { id: `donation-${student}`, recipient: student, senderLabel: '아기고마', title: '고맙고마', content: '6고마 고맙고마' };
    const donationArgs = [student, 6, letter.id, 2, JSON.stringify(letter)];
    const donated = await pool.query('select public.donate_to_class_goal_v2($1,$2,$3,$4,$5) result', donationArgs);
    const donatedAgain = await pool.query('select public.donate_to_class_goal_v2($1,$2,$3,$4,$5) result', donationArgs);
    assert.deepEqual(donatedAgain.rows[0].result, donated.rows[0].result);
    return first.rows[0].result.rewardAmount;
  }).concat([pool.query(`select public.save_today_friend_planning_v2('{"weeks":[],"partnerDays":[],"questions":[],"selectedQuestionIdByDate":{}}','{"weeks":[],"partnerDays":[],"questions":[{"id":"q","text":"local fixture","active":true,"usedDateKeys":[]}],"selectedQuestionIdByDate":{}}',2)`).then(() => 0)]));
  const balances = await pool.query('select sum(balance)::integer total from public.wallet_accounts');
  assert.equal(balances.rows[0].total, 2300 + rewards.reduce((a, b) => a + b, 0) - 23 * 6);
  const audit = await pool.query(`select (select count(*)::integer from public.wallet_ledger) ledger,
    (select count(*)::integer from public.storage_resources where value->>'parentKey'='/studentLife/letters') letters,
    (select count(*)::integer from public.class_donation_requests) donations,
    (select (value->>'data')::integer from public.storage_resources where resource_key='/classDonation/totalAmount') total`);
  assert.deepEqual(audit.rows[0], { ledger: 46, letters: 23, donations: 23, total: 138 });
  console.log('PASS 24 concurrent sessions: 23 quiz claims and donation replays plus teacher planning, exact wallet/ledger/mail totals');
} finally { await pool.end(); }
