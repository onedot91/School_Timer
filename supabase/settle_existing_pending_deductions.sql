begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

-- Run only after installing the partial-settlement function. Lock wallets first,
-- matching the normal financial transaction order, before touching any records.
do $$
declare
  student integer;
  definition text;
begin
  select pg_get_functiondef('public.storage_settle_pending_deductions(integer)'::regprocedure) into definition;
  if position('pending_amount := amount' in definition) = 0 then
    raise exception 'STORAGE_PARTIAL_SETTLEMENT_NOT_INSTALLED';
  end if;
  perform public.storage_require_writable();
  for student in
    select a.student_number from public.wallet_accounts a
    join public.storage_resources r on r.resource_key = '/studentEconomy/' || a.student_number and not r.deleted
    where jsonb_typeof(r.value#>'{data,pendingDeductions}') = 'array'
      and r.value#>'{data,pendingDeductions}' <> '[]'::jsonb
    order by a.student_number for update of a
  loop
    perform public.storage_settle_pending_deductions(student);
  end loop;
end $$;
commit;
