begin;
set local lock_timeout = '2s';
set local statement_timeout = '8s';

do $$
declare
  repair_id constant text := 'restore-auction-items-20260915-033100';
  repair_scope constant jsonb := '{"resources":[{"path":"/auctionItems"}],"wallets":[],"history":[],"writeResources":[{"path":"/auctionItems"}],"writeWallets":[],"revisionKeys":["scope:auctionItems:all"]}';
  snapshot jsonb;
  restored_resources jsonb;
  outcome jsonb;
begin
  if exists(select 1 from public.storage_receipts where actor_key='teacher:0' and request_id=repair_id) then
    return;
  end if;
  snapshot := public.storage_load_scope(repair_scope);
  select jsonb_agg(jsonb_build_object('resource_key',resource_key,'category',category,'owner_number',owner_number,'value',value))
    into restored_resources
    from public.storage_resources
    where ((resource_key='/auctionItems/@item-2-2' and revision=8)
      or (resource_key='/auctionItems/@item-2-3' and revision=11))
      and deleted and updated_at between '2026-09-15T03:30:59Z' and '2026-09-15T03:31:01Z'
      and value->>'parentKey'='/auctionItems' and value->'data'->>'isConfigured'='true';
  if coalesce(jsonb_array_length(restored_resources),0)<>2 then
    raise exception 'AUCTION_RESTORE_SOURCE_CHANGED';
  end if;
  outcome := public.storage_commit_scoped_mutation(
    snapshot->'revisions',restored_resources,'[]'::jsonb,'[]'::jsonb,
    'teacher:0',repair_id,encode(sha256(convert_to(repair_id,'UTF8')),'hex'),
    'teacher.auction.restore','{"restoredItems":2}'::jsonb,null,repair_scope);
  if outcome->>'saved' is distinct from 'true' then
    raise exception 'AUCTION_RESTORE_CONFLICT';
  end if;
end;
$$;

commit;
