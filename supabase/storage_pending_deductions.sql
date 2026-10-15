begin;
set local lock_timeout = '2s';
set local statement_timeout = '8s';

-- Called only inside an existing financial transaction, with the wallet locked first.
create or replace function public.storage_settle_pending_deductions(p_student_number integer) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  account public.wallet_accounts%rowtype;
  economy public.storage_resources%rowtype;
  state jsonb; pending jsonb; item jsonb; deposits jsonb; deposit_item jsonb;
  processed jsonb; letter jsonb; letter_id text; settlement_id text; settlement_entry_id text;
  amount integer; deposit_total integer; deposit_used integer; remaining integer; principal integer;
  wallet_used integer; letter_order double precision; settled_at timestamptz; stamp text; k text;
begin
  perform public.storage_require_writable();
  if p_student_number is null or p_student_number not between 1 and 23 then raise exception 'INVALID_STUDENT_NUMBER'; end if;
  select * into account from public.wallet_accounts where student_number = p_student_number for update;
  if not found then raise exception 'STORAGE_WALLET_NOT_FOUND'; end if;
  select * into economy from public.storage_resources where resource_key = '/studentEconomy/' || p_student_number and not deleted;
  if not found or jsonb_typeof(economy.value#>'{data,pendingDeductions}') is distinct from 'array'
    or jsonb_array_length(economy.value#>'{data,pendingDeductions}') = 0 then return; end if;

  -- Match storage_write_resource's lock order, before taking the resource row lock.
  for k in select key from (values ('collection:/studentEconomy'), ('collection:/studentLife/letters'),
    ('scope:studentEconomy:all'), ('scope:studentEconomy:' || p_student_number),
    ('scope:studentLife:all'), ('scope:studentLife:shared')) locks(key) order by key loop
    perform pg_advisory_xact_lock(hashtextextended('scope:' || k, 0));
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('resource:' || economy.resource_key, 0));
  select * into economy from public.storage_resources where resource_key = economy.resource_key for update;
  state := economy.value->'data';
  pending := state->'pendingDeductions';
  deposits := coalesce(state->'deposits', '[]'::jsonb);
  if jsonb_typeof(deposits) is distinct from 'array' then raise exception 'STORAGE_INVALID_PENDING_DEDUCTION'; end if;
  if jsonb_array_length(deposits) = 0 and coalesce((state->>'deposit')::integer, 0) > 0 then
    deposits := jsonb_build_array(jsonb_build_object('id', 'legacy-deposit', 'principal', (state->>'deposit')::integer,
      'openedOn', '', 'maturityDate', '', 'interest', 0));
  end if;
  processed := coalesce(state->'processedRequestIds', '[]'::jsonb);

  -- FIFO, whole amount only. No negative wallet and no partial debit while waiting.
  while jsonb_array_length(pending) > 0 loop
    item := pending->0;
    settlement_id := item->>'settlementRequestId';
    if item->>'id' is null or item->>'id' !~ '^[a-zA-Z0-9_-]{1,200}$'
      or settlement_id is null or settlement_id !~ '^pending-[a-zA-Z0-9_-]{1,40}$'
      or jsonb_typeof(item->'amount') is distinct from 'number' or item->>'amount' !~ '^[0-9]{1,6}$'
      or nullif(btrim(item->>'teacherReason'), '') is null or length(item->>'teacherReason') > 60
      then raise exception 'STORAGE_INVALID_PENDING_DEDUCTION'; end if;
    amount := (item->>'amount')::integer;
    if amount < 1 or amount > 999999 then raise exception 'STORAGE_INVALID_PENDING_DEDUCTION'; end if;
    select coalesce(sum((value->>'principal')::integer), 0) into deposit_total from jsonb_array_elements(deposits);
    if account.balance + deposit_total < amount then exit; end if;
    settlement_entry_id := 'currency-economy-' || settlement_id || '-' || p_student_number;
    if exists(select 1 from public.wallet_ledger where student_number = p_student_number and entry_id = settlement_entry_id) then
      raise exception 'STORAGE_PENDING_DEDUCTION_REUSED';
    end if;
    settled_at := clock_timestamp();
    stamp := to_char(settled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    wallet_used := least(account.balance, amount);
    deposit_used := amount - wallet_used;
    state := jsonb_set(state, '{deposits}', '[]'::jsonb);
    -- Consume oldest deposits; only touched principals have their interest recalculated.
    remaining := deposit_used;
    for deposit_item in select value from jsonb_array_elements(deposits) loop
      principal := (deposit_item->>'principal')::integer;
      if remaining > 0 then
        amount := least(principal, remaining);
        remaining := remaining - amount;
        principal := principal - amount;
        deposit_item := jsonb_set(jsonb_set(deposit_item, '{principal}', to_jsonb(principal)), '{interest}', to_jsonb(round(principal * 0.1)::integer));
      end if;
      if principal > 0 then state := jsonb_set(state, '{deposits}', (state->'deposits') || jsonb_build_array(deposit_item)); end if;
    end loop;
    amount := (item->>'amount')::integer;
    deposits := state->'deposits';
    pending := pending - 0;
    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb) into processed from (
      select value, ordinality from jsonb_array_elements(processed || jsonb_build_array(settlement_id)) with ordinality
      order by ordinality desc limit 24
    ) ids;
    state := state || jsonb_build_object('deposit', deposit_total - deposit_used, 'pendingDeductions', pending, 'processedRequestIds', processed);
    perform public.storage_write_resource(economy.resource_key, 'studentEconomy', p_student_number, jsonb_set(economy.value, '{data}', state));
    -- Negative deltas do not re-enter settlement. Zero still records deposit-only deductions.
    perform public.storage_apply_wallet_delta(p_student_number, settlement_entry_id, -wallet_used, 'teacher_deduction', settled_at, settlement_id);
    select * into account from public.wallet_accounts where student_number = p_student_number;
    letter_id := 'teacher-deduction-letter-' || settlement_id;
    select coalesce(min((value->>'order')::double precision), 0) - 1 into letter_order from public.storage_resources
      where not deleted and value->>'parentKey' = '/studentLife/letters';
    letter := jsonb_build_object('id', letter_id, 'recipient', p_student_number, 'senderLabel', '선생님', 'senderStudentNumber', null,
      'replyToId', null, 'title', '고마 차감 안내', 'content', '선생님이 ' || amount || '고마를 차감했어요.' || E'\n\n차감 사유\n: '
      || (item->>'teacherReason') || case when deposit_used > 0 then E'\n\n보유 고마가 부족해 ' || deposit_used || '고마는 예금에서 사용했어요.' else '' end,
      'createdAt', stamp, 'readAt', null);
    perform public.storage_write_resource('/studentLife/letters/@' || letter_id, 'studentLife', null,
      jsonb_build_object('kind', 'value', 'parentKey', '/studentLife/letters', 'member', '@' || letter_id, 'order', letter_order, 'data', letter));
  end loop;
end;
$$;

revoke all on function public.storage_settle_pending_deductions(integer) from public, anon, authenticated;
grant execute on function public.storage_settle_pending_deductions(integer) to service_role;

-- Preserve the deployed function body and its existing concurrency/maintenance guards.
-- Each patch verifies its anchor and is idempotent; an unknown version aborts the transaction.
do $patch$
declare definition text; anchor text; replacement text;
begin
  definition := pg_get_functiondef('public.storage_apply_wallet_delta(integer,text,integer,text,timestamptz,text)'::regprocedure);
  if position('storage_settle_pending_deductions' in definition) = 0 then
    anchor := '  return jsonb_build_object(''balance'',next_balance,''entry'',entry,''awarded'',true);';
    replacement := '  if p_delta > 0 then
    perform public.storage_settle_pending_deductions(p_student_number);
    select balance into next_balance from public.wallet_accounts where student_number=p_student_number;
  end if;
' || anchor;
    if position(anchor in definition) = 0 then raise exception 'STORAGE_PENDING_PATCH_VERSION_MISMATCH: wallet delta'; end if;
    execute replace(definition, anchor, replacement);
  end if;

  definition := pg_get_functiondef('public.storage_commit_mutation(jsonb,jsonb,jsonb,jsonb,text,text,text,text,jsonb,jsonb)'::regprocedure);
  if position('storage_settle_pending_deductions' in definition) = 0 then
    anchor := '    union select substring(key from 8)::integer from jsonb_object_keys(p_expected) key where key like ''wallet:%''';
    replacement := anchor || E'\n    union select (value->>''owner_number'')::integer from jsonb_array_elements(p_resources) where value->>''category''=''studentEconomy'' and value->>''owner_number'' is not null';
    if position(anchor in definition) = 0 then raise exception 'STORAGE_PENDING_PATCH_VERSION_MISMATCH: wallet locks'; end if;
    definition := replace(definition, anchor, replacement);
    anchor := '    union select key from jsonb_object_keys(p_expected) key where key like ''scope:%'' or key like ''collection:%''';
    replacement := anchor || '
    union select pending_locks.key from (
      select (value->>''student_number'')::integer n from jsonb_array_elements(p_wallets)
      union select (value->>''student_number'')::integer from jsonb_array_elements(p_ledger)
      union select (value->>''owner_number'')::integer from jsonb_array_elements(p_resources) where value->>''category''=''studentEconomy'' and value->>''owner_number'' is not null
    ) affected join public.storage_resources r on r.resource_key=''/studentEconomy/''||affected.n and not r.deleted
    cross join lateral (values (''collection:/studentEconomy''), (''collection:/studentLife/letters''),
      (''scope:studentEconomy:all''), (''scope:studentEconomy:''||affected.n), (''scope:studentLife:all''), (''scope:studentLife:shared'')) pending_locks(key)
    where jsonb_typeof(r.value#>''{data,pendingDeductions}'')=''array'' and r.value#>''{data,pendingDeductions}''<>''[]''::jsonb';
    if position(anchor in definition) = 0 then raise exception 'STORAGE_PENDING_PATCH_VERSION_MISMATCH: scope locks'; end if;
    definition := replace(definition, anchor, replacement);
    anchor := '  changed_at:=clock_timestamp();';
    replacement := '  for student in select distinct n from (
    select (value->>''student_number'')::integer n from jsonb_array_elements(p_wallets)
    union select (value->>''student_number'')::integer from jsonb_array_elements(p_ledger)
    union select (value->>''owner_number'')::integer from jsonb_array_elements(p_resources) where value->>''category''=''studentEconomy'' and value->>''owner_number'' is not null
  ) affected order by n loop
    perform public.storage_settle_pending_deductions(student);
  end loop;
' || anchor;
    if position(anchor in definition) = 0 then raise exception 'STORAGE_PENDING_PATCH_VERSION_MISMATCH: commit'; end if;
    execute replace(definition, anchor, replacement);
  end if;
end;
$patch$;

notify pgrst, 'reload schema';
commit;
