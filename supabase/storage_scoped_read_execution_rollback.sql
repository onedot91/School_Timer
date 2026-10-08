begin;
set local lock_timeout='2s';
set local statement_timeout='8s';

do $patch$
declare
  rollback_mode constant boolean := true;
  fragments constant text[][] := array[
    array[$old$    select r.resource_key from public.storage_resources r
    where exists(select 1 from jsonb_array_elements(p_scope->'resources') selector
      where r.category=split_part(selector.value->>'path','/',2)
      and (r.resource_key=selector.value->>'path' or starts_with(r.resource_key,(selector.value->>'path')||'/'))
      and (not (selector.value ? 'students') or r.owner_number in(select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      and (not (selector.value ? 'mail') or (r.value->>'parentKey'='/studentLife/letters' and
        (r.value#>>'{data,recipient}'=selector.value#>>'{mail,actor}' or (selector.value#>>'{mail,direction}'='participant' and r.value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}')))))$old$,$new$    select distinct matched.resource_key
    from jsonb_array_elements(p_scope->'resources') selector
    cross join lateral (
      select r.resource_key from public.storage_resources r
      where not (selector.value ? 'mail') and r.category=split_part(selector.value->>'path','/',2)
        and (r.resource_key=selector.value->>'path'
          or (r.resource_key ~>=~ ((selector.value->>'path')||'/')
            and r.resource_key ~<~ ((selector.value->>'path')||'0')))
        and (not (selector.value ? 'students') or r.owner_number in
          (select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      union all
      select r.resource_key from public.storage_resources r
      where selector.value ? 'mail' and not r.deleted and r.value->>'parentKey'='/studentLife/letters'
        and (r.value#>>'{data,recipient}'=selector.value#>>'{mail,actor}'
          or (selector.value#>>'{mail,direction}'='participant'
            and r.value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}'))
        and r.category=split_part(selector.value->>'path','/',2)
        and (r.resource_key=selector.value->>'path'
          or (r.resource_key ~>=~ ((selector.value->>'path')||'/')
            and r.resource_key ~<~ ((selector.value->>'path')||'0')))
        and (not (selector.value ? 'students') or r.owner_number in
          (select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      union all
      select r.resource_key from public.storage_resources r
      where selector.value ? 'mail' and r.deleted and r.value->>'parentKey'='/studentLife/letters'
        and (r.value#>>'{data,recipient}'=selector.value#>>'{mail,actor}'
          or (selector.value#>>'{mail,direction}'='participant'
            and r.value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}'))
        and r.category=split_part(selector.value->>'path','/',2)
        and (r.resource_key=selector.value->>'path'
          or (r.resource_key ~>=~ ((selector.value->>'path')||'/')
            and r.resource_key ~<~ ((selector.value->>'path')||'0')))
        and (not (selector.value ? 'students') or r.owner_number in
          (select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      offset 0
    ) matched$new$],
    array[$old$    select r.resource_key,r.value->>'parentKey' parent_key from public.storage_resources r where r.resource_key in(select resource_key from selected) or (r.resource_key in(select key from roots) and r.value->>'kind' in ('object','array'))$old$,$new$    select r.resource_key,r.value->>'parentKey' parent_key
    from (
      select resource_key from selected
      union
      select r.resource_key from roots
      cross join lateral (
        select r.resource_key from public.storage_resources r
        where r.resource_key=roots.key and r.value->>'kind' in ('object','array')
        offset 0
      ) r
    ) keys
    cross join lateral (
      select r.resource_key,r.value from public.storage_resources r
      where r.resource_key=keys.resource_key offset 0
    ) r$new$],
    array[$old$    select r.resource_key,r.value->>'parentKey' from public.storage_resources r join closure child on child.parent_key=r.resource_key$old$,$new$    select r.resource_key,r.value->>'parentKey' from closure child
    cross join lateral (
      select r.resource_key,r.value from public.storage_resources r
      where r.resource_key=child.parent_key offset 0
    ) r$new$],
    array[$old$    select r.* from public.storage_resources r where r.resource_key in(select resource_key from closure)$old$,$new$    select r.* from closure c
    cross join lateral (
      select r.* from public.storage_resources r where r.resource_key=c.resource_key offset 0
    ) r$new$],
    array[$old$    select r.resource_key,r.revision,r.deleted from public.storage_resources r join closure c using(resource_key)$old$,$new$    select r.resource_key,r.revision,r.deleted from closure c
    cross join lateral (
      select r.resource_key,r.revision,r.deleted from public.storage_resources r
      where r.resource_key=c.resource_key offset 0
    ) r$new$],
    array[$old$    select p.key,coalesce(min((r.value->>'order')::double precision),0) minimum,coalesce(max((r.value->>'order')::double precision),0) maximum
    from array_parents p left join public.storage_resources r on r.value->>'parentKey'=p.key and not r.deleted group by p.key$old$,$new$    select p.key,b.minimum,b.maximum from array_parents p
    cross join lateral (
      select coalesce(min((r.value->>'order')::double precision),0) minimum,
        coalesce(max((r.value->>'order')::double precision),0) maximum
      from public.storage_resources r
      where r.value->>'parentKey'=p.key and not r.deleted
      offset 0
    ) b$new$]
  ];
  spec record; fragment text[]; body text; definition text; baseline text; candidate text; target text;
begin
  for spec in select * from (values
    ('public.storage_load_scope(jsonb)','38354d2d883a82b765412b3515d1c31a'),
    ('public.storage_scope_read_version(jsonb)','732b1b947e71c6da596af2316950056d')
  ) expected(identity,baseline_hash) loop
    select prosrc,pg_get_functiondef(oid) into body,definition
      from pg_proc where oid=to_regprocedure(spec.identity);
    baseline:=body;
    foreach fragment slice 1 in array fragments loop
      baseline:=replace(baseline,fragment[2],fragment[1]);
    end loop;
    candidate:=baseline;
    foreach fragment slice 1 in array fragments loop
      candidate:=replace(candidate,fragment[1],fragment[2]);
    end loop;
    if body is null or md5(baseline)<>spec.baseline_hash or md5(body) not in (spec.baseline_hash,md5(candidate)) then
      raise exception 'STORAGE_READ_EXECUTION_VERSION_MISMATCH: %',spec.identity;
    end if;
    target:=case when rollback_mode then baseline else candidate end;
    if body<>target then execute replace(definition,body,target); end if;
  end loop;
end;
$patch$;
notify pgrst, 'reload schema';
commit;
