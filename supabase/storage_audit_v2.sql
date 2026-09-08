-- One MVCC snapshot: an in-flight reward cannot appear as a committed activity without its committed ledger.
create or replace function public.storage_reward_audit_source() returns jsonb
language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'checkedAt', now(),
    'snapshot', public.storage_load_snapshot(),
    'walletMismatches', public.storage_reconcile_wallets(),
    'weeklyRewards', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select student_number, week_key, mission_type, reward_amount, source_event_id from public.weekly_mission_rewards
    ) r), '[]'::jsonb),
    'wordEntries', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select id, student_number, round_date from public.classword_entries
    ) r), '[]'::jsonb),
    'quizCompletions', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select id, student_number, quiz_date from public.classword_quiz_completions
    ) r), '[]'::jsonb),
    'friendSubmissions', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select id, student_number, submission_date, status from public.today_friend_submissions
    ) r), '[]'::jsonb),
    'friendRewards', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select submission_id, student_number, reward_amount from public.today_friend_rewards
    ) r), '[]'::jsonb)
  )
$$;
revoke all on function public.storage_reward_audit_source() from public, anon, authenticated;
grant execute on function public.storage_reward_audit_source() to service_role;
