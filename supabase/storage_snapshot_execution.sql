begin;
do $guard$
begin
  if not exists(select 1 from pg_proc where oid='public.storage_load_snapshot()'::regprocedure and md5(prosrc) in ('53c30ab30d619a1d05d65293cd02445c','f1160d473fe2a05eccf1845e075e0f71')) then
    raise exception 'STORAGE_CONCURRENCY_VERSION_MISMATCH: storage_load_snapshot';
  end if;
  if not exists(select 1 from pg_proc where oid='public.storage_reward_audit_source()'::regprocedure and md5(prosrc) in ('f1d55dc65084f4e6dcd1fe9a5015bd42','b58bc05acb8dbca0b9e7b883d8f7f3af')) then
    raise exception 'STORAGE_CONCURRENCY_VERSION_MISMATCH: storage_reward_audit_source';
  end if;
end;
$guard$;

create or replace function public.storage_load_snapshot() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'resources',coalesce((select jsonb_agg(to_jsonb(r)) from public.storage_resources r where not deleted),'[]'::jsonb),
    'wallets',coalesce((select jsonb_agg(to_jsonb(w)) from public.wallet_accounts w),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)) from public.wallet_ledger h),'[]'::jsonb),
    'updated_at',(select greatest(coalesce((select max(updated_at) from public.storage_resources),'epoch'),coalesce((select max(updated_at) from public.wallet_accounts),'epoch'),updated_at) from public.storage_control where singleton),
    'revisions',coalesce((select jsonb_object_agg(key,revision) from (
      select resource_key key,revision from public.storage_resources union all
      select 'wallet:'||student_number,revision from public.wallet_accounts union all
      select scope_key,revision from public.storage_scopes
    ) versions),'{}'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.storage_reward_audit_source() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare result jsonb;
begin
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
  ) into result;
  return result;
end;
$$;

notify pgrst, 'reload schema';
commit;

