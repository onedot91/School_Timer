begin;

do $$
begin
  if not exists (
    select 1 from pg_proc where oid='public.storage_scope_read_version(jsonb)'::regprocedure
      and md5(prosrc)='732b1b947e71c6da596af2316950056d'
  ) then
    raise exception 'STORAGE_POLL_READ_VERSION_MISMATCH';
  end if;
  if exists (
    select 1 from pg_proc where oid=to_regprocedure('public.storage_poll_scope(jsonb,text)')
      and md5(prosrc)<>'c2730006da7dd37fdc3f72ef283ce118'
  ) then
    raise exception 'STORAGE_POLL_FUNCTION_VERSION_MISMATCH';
  end if;
end;
$$;

create or replace function public.storage_poll_scope(p_scope jsonb,p_known_read_marker text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public set jit=off as $$
declare marker text; timestamp_value jsonb;
begin
  perform public.storage_validate_scope(p_scope);
  marker := public.storage_read_marker();
  timestamp_value := public.storage_load_updated_at();
  if p_known_read_marker ~ '^[a-f0-9]{32}$' and p_known_read_marker=marker then
    return jsonb_build_object('updatedAt',timestamp_value,'readMarker',marker,'unchanged',true);
  end if;
  return jsonb_build_object('updatedAt',timestamp_value,'readMarker',marker,
    'readVersion',public.storage_scope_read_version(p_scope));
end;
$$;

revoke all on function public.storage_poll_scope(jsonb,text) from public,anon,authenticated;
grant execute on function public.storage_poll_scope(jsonb,text) to service_role;

notify pgrst, 'reload schema';
commit;
