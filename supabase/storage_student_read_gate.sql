begin;
set local lock_timeout='2s';
set local statement_timeout='8s';

-- Classroom-wide admission for student scoped reads (2026-10-23 incident).
-- Vercel instance queues cannot bound database concurrency, so student reads take one of a few
-- transaction-scoped slots here. A busy gate fails at once instead of holding a pooled connection;
-- teacher reads and every write keep calling the ungated functions.
create or replace function public.storage_student_read_slot() returns void
language plpgsql volatile security definer set search_path=pg_catalog,public as $$
declare slots constant integer := 2;
begin
  for slot in 1..slots loop
    if pg_try_advisory_xact_lock(726315, slot) then return; end if;
  end loop;
  raise exception 'STORAGE_READ_BUSY';
end;
$$;

create or replace function public.storage_load_scope_student(p_scope jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public set jit=off as $$
begin
  perform public.storage_student_read_slot();
  return public.storage_load_scope(p_scope);
end;
$$;

create or replace function public.storage_load_scope_metadata_student(p_scope jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public set jit=off as $$
begin
  perform public.storage_student_read_slot();
  return public.storage_load_scope_metadata(p_scope);
end;
$$;

create or replace function public.storage_poll_scope_student(p_scope jsonb,p_known_read_marker text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public set jit=off as $$
begin
  perform public.storage_student_read_slot();
  return public.storage_poll_scope(p_scope,p_known_read_marker);
end;
$$;

revoke all on function public.storage_student_read_slot(),public.storage_load_scope_student(jsonb),
  public.storage_load_scope_metadata_student(jsonb),public.storage_poll_scope_student(jsonb,text) from public,anon,authenticated;
-- Supabase default privileges also grant service_role; only the wrappers may take a slot.
revoke all on function public.storage_student_read_slot() from service_role;
grant execute on function public.storage_load_scope_student(jsonb),public.storage_load_scope_metadata_student(jsonb),
  public.storage_poll_scope_student(jsonb,text) to service_role;

notify pgrst, 'reload schema';
commit;
