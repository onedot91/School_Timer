begin;

alter table public.storage_receipts add column if not exists scope jsonb;
create index if not exists storage_resources_updated_at on public.storage_resources(updated_at desc);
create index if not exists wallet_accounts_updated_at on public.wallet_accounts(updated_at desc);
create index if not exists storage_resources_key_prefix on public.storage_resources(resource_key text_pattern_ops);
create index if not exists storage_resources_letter_recipient on public.storage_resources((value#>>'{data,recipient}')) where value->>'parentKey'='/studentLife/letters' and not deleted;
create index if not exists storage_resources_letter_sender on public.storage_resources((value#>>'{data,senderStudentNumber}')) where value->>'parentKey'='/studentLife/letters' and not deleted;

create or replace function public.storage_validate_scope(p_scope jsonb) returns void
language plpgsql immutable set search_path=pg_catalog,public as $$
declare item jsonb; n jsonb; field text;
begin
  if p_scope is null or jsonb_typeof(p_scope)<>'object' or exists(select 1 from jsonb_object_keys(p_scope) k where k not in ('resources','wallets','history','writeResources','writeWallets','revisionKeys')) then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
  foreach field in array array['resources','writeResources','wallets','history','writeWallets'] loop
    if jsonb_typeof(p_scope->field) is distinct from 'array' then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
  end loop;
  foreach field in array array['wallets','history','writeWallets'] loop
    if jsonb_array_length(p_scope->field)>23 then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
    for n in select value from jsonb_array_elements(p_scope->field) loop
      if n::text !~ '^([1-9]|1[0-9]|2[0-3])$' then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
    end loop;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_scope->'writeWallets') n where not (p_scope->'wallets' @> jsonb_build_array(n.value))) then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
  foreach field in array array['resources','writeResources'] loop
    if jsonb_array_length(p_scope->field)>128 then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
    for item in select value from jsonb_array_elements(p_scope->field) loop
      if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'path') is distinct from 'string' or length(item->>'path') not between 2 and 1024
        or left(item->>'path',1)<>'/' or right(item->>'path',1)='/' or item->>'path' ~ '~([^01]|$)'
        or exists(select 1 from jsonb_object_keys(item) k where k not in ('path','students','mail')) then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
      if item ? 'students' then
        if jsonb_typeof(item->'students') is distinct from 'array' or jsonb_array_length(item->'students') not between 1 and 23 then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
        for n in select value from jsonb_array_elements(item->'students') loop
          if n::text !~ '^([1-9]|1[0-9]|2[0-3])$' then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
        end loop;
      end if;
      if item ? 'mail' and (item ? 'students' or jsonb_typeof(item->'mail') is distinct from 'object' or not (item->'mail' ?& array['actor','direction']) or jsonb_typeof(item#>'{mail,actor}') is distinct from 'number' or (item#>>'{mail,actor}') !~ '^([0-9]|1[0-9]|2[0-3])$'
        or jsonb_typeof(item#>'{mail,direction}') is distinct from 'string' or item#>>'{mail,direction}' not in ('participant','recipient')
        or not (item->>'path'='/studentLife/letters' or starts_with(item->>'path','/studentLife/letters/'))
        or exists(select 1 from jsonb_object_keys(item->'mail') k where k not in ('actor','direction'))) then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
    end loop;
  end loop;
  if p_scope ? 'revisionKeys' then
    if jsonb_typeof(p_scope->'revisionKeys') is distinct from 'array' or jsonb_array_length(p_scope->'revisionKeys')>512
      or exists(select 1 from jsonb_array_elements(p_scope->'revisionKeys') k where jsonb_typeof(k.value)<>'string' or length(k.value#>>'{}')>2048) then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_scope->'writeResources') w where not exists(
      select 1 from jsonb_array_elements(p_scope->'resources') r where
      (w.value->>'path'=r.value->>'path' or starts_with(w.value->>'path',(r.value->>'path')||'/'))
      and (not (r.value ? 'students') or (w.value ? 'students' and (r.value->'students') @> (w.value->'students')))
      and (not (r.value ? 'mail') or (w.value#>>'{mail,actor}'=r.value#>>'{mail,actor}' and (r.value#>>'{mail,direction}'='participant' or w.value#>>'{mail,direction}'='recipient')))
    )
  ) then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
end;
$$;

create or replace function public.storage_resource_in_scope(p_key text,p_owner integer,p_value jsonb,p_selectors jsonb) returns boolean
language sql immutable set search_path=pg_catalog,public as $$
  select exists(select 1 from jsonb_array_elements(p_selectors) selector where
    (p_key=selector.value->>'path' or starts_with(p_key,(selector.value->>'path')||'/'))
    and (not (selector.value ? 'students') or selector.value->'students' @> jsonb_build_array(p_owner))
    and (not (selector.value ? 'mail') or (p_value->>'parentKey'='/studentLife/letters' and
      (p_value#>>'{data,recipient}'=selector.value#>>'{mail,actor}' or (selector.value#>>'{mail,direction}'='participant' and p_value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}'))))
  )
$$;

create or replace function public.storage_load_scope(p_scope jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare output jsonb;
begin
  perform public.storage_validate_scope(p_scope);
  with recursive selected as materialized (
    select distinct r.* from jsonb_array_elements(p_scope->'resources') selector
    join public.storage_resources r on r.category=split_part(selector.value->>'path','/',2)
      and (r.resource_key=selector.value->>'path' or starts_with(r.resource_key,(selector.value->>'path')||'/'))
      and (not (selector.value ? 'students') or r.owner_number in(select (n.value#>>'{}')::integer from jsonb_array_elements(selector.value->'students') n))
      and (not (selector.value ? 'mail') or (r.value->>'parentKey'='/studentLife/letters' and
        (r.value#>>'{data,recipient}'=selector.value#>>'{mail,actor}' or (selector.value#>>'{mail,direction}'='participant' and r.value#>>'{data,senderStudentNumber}'=selector.value#>>'{mail,actor}'))))
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
    'kind','scoped','scope',p_scope,
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

create or replace function public.storage_commit_scoped_mutation(
  p_expected jsonb,p_resources jsonb,p_wallets jsonb,p_ledger jsonb,
  p_actor_key text,p_request_id text,p_payload_hash text,p_action text,p_result jsonb,p_archive jsonb default null,p_scope jsonb default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare item jsonb; old_row public.storage_resources%rowtype; permitted boolean; result jsonb;
begin
  perform public.storage_require_writable();
  perform public.storage_validate_scope(p_scope);
  if jsonb_typeof(p_expected) is distinct from 'object' or jsonb_typeof(p_resources) is distinct from 'array'
    or jsonb_typeof(p_wallets) is distinct from 'array' or jsonb_typeof(p_ledger) is distinct from 'array'
    or p_actor_key is null or length(p_actor_key) not between 1 and 128 or p_request_id is null or length(p_request_id) not between 1 and 200
    or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$' or p_action is null or length(p_action) not between 1 and 128 then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  perform pg_advisory_xact_lock(hashtextextended('receipt:'||p_actor_key||':'||p_request_id,0));
  -- Replay precedes validation against current rows, which may differ after this committed request.
  if exists(select 1 from public.storage_receipts where actor_key=p_actor_key and request_id=p_request_id) then
    return public.storage_commit_mutation(p_expected,p_resources,p_wallets,p_ledger,p_actor_key,p_request_id,p_payload_hash,p_action,p_result,p_archive);
  end if;
  for item in select value from jsonb_array_elements(p_resources) loop
    select * into old_row from public.storage_resources where resource_key=item->>'resource_key';
    if not (p_expected ? (item->>'resource_key')) then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
    if old_row.resource_key is not null and not old_row.deleted
      and not public.storage_resource_in_scope(old_row.resource_key,old_row.owner_number,old_row.value,p_scope->'writeResources') then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
    permitted:=public.storage_resource_in_scope(item->>'resource_key',(item->>'owner_number')::integer,item->'value',p_scope->'writeResources');
    if item->'value'='null'::jsonb then
      if old_row.resource_key is null or old_row.deleted or not public.storage_resource_in_scope(old_row.resource_key,old_row.owner_number,old_row.value,p_scope->'writeResources') then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
    elsif not permitted then
      -- Only missing structural ancestors may be synthesized, never an existing unrelated record.
      if (old_row.resource_key is not null and not old_row.deleted) or item#>>'{value,kind}' not in ('object','array') or not (
        (item->>'resource_key' in ('','/currencyBalances','/currencyHistory') and jsonb_array_length(p_scope->'writeWallets')>0)
        or (item->>'resource_key' ~ '^/currencyHistory/[0-9]+$' and p_scope->'writeWallets' @> jsonb_build_array(split_part(item->>'resource_key','/',3)::integer))
        or exists(select 1 from jsonb_array_elements(p_scope->'writeResources') s where item->>'resource_key'='' or s.value->>'path'=item->>'resource_key' or starts_with(s.value->>'path',(item->>'resource_key')||'/'))
      ) then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_wallets) w where not (p_scope->'writeWallets' @> jsonb_build_array((w.value->>'student_number')::integer)) or not (p_expected ? ('wallet:'||(w.value->>'student_number'))))
    or exists(select 1 from jsonb_array_elements(p_ledger) h where not (p_scope->'writeWallets' @> jsonb_build_array((h.value->>'student_number')::integer)) or not (p_expected ? ('wallet:'||(h.value->>'student_number')))) then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
  result:=public.storage_commit_mutation(p_expected,p_resources,p_wallets,p_ledger,p_actor_key,p_request_id,p_payload_hash,p_action,p_result,p_archive);
  if result->>'saved'='true' then
    update public.storage_receipts set scope=coalesce(scope,p_scope) where actor_key=p_actor_key and request_id=p_request_id;
  end if;
  return result;
end;
$$;

create or replace function public.storage_get_receipt(p_actor_key text,p_request_id text) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce((select jsonb_build_object('found',true,'action',action,'payloadHash',payload_hash,'result',result,'committedAt',committed_at)
   || case when scope is null then '{}'::jsonb else jsonb_build_object('scope',scope) end
 from public.storage_receipts where actor_key=p_actor_key and request_id=p_request_id),jsonb_build_object('found',false))
$$;

revoke all on function public.storage_validate_scope(jsonb),public.storage_resource_in_scope(text,integer,jsonb,jsonb),public.storage_load_scope(jsonb),public.storage_commit_scoped_mutation(jsonb,jsonb,jsonb,jsonb,text,text,text,text,jsonb,jsonb,jsonb),public.storage_get_receipt(text,text) from public,anon,authenticated;
grant execute on function public.storage_validate_scope(jsonb),public.storage_resource_in_scope(text,integer,jsonb,jsonb),public.storage_load_scope(jsonb),public.storage_commit_scoped_mutation(jsonb,jsonb,jsonb,jsonb,text,text,text,text,jsonb,jsonb,jsonb),public.storage_get_receipt(text,text) to service_role;
commit;
