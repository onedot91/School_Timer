begin;
set local lock_timeout='2s';
set local statement_timeout='8s';

-- Student screens re-read only the parts of their scope that changed (2026-10-30 classroom stall).
-- Any write changes a student's readVersion, so a full re-read sent the whole scope (about 1.3MB)
-- to every student after each bid. The manifest has one digest per selector path and per wallet;
-- revisions include tombstones, so removals are detected as well.
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

create or replace function public.storage_load_scope_changes(p_scope jsonb,p_known jsonb default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public set jit=off as $$
declare manifest jsonb; changed_students jsonb; selected_scope jsonb; snapshot jsonb;
begin
  perform public.storage_validate_scope(p_scope);
  if p_known is not null and (jsonb_typeof(p_known)<>'object' or octet_length(p_known::text)>32768) then
    raise exception 'STORAGE_INVALID_READ_MANIFEST';
  end if;
  manifest:=public.storage_scope_selector_manifest(p_scope);
  if p_known is null then
    return jsonb_build_object('manifest',manifest,'snapshot',public.storage_load_scope(p_scope),'complete',true);
  end if;
  select coalesce(jsonb_agg(selector.value),'[]'::jsonb) into selected_scope
    from jsonb_array_elements(p_scope->'resources') selector
    where p_known->>('scope:'||(selector.value->>'path')) is distinct from manifest->>('scope:'||(selector.value->>'path'));
  select coalesce(jsonb_agg(substring(key from 8)::integer),'[]'::jsonb) into changed_students
    from jsonb_each_text(manifest) where starts_with(key,'wallet:') and p_known->>key is distinct from value;
  selected_scope:=jsonb_build_object('resources',selected_scope,
    'wallets',(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(p_scope->'wallets') where value in(select jsonb_array_elements(changed_students))),
    'history',(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(p_scope->'history') where value in(select jsonb_array_elements(changed_students))),
    'writeResources','[]'::jsonb,'writeWallets','[]'::jsonb);
  snapshot:=public.storage_load_scope(selected_scope);
  -- Polling compares against the version of the whole scope, not of the changed part.
  snapshot:=snapshot||jsonb_build_object('readVersion',public.storage_scope_read_version(p_scope));
  return jsonb_build_object('manifest',manifest,'snapshot',snapshot,'complete',false);
end;
$$;

create or replace function public.storage_load_scope_changes_student(p_scope jsonb,p_known jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public set jit=off as $$
begin
  perform public.storage_student_read_slot();
  return public.storage_load_scope_changes(p_scope,p_known);
end;
$$;

revoke all on function public.storage_scope_selector_manifest(jsonb),public.storage_load_scope_changes(jsonb,jsonb),
  public.storage_load_scope_changes_student(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.storage_scope_selector_manifest(jsonb),public.storage_load_scope_changes(jsonb,jsonb),
  public.storage_load_scope_changes_student(jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
