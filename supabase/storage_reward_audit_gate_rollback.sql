begin;
set local lock_timeout='2s';
set local statement_timeout='8s';

-- Turn STORAGE_REWARD_AUDIT_GATE off and redeploy before running this; gated callers would otherwise fail.
drop function if exists public.storage_reward_audit_source_gated();

notify pgrst, 'reload schema';
commit;
