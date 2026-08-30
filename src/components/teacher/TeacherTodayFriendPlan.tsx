import { CalendarDays, RefreshCw, Shuffle, UserRoundCog } from 'lucide-react';
import { useState } from 'react';

import type { TeacherTodayFriendPlanAction } from '../../lib/todayFriendClient';
import type { TodayFriendQuestion, TodayFriendState } from '../../lib/todayFriendState';

interface TeacherTodayFriendPlanProps {
  readonly state: TodayFriendState;
  readonly dateKey: string;
  readonly isSaving: boolean;
  readonly onPlanAction: (action: TeacherTodayFriendPlanAction) => Promise<void>;
  readonly onQuestionsChange: (change: (questions: readonly TodayFriendQuestion[]) => readonly TodayFriendQuestion[]) => Promise<void>;
}

const GENRE_LABELS = {
  interview: '인터뷰',
  commonality: '공통점 찾기',
  recommendation: '추천하기',
  compliment: '칭찬하기',
  emotion: '감정 찾기',
} as const;

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'] as const;

export default function TeacherTodayFriendPlan({ state, dateKey, isSaving, onPlanAction, onQuestionsChange }: TeacherTodayFriendPlanProps) {
  const [firstStudentNumber, setFirstStudentNumber] = useState(1);
  const [secondStudentNumber, setSecondStudentNumber] = useState(2);
  const [newQuestion, setNewQuestion] = useState('');
  const week = state.weeks.find((entry) => entry.days.some((day) => day.dateKey === dateKey)) ?? state.weeks[0];
  const partnerDay = state.partnerDays.find((entry) => entry.dateKey === dateKey);
  const selectedQuestionId = state.selectedQuestionIdByDate[dateKey] ?? '';

  return (
    <div className="teacher-today-friend-plan">
      <section className="teacher-today-friend-plan-card">
        <header><div><CalendarDays aria-hidden="true" /><span><h3>이번 주 장르</h3><p>월요일부터 금요일까지 한 번씩 진행합니다.</p></span></div><button type="button" disabled={isSaving} onClick={() => { void onPlanAction({ action: 'reassign_week', dateKey }); }}><Shuffle aria-hidden="true" />다시 배정</button></header>
        <div className="teacher-today-friend-week-grid">
          {week?.days.map((day, index) => <article key={day.dateKey} data-today={day.dateKey === dateKey ? 'true' : undefined}><span>{WEEKDAY_LABELS[index]}</span><strong>{GENRE_LABELS[day.genre]}</strong><small>{day.dateKey.slice(5).replace('-', '.')}</small></article>)}
        </div>
      </section>

      <section className="teacher-today-friend-plan-card">
        <header><div><UserRoundCog aria-hidden="true" /><span><h3>오늘의 파트너</h3><p>10쌍과 3인 순환으로 배정됩니다.</p></span></div><button type="button" disabled={isSaving} onClick={() => { void onPlanAction({ action: 'reassign_partners', dateKey }); }}><RefreshCw aria-hidden="true" />전체 재배정</button></header>
        <div className="teacher-today-friend-partner-grid">
          {partnerDay?.assignments.map((assignment) => <span key={assignment.studentNumber} data-kind={assignment.relationKind}><strong>{assignment.studentNumber}</strong><i>→</i><b>{assignment.partnerNumber}</b></span>)}
        </div>
        <div className="teacher-today-friend-pair-editor">
          <label><span>학생</span><select value={firstStudentNumber} onChange={(event) => setFirstStudentNumber(Number(event.target.value))}>{Array.from({ length: 23 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number}번</option>)}</select></label>
          <label><span>짝</span><select value={secondStudentNumber} onChange={(event) => setSecondStudentNumber(Number(event.target.value))}>{Array.from({ length: 23 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number}번</option>)}</select></label>
          <button type="button" disabled={isSaving || firstStudentNumber === secondStudentNumber} onClick={() => { void onPlanAction({ action: 'assign_pair', dateKey, firstStudentNumber, secondStudentNumber }); }}>두 학생을 짝으로 지정</button>
        </div>
      </section>

      <section className="teacher-today-friend-plan-card">
        <header><div><span><h3>인터뷰 질문 목록</h3><p>질문을 직접 선택하거나 자동 출제할 수 있습니다.</p></span></div></header>
        <div className="teacher-today-friend-question-add"><input value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} placeholder="새 인터뷰 질문" maxLength={160} /><button type="button" disabled={newQuestion.trim().length === 0} onClick={() => {
          const text = newQuestion.trim();
          void onQuestionsChange((questions) => [...questions, { id: `question-${Date.now()}`, text, active: true, usedDateKeys: [] }]);
          setNewQuestion('');
        }}>질문 추가</button></div>
        <div className="teacher-today-friend-question-list">
          {state.questions.map((question) => (
            <article key={question.id} data-active={question.active ? 'true' : undefined}>
              <label><input type="radio" name="today-friend-question" checked={selectedQuestionId === question.id} disabled={!question.active} onChange={() => { void onPlanAction({ action: 'select_question', dateKey, questionId: question.id }); }} /><span>{question.text}</span></label>
              <div><button type="button" onClick={() => { void onQuestionsChange((questions) => questions.map((entry) => entry.id === question.id ? { ...entry, active: !entry.active } : entry)); }}>{question.active ? '사용 중' : '사용 안 함'}</button><button type="button" onClick={() => { void onQuestionsChange((questions) => questions.filter((entry) => entry.id !== question.id)); }}>삭제</button></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
