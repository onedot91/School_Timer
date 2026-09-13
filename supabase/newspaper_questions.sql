-- Apply after storage_rewards_v2.sql. Existing question-site data is not imported or deleted.
begin;
create table if not exists public.newspaper_questions (
  id uuid primary key default gen_random_uuid(), student_number integer not null check (student_number between 1 and 23),
  question_type text not null check (question_type in ('personal','topic')),
  question_text text not null check (char_length(btrim(question_text)) between 1 and 60),
  week_key text not null check (week_key ~ '^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), downloaded_at timestamptz,
  unique(student_number,question_type,week_key)
);
create index if not exists newspaper_questions_week on public.newspaper_questions(week_key,student_number);
create table if not exists public.newspaper_topics (
  id uuid primary key default gen_random_uuid(), week_key text not null unique check (week_key ~ '^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$'),
  topic_text text not null check (char_length(btrim(topic_text)) between 1 and 40),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.newspaper_receipts (
  actor integer not null check(actor between 0 and 23), request_id uuid not null,
  command jsonb not null, result jsonb not null, created_at timestamptz not null default now(), primary key(actor,request_id)
);
create table if not exists public.newspaper_audit (
  id uuid primary key default gen_random_uuid(), actor integer not null, action text not null,
  created_at timestamptz not null default now()
);
alter table public.newspaper_questions enable row level security;
alter table public.newspaper_topics enable row level security;
alter table public.newspaper_receipts enable row level security;
alter table public.newspaper_audit enable row level security;
revoke all on public.newspaper_questions,public.newspaper_topics,public.newspaper_receipts,public.newspaper_audit from public,anon,authenticated;
grant select on public.newspaper_questions,public.newspaper_topics to service_role;

create or replace function public.newspaper_read(p_actor integer,p_week text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_current text := to_char(now() at time zone 'Asia/Seoul','IYYY-IW'); v_questions jsonb; v_history jsonb; v_topics jsonb;
begin
  if p_actor is null or p_actor not between 0 and 23 then raise exception 'QUESTION_FORBIDDEN'; end if;
  if p_week is null or p_week !~ '^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$' then raise exception 'QUESTION_INVALID_WEEK'; end if;
  if p_actor <> 0 and p_week <> v_current then raise exception 'QUESTION_WEEK_CHANGED'; end if;
  select coalesce(jsonb_agg(case when p_actor=0 then to_jsonb(q) else to_jsonb(q)||jsonb_build_object('downloaded_at',null) end order by q.student_number,q.question_type),'[]')
    into v_questions from public.newspaper_questions q where q.week_key=p_week;
  select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('downloaded_at',null) order by q.week_key desc,q.question_type),'[]')
    into v_history from public.newspaper_questions q where q.student_number=p_actor;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.week_key desc),'[]') into v_topics from public.newspaper_topics t where p_actor=0 or t.week_key=p_week;
  return jsonb_build_object('weekKey',p_week,'questions',v_questions,'history',v_history,'topics',v_topics,
    'weeks',case when p_actor=0 then coalesce((select jsonb_agg(w.week_key order by w.week_key desc) from
      (select week_key from public.newspaper_questions union select week_key from public.newspaper_topics) w),'[]'::jsonb) else jsonb_build_array(p_week) end);
end;
$$;

