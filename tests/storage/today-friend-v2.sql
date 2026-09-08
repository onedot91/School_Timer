begin;
update public.storage_control set active=true,maintenance=false;
insert into public.wallet_accounts(student_number,balance,opening_balance) values(1,100,100);
do $$
declare v_plan jsonb;v_base jsonb;v_result jsonb;v_saved jsonb;v_submission jsonb;v_count integer;v_plan_revision text;
begin
  v_base:='{"version":1,"weeks":[],"partnerDays":[],"questions":[],"submissions":[],"selectedQuestionIdByDate":{}}';
  perform public.save_today_friend_planning_v2(v_base,v_base||'{"questions":[{"id":"q","text":"hello","active":true,"usedDateKeys":[]}]}',2);
  v_base:=public.load_today_friend_planning_v2();
  perform public.save_today_friend_planning_v2(v_base,v_base||'{"selectedQuestionIdByDate":{"2099-01-01":"q"}}',2);
  perform public.save_today_friend_planning_v2(v_base,v_base||'{"selectedQuestionIdByDate":{"2099-01-02":"q"}}',2);
  v_plan:=public.load_today_friend_planning_v2();
  if v_plan#>>'{selectedQuestionIdByDate,2099-01-01}'<>'q' or v_plan#>>'{selectedQuestionIdByDate,2099-01-02}'<>'q' then raise exception 'INDEPENDENT_PLAN_EDIT_LOST'; end if;
  begin
    perform public.save_today_friend_planning_v2(v_base,v_base||'{"selectedQuestionIdByDate":{"2099-01-01":"other"}}',2);
    raise exception 'STALE_PLAN_ACCEPTED';
  exception when others then if sqlerrm<>'TODAY_FRIEND_PLANNING_CONFLICT' then raise; end if;end;
  v_submission:='{"id":"fixture-cas","submission_date":"2099-01-01","student_number":1,"partner_number":2,"genre":"interview","payload":{"kind":"interview","answer":"one"},"status":"draft","revision":0,"teacher_feedback":null,"submitted_at":null,"reviewed_at":null,"reward_status":"pending"}';
  v_plan_revision:=public.today_friend_planning_version_v2('2099-01-01','2099-01');
  perform public.save_today_friend_planning_v2(v_plan,v_plan||'{"selectedQuestionIdByDate":{"2099-01-01":"new-question","2099-01-02":"q"}}',2);
  begin
    perform public.persist_today_friend_submission_v2(v_submission,0,'old-plan','student:1',repeat('e',64),2,v_plan_revision,'2099-01');
    raise exception 'CHANGED_ASSIGNMENT_ACCEPTED';
  exception when others then if sqlerrm<>'TODAY_FRIEND_SUBMISSION_CONFLICT' then raise;end if;end;
  v_result:=public.persist_today_friend_submission_v2(v_submission,0,'draft1','student:1',repeat('a',64),2);
  if v_result#>>'{0,storage_revision}'<>'1' then raise exception 'SUBMISSION_REVISION_NOT_INCREMENTED';end if;
  v_saved:=public.persist_today_friend_submission_v2(v_submission,0,'draft1','student:1',repeat('a',64),2);
  if v_result<>v_saved then raise exception 'LOST_RESPONSE_NOT_REPLAYED';end if;
  begin
    perform public.persist_today_friend_submission_v2(v_submission||'{"payload":{"kind":"interview","answer":"stale"}}',0,'stale','student:1',repeat('b',64),2);
    raise exception 'STALE_SUBMISSION_ACCEPTED';
  exception when others then if sqlerrm<>'TODAY_FRIEND_SUBMISSION_CONFLICT' then raise;end if;end;
  v_result:=public.persist_today_friend_submission_v2(v_submission||'{"status":"submitted","submitted_at":"2099-01-01T00:00:00Z"}',1,'submit1','student:1',repeat('c',64),2);
  if v_result#>>'{0,status}'<>'submitted' or v_result#>>'{0,storage_revision}'<>'2' then raise exception 'SUBMIT_NOT_ATOMIC';end if;
  perform public.approve_today_friend_submission_v2('fixture-cas',2);
  begin
    perform public.persist_today_friend_submission_v2(v_submission,2,'after-approval','student:1',repeat('d',64),2);
    raise exception 'APPROVED_SUBMISSION_DOWNGRADED';
  exception when others then if sqlerrm<>'TODAY_FRIEND_SUBMISSION_CONFLICT' then raise;end if;end;
  select storage_revision into v_count from public.today_friend_submissions where id='fixture-cas';
  perform public.approve_today_friend_submission_v2('fixture-cas',2);
  if (select storage_revision from public.today_friend_submissions where id='fixture-cas')<>v_count then raise exception 'APPROVAL_REPLAY_CHANGED_REVISION';end if;
  perform set_config('school_timer.today_friend_v2','',true);
  begin
    update public.today_friend_submissions set payload='{}' where id='fixture-cas';
    raise exception 'LEGACY_SUBMISSION_WRITE_ACCEPTED';
  exception when others then if sqlerrm<>'LEGACY_CLIENT_UPDATE_REQUIRED' then raise;end if;end;
end;
$$;
rollback;
