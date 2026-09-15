-- Apply after storage_scoped_v2.sql. Additive: old callers keep their CAS protection.
begin;

create or replace function public.storage_place_library_book(
  p_student_number integer, p_command jsonb, p_payload_hash text, p_protocol_version integer
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public set jit=off as $$
declare
  actor text := 'student:'||p_student_number;
  v_request_id text := p_command->>'requestId';
  receipt public.storage_receipts%rowtype;
  account public.wallet_accounts%rowtype;
  book_row public.storage_resources%rowtype;
  competition jsonb;
  book jsonb;
  entry jsonb;
  node jsonb;
  scope jsonb;
  result jsonb;
  book_id text;
  book_key text;
  member text;
  k text;
  slot integer;
  n integer;
  color integer;
  position double precision;
  at_time timestamptz;
  at_text text;
  reward_id text;
  event jsonb;
  count_item jsonb;
  event_group text;
  event_id text;
  seen text[];
  counts_seen text[];
  previous_at text;
  latest_at timestamptz;
  trim_chars text := E' \t\n\r\f' || chr(11) || chr(160) || chr(5760) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279);
  applied boolean := true;
begin
  if p_protocol_version is distinct from 2 then raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end if;
  perform public.storage_require_writable();
  if p_student_number is null or p_student_number not between 1 and 23
    or jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>16384
    or p_command->>'action' is distinct from 'placeLibraryBook'
    or v_request_id is null or v_request_id !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_command->'slotId') is distinct from 'number' or (p_command->>'slotId') !~ '^\d{1,2}$'
    or jsonb_typeof(p_command->'book') is distinct from 'object'
    or (p_command#>>'{book,kind}') is null or (p_command#>>'{book,kind}') not in ('new','existing') then
    raise exception 'INVALID_LIBRARY_COMMAND';
  end if;
  slot := (p_command->>'slotId')::integer;
  if p_command ? 'seasonId' and (jsonb_typeof(p_command->'seasonId') is distinct from 'string' or p_command->>'seasonId' !~ '^\d{4}-(0[1-9]|1[0-2])$') then raise exception 'INVALID_LIBRARY_COMMAND'; end if;
  if p_command#>>'{book,kind}'='new' then
    if jsonb_typeof(p_command#>'{book,title}') is distinct from 'string' or length(btrim(p_command#>>'{book,title}',trim_chars)) not between 1 and 50
      or jsonb_typeof(p_command#>'{book,author}') is distinct from 'string' or length(btrim(p_command#>>'{book,author}',trim_chars)) not between 1 and 30
      or jsonb_typeof(p_command#>'{book,pageCount}') is distinct from 'number' or p_command#>>'{book,pageCount}' !~ '^\d{1,4}$'
      or (p_command#>>'{book,pageCount}')::integer not between (case when (p_command->'book') ? 'reflection' then 0 else 1 end) and 5000
      or ((p_command->'book') ? 'reflection' and (jsonb_typeof(p_command#>'{book,reflection}') is distinct from 'string'
        or length(btrim(p_command#>>'{book,reflection}',trim_chars)) not between 1 and 100 or p_command#>>'{book,reflection}' ~ E'[\r\n]')) then raise exception 'INVALID_LIBRARY_COMMAND'; end if;
    book_id := 'library:'||p_student_number||':'||v_request_id;
  else
    book_id := p_command#>>'{book,bookId}';
    if jsonb_typeof(p_command#>'{book,bookId}') is distinct from 'string' or length(btrim(book_id,trim_chars)) not between 1 and 80 then raise exception 'INVALID_LIBRARY_COMMAND'; end if;
  end if;
  scope := jsonb_build_object('resources',jsonb_build_array(jsonb_build_object('path','/libraryCompetition'),jsonb_build_object('path','/studentLife/books')),
    'writeResources',jsonb_build_array(jsonb_build_object('path','/libraryCompetition'),jsonb_build_object('path','/studentLife/books')),
    'wallets',jsonb_build_array(p_student_number),'history',jsonb_build_array(p_student_number),'writeWallets',jsonb_build_array(p_student_number),
    'revisionKeys',jsonb_build_array('scope:libraryCompetition:shared','collection:/studentLife/books'));
  -- Match every existing writer: receipt, wallet, sorted scopes, then resource locks.
  perform pg_advisory_xact_lock(hashtextextended('receipt:'||actor||':'||v_request_id,0));
  select * into receipt from public.storage_receipts where actor_key=actor and storage_receipts.request_id=v_request_id;
  if found then
    if receipt.action<>'placeLibraryBook' or receipt.payload_hash<>p_payload_hash then raise exception 'STORAGE_REQUEST_REUSED'; end if;
    return jsonb_build_object('saved',true,'result',receipt.result,'snapshot',public.storage_load_scope(scope));
  end if;
  select * into account from public.wallet_accounts where student_number=p_student_number for update;
  if not found then raise exception 'STORAGE_INVALID_MUTATION'; end if;
  for k in select distinct key from unnest(array[
    'collection:','collection:/studentLife','collection:/studentLife/books','collection:/libraryCompetition','collection:/libraryCompetition/placements',
    'collection:/currencyHistory','scope:root:all','scope:root:shared','scope:studentLife:all','scope:studentLife:shared','scope:studentLife:'||p_student_number,
    'scope:libraryCompetition:all','scope:libraryCompetition:shared','scope:currencyHistory:all','scope:currencyHistory:shared','scope:currencyHistory:'||p_student_number,
    'scope:currencyBalances:all','scope:currencyBalances:shared'
  ]) keys(key) order by key loop perform pg_advisory_xact_lock(hashtextextended('scope:'||k,0)); end loop;
  -- Read only after obtaining the locks. No client snapshot/retry round trips while contending.
  if exists(select 1 from public.storage_resources where resource_key='/libraryCompetition' and not deleted) then
    competition := public.storage_project_node('/libraryCompetition');
  end if;
  if competition is not null and competition<>'null'::jsonb then
    if jsonb_typeof(competition) is distinct from 'object' or competition->'version' is distinct from '1'::jsonb
      or jsonb_typeof(competition->'placements') is distinct from 'array' or jsonb_typeof(competition->'adjustments') is distinct from 'array'
      or competition->>'seasonId' is null or competition->>'seasonId' !~ '^\d{4}-(0[1-9]|1[0-2])$'
      or competition->>'revision' is null or competition->>'revision' !~ '^\d+$' or (competition->>'revision')::numeric >= 9007199254740991
      or competition->>'startedAt' is null or competition->>'seed' is null then raise exception 'LIBRARY_COMPETITION_INVALID_STATE'; end if;
    begin
      if jsonb_typeof(competition->'seed') is distinct from 'string' or length(competition->>'seed') not between 1 and 200
        or btrim(competition->>'seed',trim_chars)<>competition->>'seed'
        or jsonb_typeof(competition->'revision') is distinct from 'number'
        or jsonb_array_length(competition->'placements')>100 or jsonb_array_length(competition->'adjustments')>2048
        or jsonb_typeof(competition->'startedAt') is distinct from 'string'
        or competition->>'startedAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
        or to_char((competition->>'startedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>competition->>'startedAt'
        or to_char((competition->>'startedAt')::timestamptz at time zone 'Asia/Seoul','YYYY-MM')<>competition->>'seasonId' then raise exception 'invalid'; end if;
      latest_at := (competition->>'startedAt')::timestamptz;
      foreach event_group in array array['placements','adjustments'] loop
        previous_at := competition->>'startedAt'; seen := array[]::text[];
        for event in select value from jsonb_array_elements(competition->event_group) loop
          event_id := event->>(case when event_group='placements' then 'bookId' else 'id' end);
          if jsonb_typeof(event) is distinct from 'object' or event_id is null or length(event_id) not between 1 and 200 or btrim(event_id,trim_chars)<>event_id or event_id=any(seen)
            or jsonb_typeof(event->(case when event_group='placements' then 'bookId' else 'id' end)) is distinct from 'string'
            or jsonb_typeof(event->'at') is distinct from 'string' or event->>'at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
            or event->>'at'<previous_at or to_char((event->>'at')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>event->>'at'
            or to_char((event->>'at')::timestamptz at time zone 'Asia/Seoul','YYYY-MM')<>competition->>'seasonId' then raise exception 'invalid'; end if;
          seen := array_append(seen,event_id); previous_at := event->>'at'; latest_at := greatest(latest_at,(event->>'at')::timestamptz);
          if event_group='adjustments' then
            if jsonb_typeof(event->'paused') is distinct from 'boolean' or event->'speed' is null or event->'speed' not in ('0.5'::jsonb,'1'::jsonb,'1.5'::jsonb)
              or jsonb_typeof(event->'counts') is distinct from 'array' or jsonb_array_length(event->'counts')>16 then raise exception 'invalid'; end if;
            counts_seen := array[]::text[];
            for count_item in select value from jsonb_array_elements(event->'counts') loop
              if count_item->>'schoolId' is null or count_item->>'schoolId' !~ '^school-(0[12456789]|1[0-7])$' or count_item->>'schoolId'=any(counts_seen)
                or jsonb_typeof(count_item->'count') is distinct from 'number' or count_item->>'count' !~ '^\d{1,3}$' or (count_item->>'count')::integer>100 then raise exception 'invalid'; end if;
              counts_seen := array_append(counts_seen,count_item->>'schoolId');
            end loop;
          end if;
        end loop;
      end loop;
    exception when others then raise exception 'LIBRARY_COMPETITION_INVALID_STATE'; end;
    if competition->>'seasonId' <> to_char(clock_timestamp() at time zone 'Asia/Seoul','YYYY-MM') then
      return jsonb_build_object('error','LIBRARY_SEASON_ROLLOVER_REQUIRED','status',409);
    end if;
    if p_command->>'seasonId' is distinct from competition->>'seasonId' then return jsonb_build_object('error','LIBRARY_SEASON_CHANGED','status',409); end if;
  end if;
  select * into book_row from public.storage_resources where not deleted and value->>'parentKey'='/studentLife/books' and value#>>'{data,id}'=book_id;
  get diagnostics n = row_count;
  if (select count(*) from public.storage_resources where not deleted and value->>'parentKey'='/studentLife/books' and value#>>'{data,id}'=book_id)>1 then raise exception 'INVALID_LIBRARY_COMMAND'; end if;
  if p_command#>>'{book,kind}'='existing' then
    if n=0 or book_row.value#>'{data,studentNumber}' is distinct from to_jsonb(p_student_number) then return jsonb_build_object('error','LIBRARY_BOOK_FORBIDDEN','status',403); end if;
    book := book_row.value->'data';
    if jsonb_typeof(book->'id') is distinct from 'string' or length(book->>'id')=0
      or jsonb_typeof(book->'title') is distinct from 'string' or length(btrim(book->>'title',trim_chars))=0
      or jsonb_typeof(book->'createdAt') is distinct from 'string' or jsonb_typeof(book->'pageCount') is distinct from 'number'
      or book->>'pageCount' !~ '^\d{1,4}$' or (book->>'pageCount')::integer not between (case when book ? 'reflection' then 0 else 1 end) and 5000
      or (book ? 'reflection' and (jsonb_typeof(book->'reflection') is distinct from 'string' or length(btrim(book->>'reflection',trim_chars)) not between 1 and 100 or book->>'reflection' ~ E'[\r\n]')) then raise exception 'INVALID_LIBRARY_COMMAND'; end if;
    if book ? 'librarySlot' then
      if book->'librarySlot' is distinct from to_jsonb(slot) then return jsonb_build_object('error','LIBRARY_BOOK_ALREADY_PLACED','status',409); end if;
      applied := false;
    end if;
  elsif n>0 then
    book := book_row.value->'data';
    if jsonb_typeof(book->'createdAt') is distinct from 'string' or book->'studentNumber' is distinct from to_jsonb(p_student_number) or book->'librarySlot' is distinct from to_jsonb(slot)
      or book->'title' is distinct from p_command#>'{book,title}' or book->'author' is distinct from p_command#>'{book,author}'
      or book->'pageCount' is distinct from p_command#>'{book,pageCount}' or book->'reflection' is distinct from p_command#>'{book,reflection}' then raise exception 'INVALID_LIBRARY_COMMAND'; end if;
    applied := false;
  end if;
  at_time := greatest(clock_timestamp(),latest_at,coalesce((select max(updated_at)+interval '1 millisecond' from public.storage_resources where category='libraryCompetition' or value->>'parentKey'='/studentLife/books'),'epoch'));
  at_text := to_char(at_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  if applied then
    if (select count(*) from public.storage_resources where not deleted and value->>'parentKey'='/studentLife/books' and (value->'data') ? 'librarySlot')>=100 then return jsonb_build_object('error','LIBRARY_FULL','status',409); end if;
    if exists(select 1 from public.storage_resources where not deleted and value->>'parentKey'='/studentLife/books' and value#>'{data,librarySlot}'=to_jsonb(slot)) then return jsonb_build_object('error','LIBRARY_SLOT_OCCUPIED','status',409); end if;
    if competition is not null and competition<>'null'::jsonb and to_char(at_time at time zone 'Asia/Seoul','YYYY-MM')<>competition->>'seasonId' then return jsonb_build_object('error','LIBRARY_SEASON_ROLLOVER_REQUIRED','status',409); end if;
    if p_command#>>'{book,kind}'='new' then
      select (coalesce((value#>>'{data,colorIndex}')::integer,1)+5)%6 into color from public.storage_resources
        where not deleted and value->>'parentKey'='/studentLife/books' and owner_number=p_student_number order by (value->>'order')::double precision desc,resource_key desc limit 1;
      book := ((p_command->'book')-'kind')||jsonb_build_object('id',book_id,'studentNumber',p_student_number,'createdAt',at_text,'colorIndex',coalesce(color,0),'librarySlot',slot);
      member := '@'||book_id;
      book_key := '/studentLife/books/'||replace(replace(member,'~','~0'),'/','~1');
      select coalesce(max((value->>'order')::double precision),-1)+1 into position from public.storage_resources where not deleted and value->>'parentKey'='/studentLife/books';
      node := jsonb_build_object('kind','value','parentKey','/studentLife/books','member',member,'order',position,'data',book);
    else
      book := book||jsonb_build_object('librarySlot',slot);
      book_key := book_row.resource_key;
      node := jsonb_set(book_row.value,'{data}',book);
    end if;
    -- Missing containers are created without replacing existing ancestors or unrelated fields.
    if not exists(select 1 from public.storage_resources where resource_key='/studentLife' and not deleted) then
      perform public.storage_write_resource('/studentLife','studentLife',null,jsonb_build_object('kind','object','parentKey','','member','studentLife'));
    end if;
    if not exists(select 1 from public.storage_resources where resource_key='/studentLife/books' and not deleted) then
      perform public.storage_write_resource('/studentLife/books','studentLife',null,jsonb_build_object('kind','array','parentKey','/studentLife','member','books'));
    end if;
    perform public.storage_write_resource(book_key,'studentLife',p_student_number,node);
    if competition is not null and competition<>'null'::jsonb then
      if jsonb_array_length(competition->'placements')>=100 then raise exception 'LIBRARY_COMPETITION_INVALID_STATE'; end if;
      if not exists(select 1 from jsonb_array_elements(competition->'placements') p where p->>'bookId'=book_id) then
        entry := jsonb_build_object('bookId',book_id,'at',at_text);
        member := '#{"at":'||to_jsonb(at_text)::text||',"bookId":'||to_jsonb(book_id)::text||'}';
        select coalesce(max((value->>'order')::double precision),-1)+1 into position from public.storage_resources where not deleted and value->>'parentKey'='/libraryCompetition/placements';
        perform public.storage_write_resource('/libraryCompetition/placements/'||replace(replace(member,'~','~0'),'/','~1'),'libraryCompetition',null,
          jsonb_build_object('kind','value','parentKey','/libraryCompetition/placements','member',member,'order',position,'data',entry));
        select value into node from public.storage_resources where resource_key='/libraryCompetition/revision' and not deleted;
        perform public.storage_write_resource('/libraryCompetition/revision','libraryCompetition',null,jsonb_set(node,'{data}',to_jsonb((competition->>'revision')::bigint+1)));
      end if;
    end if;
    reward_id := 'weekly-mission-book_stack-'||p_student_number||'-'||to_char(at_time at time zone 'Asia/Seoul','IYYY-IW');
    if account.balance<=999989 and not exists(select 1 from public.wallet_ledger where student_number=p_student_number and entry_id=reward_id) then
      if not exists(select 1 from public.storage_resources where resource_key='/currencyHistory' and not deleted) then
        perform public.storage_write_resource('/currencyHistory','currencyHistory',null,jsonb_build_object('kind','object','parentKey','','member','currencyHistory'));
      end if;
      if not exists(select 1 from public.storage_resources where resource_key='/currencyHistory/'||p_student_number and not deleted) then
        perform public.storage_write_resource('/currencyHistory/'||p_student_number,'currencyHistory',p_student_number,jsonb_build_object('kind','array','parentKey','/currencyHistory','member',p_student_number::text));
      end if;
      perform public.storage_apply_wallet_delta(p_student_number,reward_id,10,'weekly_mission',at_time,actor||':'||v_request_id);
    end if;
  end if;
  result := jsonb_build_object('book',book,'updatedAt',at_text);
  insert into public.storage_receipts(actor_key,request_id,action,payload_hash,result,scope) values(actor,v_request_id,'placeLibraryBook',p_payload_hash,result,scope);
  return jsonb_build_object('saved',true,'result',result,'snapshot',public.storage_load_scope(scope));
end;
$$;
revoke all on function public.storage_place_library_book(integer,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.storage_place_library_book(integer,jsonb,text,integer) to service_role;
notify pgrst, 'reload schema';
commit;
