begin;
do $guard$
begin
  if not exists(select 1 from pg_proc where oid='public.storage_load_snapshot()'::regprocedure and md5(prosrc) in ('53c30ab30d619a1d05d65293cd02445c','f1160d473fe2a05eccf1845e075e0f71')) then
    raise exception 'STORAGE_CONCURRENCY_VERSION_MISMATCH: storage_load_snapshot';
  end if;
  if not exists(select 1 from pg_proc where oid='public.storage_reward_audit_source()'::regprocedure and md5(prosrc) in ('f1d55dc65084f4e6dcd1fe9a5015bd42','b58bc05acb8dbca0b9e7b883d8f7f3af')) then
    raise exception 'STORAGE_CONCURRENCY_VERSION_MISMATCH: storage_reward_audit_source';
  end if;
  if not exists(select 1 from pg_proc where oid='public.storage_commit_mutation(jsonb,jsonb,jsonb,jsonb,text,text,text,text,jsonb,jsonb)'::regprocedure and md5(prosrc) in ('1b835f943a6f37f135d7e8e6acc27dd6','87b5af4e04b5a40080ea697fc540ccbe')) then
    raise exception 'STORAGE_CONCURRENCY_VERSION_MISMATCH: storage_commit_mutation';
  end if;
end;
$guard$;

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

create or replace function public.storage_reward_audit_source() returns jsonb
language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'checkedAt', now(),
    'snapshot', public.storage_load_snapshot(),
    'walletMismatches', public.storage_reconcile_wallets(),
    'weeklyRewards', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select student_number, week_key, mission_type, reward_amount, source_event_id from public.weekly_mission_rewards
    ) r), '[]'::jsonb),
    'wordEntries', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select id, student_number, round_date from public.classword_entries
    ) r), '[]'::jsonb),
    'quizCompletions', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select id, student_number, quiz_date from public.classword_quiz_completions
    ) r), '[]'::jsonb),
    'friendSubmissions', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select id, student_number, submission_date, status from public.today_friend_submissions
    ) r), '[]'::jsonb),
    'friendRewards', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select submission_id, student_number, reward_amount from public.today_friend_rewards
    ) r), '[]'::jsonb)
  )
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

notify pgrst, 'reload schema';
commit;

