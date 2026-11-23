begin;
set local lock_timeout='2s';
set local statement_timeout='8s';

-- Set STORAGE_BID_ITEM_READS=0 and redeploy first; item-level reads are slower with this definition.
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
    select 'scope:'||(selector.value->>'path') key, md5(coalesce((
      select jsonb_agg(jsonb_build_array(r.resource_key,r.revision,r.deleted) order by r.resource_key)
      from public.storage_resources r
      where r.category=split_part(selector.value->>'path','/',2)
        and (r.resource_key=selector.value->>'path' or starts_with(r.resource_key,(selector.value->>'path')||'/'))
        and (not (selector.value ? 'students') or r.owner_number in(select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
        and (not (selector.value ? 'mail') or (r.value->>'parentKey'='/studentLife/letters' and
          (r.value#>>'{data,recipient}'=selector.value#>>'{mail,actor}' or (selector.value#>>'{mail,direction}'='participant'
            and r.value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}'))))
    ),'[]'::jsonb)::text) digest
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
