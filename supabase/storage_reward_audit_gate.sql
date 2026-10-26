begin;
set local lock_timeout='2s';
set local statement_timeout='8s';

-- Classroom-wide single slot for the teacher reward audit (2026-10-26 incident).
-- The audit assembles the full snapshot (~1s CPU idle, >8s under class load); overlapping runs from
-- several teacher devices starved student and teacher saves. A busy slot fails at once instead of
-- holding a pooled connection. The wrapped function keeps its single stable MVCC snapshot.
create or replace function public.storage_reward_audit_source_gated() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public as $$
begin
  if not pg_try_advisory_xact_lock(726316, 1) then raise exception 'REWARD_AUDIT_BUSY'; end if;
  return public.storage_reward_audit_source();
end;
$$;

revoke all on function public.storage_reward_audit_source_gated() from public,anon,authenticated;
grant execute on function public.storage_reward_audit_source_gated() to service_role;

notify pgrst, 'reload schema';
commit;
