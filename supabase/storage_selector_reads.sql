begin;

-- Candidate only: local selector scans decreased, but HTTP p95 did not improve.
-- Not applied to production; this is not a verified fix for the 2026-10-08 incident.
-- Only replace the selector query in the two known read functions.
-- Keep tombstones, readVersion, history bounds and all mutation paths intact.
do $patch$
declare
  spec record;
  body text;
  definition text;
  old_selector constant text := $old$
    select r.resource_key from public.storage_resources r
    where exists(select 1 from jsonb_array_elements(p_scope->'resources') selector
      where r.category=split_part(selector.value->>'path','/',2)
      and (r.resource_key=selector.value->>'path' or starts_with(r.resource_key,(selector.value->>'path')||'/'))
      and (not (selector.value ? 'students') or r.owner_number in(select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      and (not (selector.value ? 'mail') or (r.value->>'parentKey'='/studentLife/letters' and
        (r.value#>>'{data,recipient}'=selector.value#>>'{mail,actor}' or (selector.value#>>'{mail,direction}'='participant' and r.value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}')))))
$old$;
  new_selector constant text := $new$
    select distinct matched.resource_key
    from jsonb_array_elements(p_scope->'resources') selector
    cross join lateral (
      select r.resource_key from public.storage_resources r
      where r.category=split_part(selector.value->>'path','/',2)
      and (r.resource_key=selector.value->>'path' or starts_with(r.resource_key,(selector.value->>'path')||'/'))
      and (not (selector.value ? 'students') or r.owner_number in(select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      and (not (selector.value ? 'mail') or (r.value->>'parentKey'='/studentLife/letters' and
        (r.value#>>'{data,recipient}'=selector.value#>>'{mail,actor}' or (selector.value#>>'{mail,direction}'='participant' and r.value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}'))))
      offset 0
    ) matched
$new$;
begin
  for spec in select * from (values
    ('public.storage_load_scope(jsonb)', '38354d2d883a82b765412b3515d1c31a', 'cf64df3c6ca86f848f4a39d3e4e1d5b7'),
    ('public.storage_scope_read_version(jsonb)', '732b1b947e71c6da596af2316950056d', '56ad7297d33a85b22187ce828a543718')
  ) as expected(identity, old_hash, new_hash) loop
    select prosrc,pg_get_functiondef(oid) into body,definition
      from pg_proc where oid=to_regprocedure(spec.identity);
    if body is null or md5(body) not in (spec.old_hash,spec.new_hash) then
      raise exception 'STORAGE_SELECTOR_READ_VERSION_MISMATCH: %',spec.identity;
    end if;
    if md5(body)=spec.old_hash then
      if strpos(body,trim(both E'\n' from old_selector))=0 then
        raise exception 'STORAGE_SELECTOR_QUERY_MISMATCH: %',spec.identity;
      end if;
      execute replace(definition,trim(both E'\n' from old_selector),trim(both E'\n' from new_selector));
    end if;
  end loop;
end;
$patch$;

notify pgrst, 'reload schema';
commit;
