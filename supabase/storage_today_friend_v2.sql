-- Dedicated submissions retain their identifiers; planning uses one row per week/day/question.
alter table public.today_friend_submissions add column if not exists storage_revision bigint not null default 0;
create table if not exists public.today_friend_planning_records (
  category text not null,record_key text not null,value jsonb not null,sort_order integer not null default 0,
  revision bigint not null default 1, primary key(category,record_key)
);
create or replace function public.today_friend_plan_rows(p_state jsonb)
returns table(category text,record_key text,value jsonb,sort_order integer)
language sql immutable set search_path='' as $$
  select 'weeks',v->>'weekKey',v,ordinality::integer from jsonb_array_elements(coalesce(p_state->'weeks','[]')) with ordinality a(v,ordinality)
  union all select 'partnerDays',v->>'dateKey',v,ordinality::integer from jsonb_array_elements(coalesce(p_state->'partnerDays','[]')) with ordinality a(v,ordinality)
  union all select 'questions',v->>'id',v,ordinality::integer from jsonb_array_elements(coalesce(p_state->'questions','[]')) with ordinality a(v,ordinality)
  union all select 'selectedQuestionIdByDate',key,value,0 from jsonb_each(coalesce(p_state->'selectedQuestionIdByDate','{}'))
$$;
do $$ begin
  if exists(select 1 from public.today_friend_settings s cross join lateral public.today_friend_plan_rows(s.state) r
    where s.id='main' group by r.category,r.record_key having count(*)>1) then raise exception 'STORAGE_TODAY_FRIEND_DUPLICATE_PLAN_KEYS'; end if;
end; $$;
insert into public.today_friend_planning_records(category,record_key,value,sort_order)
 select r.* from public.today_friend_settings s cross join lateral public.today_friend_plan_rows(s.state) r
 where s.id='main' on conflict(category,record_key) do nothing;

create or replace function public.load_today_friend_planning_v2() returns jsonb
language sql stable security definer set search_path='' as $$
 select case when not exists(select 1 from public.today_friend_planning_records) then null else jsonb_build_object(
  'version',1,'submissions','[]'::jsonb,
  'weeks',coalesce((select jsonb_agg(value order by sort_order,record_key) from public.today_friend_planning_records where category='weeks'),'[]'::jsonb),
  'partnerDays',coalesce((select jsonb_agg(value order by sort_order,record_key) from public.today_friend_planning_records where category='partnerDays'),'[]'::jsonb),
  'questions',coalesce((select jsonb_agg(value order by sort_order,record_key) from public.today_friend_planning_records where category='questions'),'[]'::jsonb),
  'selectedQuestionIdByDate',coalesce((select jsonb_object_agg(record_key,value) from public.today_friend_planning_records where category='selectedQuestionIdByDate'),'{}'::jsonb)) end
$$;

create or replace function public.today_friend_planning_version_v2(p_date_key text,p_week_key text) returns text
language sql stable security definer set search_path='' as $$
  select md5(coalesce(jsonb_agg(jsonb_build_array(category,record_key,value) order by category,record_key),'[]'::jsonb)::text)
  from public.today_friend_planning_records where category='questions' or (category='weeks' and record_key=p_week_key)
    or (category in ('partnerDays','selectedQuestionIdByDate') and record_key=p_date_key)
