begin;
set local lock_timeout='2s';
set local statement_timeout='8s';

-- Restores the student change read with the full coin history.
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

notify pgrst,'reload schema';
commit;
