-- Disposable local database only. Entire scenario is rolled back.
begin;
insert into public.wallet_accounts(student_number,balance,opening_balance) values(1,100,100),(2,100,100),(3,100,100),(4,999999,999999);
update public.storage_control set active=true,maintenance=false;
insert into public.storage_resources(resource_key,category,owner_number,value) values
('/classDonation','classDonation',null,'{"kind":"object","parentKey":"","member":"classDonation"}'),
('/classDonation/enabled','classDonation',null,'{"kind":"value","parentKey":"/classDonation","member":"enabled","data":true}'),
('/classDonation/targetAmount','classDonation',null,'{"kind":"value","parentKey":"/classDonation","member":"targetAmount","data":500}'),
('/classDonation/totalAmount','classDonation',null,'{"kind":"value","parentKey":"/classDonation","member":"totalAmount","data":0}'),
('/classDonation/history','classDonation',null,'{"kind":"array","parentKey":"/classDonation","member":"history"}'),
('/studentLife','studentLife',null,'{"kind":"object","parentKey":"","member":"studentLife"}'),
('/studentLife/letters','studentLife',null,'{"kind":"array","parentKey":"/studentLife","member":"letters"}');

do $$
declare v_first jsonb; v_second jsonb; v_balance integer; v_amount integer; v_count integer;
begin
  v_first:=public.claim_weekly_mission_reward_v2(1,'2099-01-01','classword_quiz_correct','fixture-quiz',2);
  v_amount:=(v_first->>'rewardAmount')::integer;
  if v_amount not between 1 and 10 or v_first->>'awarded'<>'true' then raise exception 'QUIZ_NOT_PAID'; end if;
  v_second:=public.claim_weekly_mission_reward_v2(1,'2099-01-01','classword_quiz_correct','fixture-quiz',2);
  if v_second->>'awarded'<>'false' or (v_second->>'balance')::integer<>100+v_amount then raise exception 'QUIZ_DUPLICATE_PAID'; end if;
  select count(*) into v_count from public.wallet_ledger where student_number=1;
  if v_count<>1 then raise exception 'QUIZ_LEDGER_COUNT'; end if;
  v_first:=public.claim_weekly_mission_reward_v2(4,'2099-01-01','classword_quiz_correct','fixture-overflow',2);
  if v_first->>'awarded'<>'false' or exists(select 1 from public.weekly_mission_rewards where student_number=4) then raise exception 'OVERFLOW_CLAIM_CONSUMED'; end if;
  insert into public.weekly_mission_rewards(student_number,week_key,mission_type,reward_amount,source_event_id)
    values(3,'2099-01-01','classword_quiz_correct',6,'recovered-six');
  v_first:=public.claim_weekly_mission_reward_v2(3,'2099-01-01','classword_quiz_correct','recovered-six',2);
  if v_first->>'awarded'<>'false' or v_first->>'rewardAmount'<>'6' or v_first->>'balance'<>'100' then raise exception 'RECOVERED_REWARD_PAID_TWICE'; end if;
  -- New +6 wallet entry remains unchanged by a different reward command.
  perform public.storage_apply_wallet_delta(2,'fixture-six',6,'weekly_mission',now(),'fixture-six');
  v_first:=public.claim_weekly_mission_reward_v2(2,'2099-01-01','classword_word_entry','word-one',2);
  if v_first->>'balance'<>'111' then raise exception 'SIX_REWARD_LOST'; end if;
  begin
    perform public.claim_weekly_mission_reward(1,'2099-01-02','classword_word_entry','old');
    raise exception 'OLD_CLIENT_ACCEPTED';
  exception when others then if sqlerrm<>'LEGACY_CLIENT_UPDATE_REQUIRED' then raise; end if; end;
end;
$$;

select set_config('school_timer.today_friend_v2','2',true);
insert into public.today_friend_submissions(id,submission_date,student_number,partner_number,genre,status)
 values('fixture-today','2099-01-01',2,1,'interview','submitted');
do $$
declare v_first jsonb;v_second jsonb;
begin
  v_first:=public.approve_today_friend_submission_v2('fixture-today',2);
  v_second:=public.approve_today_friend_submission_v2('fixture-today',2);
  if v_first->>'awarded'<>'true' or v_first->>'balance'<>'126' or v_second->>'awarded'<>'false' or v_second->>'balance'<>'126' then raise exception 'TODAY_FRIEND_NOT_EXACTLY_ONCE'; end if;
end;
$$;

do $$
declare v_first jsonb;v_second jsonb;v_letter jsonb;v_balance integer;v_count integer;
begin
  v_letter:=jsonb_build_object('id','donation/fixture','recipient',3,'senderLabel','아기고마','title','고맙고마','content','6고마 고맙고마');
  v_first:=public.donate_to_class_goal_v2(3,6,'donation/fixture',2,v_letter);
  v_second:=public.donate_to_class_goal_v2(3,6,'donation/fixture',2,v_letter);
  if v_first<>v_second or v_first->>'balance'<>'94' then raise exception 'DONATION_NOT_EXACTLY_ONCE'; end if;
  if not exists(select 1 from public.storage_resources where resource_key='/studentLife/letters/@donation~1fixture' and value->'data'->>'content'='6고마 고맙고마') then raise exception 'DONATION_MAIL_NOT_ATOMIC'; end if;
  select count(*) into v_count from public.wallet_ledger where entry_id='class-donation-donation/fixture';
  if v_count<>1 then raise exception 'DONATION_LEDGER_DUPLICATE'; end if;
  begin
    perform public.donate_to_class_goal_v2(3,7,'donation/fixture',2,v_letter);
    raise exception 'DONATION_PAYLOAD_MISMATCH_ACCEPTED';
  exception when others then if sqlerrm<>'STORAGE_REQUEST_PAYLOAD_MISMATCH' then raise; end if; end;
  insert into public.storage_resources(resource_key,category,owner_number,value)
    values('/auctionBids/item','auctionBids',null,'{"kind":"value","parentKey":"/auctionBids","member":"item","data":{"bidder":3,"amount":90}}');
  begin
    perform public.donate_to_class_goal_v2(3,5,'reserved',2,v_letter||'{"id":"reserved"}');
    raise exception 'RESERVED_MONEY_SPENT';
  exception when others then if sqlerrm<>'INSUFFICIENT_AVAILABLE_CURRENCY' then raise; end if; end;
  select balance into v_balance from public.wallet_accounts where student_number=3;
  if v_balance<>94 then raise exception 'REJECTED_DONATION_CHANGED_WALLET'; end if;
  if exists(select 1 from public.class_donation_requests where request_id='reserved') then raise exception 'REJECTED_DONATION_RECEIPT'; end if;
end;
$$;
update public.storage_control set maintenance=true;
do $$ begin
  begin perform public.claim_weekly_mission_reward_v2(1,'2099-01-02','classword_word_entry','blocked',2);
    raise exception 'MAINTENANCE_WRITE_ACCEPTED';
  exception when others then if sqlerrm<>'STORAGE_MAINTENANCE' then raise; end if; end;
end; $$;
rollback;
