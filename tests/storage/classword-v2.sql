begin;
update public.storage_control set active=true,maintenance=false where singleton;
insert into public.wallet_accounts(student_number,balance,opening_balance) select n,100,100 from generate_series(1,23) n;
do $$
declare first_result jsonb; repeated jsonb; current_revision text; bad boolean;
begin
 first_result:=public.classword_command_v2(2,'entry-request-001','save_entry','{"dateKey":"2099-09-08","initial":"ㄱ","word":"강아지"}',2);
 repeated:=public.classword_command_v2(2,'entry-request-001','save_entry','{"dateKey":"2099-09-08","initial":"ㄱ","word":"강아지"}',2);
 if first_result<>repeated then raise exception 'receipt replay changed'; end if;
 if (select balance from public.wallet_accounts where student_number=2)<>105 then raise exception 'duplicate payment'; end if;
 if (select count(*) from public.wallet_ledger where student_number=2)<>1 then raise exception 'duplicate ledger'; end if;
 bad:=false;
 begin perform public.classword_command_v2(2,'entry-request-001','save_entry','{"dateKey":"2099-09-08","initial":"ㄱ","word":"기린"}',2);
 exception when others then if sqlerrm<>'STORAGE_REQUEST_REUSED' then raise; end if; bad:=true; end;
 if not bad then raise exception 'request reused'; end if;
 bad:=false;
 begin perform public.classword_command_v2(4,'entry-request-002','save_entry','{"dateKey":"2099-09-08","initial":"ㄱ","word":"기린"}',2);
 exception when others then if sqlerrm<>'CLASSWORD_INITIAL_OCCUPIED' then raise; end if; bad:=true; end;
 if not bad then raise exception 'occupied slot accepted'; end if;
 bad:=false;
 begin perform public.classword_command_v2(2,'entry-request-003','save_entry',jsonb_build_object('dateKey','2099-09-08','entryId',first_result#>>'{entry,id}','initial','ㄱ','word','기린','expectedRevision','2000-01-01T00:00:00Z'),2);
 exception when others then if sqlerrm<>'CLASSWORD_ENTRY_CHANGED' then raise; end if; bad:=true; end;
 if not bad then raise exception 'stale edit accepted'; end if;
 repeated:=public.classword_command_v2(2,'entry-request-004','save_entry',jsonb_build_object('dateKey','2099-09-08','entryId',first_result#>>'{entry,id}','initial','ㄱ','word','기린','expectedRevision',first_result#>>'{entry,updated_at}'),2);
 if repeated#>>'{entry,word}'<>'기린' then raise exception 'edit failed'; end if;
 first_result:=public.classword_command_v2(2,'quiz-request-001','complete_quiz','{"dateKey":"2099-09-08","questionId":"fixture-question"}',2);
 repeated:=public.classword_command_v2(2,'quiz-request-001','complete_quiz','{"dateKey":"2099-09-08","questionId":"fixture-question"}',2);
 if first_result<>repeated then raise exception 'quiz replay changed'; end if;
 if (select count(*) from public.classword_quiz_completions where student_number=2)<>1 then raise exception 'duplicate completion'; end if;
 perform set_config('school_timer.storage_protocol','',true);
 bad:=false;
 begin insert into public.classword_entries(round_date,student_number,initial,word) values('2099-09-08',4,'ㄴ','나비');
 exception when others then if sqlerrm<>'STORAGE_LEGACY_WRITE_DISABLED' then raise; end if; bad:=true; end;
 if not bad then raise exception 'legacy write accepted'; end if;
 bad:=false;
 begin perform public.classword_command_v2(23,'entry-request-rollback','save_entry','{"dateKey":"2099-09-08","initial":"ㄴ","word":"나비"}',1);
 exception when others then if sqlerrm<>'STORAGE_PROTOCOL_REQUIRED' then raise; end if; bad:=true; end;
 if not bad then raise exception 'old protocol accepted'; end if;
 delete from public.wallet_accounts where student_number=23;
 bad:=false;
 begin perform public.classword_command_v2(23,'entry-missing-wallet','save_entry','{"dateKey":"2099-09-08","initial":"ㄴ","word":"나비"}',2);
 exception when others then if sqlerrm<>'STORAGE_WALLET_NOT_FOUND' then raise; end if; bad:=true; end;
 if not bad or exists(select 1 from public.classword_entries where student_number=23) then raise exception 'entry survived failed reward'; end if;
 if exists(select 1 from public.storage_receipts where request_id='entry-missing-wallet') then raise exception 'failed command receipt committed'; end if;
end;
$$;
-- A rejected payment must not consume the completion or request identity.
do $$
declare result jsonb;
begin
 update public.wallet_accounts set balance=999999 where student_number=22;
 begin
  perform public.classword_command_v2(22,'quiz-cap-retry','complete_quiz','{"dateKey":"2099-09-09","questionId":"cap-quiz"}',2);
  raise exception 'unpaid completion accepted';
 exception when others then if sqlerrm<>'CLASSWORD_REWARD_LIMIT_EXCEEDED' then raise; end if; end;
 if exists(select 1 from public.classword_quiz_completions where student_number=22)
  or exists(select 1 from public.weekly_mission_rewards where student_number=22)
  or exists(select 1 from public.wallet_ledger where student_number=22)
  or exists(select 1 from public.storage_receipts where request_id='quiz-cap-retry')
 then raise exception 'rejected reward left partial data'; end if;
 update public.wallet_accounts set balance=100 where student_number=22;
 result:=public.classword_command_v2(22,'quiz-cap-retry','complete_quiz','{"dateKey":"2099-09-09","questionId":"cap-quiz"}',2);
 if result#>>'{reward,awarded}'<>'true' then raise exception 'retry did not pay'; end if;
 if (select balance from public.wallet_accounts where student_number=22)<>100+(result#>>'{reward,rewardAmount}')::integer then raise exception 'wallet mismatch'; end if;
 -- A legacy claim marker alone cannot prove payment.
 insert into public.weekly_mission_rewards(student_number,week_key,mission_type,reward_amount,source_event_id)
 values(21,'2099-09-09','classword_quiz_correct',6,'missing-ledger');
 begin
  perform public.classword_command_v2(21,'quiz-missing-proof','complete_quiz','{"dateKey":"2099-09-09","questionId":"missing-ledger"}',2);
  raise exception 'claim without ledger accepted';
 exception when others then if sqlerrm<>'CLASSWORD_REWARD_EVIDENCE_MISMATCH' then raise; end if; end;
 if exists(select 1 from public.classword_quiz_completions where student_number=21)
  or exists(select 1 from public.storage_receipts where request_id='quiz-missing-proof')
 then raise exception 'unverified payment completed'; end if;
end;
$$;
do $$
declare first_result jsonb; replay jsonb; payload jsonb; before_balance integer;
begin
 perform public.classword_command_v2(0,'topic-context-start','save_topic','{"dateKey":"2099-11-01","topic":"동물"}',2);
 payload:=jsonb_build_object('dateKey','2099-11-01','initial','ㄱ','word','강아지','expectedStoredTopic','동물','transportHash',repeat('a',64));
 first_result:=public.classword_command_v2(7,'transport-word-001','save_entry',payload,2);
 if first_result->>'transportHash'<>repeat('a',64) or
   (select result->>'transportHash' from public.storage_receipts where actor_key='classword:7' and request_id='transport-word-001')<>repeat('a',64)
 then raise exception 'transport identity not committed atomically'; end if;
 perform public.classword_command_v2(0,'topic-context-change','save_topic','{"dateKey":"2099-11-01","topic":"음식"}',2);
 replay:=public.classword_command_v2(7,'transport-word-001','save_entry',payload,2);
 if replay<>first_result then raise exception 'context change blocked committed replay'; end if;
 select balance into before_balance from public.wallet_accounts where student_number=8;
 begin
   perform public.classword_command_v2(8,'stale-topic-0001','save_entry',payload || '{"initial":"ㄴ","word":"나비"}',2);
   raise exception 'stale topic accepted';
 exception when others then if sqlerrm<>'CLASSWORD_TOPIC_CHANGED' then raise; end if; end;
 if exists(select 1 from public.classword_entries where round_date='2099-11-01' and student_number=8)
   or exists(select 1 from public.storage_receipts where request_id='stale-topic-0001')
   or (select balance from public.wallet_accounts where student_number=8)<>before_balance then raise exception 'stale topic left partial records'; end if;
 perform public.classword_command_v2(0,'quiz-context-change','save_quiz','{"quiz_date":"2099-11-01","question_id":"new-question","initial_hint":"ㄷㅇ","meaning":"도움을 주는 일","answer":"도움","written_prefix":"","written_suffix":"","spoken_prefix":"","spoken_suffix":""}',2);
 begin
   perform public.classword_command_v2(8,'stale-question-001','complete_quiz',jsonb_build_object('dateKey','2099-11-01','questionId','old-question','expectedStoredQuestionId',null,'transportHash',repeat('b',64)),2);
   raise exception 'stale question accepted';
 exception when others then if sqlerrm<>'CLASSWORD_QUIZ_CHANGED' then raise; end if; end;
 if exists(select 1 from public.classword_quiz_completions where quiz_date='2099-11-01' and student_number=8)
   or exists(select 1 from public.storage_receipts where request_id='stale-question-001') then raise exception 'changed quiz consumed the answer'; end if;
 payload:=jsonb_build_object('dateKey','2099-11-01','questionId','new-question','expectedStoredQuestionId','new-question','transportHash',repeat('c',64));
 first_result:=public.classword_command_v2(8,'transport-quiz-001','complete_quiz',payload,2);
 replay:=public.classword_command_v2(8,'transport-quiz-001','complete_quiz',payload,2);
 if first_result<>replay or first_result->>'transportHash'<>repeat('c',64) then raise exception 'quiz receipt metadata lost'; end if;
 if (select count(*) from public.wallet_ledger where student_number=8 and entry_id like '%2099-11-01')<>1 then raise exception 'transport quiz paid twice'; end if;
 begin
   perform public.classword_command_v2(8,'invalid-transport-001','complete_quiz',payload || '{"transportHash":"invalid"}',2);
   raise exception 'invalid transport hash accepted';
 exception when others then if sqlerrm<>'CLASSWORD_INVALID_COMMAND' then raise; end if; end;
end; $$;
set constraints classword_quiz_reward_guard immediate;
do $$ begin
 begin
  insert into public.classword_quiz_completions(quiz_date,question_id,student_number)
   values('2099-09-09','bypass-attempt',20);
  raise exception 'direct unpaid completion accepted';
 exception when others then if sqlerrm<>'CLASSWORD_REWARD_EVIDENCE_MISMATCH' then raise; end if; end;
end; $$;
rollback;