$$;
create or replace function public.load_today_friend_context_v2(p_date_key text,p_week_key text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('state',public.load_today_friend_planning_v2(),'revision',public.today_friend_planning_version_v2(p_date_key,p_week_key))
$$;

create or replace function public.save_today_friend_planning_v2(p_expected jsonb,p_state jsonb,p_protocol_version integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare change record; current_value jsonb; initial_key text;
begin
  if p_protocol_version is distinct from 2 then raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end if;
  perform public.storage_require_writable();
  if jsonb_typeof(p_state) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object' then raise exception 'INVALID_TODAY_FRIEND_PLAN'; end if;
  if not exists(select 1 from public.today_friend_planning_records) then
    perform pg_advisory_xact_lock(hashtextextended('today-friend-plan-initial',0));
  end if;
  if p_expected->'questions' is distinct from p_state->'questions' or not exists(select 1 from public.today_friend_planning_records) then
    perform pg_advisory_xact_lock(hashtextextended('today-friend-plan:questions:*',0));
  end if;
  if not exists(select 1 from public.today_friend_planning_records) then
    for initial_key in select category||':'||record_key from public.today_friend_plan_rows(p_state) order by category,record_key loop
      perform pg_advisory_xact_lock(hashtextextended('today-friend-plan:'||initial_key,0));
    end loop;
    insert into public.today_friend_planning_records(category,record_key,value,sort_order) select * from public.today_friend_plan_rows(p_state);
    return true;
  end if;
  for change in select coalesce(n.category,e.category) category,coalesce(n.record_key,e.record_key) record_key,e.value expected,n.value desired,coalesce(n.sort_order,0) sort_order
    from public.today_friend_plan_rows(p_expected) e full join public.today_friend_plan_rows(p_state) n using(category,record_key)
    where e.value is distinct from n.value order by 1,2 loop
    perform pg_advisory_xact_lock(hashtextextended('today-friend-plan:'||change.category||':'||change.record_key,0));
    select value into current_value from public.today_friend_planning_records where category=change.category and record_key=change.record_key for update;
    if current_value is not distinct from change.desired then continue; end if;
    if current_value is distinct from change.expected then raise exception 'TODAY_FRIEND_PLANNING_CONFLICT'; end if;
    if change.desired is null then delete from public.today_friend_planning_records where category=change.category and record_key=change.record_key;
    else insert into public.today_friend_planning_records(category,record_key,value,sort_order) values(change.category,change.record_key,change.desired,change.sort_order)
      on conflict(category,record_key) do update set value=excluded.value,sort_order=excluded.sort_order,revision=public.today_friend_planning_records.revision+1;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.persist_today_friend_submission_v2(
  p_submission jsonb,p_expected_revision bigint,p_request_id text,p_actor_key text,p_payload_hash text,p_protocol_version integer,p_expected_plan_revision text default null,p_week_key text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.today_friend_submissions%rowtype;next_row public.today_friend_submissions%rowtype;v_hash text;v_receipt public.storage_receipts%rowtype;v_result jsonb;v_plan_key text;
begin
  if p_protocol_version is distinct from 2 then raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end if;
  perform public.storage_require_writable();
  if p_expected_revision is null or p_expected_revision<0 or nullif(p_request_id,'') is null or length(p_request_id)>200 or jsonb_typeof(p_submission) is distinct from 'object' then raise exception 'INVALID_TODAY_FRIEND_SUBMISSION'; end if;
  if p_payload_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_TODAY_FRIEND_SUBMISSION'; end if;
  v_hash:=p_payload_hash;
  perform pg_advisory_xact_lock(hashtextextended('receipt:'||p_actor_key||':'||p_request_id,0));
  select * into v_receipt from public.storage_receipts where actor_key=p_actor_key and request_id=p_request_id;
  if found then
    if v_receipt.action<>'today_friend_submission' or v_receipt.payload_hash<>v_hash then raise exception 'STORAGE_REQUEST_PAYLOAD_MISMATCH'; end if;
    return v_receipt.result;
  end if;
  if p_expected_plan_revision is not null then
    perform pg_advisory_xact_lock_shared(hashtextextended('today-friend-plan:questions:*',0));
    for v_plan_key in select k from unnest(array['weeks:'||p_week_key,'partnerDays:'||(p_submission->>'submission_date'),'selectedQuestionIdByDate:'||(p_submission->>'submission_date')]) k order by k loop
      perform pg_advisory_xact_lock_shared(hashtextextended('today-friend-plan:'||v_plan_key,0));
    end loop;
    if public.today_friend_planning_version_v2(p_submission->>'submission_date',p_week_key) is distinct from p_expected_plan_revision then raise exception 'TODAY_FRIEND_SUBMISSION_CONFLICT'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('today-friend-submission:'||(p_submission->>'submission_date')||':'||(p_submission->>'student_number'),0));
  select * into current_row from public.today_friend_submissions where submission_date=(p_submission->>'submission_date')::date and student_number=(p_submission->>'student_number')::integer for update;
  if coalesce(current_row.storage_revision,0)<>p_expected_revision then raise exception 'TODAY_FRIEND_SUBMISSION_CONFLICT'; end if;
  if current_row.status='approved' or (current_row.status='submitted' and p_submission->>'status' not in ('revision_requested')) then raise exception 'SUBMISSION_NOT_EDITABLE'; end if;
  if current_row.id is not null and current_row.id<>p_submission->>'id' then raise exception 'TODAY_FRIEND_SUBMISSION_CONFLICT'; end if;
  perform set_config('school_timer.today_friend_v2','2',true);
  insert into public.today_friend_submissions(id,submission_date,student_number,partner_number,genre,payload,status,revision,teacher_feedback,submitted_at,reviewed_at,reward_status,storage_revision,updated_at)
  values(p_submission->>'id',(p_submission->>'submission_date')::date,(p_submission->>'student_number')::integer,(p_submission->>'partner_number')::integer,
    p_submission->>'genre',p_submission->'payload',p_submission->>'status',(p_submission->>'revision')::integer,p_submission->>'teacher_feedback',(p_submission->>'submitted_at')::timestamptz,
    (p_submission->>'reviewed_at')::timestamptz,coalesce(current_row.reward_status,'pending'),p_expected_revision+1,clock_timestamp())
  on conflict(submission_date,student_number) do update set payload=excluded.payload,status=excluded.status,revision=excluded.revision,teacher_feedback=excluded.teacher_feedback,
    submitted_at=excluded.submitted_at,reviewed_at=excluded.reviewed_at,storage_revision=excluded.storage_revision,updated_at=excluded.updated_at
  returning * into next_row;
  v_result:=jsonb_build_array(to_jsonb(next_row));
  insert into public.storage_receipts(actor_key,request_id,action,payload_hash,result) values(p_actor_key,p_request_id,'today_friend_submission',v_hash,v_result);
  return v_result;
end;
$$;

create or replace function public.guard_today_friend_v2() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.storage_control where singleton and (active or maintenance)) then
    perform public.storage_require_writable();
    if current_setting('school_timer.today_friend_v2',true) is distinct from '2' then raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;return new;
end;
$$;
drop trigger if exists guard_today_friend_v2 on public.today_friend_submissions;
create trigger guard_today_friend_v2 before insert or update or delete on public.today_friend_submissions for each row execute function public.guard_today_friend_v2();
drop trigger if exists guard_today_friend_v2 on public.today_friend_settings;
create trigger guard_today_friend_v2 before insert or update or delete on public.today_friend_settings for each row execute function public.guard_today_friend_v2();
alter table public.today_friend_planning_records enable row level security;
revoke all on public.today_friend_planning_records from public,anon,authenticated;
grant select,insert,update,delete on public.today_friend_planning_records to service_role;
revoke all on function public.load_today_friend_planning_v2() from public,anon,authenticated;
revoke all on function public.save_today_friend_planning_v2(jsonb,jsonb,integer) from public,anon,authenticated;
revoke all on function public.persist_today_friend_submission_v2(jsonb,bigint,text,text,text,integer,text,text) from public,anon,authenticated;
revoke all on function public.today_friend_plan_rows(jsonb) from public,anon,authenticated;
revoke all on function public.guard_today_friend_v2() from public,anon,authenticated;
grant execute on function public.load_today_friend_planning_v2() to service_role;
grant execute on function public.save_today_friend_planning_v2(jsonb,jsonb,integer) to service_role;
grant execute on function public.persist_today_friend_submission_v2(jsonb,bigint,text,text,text,integer,text,text) to service_role;

revoke all on function public.today_friend_planning_version_v2(text,text) from public,anon,authenticated;
revoke all on function public.load_today_friend_context_v2(text,text) from public,anon,authenticated;
grant execute on function public.today_friend_planning_version_v2(text,text) to service_role;
grant execute on function public.load_today_friend_context_v2(text,text) to service_role;
