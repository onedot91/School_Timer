begin;
set local lock_timeout='2s';
set local statement_timeout='30s';

-- Auction bid history tombstones (2026-10-26 incident).
-- Weekly close and item removal delete every bid entry as a tombstone, and every student read and bid
-- loads /auctionBidHistory with its tombstones. 1,415 of 1,433 rows were tombstones: a bid scope read
-- returned 383 KB instead of 10 KB and a student overview read took 207 ms instead of 57 ms, so a
-- classroom of polls saturated the database and bids failed with STORAGE_DATABASE_TIMEOUT.
--
-- Only bid entry members are purged. Their keys embed amount, bidder and createdAt, so a key is never
-- written again and no revision can move backwards for a client cache. Item containers such as
-- /auctionBidHistory/item-a are reused weekly and keep their tombstones. Purged rows are kept below.
create table if not exists public.storage_purged_tombstones (
  like public.storage_resources,
  purged_at timestamptz not null default now()
);
alter table public.storage_purged_tombstones enable row level security;
revoke all on table public.storage_purged_tombstones from public,anon,authenticated;

create or replace function public.storage_purge_auction_history_tombstones(p_retention interval default interval '1 day')
returns integer language plpgsql volatile security definer set search_path=pg_catalog,public as $$
declare purged integer;
begin
  perform public.storage_require_writable();
  if p_retention is null or p_retention < interval '1 hour' then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  -- The bid and close paths take this scope lock, so a purge never interleaves with their commits.
  perform pg_advisory_xact_lock(hashtextextended('scope:scope:auctionBidHistory:all',0));
  with removed as (
    delete from public.storage_resources
    where category='auctionBidHistory' and deleted and starts_with(value->>'member','#')
      and value->>'parentKey' like '/auctionBidHistory/%' and updated_at < now()-p_retention
    returning *
  )
  insert into public.storage_purged_tombstones(resource_key,category,owner_number,value,revision,updated_at,deleted)
  select resource_key,category,owner_number,value,revision,updated_at,deleted from removed;
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function public.storage_purge_auction_history_tombstones(interval) from public,anon,authenticated;
grant execute on function public.storage_purge_auction_history_tombstones(interval) to service_role;

select public.storage_purge_auction_history_tombstones();

-- Daily at 03:17 KST, outside class hours. cron.schedule replaces a job with the same name.
create extension if not exists pg_cron;
select cron.schedule('storage-purge-auction-history-tombstones', '17 18 * * *',
  $job$select public.storage_purge_auction_history_tombstones()$job$);

notify pgrst, 'reload schema';
commit;
