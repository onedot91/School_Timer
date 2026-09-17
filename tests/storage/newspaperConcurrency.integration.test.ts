import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureCookie, startHttpHarness } from './httpHarness.js';
import { getKoreanIsoWeekKey } from '../../src/lib/weeklyMission.js';

test('신문 질문은 학생 23명이 동시에 제출해도 서로의 저장 잠금을 기다리지 않는다', async () => {
  const harness = await startHttpHarness({ name: `storage_http_test_newspaper_${process.pid}_${Date.now()}`, port: 0 });
  try {
    await harness.query(`
      create or replace function public.test_delay_newspaper_insert() returns trigger
      language plpgsql set search_path = '' as $$
      begin
        perform pg_sleep(0.05);
        return new;
      end;
      $$;
      create trigger test_delay_newspaper_insert before insert on public.newspaper_questions
      for each row execute function public.test_delay_newspaper_insert();
    `);
    const weekKey = getKoreanIsoWeekKey();
    const started = performance.now();
    const responses = await Promise.all(Array.from({ length: 23 }, async (_, index) => {
      const studentNumber = index + 1;
      return fetch(`${harness.baseUrl}/api/newspaper`, {
        method: 'POST',
        headers: { Cookie: fixtureCookie(studentNumber), 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          command: { action: 'submit', studentNumber, weekKey, questionType: 'personal', questionText: `학생 ${studentNumber}번은 왜 궁금할까요?`, expectedUpdatedAt: null },
        }),
      });
    }));
    const elapsed = performance.now() - started;
    assert.deepEqual(responses.map(response => response.status), Array(23).fill(200));
    assert.ok(elapsed < 700, `23개 독립 저장이 ${Math.round(elapsed)}ms 동안 직렬화됨`);
    assert.equal((await harness.query('select count(*)::integer as count from public.newspaper_questions where week_key=$1', [weekKey])).rows[0]?.count, 23);
    assert.equal((await harness.query('select count(*)::integer as count from public.newspaper_receipts')).rows[0]?.count, 23);
    assert.equal((await harness.query('select count(*)::integer as count from public.wallet_accounts where balance=115')).rows[0]?.count, 23);
  } finally {
    await harness.stop();
  }
});
