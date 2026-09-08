import assert from 'node:assert/strict';
import test from 'node:test';
import { startHttpHarness, fixtureCookie } from './httpHarness.js';
import { parseRewardAuditReport } from '../../src/lib/rewardAudit.js';

test('실제 HTTP/DB 감사는 교사만 접근하고 누락된 +6을 찾으며 원본을 변경하지 않는다', async () => {
  const harness = await startHttpHarness({ name: `storage_http_test_audit_${process.pid}_${Date.now()}`, port: 0 });
  try {
    const auditUrl = `${harness.baseUrl}/api/save-alerts?audit=rewards`;
    const rpcBefore = harness.metrics.length;
    assert.equal((await fetch(auditUrl)).status, 401);
    assert.equal((await fetch(auditUrl, { headers: { Cookie: fixtureCookie(17) } })).status, 403);
    assert.equal(harness.metrics.length, rpcBefore);
    await harness.query("insert into weekly_mission_rewards(student_number,week_key,mission_type,reward_amount,source_event_id) values(17,'2026-09-08','classword_quiz_correct',6,'fixture-answer')");
    const checksum = async () => (await harness.query("select md5(storage_load_snapshot()::text) snapshot_hash, (select count(*) from storage_receipts) receipts, (select count(*) from wallet_ledger) ledger")).rows[0];
    const before = await checksum();
    const response = await fetch(auditUrl, { headers: { Cookie: fixtureCookie(0) } });
    assert.equal(response.status, 200);
    const report = parseRewardAuditReport(await response.json());
    assert.equal(report.issues.length, 1); assert.equal(report.issues[0].studentNumber, 17); assert.equal(report.issues[0].expectedAmount, 6);
    assert.deepEqual(report.walletMismatches, []);
    assert.deepEqual(await checksum(), before);
    const repeated = parseRewardAuditReport(await (await fetch(auditUrl, { headers: { Cookie: fixtureCookie(0) } })).json());
    assert.deepEqual(repeated.issues, report.issues);
    const writer = harness.query("do $$ begin perform set_config('school_timer.storage_protocol','2',true); insert into classword_quiz_completions(quiz_date,question_id,student_number) values('2026-09-08','concurrent-answer',1); perform pg_sleep(0.2); perform claim_weekly_mission_reward_v2(1,'2026-09-08','classword_quiz_correct','concurrent-answer',2); end $$").then(() => null, (error: unknown) => error);
    const during = await fetch(auditUrl, { headers: { Cookie: fixtureCookie(0) } });
    assert.equal(during.status, 200);
    assert.equal(parseRewardAuditReport(await during.json()).issues.some(issue => issue.studentNumber === 1), false);
    assert.equal(await writer, null);
    const after = parseRewardAuditReport(await (await fetch(auditUrl, { headers: { Cookie: fixtureCookie(0) } })).json());
    assert.equal(after.issues.some(issue => issue.studentNumber === 1), false);
    const grants = await harness.query("select has_function_privilege('anon','storage_reward_audit_source()','execute') anon, has_function_privilege('authenticated','storage_reward_audit_source()','execute') authenticated, has_function_privilege('service_role','storage_reward_audit_source()','execute') service");
    assert.deepEqual(grants.rows[0], { anon: false, authenticated: false, service: true });
    await harness.query("create or replace function public.storage_reward_audit_source() returns jsonb language sql stable security definer set search_path=public as $$ select 'null'::jsonb $$");
    const malformed = await fetch(auditUrl, { headers: { Cookie: fixtureCookie(0) } });
    assert.equal(malformed.status, 502);
    assert.deepEqual(await malformed.json(), { error: 'REWARD_AUDIT_UNAVAILABLE' });
    console.log(JSON.stringify({ database: harness.name, missingRewardDetected: 6, readOnly: true, concurrentFalsePositive: false }));
  } finally { await harness.stop(); }
});
