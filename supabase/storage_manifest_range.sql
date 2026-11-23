begin;
set local lock_timeout='2s';
set local statement_timeout='8s';

-- Same digests, read through the key-prefix index instead of one category scan per selector
-- (2026-11-23 classroom stall). Required before STORAGE_BID_ITEM_READS=1, which adds 30 selectors.
do $guard$
begin
  if not exists (
    select 1 from pg_proc where oid=to_regprocedure('public.storage_scope_selector_manifest(jsonb)')
      and md5(prosrc) in ('67633dbda1206c753affe78f8f3d8e5d','d175304ba161c1f57bb25dd68871839f')
  ) then
    raise exception 'STORAGE_MANIFEST_FUNCTION_VERSION_MISMATCH';
  end if;
end;
$guard$;

create or replace function public.storage_scope_selector_manifest(p_scope jsonb) returns jsonb
language sql stable security definer set search_path=pg_catalog,public set jit=off as $$
  select coalesce(jsonb_object_agg(key,digest),'{}'::jsonb) from (
    select 'scope:'||(selector.value->>'path') key, md5(coalesce(case when selector.value ? 'mail' then (
      select jsonb_agg(jsonb_build_array(r.resource_key,r.revision,r.deleted) order by r.resource_key)
      from public.storage_resources r
      where r.category=split_part(selector.value->>'path','/',2)
        and (r.resource_key=selector.value->>'path' or starts_with(r.resource_key,(selector.value->>'path')||'/'))
        and r.value->>'parentKey'='/studentLife/letters'
        and (r.value#>>'{data,recipient}'=selector.value#>>'{mail,actor}' or (selector.value#>>'{mail,direction}'='participant'
          and r.value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}'))
    ) else (
      select jsonb_agg(jsonb_build_array(r.resource_key,r.revision,r.deleted) order by r.resource_key)
      from (
        select resource_key,revision,deleted,owner_number from public.storage_resources
        where resource_key=selector.value->>'path' and category=split_part(selector.value->>'path','/',2)
        union all
        -- '0' follows '/', so this is the same prefix range as storage_scoped_read_execution.sql.
        select resource_key,revision,deleted,owner_number from public.storage_resources
        where resource_key ~>=~ ((selector.value->>'path')||'/') and resource_key ~<~ ((selector.value->>'path')||'0')
          and category=split_part(selector.value->>'path','/',2)
      ) r
      where not (selector.value ? 'students') or r.owner_number in(select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n)
    ) end,'[]'::jsonb)::text) digest
    from jsonb_array_elements(p_scope->'resources') selector
    union all
    select 'wallet:'||student_number,md5(revision::text) from public.wallet_accounts
    where student_number in(select (value#>>'{}')::integer from jsonb_array_elements((p_scope->'wallets')||(p_scope->'history')))
  ) versions
$$;

revoke all on function public.storage_scope_selector_manifest(jsonb) from public,anon,authenticated;
grant execute on function public.storage_scope_selector_manifest(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
