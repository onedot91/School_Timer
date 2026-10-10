begin;

create or replace function public.storage_prepare_command(
  p_actor_key text,p_request_id text,p_scope jsonb,p_replay_scope jsonb default null
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public set jit=off as $$
declare receipt jsonb; selected_scope jsonb;
begin
  receipt:=public.storage_get_receipt(p_actor_key,p_request_id);
  selected_scope:=case when receipt->>'found'='true'
    then coalesce(p_replay_scope,receipt->'scope',p_scope) else p_scope end;
  return jsonb_build_object('receipt',receipt,'snapshot',public.storage_load_scope(selected_scope));
end;
$$;

create or replace function public.storage_commit_scoped_and_load(
  p_expected jsonb,p_resources jsonb,p_wallets jsonb,p_ledger jsonb,
  p_actor_key text,p_request_id text,p_payload_hash text,p_action text,p_result jsonb,
  p_archive jsonb default null,p_scope jsonb default null,p_result_scope jsonb default null
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public set jit=off as $$
declare result jsonb; receipt jsonb;
begin
  result:=public.storage_commit_scoped_mutation(p_expected,p_resources,p_wallets,p_ledger,
    p_actor_key,p_request_id,p_payload_hash,p_action,p_result,p_archive,p_scope);
  if result->>'saved'='true' then
    -- Separate statements in this volatile wrapper expose this transaction's writes to stable readers.
    receipt:=public.storage_get_receipt(p_actor_key,p_request_id);
    result:=result||jsonb_build_object('snapshot',public.storage_load_scope(coalesce(p_result_scope,receipt->'scope',p_scope)));
  end if;
  return result;
end;
$$;

revoke all on function public.storage_prepare_command(text,text,jsonb,jsonb),public.storage_commit_scoped_and_load(jsonb,jsonb,jsonb,jsonb,text,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.storage_prepare_command(text,text,jsonb,jsonb),public.storage_commit_scoped_and_load(jsonb,jsonb,jsonb,jsonb,text,text,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
