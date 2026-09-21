begin;

create or replace function public.storage_scope_read_version(p_scope jsonb) returns text
language plpgsql stable security definer set search_path=pg_catalog,public set jit=off as $$
declare output text;
begin
  perform public.storage_validate_scope(p_scope);
  with recursive selected as materialized (
    select r.resource_key from public.storage_resources r
    where exists(select 1 from jsonb_array_elements(p_scope->'resources') selector
      where r.category=split_part(selector.value->>'path','/',2)
      and (r.resource_key=selector.value->>'path' or starts_with(r.resource_key,(selector.value->>'path')||'/'))
      and (not (selector.value ? 'students') or r.owner_number in(select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      and (not (selector.value ? 'mail') or (r.value->>'parentKey'='/studentLife/letters' and
        (r.value#>>'{data,recipient}'=selector.value#>>'{mail,actor}' or (selector.value#>>'{mail,direction}'='participant' and r.value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}')))))
  ), roots as (
    select value->>'path' key from jsonb_array_elements(p_scope->'resources')
    union select ''
    union select '/currencyBalances' where jsonb_array_length(p_scope->'wallets')>0
    union select '/currencyHistory' where jsonb_array_length(p_scope->'history')>0
    union select '/currencyHistory/'||(value#>>'{}') from jsonb_array_elements(p_scope->'history')
  ), closure as (
    select r.resource_key,r.value->>'parentKey' parent_key from public.storage_resources r where r.resource_key in(select resource_key from selected) or (r.resource_key in(select key from roots) and r.value->>'kind' in ('object','array'))
    union
    select r.resource_key,r.value->>'parentKey' from public.storage_resources r join closure child on child.parent_key=r.resource_key
  ), nodes as materialized (
    select r.resource_key,r.revision,r.deleted from public.storage_resources r join closure c using(resource_key)

  ), versions as (
    select resource_key key,revision,deleted from nodes
    union all
    select 'wallet:'||student_number,revision,false from public.wallet_accounts
    where student_number in (select (value#>>'{}')::integer from jsonb_array_elements((p_scope->'wallets')||(p_scope->'history')))
  )
  select md5(jsonb_build_array(p_scope,
    (select updated_at from public.storage_control where singleton),
    coalesce((select jsonb_agg(jsonb_build_array(key,revision,deleted) order by key) from versions),'[]'::jsonb))::text)
  into output;
  return output;
end;
$$;

create or replace function public.storage_load_scope_metadata(p_scope jsonb) returns jsonb
language sql stable security definer set search_path=pg_catalog,public set jit=off as $$
  select jsonb_build_object('updatedAt',public.storage_load_updated_at(),'readVersion',public.storage_scope_read_version(p_scope))
$$;

create or replace function public.storage_load_scope(p_scope jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public set jit=off as $$
declare output jsonb;
begin
  perform public.storage_validate_scope(p_scope);
  with recursive selected as materialized (
    select r.resource_key from public.storage_resources r
    where exists(select 1 from jsonb_array_elements(p_scope->'resources') selector
      where r.category=split_part(selector.value->>'path','/',2)
      and (r.resource_key=selector.value->>'path' or starts_with(r.resource_key,(selector.value->>'path')||'/'))
      and (not (selector.value ? 'students') or r.owner_number in(select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      and (not (selector.value ? 'mail') or (r.value->>'parentKey'='/studentLife/letters' and
        (r.value#>>'{data,recipient}'=selector.value#>>'{mail,actor}' or (selector.value#>>'{mail,direction}'='participant' and r.value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}')))))
  ), roots as (
    select value->>'path' key from jsonb_array_elements(p_scope->'resources')
    union select ''
    union select '/currencyBalances' where jsonb_array_length(p_scope->'wallets')>0
    union select '/currencyHistory' where jsonb_array_length(p_scope->'history')>0
    union select '/currencyHistory/'||(value#>>'{}') from jsonb_array_elements(p_scope->'history')
  ), closure as (
    select r.resource_key,r.value->>'parentKey' parent_key from public.storage_resources r where r.resource_key in(select resource_key from selected) or (r.resource_key in(select key from roots) and r.value->>'kind' in ('object','array'))
    union
    select r.resource_key,r.value->>'parentKey' from public.storage_resources r join closure child on child.parent_key=r.resource_key
  ), nodes as materialized (
    select r.* from public.storage_resources r join closure c using(resource_key)
  ), synthetic as (
    select key resource_key,split_part(key,'/',2) category,
      case when key ~ '^/currencyHistory/[0-9]+$' then split_part(key,'/',3)::integer else null end owner_number,
      jsonb_build_object('kind',case when key ~ '^/currencyHistory/[0-9]+$' then 'array' else 'object' end,
        'parentKey',case when key='' then null when key ~ '^/currencyHistory/[0-9]+$' then '/currencyHistory' else '' end,
        'member',case when key='' then '' when key ~ '^/currencyHistory/[0-9]+$' then split_part(key,'/',3) else substring(key from 2) end) value
    from roots where (key='' or key='/currencyBalances' or key='/currencyHistory' or key ~ '^/currencyHistory/[0-9]+$')
      and not exists(select 1 from public.storage_resources r where r.resource_key=key and not deleted)
  ), wallet_students as (
    select (value#>>'{}')::integer student_number from jsonb_array_elements(p_scope->'wallets')
  ), history_students as (
    select (value#>>'{}')::integer student_number from jsonb_array_elements(p_scope->'history')
  ), revision_keys as (
    select value#>>'{}' key from jsonb_array_elements(coalesce(p_scope->'revisionKeys','[]'::jsonb))
    union select resource_key from nodes
    union select key from roots
    union select 'wallet:'||student_number from wallet_students
    union select 'wallet:'||student_number from history_students
    union select public.storage_scope_keys(category,owner_number,value) from nodes
    union select 'collection:'||(value->>'path') from jsonb_array_elements(p_scope->'resources')
    union select 'scope:'||split_part(value->>'path','/',2)||':all' from jsonb_array_elements(p_scope->'resources')
    union select 'scope:'||split_part(s.value->>'path','/',2)||':'||(n.value#>>'{}') from jsonb_array_elements(p_scope->'resources') s cross join lateral jsonb_array_elements(coalesce(s.value->'students','[]'::jsonb)) n
  ), versions as (
    select keys.key,coalesce(r.revision,w.revision,s.revision,0) revision from revision_keys keys
    left join public.storage_resources r on r.resource_key=keys.key
    left join public.wallet_accounts w on keys.key='wallet:'||w.student_number
    left join public.storage_scopes s on s.scope_key=keys.key
  ), array_parents as (
    select resource_key key from nodes where value->>'kind'='array' and not deleted
  ), bounds as (
    select p.key,coalesce(min((r.value->>'order')::double precision),0) minimum,coalesce(max((r.value->>'order')::double precision),0) maximum
    from array_parents p left join public.storage_resources r on r.value->>'parentKey'=p.key and not r.deleted group by p.key
  )
  select jsonb_build_object(
    'kind','scoped','scope',p_scope,'readVersion',md5(jsonb_build_array(p_scope,
      (select updated_at from public.storage_control where singleton),
      coalesce((select jsonb_agg(jsonb_build_array(key,revision,deleted) order by key) from (
        select resource_key key,revision,deleted from nodes
        union all
        select 'wallet:'||student_number,revision,false from public.wallet_accounts
        where student_number in(select student_number from wallet_students union select student_number from history_students)
      ) read_versions),'[]'::jsonb))::text),
    'resources',coalesce((select jsonb_agg(to_jsonb(r)) from nodes r where not deleted),'[]'::jsonb)||coalesce((select jsonb_agg(to_jsonb(r)) from synthetic r),'[]'::jsonb),
    'wallets',coalesce((select jsonb_agg(to_jsonb(w)) from public.wallet_accounts w where student_number in(select student_number from wallet_students)),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)) from public.wallet_ledger h where student_number in(select student_number from history_students)),'[]'::jsonb),
    'deletedKeys',coalesce((select jsonb_agg(resource_key) from nodes where deleted),'[]'::jsonb),
    'revisions',coalesce((select jsonb_object_agg(key,revision) from versions),'{}'::jsonb),
    'orderingBounds',coalesce((select jsonb_object_agg(key,jsonb_build_object('minimum',minimum,'maximum',maximum)) from bounds),'{}'::jsonb),
    'updated_at',(select greatest(coalesce((select max(updated_at) from public.storage_resources),'epoch'),coalesce((select max(updated_at) from public.wallet_accounts),'epoch'),updated_at) from public.storage_control where singleton)
  ) into output;
  return output;
end;
$$;

revoke all on function public.storage_scope_read_version(jsonb),public.storage_load_scope_metadata(jsonb),public.storage_load_scope(jsonb) from public,anon,authenticated;
grant execute on function public.storage_scope_read_version(jsonb),public.storage_load_scope_metadata(jsonb),public.storage_load_scope(jsonb) to service_role;

commit;