create or replace function public.newspaper_command(p_actor integer,p_request_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_action text := p_command->>'action'; v_week text := p_command->>'weekKey'; v_type text := p_command->>'questionType';
  v_text text := p_command->>'questionText'; v_now timestamptz := clock_timestamp();
  v_current text := to_char(now() at time zone 'Asia/Seoul','IYYY-IW');
  v_row public.newspaper_questions%rowtype; v_receipt public.newspaper_receipts%rowtype;
  v_result jsonb; v_reward jsonb := null; v_topic public.newspaper_topics%rowtype;
begin
  if p_actor is null or p_actor not between 0 and 23 or p_request_id is null or jsonb_typeof(p_command) is distinct from 'object' then raise exception 'QUESTION_FORBIDDEN'; end if;
  if v_action is null or v_action not in ('submit','update','delete','topic','download','reset') then raise exception 'QUESTION_INVALID_ACTION'; end if;
  if p_actor <> 0 and v_action <> 'submit' then raise exception 'QUESTION_FORBIDDEN'; end if;
  -- All mutations share this feature lock: edit, reset and download cannot race each other.
  perform pg_advisory_xact_lock(hashtextextended('newspaper-questions',0));
  select * into v_receipt from public.newspaper_receipts where actor=p_actor and request_id=p_request_id;
  if found then
    if v_receipt.command is distinct from p_command then raise exception 'QUESTION_REQUEST_REUSED'; end if;
    return v_receipt.result;
  end if;
  perform public.storage_require_writable();
  if v_action in ('submit','topic','download') and (v_week is null or v_week !~ '^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$') then raise exception 'QUESTION_INVALID_WEEK'; end if;
  if v_action in ('submit','update') then
    if v_text is null or char_length(btrim(v_text)) not between 1 and 60 then raise exception 'QUESTION_TOO_LONG'; end if;
  end if;
  if v_action='submit' then
    if p_actor=0 or v_type is null or v_type not in ('personal','topic') then raise exception 'QUESTION_FORBIDDEN'; end if;
    if v_week<>v_current then raise exception 'QUESTION_WEEK_CHANGED'; end if;
    if v_type='topic' then
      if not exists(select 1 from public.newspaper_topics where week_key=v_week) then raise exception 'QUESTION_TOPIC_REQUIRED'; end if;
      if not exists(select 1 from public.newspaper_questions where student_number=p_actor and week_key=v_week and question_type='personal') then raise exception 'QUESTION_PERSONAL_REQUIRED'; end if;
      if (select updated_at from public.newspaper_topics where week_key=v_week) is distinct from (p_command->>'topicRevision')::timestamptz then raise exception 'QUESTION_CONFLICT'; end if;
    end if;
    select * into v_row from public.newspaper_questions where student_number=p_actor and week_key=v_week and question_type=v_type;
    if v_row.updated_at is distinct from (p_command->>'expectedUpdatedAt')::timestamptz then raise exception 'QUESTION_CONFLICT'; end if;
    insert into public.newspaper_questions(student_number,question_type,question_text,week_key,created_at,updated_at)
      values(p_actor,v_type,v_text,v_week,v_now,v_now)
      on conflict(student_number,question_type,week_key) do update set question_text=excluded.question_text,
        updated_at=case when newspaper_questions.question_text=excluded.question_text then newspaper_questions.updated_at else excluded.updated_at end,
        downloaded_at=case when newspaper_questions.question_text=excluded.question_text then newspaper_questions.downloaded_at else null end
      returning * into v_row;
    if v_type='personal' then v_reward := public.claim_weekly_mission_reward_v2(p_actor,v_week,'personal_question',v_row.id::text,2); end if;
    v_result := jsonb_build_object('question',to_jsonb(v_row)||jsonb_build_object('downloaded_at',null),'reward',v_reward);
  elsif v_action in ('update','delete') then
    select * into v_row from public.newspaper_questions where id=(p_command->>'id')::uuid;
    if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
    if v_row.updated_at is distinct from (p_command->>'expectedUpdatedAt')::timestamptz then raise exception 'QUESTION_CONFLICT'; end if;
    if v_action='delete' then
      delete from public.newspaper_questions where id=v_row.id;
      update public.newspaper_receipts set command='{}',result='{}'
        where result->'question'->>'id'=v_row.id::text or command->>'id'=v_row.id::text
          or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(result->'questions')='array' then result->'questions' else '[]'::jsonb end) q where q->>'id'=v_row.id::text);
    else update public.newspaper_questions set question_text=v_text,updated_at=v_now,downloaded_at=null where id=v_row.id returning * into v_row; end if;
    v_result := jsonb_build_object('ok',true);
  elsif v_action='topic' then
    if char_length(btrim(p_command->>'topicText')) not between 1 and 40 or p_command->>'topicText' is null then raise exception 'QUESTION_TOPIC_INVALID'; end if;
    select * into v_topic from public.newspaper_topics where week_key=v_week;
    if v_topic.updated_at is distinct from (p_command->>'expectedUpdatedAt')::timestamptz then raise exception 'QUESTION_CONFLICT'; end if;
    insert into public.newspaper_topics(week_key,topic_text,created_at,updated_at) values(v_week,p_command->>'topicText',v_now,v_now)
      on conflict(week_key) do update set topic_text=excluded.topic_text,updated_at=excluded.updated_at;
    v_result := jsonb_build_object('ok',true);
  elsif v_action='download' then
    if p_command->>'mode' is null or p_command->>'mode' not in ('personal','topic','all') or jsonb_typeof(p_command->'cumulative') is distinct from 'boolean' then raise exception 'QUESTION_INVALID_ACTION'; end if;
    if (p_command->>'cumulative')::boolean then
      with claimed as (
        update public.newspaper_questions set downloaded_at=v_now where week_key=v_week and downloaded_at is null
          and (p_command->>'mode'='all' or question_type=p_command->>'mode') returning *
      ) select coalesce(jsonb_agg(to_jsonb(c) order by c.student_number,c.question_type),'[]') into v_result from claimed c;
    else select coalesce(jsonb_agg(to_jsonb(q) order by q.student_number,q.question_type),'[]') into v_result
      from public.newspaper_questions q where week_key=v_week and (p_command->>'mode'='all' or question_type=p_command->>'mode'); end if;
    v_result := jsonb_build_object('questions',v_result);
  elsif v_action='reset' then
    if p_command->>'confirmation' is distinct from '모든 기록 초기화' then raise exception 'QUESTION_FORBIDDEN'; end if;
    delete from public.newspaper_questions;
    delete from public.newspaper_topics;
    -- Erase retained question text; expired receipts remain as tombstones against late replays.
    update public.newspaper_receipts set command='{}',result='{}';
    v_result := jsonb_build_object('ok',true);
  end if;
  insert into public.newspaper_receipts(actor,request_id,command,result) values(p_actor,p_request_id,p_command,v_result);
  if p_actor=0 then insert into public.newspaper_audit(actor,action) values(p_actor,v_action); end if;
  return v_result;
end;
$$;
revoke all on function public.newspaper_read(integer,text), public.newspaper_command(integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.newspaper_read(integer,text), public.newspaper_command(integer,uuid,jsonb) to service_role;
commit;
