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

create or replace function public.storage_auction_amount(p_value jsonb) returns numeric
language plpgsql immutable set search_path=pg_catalog,public as $$
declare text_value text; amount double precision; radix integer; digit integer; digit_text text; total numeric:=0; index_value integer;
begin
  if p_value='true'::jsonb then return 1; end if;
  if jsonb_typeof(p_value)='array' then
    if jsonb_array_length(p_value)=1 and jsonb_typeof(p_value->0) in ('number','string','array') then
      return public.storage_auction_amount(p_value->0); end if;
    return 0;
  end if;
  if jsonb_typeof(p_value) not in ('number','string') then return 0; end if;
  text_value:=btrim(p_value#>>'{}',E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)
    ||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279));
  if text_value ~* '^0(x[0-9a-f]+|b[01]+|o[0-7]+)$' then
    radix:=case lower(substr(text_value,2,1)) when 'x' then 16 when 'b' then 2 else 8 end;
    digit_text:=lower(substr(text_value,3));
    for index_value in 1..length(digit_text) loop
      digit:=strpos('0123456789abcdef',substr(digit_text,index_value,1))-1;
      total:=total*radix+digit;
    end loop;
    amount:=total::double precision;
  else
    if text_value !~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$' then return 0; end if;
    amount:=text_value::double precision;
  end if;
  return greatest(0,floor(amount))::numeric;
exception when numeric_value_out_of_range then return 0;
end;
$$;

