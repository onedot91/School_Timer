import { CalendarCheck2, ClipboardList, RefreshCw, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { getTodayFriendDateKey } from '../../lib/todayFriend';
import {
  loadTeacherTodayFriendState,
  reviewStudentTodayFriendSubmission,
  updateTeacherTodayFriendPlan,
  updateTeacherTodayFriendQuestions,
  type TeacherTodayFriendPlanAction,
} from '../../lib/todayFriendClient';
import type { TodayFriendQuestion, TodayFriendState } from '../../lib/todayFriendState';
import TeacherTodayFriendPlan from './TeacherTodayFriendPlan';
import TeacherTodayFriendReview from './TeacherTodayFriendReview';

type TeacherTodayFriendTab = 'review' | 'plan';

export default function TeacherTodayFriendPanel() {
  const [dateKey, setDateKey] = useState(getTodayFriendDateKey);
  const [state, setState] = useState<TodayFriendState | null>(null);
  const [tab, setTab] = useState<TeacherTodayFriendTab>('review');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadState = useCallback(async () => {
    setIsLoading(true);
    setMessage('');
    try {
      setState(await loadTeacherTodayFriendState(dateKey));
    } catch (error) {
      if (error instanceof Error) setMessage('오늘의 친구 현황을 불러오지 못했습니다.');
      else throw error;
    } finally {
      setIsLoading(false);
    }
  }, [dateKey]);

  useEffect(() => { void loadState(); }, [loadState]);

  const review = async (submissionId: string, decision: 'revision_requested' | 'approved', feedback: string) => {
    setIsSaving(true);
    setMessage('');
    try {
      setState(await reviewStudentTodayFriendSubmission({ submissionId, decision, feedback }));
      setMessage(decision === 'approved' ? '승인하고 15고마를 지급했습니다.' : '학생에게 수정 요청을 보냈습니다.');
    } catch (error) {
      if (error instanceof Error) setMessage('처리하지 못했습니다. 다시 시도해 주세요.');
      else throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const updatePlan = async (action: TeacherTodayFriendPlanAction) => {
    setIsSaving(true);
    try {
      setState(await updateTeacherTodayFriendPlan(action));
      setMessage('배정 내용을 저장했습니다.');
    } catch (error) {
      if (error instanceof Error) setMessage('배정 내용을 저장하지 못했습니다.');
      else throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const updateQuestions = async (change: (questions: readonly TodayFriendQuestion[]) => readonly TodayFriendQuestion[]) => {
    if (!state) return;
    setIsSaving(true);
    try {
      setState(await updateTeacherTodayFriendQuestions(dateKey, change(state.questions)));
      setMessage('질문 목록을 저장했습니다.');
    } catch (error) {
      if (error instanceof Error) setMessage('질문 목록을 저장하지 못했습니다.');
      else throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const dateSubmissions = state?.submissions.filter((submission) => submission.dateKey === dateKey) ?? [];

  return (
    <section className="teacher-today-friend-panel" aria-labelledby="teacher-today-friend-title">
      <header className="teacher-today-friend-header">
        <div><CalendarCheck2 aria-hidden="true" /><span><h2 id="teacher-today-friend-title">오늘의 친구 관리</h2><p>제출 내용을 확인한 뒤 15고마를 지급합니다.</p></span></div>
        <label><span>확인 날짜</span><input type="date" value={dateKey} onChange={(event) => setDateKey(event.target.value)} /></label>
      </header>
      <div className="teacher-today-friend-summary">
        <span><strong>{dateSubmissions.filter((entry) => entry.status === 'submitted').length}</strong>승인 대기</span>
        <span><strong>{dateSubmissions.filter((entry) => entry.status === 'approved').length}</strong>승인 완료</span>
        <span><strong>{23 - dateSubmissions.length}</strong>미제출</span>
      </div>
      <nav className="teacher-today-friend-tabs" aria-label="오늘의 친구 관리 메뉴">
        <button type="button" className={tab === 'review' ? 'is-active' : ''} onClick={() => setTab('review')}><ClipboardList aria-hidden="true" />제출 확인</button>
        <button type="button" className={tab === 'plan' ? 'is-active' : ''} onClick={() => setTab('plan')}><Settings2 aria-hidden="true" />주간·파트너 설정</button>
        <button type="button" onClick={() => { void loadState(); }}><RefreshCw aria-hidden="true" />새로고침</button>
      </nav>
      {message ? <p className="teacher-today-friend-message" role="status">{message}</p> : null}
      {isLoading || !state ? <div className="teacher-today-friend-loading">현황을 불러오는 중입니다.</div> : tab === 'review' ? (
        <TeacherTodayFriendReview submissions={dateSubmissions} isSaving={isSaving} onReview={review} />
      ) : (
        <TeacherTodayFriendPlan state={state} dateKey={dateKey} isSaving={isSaving} onPlanAction={updatePlan} onQuestionsChange={updateQuestions} />
      )}
    </section>
  );
}
