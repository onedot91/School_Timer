import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('오늘의 친구 제출과 보상은 공개 접근 없이 전용 테이블에 저장된다', async () => {
  // Given
  const sql = await readFile(new URL('../../supabase/app_settings.sql', import.meta.url), 'utf8');

  // When
  const schema = sql.slice(sql.indexOf('create table if not exists public.today_friend_settings'));

  // Then
  assert.match(schema, /create table if not exists public\.today_friend_submissions/i);
  assert.match(schema, /create table if not exists public\.today_friend_rewards/i);
  assert.match(schema, /revoke all on table public\.today_friend_submissions from public, anon, authenticated/i);
  assert.match(schema, /revoke all on table public\.today_friend_rewards from public, anon, authenticated/i);
});

test('오늘의 친구 승인은 제출과 잔액을 잠그고 15고마를 한 번만 지급한다', async () => {
  // Given
  const sql = await readFile(new URL('../../supabase/app_settings.sql', import.meta.url), 'utf8');

  // When
  const start = sql.indexOf('create or replace function public.approve_today_friend_submission');
  const end = sql.indexOf('grant execute on function public.approve_today_friend_submission', start);
  const rpc = sql.slice(start, end);

  // Then
  assert.ok(start >= 0);
  assert.match(rpc, /from public\.today_friend_submissions[\s\S]*for update/i);
  assert.match(rpc, /from public\.app_settings[\s\S]*for update/i);
  assert.match(rpc, /insert into public\.today_friend_rewards/i);
  assert.match(rpc, /on conflict \(submission_id\) do nothing/i);
  assert.match(rpc, /v_reward_amount integer := 15/i);
  assert.match(rpc, /'reason', 'weekly_mission'/i);
});
