begin;
set local lock_timeout='2s';
set local statement_timeout='30s';

select cron.unschedule('storage-purge-auction-history-tombstones')
where exists(select 1 from cron.job where jobname='storage-purge-auction-history-tombstones');
drop function if exists public.storage_purge_auction_history_tombstones(interval);

-- Restores purged tombstones whose keys are still absent. The backup table is kept.
insert into public.storage_resources(resource_key,category,owner_number,value,revision,updated_at,deleted)
select distinct on (resource_key) resource_key,category,owner_number,value,revision,updated_at,deleted
from public.storage_purged_tombstones
order by resource_key,purged_at desc
on conflict (resource_key) do nothing;

notify pgrst, 'reload schema';
commit;
