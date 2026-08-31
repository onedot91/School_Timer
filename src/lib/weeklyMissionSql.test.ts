import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('weekly mission RPC preserves exact rewards and initializes empty settings', async () => {
  const sql = await readFile(new URL('../../supabase/app_settings.sql', import.meta.url), 'utf8');
  const functionSql = sql.slice(
    sql.indexOf('create or replace function public.claim_weekly_mission_reward'),
    sql.indexOf('create or replace function public.claim_personal_question_weekly_reward'),
  );

  assert.match(functionSql, /jsonb_typeof\(v_value -> 'currencyBalances'\) is distinct from 'object'/);
  assert.match(functionSql, /jsonb_typeof\(v_value -> 'currencyHistory'\) is distinct from 'object'/);
  assert.match(functionSql, /p_mission_type = 'classword_quiz_correct'[\s\S]*?floor\(random\(\) \* 10\)::integer \+ 1/);
  assert.match(functionSql, /p_mission_type not in \('personal_question', 'classword_word_entry', 'classword_quiz_correct'\)/);
  assert.match(sql, /weekly_mission_rewards_reward_amount_check[\s\S]*?reward_amount between 1 and 15/);
  assert.match(functionSql, /p_mission_type = 'personal_question' then 15/);
  assert.match(
    functionSql,
    /p_mission_type in \('classword_word_entry', 'classword_quiz_correct'\)[\s\S]*?p_week_key !~ '\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$'/,
  );
  assert.match(functionSql, /v_before <= 999999 - v_reward_amount/);
  assert.match(functionSql, /v_after := v_before \+ v_reward_amount/);
  assert.match(functionSql, /'rewardAmount', v_reward_amount/);
  assert.doesNotMatch(functionSql, /limit 30/i);
  const earlyReturnIndex = functionSql.indexOf('if p_source_event_id is null or btrim(p_source_event_id)');
  assert.ok(earlyReturnIndex >= 0, 'the function must short-circuit non-awardable requests');
  assert.ok(
    earlyReturnIndex < functionSql.indexOf('for update;'),
    'incomplete or previously claimed missions must return before locking the shared balance row',
  );
  assert.ok(
    functionSql.indexOf("for update;") < functionSql.indexOf('insert into public.weekly_mission_rewards'),
    'the shared balance row must be locked before the reward claim is consumed',
  );
});

test('security definer functions pin an empty search path and expose only intended roles', async () => {
  const sql = await readFile(new URL('../../supabase/app_settings.sql', import.meta.url), 'utf8');

  assert.doesNotMatch(sql, /security definer\s+set search_path = public/i);
  assert.equal((sql.match(/security definer\s+set search_path = ''/gi) ?? []).length, 4);
  assert.match(sql, /revoke all on function public\.donate_to_class_goal\(integer, integer, text\) from anon/i);
  assert.match(sql, /revoke all on function public\.donate_to_class_goal\(integer, integer, text\) from authenticated/i);
  assert.match(sql, /revoke all on table public\.app_settings from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update on table public\.app_settings to service_role/i);
  assert.match(sql, /grant select, insert, update on table public\.announcement_notes to service_role/i);
  assert.match(sql, /revoke all on table public\.weekly_mission_rewards from public, anon, authenticated/i);
});

test('public write tables reject oversized or malformed payloads at the database boundary', async () => {
  const sql = await readFile(new URL('../../supabase/app_settings.sql', import.meta.url), 'utf8');

  assert.match(sql, /app_settings_value_size_check[\s\S]*octet_length\(value::text\) <= 1048576/i);
  assert.match(sql, /announcement_notes_date_key_check[\s\S]*date_key ~ '\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$'/i);
  assert.match(sql, /announcement_notes_note_size_check[\s\S]*char_length\(note\) <= 10000/i);
});
