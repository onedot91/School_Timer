begin;

create or replace function public.classword_guard_storage_v2() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform pg_advisory_xact_lock_shared(726314925132::bigint);
  if exists(select 1 from public.storage_control where singleton and maintenance) then raise exception 'STORAGE_MAINTENANCE'; end if;
  if exists(select 1 from public.storage_control where singleton and active)
    and current_setting('school_timer.storage_protocol',true) is distinct from '2' then
    raise exception 'STORAGE_LEGACY_WRITE_DISABLED';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists classword_storage_v2_guard on public.classword_entries;
create trigger classword_storage_v2_guard before insert or update or delete on public.classword_entries for each row execute function public.classword_guard_storage_v2();
drop trigger if exists classword_storage_v2_guard on public.classword_quiz_completions;
create trigger classword_storage_v2_guard before insert or update or delete on public.classword_quiz_completions for each row execute function public.classword_guard_storage_v2();
drop trigger if exists classword_storage_v2_guard on public.classword_rounds;
create trigger classword_storage_v2_guard before insert or update or delete on public.classword_rounds for each row execute function public.classword_guard_storage_v2();
drop trigger if exists classword_storage_v2_guard on public.classword_quizzes;
create trigger classword_storage_v2_guard before insert or update or delete on public.classword_quizzes for each row execute function public.classword_guard_storage_v2();

