begin;
set local lock_timeout='2s';
set local statement_timeout='8s';

-- Scoped reads walk ancestors once per distinct parent and keep the rows they already read,
-- instead of re-reading every selected row by key three times (2026-10-23 classroom timeouts).
do $patch$
declare
  rollback_mode constant boolean := false;
  specs constant text[][] := array[
    array['public.storage_load_scope(jsonb)','6916f9db14ee774148259dbaa7566558','8989e478b4e372f8d47aedeac36ec4f7',$old$  with recursive selected as materialized (
    select distinct matched.resource_key
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
    ) matched
  ), roots as (
    select value->>'path' key from jsonb_array_elements(p_scope->'resources')
    union select ''
    union select '/currencyBalances' where jsonb_array_length(p_scope->'wallets')>0
    union select '/currencyHistory' where jsonb_array_length(p_scope->'history')>0
    union select '/currencyHistory/'||(value#>>'{}') from jsonb_array_elements(p_scope->'history')
  ), closure as (
    select r.resource_key,r.value->>'parentKey' parent_key
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
    ) r
    union
    select r.resource_key,r.value->>'parentKey' from closure child
    cross join lateral (
      select r.resource_key,r.value from public.storage_resources r
      where r.resource_key=child.parent_key offset 0
    ) r
  ), nodes as materialized (
    select r.* from closure c
    cross join lateral (
      select r.* from public.storage_resources r where r.resource_key=c.resource_key offset 0
    ) r
$old$,$new$  with recursive selected as materialized (
    select distinct on (matched.resource_key) matched.*
    from jsonb_array_elements(p_scope->'resources') selector
    cross join lateral (
      select r.* from public.storage_resources r
      where not (selector.value ? 'mail') and r.category=split_part(selector.value->>'path','/',2)
        and (r.resource_key=selector.value->>'path'
          or (r.resource_key ~>=~ ((selector.value->>'path')||'/')
            and r.resource_key ~<~ ((selector.value->>'path')||'0')))
        and (not (selector.value ? 'students') or r.owner_number in
          (select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      union all
      select r.* from public.storage_resources r
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
      select r.* from public.storage_resources r
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
    ) matched
  ), roots as (
    select value->>'path' key from jsonb_array_elements(p_scope->'resources')
    union select ''
    union select '/currencyBalances' where jsonb_array_length(p_scope->'wallets')>0
    union select '/currencyHistory' where jsonb_array_length(p_scope->'history')>0
    union select '/currencyHistory/'||(value#>>'{}') from jsonb_array_elements(p_scope->'history')
  ), seeds as materialized (
    select * from selected
    union all
    select r.* from roots
    cross join lateral (
      select r.* from public.storage_resources r
      where r.resource_key=roots.key and r.value->>'kind' in ('object','array')
      offset 0
    ) r
    where not exists(select 1 from selected s where s.resource_key=roots.key)
  ), ancestors as (
    select r.* from (select distinct s.value->>'parentKey' key from seeds s) parents
    cross join lateral (
      select r.* from public.storage_resources r where r.resource_key=parents.key offset 0
    ) r
    union
    select r.* from ancestors child
    cross join lateral (
      select r.* from public.storage_resources r where r.resource_key=child.value->>'parentKey' offset 0
    ) r
  ), nodes as materialized (
    select * from seeds
    union all
    select a.* from ancestors a where not exists(select 1 from seeds s where s.resource_key=a.resource_key)
$new$],
    array['public.storage_scope_read_version(jsonb)','6866cb51793ad8b48f47a681f28c89a1','da3fc297c2f2155bd1dc9b58f1d2990e',$old$  with recursive selected as materialized (
    select distinct matched.resource_key
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
    ) matched
  ), roots as (
    select value->>'path' key from jsonb_array_elements(p_scope->'resources')
    union select ''
    union select '/currencyBalances' where jsonb_array_length(p_scope->'wallets')>0
    union select '/currencyHistory' where jsonb_array_length(p_scope->'history')>0
    union select '/currencyHistory/'||(value#>>'{}') from jsonb_array_elements(p_scope->'history')
  ), closure as (
    select r.resource_key,r.value->>'parentKey' parent_key
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
    ) r
    union
    select r.resource_key,r.value->>'parentKey' from closure child
    cross join lateral (
      select r.resource_key,r.value from public.storage_resources r
      where r.resource_key=child.parent_key offset 0
    ) r
  ), nodes as materialized (
    select r.resource_key,r.revision,r.deleted from closure c
    cross join lateral (
      select r.resource_key,r.revision,r.deleted from public.storage_resources r
      where r.resource_key=c.resource_key offset 0
    ) r

$old$,$new$  with recursive selected as materialized (
    select distinct on (matched.resource_key) matched.*
    from jsonb_array_elements(p_scope->'resources') selector
    cross join lateral (
      select r.resource_key,r.value->>'parentKey' parent_key,r.revision,r.deleted from public.storage_resources r
      where not (selector.value ? 'mail') and r.category=split_part(selector.value->>'path','/',2)
        and (r.resource_key=selector.value->>'path'
          or (r.resource_key ~>=~ ((selector.value->>'path')||'/')
            and r.resource_key ~<~ ((selector.value->>'path')||'0')))
        and (not (selector.value ? 'students') or r.owner_number in
          (select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      union all
      select r.resource_key,r.value->>'parentKey' parent_key,r.revision,r.deleted from public.storage_resources r
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
      select r.resource_key,r.value->>'parentKey' parent_key,r.revision,r.deleted from public.storage_resources r
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
    ) matched
  ), roots as (
    select value->>'path' key from jsonb_array_elements(p_scope->'resources')
    union select ''
    union select '/currencyBalances' where jsonb_array_length(p_scope->'wallets')>0
    union select '/currencyHistory' where jsonb_array_length(p_scope->'history')>0
    union select '/currencyHistory/'||(value#>>'{}') from jsonb_array_elements(p_scope->'history')
  ), seeds as materialized (
    select * from selected
    union all
    select r.resource_key,r.value->>'parentKey',r.revision,r.deleted from roots
    cross join lateral (
      select r.resource_key,r.value,r.revision,r.deleted from public.storage_resources r
      where r.resource_key=roots.key and r.value->>'kind' in ('object','array')
      offset 0
    ) r
    where not exists(select 1 from selected s where s.resource_key=roots.key)
  ), ancestors as (
    select r.resource_key,r.value->>'parentKey' parent_key,r.revision,r.deleted
    from (select distinct s.parent_key key from seeds s) parents
    cross join lateral (
      select r.resource_key,r.value,r.revision,r.deleted from public.storage_resources r
      where r.resource_key=parents.key offset 0
    ) r
    union
    select r.resource_key,r.value->>'parentKey',r.revision,r.deleted from ancestors child
    cross join lateral (
      select r.resource_key,r.value,r.revision,r.deleted from public.storage_resources r
      where r.resource_key=child.parent_key offset 0
    ) r
  ), nodes as materialized (
    select resource_key,revision,deleted from seeds
    union all
    select a.resource_key,a.revision,a.deleted from ancestors a
    where not exists(select 1 from seeds s where s.resource_key=a.resource_key)

$new$]
  ];
  spec text[]; body text; definition text; target text; expected text;
begin
  foreach spec slice 1 in array specs loop
    select prosrc,pg_get_functiondef(oid) into body,definition
      from pg_proc where oid=to_regprocedure(spec[1]);
    if body is null or md5(body) not in (spec[2],spec[3]) then
      raise exception 'STORAGE_SCOPE_READ_BUFFERS_VERSION_MISMATCH: %',spec[1];
    end if;
    target:=case when rollback_mode then replace(body,spec[5],spec[4]) else replace(body,spec[4],spec[5]) end;
    expected:=case when rollback_mode then spec[2] else spec[3] end;
    if md5(target)<>expected then
      raise exception 'STORAGE_SCOPE_READ_BUFFERS_PATCH_MISMATCH: %',spec[1];
    end if;
    if body<>target then execute replace(definition,body,target); end if;
  end loop;
end;
$patch$;
notify pgrst, 'reload schema';
commit;
