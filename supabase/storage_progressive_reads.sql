begin;

-- All statements share the caller's MVCC snapshot. Revisions, including tombstones,
-- detect late commits without relying on transaction wall-clock ordering.
create or replace function public.storage_load_teacher_changes(p_known jsonb default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public set jit=off as $$
declare manifest jsonb; selectors jsonb; students jsonb; selected_scope jsonb; snapshot jsonb;
begin
  if p_known is not null and (jsonb_typeof(p_known)<>'object' or octet_length(p_known::text)>32768) then
    raise exception 'STORAGE_INVALID_READ_MANIFEST';
  end if;
  if exists(select 1 from public.storage_resources where category !~ '^[A-Za-z][A-Za-z0-9]*$') then
    return jsonb_build_object('manifest','{}'::jsonb,'snapshot',public.storage_load_snapshot(),'complete',true);
  end if;
  select coalesce(jsonb_object_agg(key,digest),'{}'::jsonb) into manifest from (
    select 'resource:'||category key, md5(jsonb_agg(jsonb_build_array(resource_key,revision,deleted) order by resource_key)::text) digest
    from public.storage_resources where category<>'root' group by category
    union all
    select 'wallet:'||student_number,md5(revision::text) from public.wallet_accounts
  ) versions;
  if p_known is null then
    snapshot:=public.storage_load_snapshot();
  elsif p_known=manifest then
    selected_scope:=jsonb_build_object('resources','[]'::jsonb,'wallets','[]'::jsonb,'history','[]'::jsonb,'writeResources','[]'::jsonb,'writeWallets','[]'::jsonb);
    select jsonb_build_object('kind','scoped','scope',selected_scope,'resources',jsonb_build_array(to_jsonb(r)),
      'wallets','[]'::jsonb,'history','[]'::jsonb,'deletedKeys','[]'::jsonb,'orderingBounds','{}'::jsonb,
      'revisions',jsonb_build_object('',r.revision),'updated_at',public.storage_load_updated_at())
      into snapshot from public.storage_resources r where resource_key='' and not deleted;
  else
    select coalesce(jsonb_agg(jsonb_build_object('path','/'||substring(key from 10))),'[]'::jsonb)
      into selectors from jsonb_each_text(manifest) where starts_with(key,'resource:') and (p_known->>key is distinct from value);
    select coalesce(jsonb_agg(substring(key from 8)::integer),'[]'::jsonb)
      into students from jsonb_each_text(manifest) where starts_with(key,'wallet:') and (p_known->>key is distinct from value);
    selected_scope:=jsonb_build_object('resources',selectors,'wallets',students,'history',students,'writeResources','[]'::jsonb,'writeWallets','[]'::jsonb);
    snapshot:=public.storage_load_scope(selected_scope);
  end if;
  return jsonb_build_object('manifest',manifest,'snapshot',snapshot,'complete',p_known is null);
end;
$$;

revoke all on function public.storage_load_teacher_changes(jsonb) from public,anon,authenticated;
grant execute on function public.storage_load_teacher_changes(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