-- Completion is valid only with a matching, fully recorded daily payment.
create or replace function public.classword_require_quiz_reward(p_student integer,p_date text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not exists (
    select 1 from public.weekly_mission_rewards r
    join public.wallet_ledger l on l.student_number=r.student_number
      and l.entry_id=concat('weekly-mission-classword_quiz_correct-',r.student_number,'-',r.week_key)
      and l.delta=r.reward_amount and l.reason='weekly_mission'
      and l.balance_after-l.balance_before=l.delta
    where r.student_number=p_student and r.week_key=p_date
      and r.mission_type='classword_quiz_correct' and r.reward_amount between 1 and 10
  ) then raise exception 'CLASSWORD_REWARD_EVIDENCE_MISMATCH'; end if;
end;
$$;

create or replace function public.classword_quiz_reward_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.classword_require_quiz_reward(new.student_number,new.quiz_date::text);
  return new;
end;
$$;
drop trigger if exists classword_quiz_reward_guard on public.classword_quiz_completions;
create constraint trigger classword_quiz_reward_guard
  after insert or update on public.classword_quiz_completions
  deferrable initially deferred for each row execute function public.classword_quiz_reward_guard();
revoke all on function public.classword_require_quiz_reward(integer,text) from public,anon,authenticated;
revoke all on function public.classword_quiz_reward_guard() from public,anon,authenticated;

create or replace function public.classword_command_v2(p_actor integer,p_request_id text,p_action text,p_payload jsonb,p_protocol_version integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor_key text := 'classword:'||p_actor;
  v_payload_hash text := md5(jsonb_build_object('action',p_action,'payload',p_payload)::text);
  receipt public.storage_receipts%rowtype;
  entry public.classword_entries%rowtype;
  completion public.classword_quiz_completions%rowtype;
  reward jsonb;
  result jsonb;
  constraint_name text;
  affected integer;
  stored_context text;
begin
  if p_protocol_version is distinct from 2 then raise exception 'STORAGE_PROTOCOL_REQUIRED'; end if;
  perform public.storage_require_writable();
  if p_actor is null or p_actor not between 0 and 23 or p_request_id is null or length(p_request_id) not between 8 and 160 or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'CLASSWORD_INVALID_COMMAND'; end if;
  if p_payload ? 'transportHash' and (jsonb_typeof(p_payload->'transportHash') is distinct from 'string' or (p_payload->>'transportHash') !~ '^[a-f0-9]{64}$') then raise exception 'CLASSWORD_INVALID_COMMAND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_actor_key||':'||p_request_id,0));
  select * into receipt from public.storage_receipts r where r.actor_key=v_actor_key and r.request_id=p_request_id;
  if found then
    if receipt.payload_hash<>v_payload_hash then raise exception 'STORAGE_REQUEST_REUSED'; end if;
    if p_action='complete_quiz' then
      perform public.classword_require_quiz_reward(p_actor,p_payload->>'dateKey');
    end if;
    return receipt.result;
  end if;
  perform set_config('school_timer.storage_protocol','2',true);
  if p_action in ('save_entry','complete_quiz','save_topic','save_quiz','delete_quiz') then
    perform pg_advisory_xact_lock(hashtextextended('classword-context:'||coalesce(p_payload->>'dateKey',p_payload->>'quiz_date'),0));
  end if;
  if p_action='save_entry' and p_payload ? 'expectedStoredTopic' then
    select topic into stored_context from public.classword_rounds where round_date=(p_payload->>'dateKey')::date;
    if stored_context is distinct from p_payload->>'expectedStoredTopic' then raise exception 'CLASSWORD_TOPIC_CHANGED'; end if;
  end if;
  if p_action='complete_quiz' and p_payload ? 'expectedStoredQuestionId' then
    select question_id into stored_context from public.classword_quizzes where quiz_date=(p_payload->>'dateKey')::date;
    if stored_context is distinct from p_payload->>'expectedStoredQuestionId' then raise exception 'CLASSWORD_QUIZ_CHANGED'; end if;
  end if;
  if p_action in ('save_entry','complete_quiz') then
    perform 1 from public.wallet_accounts where student_number=p_actor for update;
  end if;
  if p_action='save_entry' then
    if p_actor=0 then raise exception 'STUDENT_REQUIRED'; end if;
    perform pg_advisory_xact_lock(hashtextextended('classword-entry:'||p_actor||':'||(p_payload->>'dateKey'),0));
    select * into entry from public.classword_entries where student_number=p_actor and round_date=(p_payload->>'dateKey')::date for update;
    if p_payload->>'entryId' is not null then
      if entry.id is null or entry.id::text<>p_payload->>'entryId' then raise exception 'CLASSWORD_ENTRY_FORBIDDEN'; end if;
      if p_payload->>'expectedRevision' is null or entry.updated_at is distinct from (p_payload->>'expectedRevision')::timestamptz then raise exception 'CLASSWORD_ENTRY_CHANGED'; end if;
      begin
        update public.classword_entries set initial=p_payload->>'initial',word=p_payload->>'word'
          where id=entry.id returning * into entry;
      exception when unique_violation then
        get stacked diagnostics constraint_name=constraint_name;
        if constraint_name='classword_entries_initial_day_unique' then raise exception 'CLASSWORD_INITIAL_OCCUPIED'; end if;
        raise;
      end;
    elsif entry.id is not null then
      if entry.initial<>p_payload->>'initial' or entry.word<>p_payload->>'word' then raise exception 'CLASSWORD_STUDENT_ALREADY_ENTERED'; end if;
    else
      begin
        insert into public.classword_entries(round_date,initial,word,student_number)
          values((p_payload->>'dateKey')::date,p_payload->>'initial',p_payload->>'word',p_actor) returning * into entry;
      exception when unique_violation then
        get stacked diagnostics constraint_name=constraint_name;
        if constraint_name='classword_entries_initial_day_unique' then raise exception 'CLASSWORD_INITIAL_OCCUPIED'; end if;
        raise;
      end;
    end if;
    reward := public.claim_weekly_mission_reward_v2(p_actor,p_payload->>'dateKey','classword_word_entry',entry.id::text,2);
    result := jsonb_build_object('entry',to_jsonb(entry),'reward',reward);
  elsif p_action='complete_quiz' then
    if p_actor=0 then raise exception 'STUDENT_REQUIRED'; end if;
    insert into public.classword_quiz_completions(quiz_date,question_id,student_number)
      values((p_payload->>'dateKey')::date,p_payload->>'questionId',p_actor)
      on conflict(quiz_date,question_id,student_number) do nothing;
    select * into completion from public.classword_quiz_completions where quiz_date=(p_payload->>'dateKey')::date and question_id=p_payload->>'questionId' and student_number=p_actor;
    reward := public.claim_weekly_mission_reward_v2(p_actor,p_payload->>'dateKey','classword_quiz_correct',p_payload->>'questionId',2);
    if reward->>'completed' is distinct from 'true' then raise exception 'CLASSWORD_REWARD_LIMIT_EXCEEDED'; end if;
    perform public.classword_require_quiz_reward(p_actor,p_payload->>'dateKey');
    result := jsonb_build_object('completion',to_jsonb(completion),'reward',reward,'question',p_payload->'question');
  elsif p_action='delete_entry' then
    delete from public.classword_entries where id=(p_payload->>'entryId')::uuid
      and (p_actor=0 or (student_number=p_actor and round_date=(p_payload->>'dateKey')::date));
    get diagnostics affected=row_count;
    if affected=0 then raise exception 'CLASSWORD_ENTRY_FORBIDDEN'; end if;
    result := jsonb_build_object('deleted',true);
  elsif p_actor<>0 then raise exception 'TEACHER_REQUIRED';
  elsif p_action='prune' then
    delete from public.classword_entries where round_date<(p_payload->>'dateKey')::date;
    result := jsonb_build_object('deleted',true);
  elsif p_action='delete_date_entries' then
    delete from public.classword_entries where round_date=(p_payload->>'dateKey')::date;
    result := jsonb_build_object('deleted',true);
  elsif p_action='save_topic' then
    insert into public.classword_rounds(round_date,topic) values((p_payload->>'dateKey')::date,p_payload->>'topic')
      on conflict(round_date) do update set topic=excluded.topic;
    result := jsonb_build_object('saved',true);
  elsif p_action='delete_quiz' then
    delete from public.classword_quizzes where quiz_date=(p_payload->>'dateKey')::date;
    result := jsonb_build_object('deleted',true);
  elsif p_action='save_quiz' then
    insert into public.classword_quizzes(quiz_date,question_id,initial_hint,meaning,answer,written_prefix,written_suffix,spoken_prefix,spoken_suffix)
      values((p_payload->>'quiz_date')::date,p_payload->>'question_id',p_payload->>'initial_hint',p_payload->>'meaning',p_payload->>'answer',p_payload->>'written_prefix',p_payload->>'written_suffix',p_payload->>'spoken_prefix',p_payload->>'spoken_suffix')
      on conflict(quiz_date) do update set question_id=excluded.question_id,initial_hint=excluded.initial_hint,meaning=excluded.meaning,answer=excluded.answer,written_prefix=excluded.written_prefix,written_suffix=excluded.written_suffix,spoken_prefix=excluded.spoken_prefix,spoken_suffix=excluded.spoken_suffix;
    result := jsonb_build_object('saved',true);
  else raise exception 'CLASSWORD_INVALID_COMMAND';
  end if;
  if p_payload ? 'transportHash' then result := result || jsonb_build_object('transportHash',p_payload->>'transportHash'); end if;
  insert into public.storage_receipts(actor_key,request_id,action,payload_hash,result)
    values(v_actor_key,p_request_id,'classword:'||p_action,v_payload_hash,result);
  return result;
end;
$$;
revoke all on function public.classword_guard_storage_v2() from public,anon,authenticated;
revoke all on function public.classword_command_v2(integer,text,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.classword_command_v2(integer,text,text,jsonb,integer) to service_role;
commit;