create or replace function public.storage_auction_student(p_value jsonb) returns integer
language plpgsql immutable set search_path=pg_catalog,public as $$
declare student double precision;
begin
  if jsonb_typeof(p_value) is distinct from 'number' then return null; end if;
  student:=(p_value#>>'{}')::double precision;
  if student between 1 and 23 and trunc(student)=student then return student::integer; end if;
  return null;
end;
$$;

-- Keep the existing receipt, wallet, scope and resource lock order. Bid races are
-- decided against locked current rows here, without another client CAS round trip.
create or replace function public.storage_place_auction_bid(p_command jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public set jit=off as $$
declare
  actor text:=p_command->>'actorKey'; request_id_value text:=p_command->>'requestId';
  payload_hash_value text:=p_command->>'payloadHash'; item_id text:=p_command->>'itemId';
  student integer; amount numeric; start_price numeric; config_revision bigint;
  account public.wallet_accounts%rowtype; receipt public.storage_receipts%rowtype;
  bid jsonb; award jsonb; scope jsonb; changes jsonb:='[]'; expected jsonb;
  k text; key_value text; parent text; category_value text; member text;
  history_path text; bid_path text; position_value double precision; reserved numeric;
  entry jsonb; value_row jsonb; result jsonb; created_at_value text:=p_command->>'createdAt';
begin
  perform public.storage_require_writable();
  if jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>16384
    or jsonb_typeof(p_command->'studentNumber') is distinct from 'number' or p_command->>'studentNumber' !~ '^([1-9]|1[0-9]|2[0-3])$'
    or actor is null or request_id_value is null or request_id_value !~ '^[a-zA-Z0-9_-]{8,160}$'
    or payload_hash_value is null or payload_hash_value !~ '^[a-f0-9]{64}$'
    or item_id is null or item_id !~ '^[a-zA-Z0-9_-]{1,100}$'
    or jsonb_typeof(p_command->'amount') is distinct from 'number' or p_command->>'amount' !~ '^[0-9]{1,6}$'
    or jsonb_typeof(p_command->'activeItemIds') is distinct from 'array'
    or jsonb_array_length(p_command->'activeItemIds') not between 1 and 30
    or not (p_command->'activeItemIds' @> jsonb_build_array(item_id))
    or exists(select 1 from jsonb_array_elements(p_command->'activeItemIds') v where jsonb_typeof(v.value)<>'string' or v.value#>>'{}' !~ '^[a-zA-Z0-9_-]{1,100}$')
    or jsonb_typeof(p_command->'startPrice') is distinct from 'number' or p_command->>'startPrice' !~ '^[0-9]{1,6}$'
    or jsonb_typeof(p_command->'configRevision') is distinct from 'number' or p_command->>'configRevision' !~ '^[0-9]{1,18}$'
    or created_at_value is null or created_at_value !~ '^\d{4}-\d{2}-\d{2}T' then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  student:=(p_command->>'studentNumber')::integer;
  if actor not in ('student:'||student,'teacher:0:student:'||student) then raise exception 'STORAGE_SCOPE_VIOLATION'; end if;
  amount:=(p_command->>'amount')::numeric; start_price:=(p_command->>'startPrice')::numeric;
  if amount<1 or start_price<1 then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  perform created_at_value::timestamptz;
  scope:=jsonb_build_object('resources',jsonb_build_array(jsonb_build_object('path','/auctionItems'),jsonb_build_object('path','/auctionBids'),jsonb_build_object('path','/auctionAwards'),jsonb_build_object('path','/auctionBidHistory')),
    'wallets',jsonb_build_array(student),'history','[]'::jsonb,
    'writeResources',jsonb_build_array(jsonb_build_object('path','/auctionBids'),jsonb_build_object('path','/auctionBidHistory')),'writeWallets','[]'::jsonb,
    'revisionKeys',jsonb_build_array('scope:auctionItems:all','scope:auctionBids:all','scope:auctionAwards:all','scope:auctionBidHistory:all','wallet:'||student));
  perform pg_advisory_xact_lock(hashtextextended('receipt:'||actor||':'||request_id_value,0));
  select * into receipt from public.storage_receipts where actor_key=actor and request_id=request_id_value;
  if found then
    if receipt.action<>'student.auction.bid' or receipt.payload_hash<>payload_hash_value then raise exception 'STORAGE_REQUEST_REUSED'; end if;
    return jsonb_build_object('saved',true,'result',receipt.result,'snapshot',public.storage_load_scope(scope));
  end if;
  select * into account from public.wallet_accounts where student_number=student for update;
  if not found then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  bid_path:='/auctionBids/'||item_id; history_path:='/auctionBidHistory/'||item_id;
  for k in select key from unnest(array['collection:','collection:/auctionBidHistory','collection:'||history_path,'collection:/auctionBids',
    'scope:auctionBidHistory:all','scope:auctionBidHistory:shared','scope:auctionBids:all','scope:auctionBids:shared',
    'scope:auctionItems:all','scope:auctionAwards:all']) locks(key) order by key loop
    perform pg_advisory_xact_lock(hashtextextended('scope:'||k,0));
  end loop;
  select revision into config_revision from public.storage_scopes where scope_key='scope:auctionItems:all';
  if coalesce(config_revision,0)<>(p_command->>'configRevision')::bigint then return jsonb_build_object('saved',false); end if;
  select value->'data' into bid from public.storage_resources where resource_key=bid_path and not deleted;
  select value->'data' into award from public.storage_resources where resource_key='/auctionAwards/'||item_id and not deleted;
  if public.storage_auction_student(award->'winner') is not null and public.storage_auction_amount(award->'amount')>0 then
    return jsonb_build_object('rejected','ALREADY_AWARDED'); end if;
  if public.storage_auction_student(bid->'bidder')=student then return jsonb_build_object('rejected','ALREADY_HIGHEST_BIDDER'); end if;
  if amount<greatest(start_price,public.storage_auction_amount(bid->'amount')+1) then return jsonb_build_object('rejected','BID_TOO_LOW'); end if;
  if exists(select 1 from public.storage_resources r where not r.deleted and r.value->>'parentKey'=history_path
    and public.storage_auction_student(r.value#>'{data,bidder}') is not null
    and public.storage_auction_amount(r.value#>'{data,amount}')=amount) then return jsonb_build_object('rejected','DUPLICATE_BID_AMOUNT'); end if;
  select coalesce(sum(public.storage_auction_amount(b.value->'data'->'amount')),0) into reserved
    from jsonb_array_elements_text(p_command->'activeItemIds') ids(id)
    join public.storage_resources b on b.resource_key='/auctionBids/'||ids.id and not b.deleted
    left join public.storage_resources a on a.resource_key='/auctionAwards/'||ids.id and not a.deleted
    where ids.id<>item_id and public.storage_auction_student(b.value#>'{data,bidder}')=student
    and not (public.storage_auction_student(a.value#>'{data,winner}') is not null
      and public.storage_auction_amount(a.value#>'{data,amount}')>0);
  if amount>account.balance-reserved then return jsonb_build_object('rejected','INSUFFICIENT_FUNDS'); end if;
  for key_value,parent,member,category_value in select * from (values
    ('/auctionBids','','auctionBids','auctionBids'),('/auctionBidHistory','','auctionBidHistory','auctionBidHistory'),
    (history_path,'/auctionBidHistory',item_id,'auctionBidHistory')) containers(key,parent_key,member_value,category) loop
    if not exists(select 1 from public.storage_resources where resource_key=key_value and not deleted
      and value->>'kind'=case when key_value=history_path then 'array' else 'object' end) then
      changes:=changes||jsonb_build_array(jsonb_build_object('resource_key',key_value,'category',category_value,'owner_number',null,
        'value',jsonb_build_object('kind',case when key_value=history_path then 'array' else 'object' end,'parentKey',parent,'member',member)));
    end if;
  end loop;
  changes:=changes||jsonb_build_array(jsonb_build_object('resource_key',bid_path,'category','auctionBids','owner_number',null,
    'value',jsonb_build_object('kind','value','parentKey','/auctionBids','member',item_id,'data',jsonb_build_object('bidder',student,'amount',amount))));
  entry:=jsonb_build_object('itemId',item_id,'bidder',student,'amount',amount,'createdAt',created_at_value);
  member:=format('#{"amount":%s,"bidder":%s,"createdAt":%s,"itemId":%s}',amount,student,to_jsonb(created_at_value)::text,to_jsonb(item_id)::text);
  key_value:=history_path||'/'||replace(replace(member,'~','~0'),'/','~1');
  select coalesce(max((value->>'order')::double precision),-1)+1 into position_value from public.storage_resources
    where not deleted and value->>'parentKey'=history_path;
  changes:=changes||jsonb_build_array(jsonb_build_object('resource_key',key_value,'category','auctionBidHistory','owner_number',null,
    'value',jsonb_build_object('kind','value','parentKey',history_path,'member',member,'order',position_value,'data',entry)));
  select coalesce(jsonb_object_agg(keys.key,coalesce(r.revision,0)),'{}'::jsonb) into expected from (
    select value->>'resource_key' key from jsonb_array_elements(changes)
    union select '' union select '/auctionBids' union select '/auctionBidHistory' union select history_path
  ) keys left join public.storage_resources r on r.resource_key=keys.key;
  expected:=expected||jsonb_build_object('wallet:'||student,account.revision,'scope:auctionItems:all',coalesce(config_revision,0));
  result:=public.storage_commit_scoped_mutation(expected,changes,'[]','[]',actor,request_id_value,payload_hash_value,
    'student.auction.bid','{"applied":true}',null,scope);
  if result->>'saved'='true' then result:=result||jsonb_build_object('snapshot',public.storage_load_scope(scope)); end if;
  return result;
end;
$$;

revoke all on function public.storage_auction_amount(jsonb),public.storage_auction_student(jsonb),public.storage_place_auction_bid(jsonb) from public,anon,authenticated;
grant execute on function public.storage_auction_amount(jsonb),public.storage_auction_student(jsonb),public.storage_place_auction_bid(jsonb) to service_role;
revoke all on function public.storage_prepare_command(text,text,jsonb,jsonb),public.storage_commit_scoped_and_load(jsonb,jsonb,jsonb,jsonb,text,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.storage_prepare_command(text,text,jsonb,jsonb),public.storage_commit_scoped_and_load(jsonb,jsonb,jsonb,jsonb,text,text,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
