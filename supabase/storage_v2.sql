begin;

create table if not exists public.storage_control (
  singleton boolean primary key default true check (singleton),
  active boolean not null default false,
  maintenance boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);
insert into public.storage_control(singleton) values(true) on conflict do nothing;
create table if not exists public.storage_resources (
  resource_key text primary key,
  category text not null,
  owner_number integer check(owner_number between 1 and 23),
  value jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp(),
  check (value->>'kind' in ('object','array','value'))
);
alter table public.storage_resources add column if not exists deleted boolean not null default false;
create index if not exists storage_resources_category_owner on public.storage_resources(category,owner_number);
create index if not exists storage_resources_parent on public.storage_resources((value->>'parentKey'));
create table if not exists public.storage_scopes (
  scope_key text primary key,
  revision bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.wallet_accounts (
  student_number integer primary key check(student_number between 1 and 23),
  balance integer not null check(balance between 0 and 999999),
  opening_balance integer not null check(opening_balance between 0 and 999999),
  revision bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.wallet_ledger (
  resource_key text primary key,
  entry_id text not null,
  student_number integer not null references public.wallet_accounts(student_number),
  delta integer not null,
  balance_before integer,
  balance_after integer,
  reason text not null,
  created_at timestamptz not null,
  operation_id text not null,
  historical boolean not null default false,
  sort_order double precision not null,
  value jsonb not null,
  recorded_at timestamptz not null default clock_timestamp(),
  check(historical or (balance_before between 0 and 999999 and balance_after between 0 and 999999 and balance_after-balance_before=delta))
);
create unique index if not exists wallet_ledger_live_entry on public.wallet_ledger(student_number,entry_id) where not historical;
create index if not exists wallet_ledger_student_order on public.wallet_ledger(student_number,sort_order);
create table if not exists public.storage_receipts (
  actor_key text not null,
  request_id text not null,
  action text not null,
  payload_hash text not null,
  result jsonb not null,
  committed_at timestamptz not null default clock_timestamp(),
  primary key(actor_key,request_id)
);
create table if not exists public.storage_reward_claims (
  claim_id text primary key,
  student_number integer not null check(student_number between 1 and 23),
  value jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create table if not exists public.storage_backups (
  backup_id bigint generated always as identity primary key,
  source_updated_at timestamptz not null,
  value jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);

create or replace function public.storage_require_writable() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare state public.storage_control%rowtype;
begin
  -- Shared locks admit concurrent writers; cutover's exclusive lock drains every active transaction.
  perform pg_advisory_xact_lock_shared(726314925132::bigint);
  select * into state from public.storage_control where singleton;
  if not state.active then raise exception 'STORAGE_NOT_ACTIVE'; end if;
  if state.maintenance then raise exception 'STORAGE_MAINTENANCE'; end if;
end;
$$;
create or replace function public.storage_set_maintenance(p_maintenance boolean,p_active boolean default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform pg_advisory_xact_lock(726314925132::bigint);
  if p_active is true and not exists(select 1 from public.storage_backups) then raise exception 'STORAGE_NOT_MIGRATED'; end if;
  if p_active is false and (exists(select 1 from public.wallet_ledger where not historical) or exists(select 1 from public.storage_receipts) or exists(select 1 from public.storage_resources where revision>1)) then raise exception 'STORAGE_ROLLBACK_REQUIRES_FORWARD_RECOVERY'; end if;
  update public.storage_control set maintenance=p_maintenance,active=coalesce(p_active,active),updated_at=clock_timestamp() where singleton;
  return (select to_jsonb(c) from public.storage_control c where singleton);
end;
$$;
create or replace function public.storage_guard_legacy() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare controlled_id text;
begin
  controlled_id := case when tg_op='DELETE' then old.id else new.id end;
  if controlled_id='school-timer-main' then
    perform pg_advisory_xact_lock_shared(726314925132::bigint);
    if exists(select 1 from public.storage_control where singleton and (active or maintenance)) then raise exception 'STORAGE_LEGACY_WRITE_DISABLED'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists storage_guard_legacy on public.app_settings;
create trigger storage_guard_legacy before insert or update or delete on public.app_settings for each row execute function public.storage_guard_legacy();
create or replace function public.storage_immutable_ledger() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin raise exception 'STORAGE_LEDGER_IMMUTABLE'; end;
$$;
drop trigger if exists storage_immutable_ledger on public.wallet_ledger;
create trigger storage_immutable_ledger before update or delete on public.wallet_ledger for each row execute function public.storage_immutable_ledger();
drop trigger if exists storage_immutable_backup on public.storage_backups;
create trigger storage_immutable_backup before update or delete on public.storage_backups for each row execute function public.storage_immutable_ledger();

create or replace function public.storage_scope_keys(p_category text,p_owner_number integer,p_value jsonb) returns setof text
language sql immutable set search_path=pg_catalog,public as $$
  select distinct k from (values('scope:'||p_category||':all'),('scope:'||p_category||':'||coalesce(p_owner_number::text,'shared')),
    (case when p_value->>'parentKey' is not null then 'collection:'||(p_value->>'parentKey') end)) keys(k) where k is not null
$$;
create or replace function public.storage_write_resource(p_resource_key text,p_category text,p_owner_number integer,p_value jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare prior public.storage_resources%rowtype; k text;
begin
  perform public.storage_require_writable();
  if p_resource_key is null or p_category is null or length(p_resource_key)>16000 or (p_value is not null and (jsonb_typeof(p_value)<>'object' or p_value->>'kind' not in ('value','array','object'))) then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  select * into prior from public.storage_resources where resource_key=p_resource_key;
  for k in select q.key from (
    select public.storage_scope_keys(p_category,p_owner_number,p_value) key
    union select public.storage_scope_keys(prior.category,prior.owner_number,prior.value) where prior.resource_key is not null
  ) q order by q.key loop
    perform pg_advisory_xact_lock(hashtextextended('scope:'||k,0));
    insert into public.storage_scopes(scope_key) values(k) on conflict(scope_key) do update set revision=storage_scopes.revision+1,updated_at=clock_timestamp();
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('resource:'||p_resource_key,0));
  if p_value is null then update public.storage_resources set deleted=true,revision=revision+1,updated_at=clock_timestamp() where resource_key=p_resource_key;
  else insert into public.storage_resources(resource_key,category,owner_number,value) values(p_resource_key,p_category,p_owner_number,p_value)
    on conflict(resource_key) do update set category=excluded.category,owner_number=excluded.owner_number,value=excluded.value,deleted=false,revision=storage_resources.revision+1,updated_at=clock_timestamp();
  end if;
end;
$$;
create or replace function public.storage_apply_wallet_delta(p_student_number integer,p_entry_id text,p_delta integer,p_reason text,p_created_at timestamptz,p_operation_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare account public.wallet_accounts%rowtype; existing public.wallet_ledger%rowtype; next_balance integer; entry jsonb; position double precision; member text; resource_key_value text;
begin
  perform public.storage_require_writable();
  if p_student_number not between 1 and 23 or p_entry_id is null or length(p_entry_id) not between 1 and 1000 or p_reason is null or p_operation_id is null or p_delta is null or p_created_at is null then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  select * into account from public.wallet_accounts where student_number=p_student_number for update;
  if not found then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  select * into existing from public.wallet_ledger where student_number=p_student_number and entry_id=p_entry_id limit 1;
  if found then
    if existing.delta<>p_delta or existing.reason<>p_reason then raise exception 'STORAGE_REQUEST_REUSED'; end if;
    return jsonb_build_object('balance',account.balance,'entry',existing.value->'data','awarded',false);
  end if;
  next_balance:=account.balance+p_delta;
  if next_balance not between 0 and 999999 then raise exception 'STORAGE_BALANCE_MISMATCH'; end if;
  entry:=jsonb_build_object('id',p_entry_id,'studentNumber',p_student_number,'delta',p_delta,'before',account.balance,'after',next_balance,'reason',p_reason,'createdAt',to_char(p_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  select coalesce(min(sort_order),0)-1 into position from public.wallet_ledger where student_number=p_student_number;
  member:='@'||p_entry_id;
  resource_key_value:='/currencyHistory/'||p_student_number||'/'||replace(replace(member,'~','~0'),'/','~1');
  insert into public.wallet_ledger(resource_key,entry_id,student_number,delta,balance_before,balance_after,reason,created_at,operation_id,sort_order,value)
    values(resource_key_value,p_entry_id,p_student_number,p_delta,account.balance,next_balance,p_reason,p_created_at,p_operation_id,position,
      jsonb_build_object('kind','value','parentKey','/currencyHistory/'||p_student_number,'member',member,'order',position,'data',entry));
  update public.wallet_accounts set balance=next_balance,revision=revision+1,updated_at=clock_timestamp() where student_number=p_student_number;
  return jsonb_build_object('balance',next_balance,'entry',entry,'awarded',true);
end;
$$;

create or replace function public.storage_load_snapshot() returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
  select jsonb_build_object(
    'resources',coalesce((select jsonb_agg(to_jsonb(r)) from public.storage_resources r where not deleted),'[]'::jsonb),
    'wallets',coalesce((select jsonb_agg(to_jsonb(w)) from public.wallet_accounts w),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)) from public.wallet_ledger h),'[]'::jsonb),
    'updated_at',(select greatest(coalesce((select max(updated_at) from public.storage_resources),'epoch'),coalesce((select max(updated_at) from public.wallet_accounts),'epoch'),updated_at) from public.storage_control where singleton),
    'revisions',coalesce((select jsonb_object_agg(key,revision) from (
      select resource_key key,revision from public.storage_resources union all
      select 'wallet:'||student_number,revision from public.wallet_accounts union all
      select scope_key,revision from public.storage_scopes
    ) versions),'{}'::jsonb)
  )
$$;
create or replace function public.storage_get_receipt(p_actor_key text,p_request_id text) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce((select jsonb_build_object('found',true,'action',action,'payloadHash',payload_hash,'result',result,'committedAt',committed_at)
 from public.storage_receipts where actor_key=p_actor_key and request_id=p_request_id),jsonb_build_object('found',false))
$$;

create or replace function public.storage_commit_mutation(
  p_expected jsonb,p_resources jsonb,p_wallets jsonb,p_ledger jsonb,
  p_actor_key text,p_request_id text,p_payload_hash text,p_action text,p_result jsonb,p_archive jsonb default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare receipt public.storage_receipts%rowtype; item jsonb; prior public.storage_resources%rowtype; k text; wanted bigint; actual bigint; student integer; target integer; account public.wallet_accounts%rowtype; entry jsonb; delta_total bigint; running_balance integer; position double precision; changed_at timestamptz; library_old_season text; library_next_season text; library_books jsonb; library_archive_books jsonb;
begin
  perform public.storage_require_writable();
  p_result:=coalesce(p_result,'null'::jsonb);
  if jsonb_typeof(p_expected)<>'object' or jsonb_typeof(p_resources)<>'array' or jsonb_typeof(p_wallets)<>'array' or jsonb_typeof(p_ledger)<>'array'
    or length(p_actor_key) not between 1 and 128 or length(p_request_id) not between 1 and 200 or p_payload_hash !~ '^[a-f0-9]{64}$' or length(p_action) not between 1 and 128 or p_result is null then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  perform pg_advisory_xact_lock(hashtextextended('receipt:'||p_actor_key||':'||p_request_id,0));
  select * into receipt from public.storage_receipts where actor_key=p_actor_key and request_id=p_request_id;
  if found then
    if receipt.payload_hash<>p_payload_hash or receipt.action<>p_action then raise exception 'STORAGE_REQUEST_REUSED'; end if;
    return jsonb_build_object('saved',true,'result',receipt.result,'updatedAt',receipt.committed_at,'replayed',true);
  end if;
  -- Wallets precede feature locks in every writer, including reward and donation RPCs.
  for student in select distinct n from (
    select (value->>'student_number')::integer n from jsonb_array_elements(p_wallets)
    union select (value->>'student_number')::integer from jsonb_array_elements(p_ledger)
    union select substring(key from 8)::integer from jsonb_object_keys(p_expected) key where key like 'wallet:%'
  ) students order by n loop
    perform 1 from public.wallet_accounts where student_number=student for update;
  end loop;
  -- Lock all affected scope counters in the same order before changing any resource.
  for k in select distinct key from (
    select public.storage_scope_keys(value->>'category',(value->>'owner_number')::integer,value->'value') key from jsonb_array_elements(p_resources)
    union select public.storage_scope_keys(r.category,r.owner_number,r.value) from public.storage_resources r join jsonb_array_elements(p_resources) c on r.resource_key=c.value->>'resource_key'
    union select key from jsonb_object_keys(p_expected) key where key like 'scope:%' or key like 'collection:%'
  ) scopes where key is not null order by key loop
    perform pg_advisory_xact_lock(hashtextextended('scope:'||k,0));
  end loop;
  -- Absent resources get an advisory lock too; unrelated record inserts never conflict.
  for k in select key from jsonb_object_keys(p_expected) key where key not like 'wallet:%' order by key loop
    perform pg_advisory_xact_lock(hashtextextended('resource:'||k,0));
  end loop;
  for k,wanted in select key,value::bigint from jsonb_each_text(p_expected) loop
    actual:=null;
    if k like 'wallet:%' then select revision into actual from public.wallet_accounts where student_number=substring(k from 8)::integer;
    elsif k like 'scope:%' or k like 'collection:%' then select revision into actual from public.storage_scopes where scope_key=k;
    else select revision into actual from public.storage_resources where resource_key=k; end if;
    if coalesce(actual,0)<>wanted then return jsonb_build_object('saved',false); end if;
  end loop;
  for student in select distinct n from (
    select (value->>'student_number')::integer n from jsonb_array_elements(p_wallets)
    union select (value->>'student_number')::integer from jsonb_array_elements(p_ledger)
  ) students order by n loop
    select * into account from public.wallet_accounts where student_number=student for update;
    if not found then raise exception 'STORAGE_INVALID_MUTATION'; end if;
    target:=coalesce((select (value->>'balance')::integer from jsonb_array_elements(p_wallets) where (value->>'student_number')::integer=student),account.balance);
    select coalesce(sum((value#>>'{value,data,delta}')::integer),0) into delta_total from jsonb_array_elements(p_ledger) where (value->>'student_number')::integer=student;
    if target not between 0 and 999999 or target-account.balance<>delta_total then raise exception 'STORAGE_BALANCE_MISMATCH'; end if;
    running_balance:=account.balance;
    select coalesce(min(sort_order),0) into position from public.wallet_ledger where student_number=student;
    -- New history is displayed newest first, but money is applied oldest first.
    for item in select value from jsonb_array_elements(p_ledger) where (value->>'student_number')::integer=student order by (value->>'sort_order')::double precision desc loop
      entry:=item#>'{value,data}';
      if jsonb_typeof(entry)<>'object' or entry->>'id' is distinct from item->>'entry_id' or (entry->>'studentNumber')::integer<>student
        or (entry->>'before')::integer<>running_balance or (entry->>'after')::integer-running_balance<>(entry->>'delta')::integer
        or exists(select 1 from public.wallet_ledger where student_number=student and entry_id=item->>'entry_id') then raise exception 'STORAGE_LEDGER_IMMUTABLE'; end if;
      position:=position-1;
      insert into public.wallet_ledger(resource_key,entry_id,student_number,delta,balance_before,balance_after,reason,created_at,operation_id,sort_order,value)
        values(item->>'resource_key',item->>'entry_id',student,(entry->>'delta')::integer,running_balance,(entry->>'after')::integer,entry->>'reason',(entry->>'createdAt')::timestamptz,p_actor_key||':'||p_request_id,position,jsonb_set(item->'value','{order}',to_jsonb(position)));
      running_balance:=(entry->>'after')::integer;
    end loop;
    if running_balance<>target then raise exception 'STORAGE_BALANCE_MISMATCH'; end if;
    update public.wallet_accounts set balance=target,revision=revision+1,updated_at=clock_timestamp() where student_number=student;
  end loop;
  -- Validate the archive against locked original records before applying the rollover.
  select value->>'data' into library_old_season from public.storage_resources where resource_key='/libraryCompetition/seasonId' and not deleted;
  select value#>>'{value,data}' into library_next_season from jsonb_array_elements(p_resources) where value->>'resource_key'='/libraryCompetition/seasonId';
  if library_old_season is not null and library_next_season is not null and library_next_season<>library_old_season
    and (p_archive is null or p_archive='null'::jsonb) then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  if p_archive is not null and p_archive<>'null'::jsonb then
    if p_action<>'libraryCompetitionRollover' or library_old_season is null
      or p_archive->>'seasonId' is distinct from library_old_season
      or library_next_season is null or library_next_season<=library_old_season
      or not (p_expected ? 'scope:libraryCompetition:shared') or not (p_expected ? 'collection:/studentLife/books')
      or jsonb_array_length(p_wallets)<>0 or jsonb_array_length(p_ledger)<>0
      or jsonb_typeof(p_archive->'books') is distinct from 'array' then raise exception 'STORAGE_INVALID_MUTATION'; end if;
    select coalesce(jsonb_agg(value->'data' order by (value->'data')::text),'[]'::jsonb) into library_books
      from public.storage_resources where not deleted and value->>'parentKey'='/studentLife/books' and (value->'data') ? 'librarySlot';
    select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) into library_archive_books from jsonb_array_elements(p_archive->'books');
    if library_books is distinct from library_archive_books then raise exception 'STORAGE_INVALID_MUTATION'; end if;
    if exists (
      select 1 from public.storage_resources r where not r.deleted and r.value->>'parentKey'='/studentLife/books' and (r.value->'data') ? 'librarySlot'
      and not exists(select 1 from jsonb_array_elements(p_resources) c where c.value->>'resource_key'=r.resource_key and c.value->'value'='null'::jsonb)
    ) or exists (
      select 1 from jsonb_array_elements(p_resources) c where c.value->>'category'<>'libraryCompetition'
      and not exists(select 1 from public.storage_resources r where not r.deleted and r.resource_key=c.value->>'resource_key'
        and r.value->>'parentKey'='/studentLife/books' and (r.value->'data') ? 'librarySlot' and c.value->'value'='null'::jsonb)
    ) then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  end if;
  for item in select value from jsonb_array_elements(p_resources) order by value->>'resource_key' loop
    perform public.storage_write_resource(item->>'resource_key',item->>'category',(item->>'owner_number')::integer,case when item->'value'='null'::jsonb then null else item->'value' end);
  end loop;
  if p_archive is not null and p_archive<>'null'::jsonb then
    insert into public.library_competition_archives(settings_id,season_id,archived_at,standings,books)
    values('school-timer-main',p_archive->>'seasonId',(p_archive->>'archivedAt')::timestamptz,p_archive->'standings',p_archive->'books');
  end if;
  changed_at:=clock_timestamp();
  insert into public.storage_receipts(actor_key,request_id,action,payload_hash,result,committed_at) values(p_actor_key,p_request_id,p_action,p_payload_hash,p_result,changed_at);
  return jsonb_build_object('saved',true,'result',p_result,'updatedAt',changed_at);
end;
$$;

-- Migration comparison uses the same raw container metadata and never runs domain normalizers.
create or replace function public.storage_project_node(p_key text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare node jsonb; child record; result jsonb;
begin
  select value into node from public.storage_resources where resource_key=p_key and not deleted;
  if node is null then raise exception 'STORAGE_MISSING_NODE'; end if;
  if node->>'kind'='value' then return node->'data'; end if;
  result:=case when node->>'kind'='array' then '[]'::jsonb else '{}'::jsonb end;
  for child in select r.resource_key,r.value,(r.value->>'order')::double precision sort_order from public.storage_resources r where r.value->>'parentKey'=p_key and not r.deleted
    union all select '/currencyBalances/'||w.student_number,jsonb_build_object('kind','value','member',w.student_number::text,'data',w.balance),null from public.wallet_accounts w where p_key='/currencyBalances'
    union all select h.resource_key,h.value,h.sort_order from public.wallet_ledger h where h.value->>'parentKey'=p_key
    order by sort_order nulls last,resource_key
  loop
    if node->>'kind'='array' then
      result:=result||jsonb_build_array(case when child.value->>'kind'='value' then child.value->'data' else public.storage_project_node(child.resource_key) end);
    else
      result:=result||jsonb_build_object(child.value->>'member',case when child.value->>'kind'='value' then child.value->'data' else public.storage_project_node(child.resource_key) end);
    end if;
  end loop;
  return result;
end;
$$;
create or replace function public.storage_bootstrap(p_expected_updated_at timestamptz,p_source jsonb,p_resources jsonb,p_wallets jsonb,p_history jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_row public.app_settings%rowtype; item jsonb; entry jsonb; claim record; projected jsonb;
begin
  perform pg_advisory_xact_lock(726314925132::bigint);
  if not exists(select 1 from public.storage_control where singleton and maintenance and not active) then raise exception 'STORAGE_MAINTENANCE_REQUIRED'; end if;
  if exists(select 1 from public.storage_backups) or exists(select 1 from public.wallet_accounts) or exists(select 1 from public.storage_resources) then raise exception 'STORAGE_ALREADY_MIGRATED'; end if;
  select * into source_row from public.app_settings where id='school-timer-main' for update;
  if source_row.updated_at is distinct from p_expected_updated_at or source_row.value is distinct from p_source then raise exception 'STORAGE_SOURCE_CHANGED'; end if;
  insert into public.storage_backups(source_updated_at,value) values(source_row.updated_at,source_row.value);
  for item in select value from jsonb_array_elements(p_resources) loop
    insert into public.storage_resources(resource_key,category,owner_number,value) values(item->>'resource_key',item->>'category',(item->>'owner_number')::integer,item->'value');
  end loop;
  for item in select value from jsonb_array_elements(p_wallets) loop
    insert into public.wallet_accounts(student_number,balance,opening_balance) values((item->>'student_number')::integer,(item->>'balance')::integer,(item->>'balance')::integer);
  end loop;
  if (select count(*) from public.wallet_accounts)<>23 then raise exception 'STORAGE_INCOMPLETE_WALLETS'; end if;
  for item in select value from jsonb_array_elements(p_history) loop
    entry:=item#>'{value,data}';
    insert into public.wallet_ledger(resource_key,entry_id,student_number,delta,balance_before,balance_after,reason,created_at,operation_id,historical,sort_order,value)
    values(item->>'resource_key',item->>'entry_id',(item->>'student_number')::integer,(entry->>'delta')::integer,(entry->>'before')::integer,(entry->>'after')::integer,entry->>'reason',(entry->>'createdAt')::timestamptz,'legacy-opening',true,(item->>'sort_order')::double precision,item->'value');
  end loop;
  if to_regclass('public.weekly_mission_rewards') is not null then
    for claim in execute 'select to_jsonb(r) value from public.weekly_mission_rewards r' loop
      insert into public.storage_reward_claims(claim_id,student_number,value)
      values('weekly:'||(claim.value->>'student_number')||':'||(claim.value->>'week_key')||':'||(claim.value->>'mission_type'),(claim.value->>'student_number')::integer,claim.value);
    end loop;
  end if;
  if to_regclass('public.today_friend_rewards') is not null then
    for claim in execute 'select to_jsonb(r) value from public.today_friend_rewards r' loop
      insert into public.storage_reward_claims(claim_id,student_number,value)
      values('today-friend:'||md5(claim.value::text),(claim.value->>'student_number')::integer,claim.value);
    end loop;
  end if;
  projected:=public.storage_project_node('');
  if projected is distinct from p_source then raise exception 'STORAGE_MIGRATION_MISMATCH'; end if;
  return jsonb_build_object('migrated',true,'wallets',(select count(*) from public.wallet_accounts),'history',(select count(*) from public.wallet_ledger),'resources',(select count(*) from public.storage_resources),'verified',true);
end;
$$;

create or replace function public.storage_reconcile_wallets() returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(jsonb_agg(jsonb_build_object('studentNumber',student_number,'balance',balance,'expectedBalance',expected_balance)),'[]'::jsonb)
 from (select a.student_number,a.balance,a.opening_balance+coalesce(sum(l.delta) filter(where not l.historical),0) expected_balance
 from public.wallet_accounts a left join public.wallet_ledger l using(student_number) group by a.student_number) totals where balance<>expected_balance
$$;

do $$
declare table_name text; fn record;
begin
  foreach table_name in array array['storage_control','storage_resources','storage_scopes','wallet_accounts','wallet_ledger','storage_receipts','storage_reward_claims','storage_backups'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',table_name);
    execute format('grant select on public.%I to service_role',table_name);
  end loop;
  for fn in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'storage\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
    execute format('grant execute on function %s to service_role',fn.signature);
  end loop;
end;
$$;
commit;
