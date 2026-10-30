begin;

-- Teacher grants and exact balance sets are decided against locked wallets in one call,
-- without the prepare round trip or a client CAS retry. Keeps the receipt, wallet, scope lock order.
create or replace function public.storage_teacher_currency(p_command jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public set jit=off as $$
declare
  actor text:=p_command->>'actorKey'; request_id_value text:=p_command->>'requestId';
  payload_hash_value text:=p_command->>'payloadHash'; action_value text:=p_command->>'action';
  created_at_value text:=p_command->>'createdAt'; scope jsonb:=p_command->'scope';
  amount integer; expected_balance integer; students integer[]; student integer; next_balance integer;
  account public.wallet_accounts%rowtype; receipt public.storage_receipts%rowtype;
  entry jsonb; entry_id text; reason text; wallets jsonb:='[]'; ledger jsonb:='[]'; expected jsonb:='{}'; result jsonb;
begin
  perform public.storage_require_writable();
  if jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>65536
    or actor is distinct from 'teacher:0'
    or request_id_value is null or request_id_value !~ '^[a-zA-Z0-9_-]{8,160}$'
    or payload_hash_value is null or payload_hash_value !~ '^[a-f0-9]{64}$'
    or action_value is null or action_value not in ('teacher.currency.adjust','teacher.currency.set')
    or jsonb_typeof(p_command->'studentNumbers') is distinct from 'array'
    or jsonb_array_length(p_command->'studentNumbers') not between 1 and 23
    or exists(select 1 from jsonb_array_elements(p_command->'studentNumbers') v
      where jsonb_typeof(v.value)<>'number' or v.value#>>'{}' !~ '^([1-9]|1[0-9]|2[0-3])$')
    or jsonb_typeof(p_command->'amount') is distinct from 'number' or p_command->>'amount' !~ '^[0-9]{1,6}$'
    or (action_value='teacher.currency.set' and (jsonb_typeof(p_command->'expectedBalance') is distinct from 'number'
      or p_command->>'expectedBalance' !~ '^[0-9]{1,6}$'))
    or jsonb_typeof(scope) is distinct from 'object'
    or created_at_value is null or created_at_value !~ '^\d{4}-\d{2}-\d{2}T' then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  amount:=(p_command->>'amount')::integer;
  if action_value='teacher.currency.adjust' and amount<1 then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  if action_value='teacher.currency.set' then expected_balance:=(p_command->>'expectedBalance')::integer; end if;
  perform created_at_value::timestamptz;
  select array_agg(distinct (v.value#>>'{}')::integer order by (v.value#>>'{}')::integer) into students
    from jsonb_array_elements(p_command->'studentNumbers') v;
  reason:=case when cardinality(students)=1 then 'manual' else 'bulk_adjust' end;

  perform pg_advisory_xact_lock(hashtextextended('receipt:'||actor||':'||request_id_value,0));
  select * into receipt from public.storage_receipts where actor_key=actor and request_id=request_id_value;
  if found then
    if receipt.action<>action_value or receipt.payload_hash<>payload_hash_value then raise exception 'STORAGE_REQUEST_REUSED'; end if;
    return jsonb_build_object('saved',true,'result',receipt.result,'snapshot',public.storage_load_scope(scope));
  end if;
  -- A student without a history container takes the general path, which also writes the container.
  if exists(select 1 from unnest(students) s(n) where not exists(select 1 from public.storage_resources r
    where r.resource_key='/currencyHistory/'||s.n and not r.deleted and r.value->>'kind'='array')) then
    return jsonb_build_object('fallback',true);
  end if;

  foreach student in array students loop
    select * into account from public.wallet_accounts where student_number=student for update;
    if not found then raise exception 'STORAGE_INVALID_MUTATION'; end if;
    if action_value='teacher.currency.set' and account.balance<>expected_balance then
      return jsonb_build_object('rejected','CURRENCY_BALANCE_CHANGED');
    end if;
    next_balance:=case when action_value='teacher.currency.adjust' then least(999999,account.balance+amount) else amount end;
    expected:=expected||jsonb_build_object('wallet:'||student,account.revision);
    if next_balance<>account.balance then
      entry_id:='teacher-'||request_id_value||'-'||student;
      entry:=jsonb_build_object('id',entry_id,'studentNumber',student,'delta',next_balance-account.balance,
        'before',account.balance,'after',next_balance,'reason',reason,'createdAt',created_at_value);
      ledger:=ledger||jsonb_build_array(jsonb_build_object('resource_key','/currencyHistory/'||student||'/@'||entry_id,
        'student_number',student,'entry_id',entry_id,'sort_order',0,
        'value',jsonb_build_object('kind','value','parentKey','/currencyHistory/'||student,'member','@'||entry_id,'order',0,'data',entry)));
      wallets:=wallets||jsonb_build_array(jsonb_build_object('student_number',student,'balance',next_balance));
    end if;
  end loop;

  result:=public.storage_commit_scoped_mutation(expected,'[]',wallets,ledger,actor,request_id_value,payload_hash_value,
    action_value,'null'::jsonb,null,scope);
  if result->>'saved'='true' then result:=result||jsonb_build_object('snapshot',public.storage_load_scope(scope)); end if;
  return result;
end;
$$;

revoke all on function public.storage_teacher_currency(jsonb) from public,anon,authenticated;
grant execute on function public.storage_teacher_currency(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
