begin;

create or replace function public.storage_load_updated_at() returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
  select to_jsonb(greatest(
    coalesce((select max(updated_at) from public.storage_resources),'epoch'),
    coalesce((select max(updated_at) from public.wallet_accounts),'epoch'),
    updated_at
  )) from public.storage_control where singleton
$$;

revoke all on function public.storage_load_updated_at() from public, anon, authenticated;
grant execute on function public.storage_load_updated_at() to service_role;

alter function public.storage_load_scope(jsonb) set jit = off;

commit;
