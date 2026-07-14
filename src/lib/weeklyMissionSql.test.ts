import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('weekly mission RPC preserves exact rewards and initializes empty settings', async () => {
  const sql = await readFile(new URL('../../supabase/app_settings.sql', import.meta.url), 'utf8');
  const functionSql = sql.slice(
    sql.indexOf('create or replace function claim_weekly_mission_reward'),
    sql.indexOf('create or replace function claim_personal_question_weekly_reward'),
  );

  assert.match(functionSql, /jsonb_typeof\(v_value -> 'currencyBalances'\) is distinct from 'object'/);
  assert.match(functionSql, /jsonb_typeof\(v_value -> 'currencyHistory'\) is distinct from 'object'/);
  assert.match(functionSql, /v_before <= 999994/);
  assert.match(functionSql, /v_after := v_before \+ 5/);
  assert.doesNotMatch(functionSql, /limit 30/i);
  assert.ok(
    functionSql.indexOf("for update;") < functionSql.indexOf('insert into weekly_mission_rewards'),
    'the shared balance row must be locked before the reward claim is consumed',
  );
});
