create table if not exists app_settings (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "Allow shared settings read" on app_settings;
create policy "Allow shared settings read"
on app_settings
for select
using (id = 'school-timer-main');

drop policy if exists "Allow shared settings write" on app_settings;
create policy "Allow shared settings write"
on app_settings
for insert
with check (id = 'school-timer-main');

drop policy if exists "Allow shared settings update" on app_settings;
create policy "Allow shared settings update"
on app_settings
for update
using (id = 'school-timer-main')
with check (id = 'school-timer-main');

create table if not exists announcement_notes (
  date_key text primary key,
  date_text text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table announcement_notes enable row level security;

drop policy if exists "Allow announcement notes read" on announcement_notes;
create policy "Allow announcement notes read"
on announcement_notes
for select
using (true);

drop policy if exists "Allow announcement notes write" on announcement_notes;
create policy "Allow announcement notes write"
on announcement_notes
for insert
with check (true);

drop policy if exists "Allow announcement notes update" on announcement_notes;
create policy "Allow announcement notes update"
on announcement_notes
for update
using (true)
with check (true);

create table if not exists weekly_mission_rewards (
  student_number smallint not null check (student_number between 1 and 23),
  week_key text not null check (week_key ~ '^\d{4}-\d{2}$'),
  mission_type text not null default 'personal_question' check (mission_type in ('personal_question', 'classword_word_entry', 'classword_quiz_correct')),
  reward_amount integer not null default 5 check (reward_amount = 5),
  source_event_id text not null,
  completed_at timestamptz not null default now(),
  primary key (student_number, week_key, mission_type)
);

alter table weekly_mission_rewards enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'weekly_mission_rewards'
      and column_name = 'source_question_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'weekly_mission_rewards'
      and column_name = 'source_event_id'
  ) then
    alter table weekly_mission_rewards rename column source_question_id to source_event_id;
  end if;
end;
$$;

alter table weekly_mission_rewards
  drop constraint if exists weekly_mission_rewards_mission_type_check;
alter table weekly_mission_rewards
  add constraint weekly_mission_rewards_mission_type_check
  check (mission_type in ('personal_question', 'classword_word_entry', 'classword_quiz_correct'));

create or replace function claim_weekly_mission_reward(
  p_student_number integer,
  p_week_key text,
  p_mission_type text,
  p_source_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awarded boolean := false;
  v_inserted_count integer := 0;
  v_completed boolean := false;
  v_value jsonb;
  v_student_key text := p_student_number::text;
  v_before integer := 100;
  v_after integer := 100;
  v_created_at timestamptz := now();
  v_history jsonb;
begin
  if p_student_number < 1 or p_student_number > 23 then
    raise exception 'INVALID_STUDENT_NUMBER';
  end if;
  if p_week_key !~ '^\d{4}-\d{2}$' then
    raise exception 'INVALID_WEEK_KEY';
  end if;
  if p_mission_type not in ('personal_question', 'classword_word_entry', 'classword_quiz_correct') then
    raise exception 'INVALID_MISSION_TYPE';
  end if;

  select value
  into v_value
  from app_settings
  where id = 'school-timer-main'
  for update;

  if not found then
    insert into app_settings (id, value)
    values ('school-timer-main', '{}'::jsonb)
    on conflict (id) do nothing;

    select value
    into v_value
    from app_settings
    where id = 'school-timer-main'
    for update;
  end if;

  v_value := coalesce(v_value, '{}'::jsonb);
  if jsonb_typeof(v_value -> 'currencyBalances') is distinct from 'object' then
    v_value := jsonb_set(v_value, '{currencyBalances}', '{}'::jsonb, true);
  end if;
  if jsonb_typeof(v_value -> 'currencyHistory') is distinct from 'object' then
    v_value := jsonb_set(v_value, '{currencyHistory}', '{}'::jsonb, true);
  end if;

  if (v_value -> 'currencyBalances' ->> v_student_key) ~ '^\d+$' then
    v_before := least(999999, greatest(0, (v_value -> 'currencyBalances' ->> v_student_key)::integer));
  end if;
  v_after := v_before;

  if
    p_source_event_id is not null and
    btrim(p_source_event_id) <> '' and
    v_before <= 999994
  then
    insert into weekly_mission_rewards (
      student_number,
      week_key,
      mission_type,
      reward_amount,
      source_event_id
    )
    values (
      p_student_number,
      p_week_key,
      p_mission_type,
      5,
      p_source_event_id
    )
    on conflict (student_number, week_key, mission_type) do nothing;
    get diagnostics v_inserted_count = row_count;
    v_awarded := v_inserted_count = 1;
  end if;

  select exists (
    select 1
    from weekly_mission_rewards as rewards
    where rewards.student_number = p_student_number
      and rewards.week_key = p_week_key
      and rewards.mission_type = p_mission_type
  ) into v_completed;

  if v_awarded then
    v_after := v_before + 5;
    v_value := jsonb_set(
      v_value,
      array['currencyBalances', v_student_key],
      to_jsonb(v_after),
      true
    );

    v_history := jsonb_build_array(jsonb_build_object(
      'id', case
        when p_mission_type = 'personal_question'
          then concat('weekly-mission-', p_student_number, '-', p_week_key)
        else concat('weekly-mission-', p_mission_type, '-', p_student_number, '-', p_week_key)
      end,
      'studentNumber', p_student_number,
      'delta', v_after - v_before,
      'before', v_before,
      'after', v_after,
      'reason', 'weekly_mission',
      'createdAt', v_created_at
    )) || case
      when jsonb_typeof(v_value -> 'currencyHistory' -> v_student_key) = 'array'
        then v_value -> 'currencyHistory' -> v_student_key
      else '[]'::jsonb
    end;

    v_value := jsonb_set(
      v_value,
      array['currencyHistory', v_student_key],
      v_history,
      true
    );

    update app_settings
    set value = v_value,
        updated_at = v_created_at
    where id = 'school-timer-main';
  end if;

  return jsonb_build_object(
    'missionType', p_mission_type,
    'weekKey', p_week_key,
    'completed', v_completed,
    'awarded', v_awarded,
    'rewardAmount', 5,
    'balance', v_after
  );
end;
$$;

create or replace function claim_personal_question_weekly_reward(
  p_student_number integer,
  p_week_key text,
  p_source_question_id text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select claim_weekly_mission_reward(
    p_student_number,
    p_week_key,
    'personal_question',
    p_source_question_id
  );
$$;

revoke all on function claim_weekly_mission_reward(integer, text, text, text) from public;
revoke all on function claim_weekly_mission_reward(integer, text, text, text) from anon;
revoke all on function claim_weekly_mission_reward(integer, text, text, text) from authenticated;
grant execute on function claim_weekly_mission_reward(integer, text, text, text) to service_role;

revoke all on function claim_personal_question_weekly_reward(integer, text, text) from public;
revoke all on function claim_personal_question_weekly_reward(integer, text, text) from anon;
revoke all on function claim_personal_question_weekly_reward(integer, text, text) from authenticated;
grant execute on function claim_personal_question_weekly_reward(integer, text, text) to service_role;

create table if not exists class_donation_requests (
  request_id text primary key,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table class_donation_requests enable row level security;
revoke all on table class_donation_requests from public;
revoke all on table class_donation_requests from anon;
revoke all on table class_donation_requests from authenticated;

create or replace function donate_to_class_goal(
  p_student_number integer,
  p_amount integer,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value jsonb;
  v_student_key text := p_student_number::text;
  v_donation jsonb;
  v_balance integer := 100;
  v_reserved integer := 0;
  v_target integer := 0;
  v_total integer := 0;
  v_created_at timestamptz := now();
  v_donation_history jsonb;
  v_currency_history jsonb;
  v_result jsonb;
begin
  if p_student_number < 1 or p_student_number > 23 then
    raise exception 'INVALID_STUDENT_NUMBER';
  end if;
  if p_amount < 1 then
    raise exception 'INVALID_DONATION_AMOUNT';
  end if;
  if p_request_id is null or btrim(p_request_id) = '' or length(p_request_id) > 100 then
    raise exception 'INVALID_DONATION_REQUEST_ID';
  end if;

  select value into v_value
  from app_settings
  where id = 'school-timer-main'
  for update;

  if not found then
    raise exception 'SHARED_SETTINGS_NOT_FOUND';
  end if;

  select result into v_result
  from class_donation_requests
  where request_id = p_request_id;
  if found then return v_result; end if;

  v_value := coalesce(v_value, '{}'::jsonb);
  v_donation := case
    when jsonb_typeof(v_value -> 'classDonation') = 'object' then v_value -> 'classDonation'
    else '{}'::jsonb
  end;
  if coalesce((v_donation ->> 'enabled')::boolean, false) is not true then
    raise exception 'CLASS_DONATION_DISABLED';
  end if;

  v_target := greatest(1, least(999999, coalesce((v_donation ->> 'targetAmount')::integer, 500)));
  v_total := greatest(0, least(v_target, coalesce((v_donation ->> 'totalAmount')::integer, 0)));
  v_donation_history := case
    when jsonb_typeof(v_donation -> 'history') = 'array' then v_donation -> 'history'
    else '[]'::jsonb
  end;

  if v_total >= v_target then
    raise exception 'CLASS_DONATION_COMPLETED';
  end if;
  if p_amount > v_target - v_total then
    raise exception 'CLASS_DONATION_EXCEEDS_REMAINING';
  end if;

  if (v_value -> 'currencyBalances' ->> v_student_key) ~ '^\d+$' then
    v_balance := greatest(0, least(999999, (v_value -> 'currencyBalances' ->> v_student_key)::integer));
  end if;

  select coalesce(sum((bid.value ->> 'amount')::integer), 0)
  into v_reserved
  from jsonb_each(case
    when jsonb_typeof(v_value -> 'auctionBids') = 'object' then v_value -> 'auctionBids'
    else '{}'::jsonb
  end) bid
  where (bid.value ->> 'bidder')::integer = p_student_number
    and not (
      jsonb_typeof(v_value -> 'auctionAwards') = 'object' and
      v_value -> 'auctionAwards' ? bid.key and
      v_value -> 'auctionAwards' -> bid.key <> 'null'::jsonb
    );

  if p_amount > greatest(0, v_balance - v_reserved) then
    raise exception 'INSUFFICIENT_AVAILABLE_CURRENCY';
  end if;

  v_donation_history := jsonb_build_array(jsonb_build_object(
    'id', p_request_id,
    'studentNumber', p_student_number,
    'amount', p_amount,
    'createdAt', v_created_at
  )) || v_donation_history;
  select coalesce(jsonb_agg(entry.value order by entry.ordinality), '[]'::jsonb)
  into v_donation_history
  from jsonb_array_elements(v_donation_history) with ordinality entry(value, ordinality)
  where entry.ordinality <= 500;

  v_donation := jsonb_set(v_donation, '{totalAmount}', to_jsonb(v_total + p_amount), true);
  v_donation := jsonb_set(v_donation, '{history}', v_donation_history, true);
  v_value := jsonb_set(v_value, '{classDonation}', v_donation, true);
  v_value := jsonb_set(v_value, array['currencyBalances', v_student_key], to_jsonb(v_balance - p_amount), true);

  if jsonb_typeof(v_value -> 'currencyHistory') is distinct from 'object' then
    v_value := jsonb_set(v_value, '{currencyHistory}', '{}'::jsonb, true);
  end if;
  v_currency_history := jsonb_build_array(jsonb_build_object(
    'id', concat('class-donation-', p_request_id),
    'studentNumber', p_student_number,
    'delta', -p_amount,
    'before', v_balance,
    'after', v_balance - p_amount,
    'reason', 'class_donation',
    'createdAt', v_created_at
  )) || case
    when jsonb_typeof(v_value -> 'currencyHistory' -> v_student_key) = 'array'
      then v_value -> 'currencyHistory' -> v_student_key
    else '[]'::jsonb
  end;
  v_value := jsonb_set(v_value, array['currencyHistory', v_student_key], v_currency_history, true);

  update app_settings
  set value = v_value, updated_at = v_created_at
  where id = 'school-timer-main';

  v_result := jsonb_build_object(
    'donatedAmount', p_amount,
    'balance', v_balance - p_amount,
    'totalAmount', v_total + p_amount,
    'targetAmount', v_target,
    'completed', v_total + p_amount >= v_target
  );
  insert into class_donation_requests (request_id, result, created_at)
  values (p_request_id, v_result, v_created_at);
  return v_result;
end;
$$;

revoke all on function donate_to_class_goal(integer, integer, text) from public;
grant execute on function donate_to_class_goal(integer, integer, text) to anon;
grant execute on function donate_to_class_goal(integer, integer, text) to authenticated;
