import { CalendarCheck2, ClipboardList, RefreshCw, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getTodayFriendDateKey } from '../../lib/todayFriend';
import {
  loadTeacherTodayFriendState,
  reviewStudentTodayFriendSubmission,
  updateTeacherTodayFriendPlan,
  updateTeacherTodayFriendQuestions,
  TodayFriendClientError,
  type TeacherTodayFriendPlanAction,
} from '../../lib/todayFriendClient';
import { createStudentSaveDraftStore } from '../../lib/studentSaveDraft';
import { isStorageRecord } from '../../lib/teacherStorageCommand';
import type { TodayFriendQuestion, TodayFriendState } from '../../lib/todayFriendState';
import TeacherTodayFriendPlan from './TeacherTodayFriendPlan';
import TeacherTodayFriendReview from './TeacherTodayFriendReview';

type TeacherTodayFriendTab = 'review' | 'plan';
const reviewDrafts = createStudentSaveDraftStore();
type PendingReview = { readonly submissionId: string; readonly decision: 'revision_requested' | 'approved'; readonly feedback: string; readonly expectedRevision: number; readonly requestId: string };
const reviewScope = (submissionId: string) => ({ studentNumber: 0, feature: 'teacher.todayFriend.review', entityId: submissionId });

export default function TeacherTodayFriendPanel() {
  const [dateKey, setDateKey] = useState(getTodayFriendDateKey);
  const [state, setState] = useState<TodayFriendState | null>(null);
  const [tab, setTab] = useState<TeacherTodayFriendTab>('review');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);
  const savingRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const currentDateRef = useRef(dateKey);
  currentDateRef.current = dateKey;

  const loadState = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setIsLoading(true);
    setMessage('');
    try {
      const loaded = await loadTeacherTodayFriendState(dateKey);
      if (generation === loadGenerationRef.current) setState(loaded);
    } catch (error) {
      if (error instanceof Error) setMessage('오늘의 친구 현황을 불러오지 못했습니다.');
      else throw error;
    } finally {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    }
  }, [dateKey]);

  useEffect(() => { void loadState(); }, [loadState]);

  const performReview = async (input: PendingReview) => {
    if (savingRef.current) return;
    savingRef.current = true;
    ++loadGenerationRef.current;
    const requestedDate = dateKey;
    setIsSaving(true);
    setMessage('');
    try {
      const saved = await reviewStudentTodayFriendSubmission(input);
      reviewDrafts.confirm(reviewScope(input.submissionId), input.requestId);
      setPendingReview(null);
      if (currentDateRef.current === requestedDate) setState(saved);
      setMessage(input.decision === 'approved' ? '승인 · 15고마 지급 완료' : '수정 요청 전송 완료');
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      const conflict = error instanceof TodayFriendClientError && error.status === 409
        && (error.code === 'TODAY_FRIEND_SUBMISSION_CONFLICT' || error.code === 'TODAY_FRIEND_PLANNING_CONFLICT');
      if (conflict) {
        reviewDrafts.remove(reviewScope(input.submissionId), input.requestId);
        setPendingReview(null);
      } else {
        setPendingReview(input);
      }
      try {
        const latest = await loadTeacherTodayFriendState(requestedDate);
        if (currentDateRef.current === requestedDate) setState(latest);
      } catch (refreshError) {
        if (!(refreshError instanceof Error)) throw refreshError;
      }
      setMessage(conflict
        ? '제출 내용이 변경되었습니다. 최신 내용을 확인한 뒤 다시 처리해 주세요.'
        : '처리 결과를 확인하지 못했습니다. 수정 요청 문구는 보관했습니다.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
      setIsLoading(false);
    }
  };

  const review = async (submissionId: string, decision: 'revision_requested' | 'approved', feedback: string) => {
    if (savingRef.current) return;
    const submission = state?.submissions.find(entry => entry.id === submissionId);
    if (!submission || submission.status !== 'submitted') {
      setMessage('최신 제출 내용을 확인한 뒤 처리해 주세요.');
      return;
    }
    const payload = { submissionId, decision, feedback, expectedRevision: submission.storageRevision ?? 0 };
    const saved = reviewDrafts.save(reviewScope(submissionId), payload);
    if (saved.status === 'invalid') return;
    if (saved.status === 'payload_changed') {
      const prior = saved.draft.payload;
      if (isStorageRecord(prior) && typeof prior.submissionId === 'string'
        && (prior.decision === 'approved' || prior.decision === 'revision_requested')
        && typeof prior.feedback === 'string' && typeof prior.expectedRevision === 'number') {
        setPendingReview({ submissionId: prior.submissionId, decision: prior.decision,
          feedback: prior.feedback, expectedRevision: prior.expectedRevision, requestId: saved.draft.requestId });
      }
      setMessage('이전 처리 결과를 먼저 확인해 주세요. 새 수정 요청 문구는 유지됩니다.');
      return;
    }
    await performReview({ ...payload, requestId: saved.draft.requestId });
  };

  const updatePlan = async (action: TeacherTodayFriendPlanAction) => {
    setIsSaving(true);
    try {
      setState(await updateTeacherTodayFriendPlan(action));
      setMessage('배정 저장 완료');
    } catch (error) {
      if (error instanceof Error) setMessage('배정 저장 실패');
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
      setMessage('질문 저장 완료');
    } catch (error) {
      if (error instanceof Error) setMessage('질문 저장 실패');
      else throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const dateSubmissions = state?.submissions.filter((submission) => submission.dateKey === dateKey) ?? [];

  return (
    <section className="teacher-today-friend-panel" aria-labelledby="teacher-today-friend-title">
      <header className="teacher-today-friend-header">
        <div><CalendarCheck2 aria-hidden="true" /><h2 id="teacher-today-friend-title">오늘의 친구</h2></div>
        <label><span className="sr-only">날짜</span><input type="date" disabled={isSaving} value={dateKey} onChange={(event) => setDateKey(event.target.value)} /></label>
      </header>
      <div className="teacher-today-friend-summary">
        <span><strong>{dateSubmissions.filter((entry) => entry.status === 'submitted').length}</strong>대기</span>
        <span><strong>{dateSubmissions.filter((entry) => entry.status === 'approved').length}</strong>완료</span>
        <span><strong>{23 - dateSubmissions.length}</strong>미제출</span>
      </div>
      <nav className="teacher-today-friend-tabs" aria-label="오늘의 친구 관리 메뉴">
        <button type="button" className={tab === 'review' ? 'is-active' : ''} onClick={() => setTab('review')}><ClipboardList aria-hidden="true" />제출</button>
        <button type="button" className={tab === 'plan' ? 'is-active' : ''} onClick={() => setTab('plan')}><Settings2 aria-hidden="true" />설정</button>
        <button type="button" aria-label="현황 새로고침" title="새로고침" disabled={isSaving} onClick={() => { void loadState(); }}><RefreshCw aria-hidden="true" /></button>
      </nav>
      {message ? <p className="teacher-today-friend-message" role="status">{message}</p> : null}
      {pendingReview && <button type="button" disabled={isSaving} className="min-h-11 rounded-full border px-4" onClick={() => { void performReview(pendingReview); }}>이전 처리 다시 확인</button>}
      {isLoading && !state ? <div className="teacher-today-friend-loading">불러오는 중…</div> : !state ? null : tab === 'review' ? (
        <TeacherTodayFriendReview submissions={dateSubmissions} isSaving={isSaving} onReview={review} />
      ) : (
        <TeacherTodayFriendPlan state={state} dateKey={dateKey} isSaving={isSaving} onPlanAction={updatePlan} onQuestionsChange={updateQuestions} />
      )}
    </section>
  );
}
