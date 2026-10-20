begin;

-- Teacher first reads only need recent ledger rows (today's summary, recent reward checks).
-- Commands still load their own scoped snapshot with full per-student history on the server.
create or replace function public.storage_teacher_history_since() returns timestamptz
language sql stable set search_path=pg_catalog as $$
  select (date_trunc('day', now() at time zone 'Asia/Seoul') - interval '13 days') at time zone 'Asia/Seoul'
$$;

create or replace function public.storage_recent_history_rows(p_history jsonb, p_since timestamptz) returns jsonb
language sql stable set search_path=pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object('resource_key',h->'resource_key','student_number',h->'student_number',
    'entry_id',h->'entry_id','sort_order',h->'sort_order','value',h->'value')),'[]'::jsonb)
  from jsonb_array_elements(coalesce(p_history,'[]'::jsonb)) h
  where (h->>'created_at')::timestamptz>=p_since
$$;

create or replace function public.storage_load_snapshot_recent_history(p_since timestamptz) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'resources',coalesce((select jsonb_agg(to_jsonb(r)) from public.storage_resources r where not deleted),'[]'::jsonb),
    'wallets',coalesce((select jsonb_agg(to_jsonb(w)) from public.wallet_accounts w),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('resource_key',h.resource_key,'student_number',h.student_number,
      'entry_id',h.entry_id,'sort_order',h.sort_order,'value',h.value)) from public.wallet_ledger h where h.created_at>=p_since),'[]'::jsonb),
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

-- Same manifest contract as storage_load_teacher_changes; only history rows are limited to the window.
create or replace function public.storage_load_teacher_changes_v2(p_known jsonb default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public set jit=off as $$
declare manifest jsonb; selectors jsonb; students jsonb; selected_scope jsonb; snapshot jsonb;
  since timestamptz:=public.storage_teacher_history_since();
begin
  if p_known is not null and (jsonb_typeof(p_known)<>'object' or octet_length(p_known::text)>32768) then
    raise exception 'STORAGE_INVALID_READ_MANIFEST';
  end if;
  if exists(select 1 from public.storage_resources where category !~ '^[A-Za-z][A-Za-z0-9]*$') then
    return jsonb_build_object('manifest','{}'::jsonb,'snapshot',public.storage_load_snapshot_recent_history(since),'complete',true,'historySince',since);
  end if;
  select coalesce(jsonb_object_agg(key,digest),'{}'::jsonb) into manifest from (
    select 'resource:'||category key, md5(jsonb_agg(jsonb_build_array(resource_key,revision,deleted) order by resource_key)::text) digest
    from public.storage_resources where category<>'root' group by category
    union all
    select 'wallet:'||student_number,md5(revision::text) from public.wallet_accounts
  ) versions;
  if p_known is null then
    snapshot:=public.storage_load_snapshot_recent_history(since);
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
    snapshot:=jsonb_set(snapshot,'{history}',public.storage_recent_history_rows(snapshot->'history',since));
  end if;
  return jsonb_build_object('manifest',manifest,'snapshot',snapshot,'complete',p_known is null,'historySince',since);
end;
$$;

revoke all on function public.storage_teacher_history_since() from public,anon,authenticated;
revoke all on function public.storage_recent_history_rows(jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.storage_load_snapshot_recent_history(timestamptz) from public,anon,authenticated;
revoke all on function public.storage_load_teacher_changes_v2(jsonb) from public,anon,authenticated;
grant execute on function public.storage_teacher_history_since() to service_role;
grant execute on function public.storage_recent_history_rows(jsonb,timestamptz) to service_role;
grant execute on function public.storage_load_snapshot_recent_history(timestamptz) to service_role;
grant execute on function public.storage_load_teacher_changes_v2(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
