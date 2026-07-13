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
  mission_type text not null default 'personal_question' check (mission_type = 'personal_question'),
  reward_amount integer not null default 5 check (reward_amount = 5),
  source_question_id text not null,
  completed_at timestamptz not null default now(),
  primary key (student_number, week_key, mission_type)
);

alter table weekly_mission_rewards enable row level security;

create or replace function claim_personal_question_weekly_reward(
  p_student_number integer,
  p_week_key text,
  p_source_question_id text default null
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

  if p_source_question_id is not null and btrim(p_source_question_id) <> '' then
    insert into weekly_mission_rewards (
      student_number,
      week_key,
      mission_type,
      reward_amount,
      source_question_id
    )
    values (
      p_student_number,
      p_week_key,
      'personal_question',
      5,
      p_source_question_id
    )
    on conflict (student_number, week_key, mission_type) do nothing;
    get diagnostics v_inserted_count = row_count;
    v_awarded := v_inserted_count = 1;
  end if;

  select exists (
    select 1
    from weekly_mission_rewards
    where student_number = p_student_number
      and week_key = p_week_key
      and mission_type = 'personal_question'
  ) into v_completed;

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
  if jsonb_typeof(v_value -> 'currencyBalances') <> 'object' then
    v_value := jsonb_set(v_value, '{currencyBalances}', '{}'::jsonb, true);
  end if;
  if jsonb_typeof(v_value -> 'currencyHistory') <> 'object' then
    v_value := jsonb_set(v_value, '{currencyHistory}', '{}'::jsonb, true);
  end if;

  if (v_value -> 'currencyBalances' ->> v_student_key) ~ '^\d+$' then
    v_before := least(999999, greatest(0, (v_value -> 'currencyBalances' ->> v_student_key)::integer));
  end if;
  v_after := v_before;

  if v_awarded then
    v_after := least(999999, v_before + 5);
    v_value := jsonb_set(
      v_value,
      array['currencyBalances', v_student_key],
      to_jsonb(v_after),
      true
    );

    v_history := jsonb_build_array(jsonb_build_object(
      'id', concat('weekly-mission-', p_student_number, '-', p_week_key),
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

    select coalesce(jsonb_agg(entry order by position), '[]'::jsonb)
    into v_history
    from (
      select entry, position
      from jsonb_array_elements(v_history) with ordinality as items(entry, position)
      order by position
      limit 30
    ) as limited_history;

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
    'missionType', 'personal_question',
    'weekKey', p_week_key,
    'completed', v_completed,
    'awarded', v_awarded,
    'rewardAmount', 5,
    'balance', v_after
  );
end;
$$;

revoke all on function claim_personal_question_weekly_reward(integer, text, text) from public;
revoke all on function claim_personal_question_weekly_reward(integer, text, text) from anon;
revoke all on function claim_personal_question_weekly_reward(integer, text, text) from authenticated;
grant execute on function claim_personal_question_weekly_reward(integer, text, text) to service_role;
