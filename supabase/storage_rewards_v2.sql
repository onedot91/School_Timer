-- Apply after storage_v2.sql. Legacy entry points reject old deployed callers.
create or replace function public.claim_weekly_mission_reward(p_student_number integer, p_week_key text, p_mission_type text, p_source_event_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end;
$$;
create or replace function public.claim_personal_question_weekly_reward(p_student_number integer, p_week_key text, p_source_question_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end;
$$;
create or replace function public.approve_today_friend_submission(p_submission_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end;
$$;
create or replace function public.donate_to_class_goal(p_student_number integer, p_amount integer, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end;
$$;

create or replace function public.claim_weekly_mission_reward_v2(
  p_student_number integer, p_week_key text, p_mission_type text,
  p_source_event_id text, p_protocol_version integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reward integer;
  v_balance integer;
  v_completed boolean;
  v_awarded boolean := false;
  v_entry_id text;
  v_now timestamptz := now();
  v_wallet jsonb;
begin
  if p_protocol_version is distinct from 2 then raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end if;
  perform public.storage_require_writable();
  if p_student_number is null or p_student_number not between 1 and 23 then raise exception 'INVALID_STUDENT_NUMBER'; end if;
  if p_mission_type is null or p_mission_type not in ('personal_question','classword_word_entry','classword_quiz_correct') then raise exception 'INVALID_MISSION_TYPE'; end if;
  if p_week_key is null or (p_mission_type = 'personal_question' and p_week_key !~ '^\d{4}-\d{2}$')
    or (p_mission_type <> 'personal_question' and p_week_key !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'INVALID_WEEK_KEY'; end if;
  if length(p_source_event_id) > 200 then raise exception 'INVALID_SOURCE_EVENT_ID'; end if;
  select balance into v_balance from public.wallet_accounts where student_number = p_student_number for update;
  if not found then raise exception 'STORAGE_WALLET_NOT_FOUND'; end if;
  select reward_amount into v_reward from public.weekly_mission_rewards
    where student_number = p_student_number and week_key = p_week_key and mission_type = p_mission_type;
  v_completed := found;
  if not v_completed then
    v_reward := case when p_mission_type = 'personal_question' then 15
      when p_mission_type = 'classword_quiz_correct' then floor(random() * 10)::integer + 1 else 5 end;
    if nullif(btrim(p_source_event_id), '') is not null and v_balance <= 999999 - v_reward then
      v_entry_id := case when p_mission_type = 'personal_question'
        then concat('weekly-mission-',p_student_number,'-',p_week_key)
        else concat('weekly-mission-',p_mission_type,'-',p_student_number,'-',p_week_key) end;
      -- Existing claim evidence survives migration, including recovered historical payments.
      if exists (select 1 from public.wallet_ledger where entry_id = v_entry_id and student_number = p_student_number) then
        raise exception 'STORAGE_REWARD_EVIDENCE_MISMATCH';
      end if;
      insert into public.weekly_mission_rewards(student_number,week_key,mission_type,reward_amount,source_event_id,completed_at)
        values(p_student_number,p_week_key,p_mission_type,v_reward,p_source_event_id,v_now);
      v_wallet := public.storage_apply_wallet_delta(p_student_number,v_entry_id,v_reward,'weekly_mission',v_now,v_entry_id);
      v_balance := (v_wallet->>'balance')::integer;
      v_awarded := (v_wallet->>'awarded')::boolean;
      v_completed := true;
      insert into public.storage_reward_claims(claim_id,student_number,value)
        values(v_entry_id,p_student_number,jsonb_build_object('missionType',p_mission_type,'weekKey',p_week_key,'rewardAmount',v_reward,'sourceEventId',p_source_event_id,'completedAt',v_now))
        on conflict (claim_id) do nothing;
    end if;
  end if;
  return jsonb_build_object('missionType',p_mission_type,'weekKey',p_week_key,'completed',v_completed,
    'awarded',v_awarded,'rewardAmount',v_reward,'balance',v_balance);
end;
$$;

create or replace function public.claim_personal_question_weekly_reward_v2(
  p_student_number integer,p_week_key text,p_source_question_id text,p_protocol_version integer
) returns jsonb language sql security definer set search_path = '' as $$
  select public.claim_weekly_mission_reward_v2(p_student_number,p_week_key,'personal_question',p_source_question_id,p_protocol_version);
$$;

drop function if exists public.approve_today_friend_submission_v2(text,integer);
create or replace function public.approve_today_friend_submission_v2(p_submission_id text,p_protocol_version integer,p_expected_revision bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_student integer;
  v_status text;
  v_balance integer;
  v_awarded boolean := false;
  v_wallet jsonb;
  v_now timestamptz := now();
  v_entry_id text := concat('today-friend-reward-',p_submission_id);
begin
  if p_protocol_version is distinct from 2 then raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end if;
  perform public.storage_require_writable();
  if nullif(btrim(p_submission_id),'') is null or length(p_submission_id)>200 then raise exception 'INVALID_SUBMISSION_ID'; end if;
  select student_number into v_student from public.today_friend_submissions where id=p_submission_id;
  if not found then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  -- Wallet precedes other row locks in all financial commands.
  select balance into v_balance from public.wallet_accounts where student_number=v_student for update;
  if not found then raise exception 'STORAGE_WALLET_NOT_FOUND'; end if;
  select status into v_status from public.today_friend_submissions where id=p_submission_id and student_number=v_student for update;
  if not found then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if v_status not in ('submitted','approved') then raise exception 'SUBMISSION_NOT_REVIEWABLE'; end if;
  if p_expected_revision is not null and v_status<>'approved' and (select storage_revision from public.today_friend_submissions where id=p_submission_id)<>p_expected_revision then raise exception 'TODAY_FRIEND_SUBMISSION_CONFLICT'; end if;
  if not exists(select 1 from public.today_friend_rewards where submission_id=p_submission_id) then
    if v_status = 'approved' then raise exception 'STORAGE_REWARD_EVIDENCE_MISMATCH'; end if;
    if v_balance > 999999-15 then raise exception 'CURRENCY_BALANCE_LIMIT_EXCEEDED'; end if;
    insert into public.today_friend_rewards(submission_id,student_number,reward_amount,awarded_at) values(p_submission_id,v_student,15,v_now);
    v_wallet := public.storage_apply_wallet_delta(v_student,v_entry_id,15,'weekly_mission',v_now,v_entry_id);
    v_balance := (v_wallet->>'balance')::integer;
    v_awarded := (v_wallet->>'awarded')::boolean;
    insert into public.storage_reward_claims(claim_id,student_number,value)
      values(v_entry_id,v_student,jsonb_build_object('submissionId',p_submission_id,'rewardAmount',15,'completedAt',v_now)) on conflict (claim_id) do nothing;
  end if;
  perform set_config('school_timer.today_friend_v2','2',true);
  update public.today_friend_submissions set storage_revision=storage_revision+1,status='approved',reviewed_at=coalesce(reviewed_at,v_now),reward_status='paid',updated_at=v_now where id=p_submission_id and (status<>'approved' or reward_status<>'paid');
  return jsonb_build_object('submissionId',p_submission_id,'awarded',v_awarded,'rewardAmount',15,'balance',v_balance);
end;
$$;

create or replace function public.donate_to_class_goal_v2(
  p_student_number integer,p_amount integer,p_request_id text,p_protocol_version integer,p_thank_you_letter jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_balance integer;
  v_reserved bigint;
  v_target integer;
  v_total integer;
  v_enabled boolean;
  v_now timestamptz := now();
  v_result jsonb;
  v_wallet jsonb;
  v_actor text := concat('student:',p_student_number);
  v_hash text := md5(jsonb_build_object('action','class_donation','studentNumber',p_student_number,'amount',p_amount)::text);
  v_previous_hash text;
  v_id text := replace(replace(p_request_id,'~','~0'),'/','~1');
  v_letter jsonb;
  v_lock text;
  v_scopes text[];
begin
  if p_protocol_version is distinct from 2 then raise exception 'LEGACY_CLIENT_UPDATE_REQUIRED'; end if;
  perform public.storage_require_writable();
  if p_student_number is null or p_student_number not between 1 and 23 then raise exception 'INVALID_STUDENT_NUMBER'; end if;
  if p_amount is null or p_amount not between 1 and 999999 then raise exception 'INVALID_DONATION_AMOUNT'; end if;
  if nullif(btrim(p_request_id),'') is null or length(p_request_id)>100 then raise exception 'INVALID_DONATION_REQUEST_ID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('receipt:'||v_actor||':'||p_request_id,0));
  select balance into v_balance from public.wallet_accounts where student_number=p_student_number for update;
  if not found then raise exception 'STORAGE_WALLET_NOT_FOUND'; end if;
  select result,payload_hash into v_result,v_previous_hash from public.storage_receipts where actor_key=v_actor and request_id=p_request_id;
  if found then
    if v_previous_hash<>v_hash then raise exception 'STORAGE_REQUEST_PAYLOAD_MISMATCH'; end if;
    return v_result;
  end if;
  -- Global legacy request ids cannot be replayed under a different student or payload.
  if exists(select 1 from public.class_donation_requests where request_id=p_request_id) then
    raise exception 'STORAGE_LEGACY_REQUEST_ALREADY_COMMITTED';
  end if;
  v_scopes:=array['scope:classDonation:all','scope:classDonation:shared','scope:classDonation:'||p_student_number,
    'scope:studentLife:all','scope:studentLife:'||p_student_number,'collection:/classDonation',
    'collection:/classDonation/history','collection:/studentLife/letters'];
  for v_lock in select k from unnest(v_scopes) k order by k loop
    perform pg_advisory_xact_lock(hashtextextended('scope:'||v_lock,0));
  end loop;
  for v_lock in select k from unnest(array['/classDonation/enabled','/classDonation/targetAmount','/classDonation/totalAmount',
    '/classDonation/history/@'||v_id,'/studentLife/letters/@'||v_id]||v_scopes) k order by k loop
    perform pg_advisory_xact_lock(hashtextextended('resource:'||v_lock,0));
  end loop;
  if exists(select 1 from public.storage_resources where resource_key='/classDonation/history/@'||v_id or resource_key='/studentLife/letters/@'||v_id) then
    raise exception 'STORAGE_REQUEST_PAYLOAD_MISMATCH';
  end if;
  select coalesce((value->>'data')::boolean,false) into v_enabled from public.storage_resources where resource_key='/classDonation/enabled' for share;
  if v_enabled is distinct from true then raise exception 'CLASS_DONATION_DISABLED'; end if;
  select (value->>'data')::integer into v_target from public.storage_resources where resource_key='/classDonation/targetAmount' for share;
  select (value->>'data')::integer into v_total from public.storage_resources where resource_key='/classDonation/totalAmount' for update;
  if v_target is null or v_total is null then raise exception 'CLASS_DONATION_NOT_CONFIGURED'; end if;
  if v_total>=v_target then raise exception 'CLASS_DONATION_COMPLETED'; end if;
  if p_amount>v_target-v_total then raise exception 'CLASS_DONATION_EXCEEDS_REMAINING'; end if;
  -- Bids and settlement commands hold the same student's wallet lock.
  select coalesce(sum((bid.value->'data'->>'amount')::integer),0) into v_reserved
    from public.storage_resources bid
    where bid.value->>'parentKey'='/auctionBids' and (bid.value->'data'->>'bidder')::integer=p_student_number
      and not exists(select 1 from public.storage_resources award where award.value->>'parentKey'='/auctionAwards'
        and award.value->>'member'=bid.value->>'member' and award.value->'data' is distinct from 'null'::jsonb);
  if p_amount>greatest(0,v_balance-v_reserved) then raise exception 'INSUFFICIENT_AVAILABLE_CURRENCY'; end if;
  if jsonb_typeof(p_thank_you_letter) is distinct from 'object'
    or p_thank_you_letter->>'id' is distinct from p_request_id
    or (p_thank_you_letter->>'recipient')::integer is distinct from p_student_number
    or nullif(p_thank_you_letter->>'title','') is null or nullif(p_thank_you_letter->>'content','') is null then
    raise exception 'INVALID_DONATION_LETTER';
  end if;
  v_wallet := public.storage_apply_wallet_delta(p_student_number,concat('class-donation-',p_request_id),-p_amount,'class_donation',v_now,p_request_id);
  v_balance := (v_wallet->>'balance')::integer;
  perform public.storage_write_resource('/classDonation/totalAmount','classDonation',null,
    jsonb_build_object('kind','value','parentKey','/classDonation','member','totalAmount','data',v_total+p_amount));
  perform public.storage_write_resource(concat('/classDonation/history/@',v_id),'classDonation',p_student_number,
    jsonb_build_object('kind','value','parentKey','/classDonation/history','member',concat('@',p_request_id),'order',-extract(epoch from v_now)*1000,
      'data',jsonb_build_object('id',p_request_id,'studentNumber',p_student_number,'amount',p_amount,'createdAt',v_now)));
  v_letter := p_thank_you_letter || jsonb_build_object('createdAt',v_now,'readAt',null);
  perform public.storage_write_resource(concat('/studentLife/letters/@',v_id),'studentLife',p_student_number,
    jsonb_build_object('kind','value','parentKey','/studentLife/letters','member',concat('@',p_request_id),'order',extract(epoch from v_now)*1000,'data',v_letter));
  v_result := jsonb_build_object('donatedAmount',p_amount,'balance',v_balance,'totalAmount',v_total+p_amount,'targetAmount',v_target,'completed',v_total+p_amount>=v_target);
  insert into public.class_donation_requests(request_id,result,created_at) values(p_request_id,v_result,v_now);
  insert into public.storage_receipts(actor_key,request_id,action,payload_hash,result) values(v_actor,p_request_id,'class_donation',v_hash,v_result);
  return v_result;
end;
$$;

revoke all on function public.claim_weekly_mission_reward_v2(integer,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.claim_personal_question_weekly_reward_v2(integer,text,text,integer) from public,anon,authenticated;
revoke all on function public.approve_today_friend_submission_v2(text,integer,bigint) from public,anon,authenticated;
revoke all on function public.donate_to_class_goal_v2(integer,integer,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.claim_weekly_mission_reward_v2(integer,text,text,text,integer) to service_role;
grant execute on function public.claim_personal_question_weekly_reward_v2(integer,text,text,integer) to service_role;
grant execute on function public.approve_today_friend_submission_v2(text,integer,bigint) to service_role;
grant execute on function public.donate_to_class_goal_v2(integer,integer,text,integer,jsonb) to service_role;
