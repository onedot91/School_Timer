import { Check, Clock3, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import type { TodayFriendSubmission } from '../../lib/todayFriend';

interface TeacherTodayFriendReviewProps {
  readonly submissions: readonly TodayFriendSubmission[];
  readonly isSaving: boolean;
  readonly onReview: (submissionId: string, decision: 'revision_requested' | 'approved', feedback: string) => Promise<void>;
}

const getPreview = (submission: TodayFriendSubmission): string => {
  switch (submission.payload.kind) {
    case 'interview': return submission.payload.answer;
    case 'commonality': return submission.payload.commonality;
    case 'recommendation': return `${submission.payload.title} · ${submission.payload.reason}`;
    case 'compliment': return [
      `칭찬할 행동: ${submission.payload.compliment}`,
      submission.payload.reason ? `좋았던 이유: ${submission.payload.reason}` : null,
      submission.payload.message ? `“${submission.payload.message}”` : null,
    ].filter((line): line is string => line !== null).join('\n');
    case 'emotion': return `${submission.payload.emotion} · ${submission.payload.declinedToExplain ? '이유는 말하지 않음' : submission.payload.reason}`;
  }
};

const STATUS_LABELS = {
  draft: '작성 중',
  submitted: '승인 대기',
  revision_requested: '수정 요청',
  approved: '완료',
} as const;

export default function TeacherTodayFriendReview({ submissions, isSaving, onReview }: TeacherTodayFriendReviewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(() => submissions.find((entry) => entry.status === 'submitted')?.id ?? submissions[0]?.id ?? null);
  const [feedback, setFeedback] = useState('조금 더 구체적으로 적어 주세요.');
  const selected = submissions.find((entry) => entry.id === selectedId) ?? submissions[0] ?? null;
  const sorted = [...submissions].sort((first, second) => {
    const firstRank = first.status === 'submitted' ? 0 : first.status === 'revision_requested' ? 1 : first.status === 'draft' ? 2 : 3;
    const secondRank = second.status === 'submitted' ? 0 : second.status === 'revision_requested' ? 1 : second.status === 'draft' ? 2 : 3;
    return firstRank - secondRank || first.studentNumber - second.studentNumber;
  });

  return (
    <div className="teacher-today-friend-review">
      <section className="teacher-today-friend-queue" aria-label="오늘의 친구 제출 목록">
        <header><h3>제출 목록</h3></header>
        <div className="teacher-today-friend-queue-list">
          {sorted.length === 0 ? <p className="teacher-today-friend-empty">아직 제출한 학생이 없습니다.</p> : sorted.map((submission) => (
            <button key={submission.id} type="button" className={submission.id === selected?.id ? 'is-active' : ''} onClick={() => setSelectedId(submission.id)}>
              <strong>{submission.studentNumber}번 → {submission.partnerNumber}번</strong>
              <span>{getPreview(submission)}</span>
              <small data-status={submission.status}>{STATUS_LABELS[submission.status]}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="teacher-today-friend-detail" aria-label="오늘의 친구 제출 상세">
        {selected ? (
          <>
            <header><h3>{selected.studentNumber}번 → {selected.partnerNumber}번</h3><small>{STATUS_LABELS[selected.status]}</small></header>
            <article data-private={selected.genre === 'emotion' ? 'true' : undefined}>
              {selected.genre === 'emotion' ? <p className="teacher-today-friend-private-label">참여 학생과 교사만 보는 감정 기록</p> : null}
              <p>{getPreview(selected)}</p>
            </article>
            {selected.teacherFeedback ? <aside><strong>수정 요청 내용</strong><p>{selected.teacherFeedback}</p></aside> : null}
            {selected.status === 'submitted' ? (
              <div className="teacher-today-friend-review-actions">
                <label><span>수정 요청 문구</span><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={300} /></label>
                <div>
                  <button type="button" disabled={isSaving || feedback.trim().length === 0} onClick={() => { void onReview(selected.id, 'revision_requested', feedback); }}><RotateCcw aria-hidden="true" />수정 요청</button>
                  <button type="button" disabled={isSaving} onClick={() => { void onReview(selected.id, 'approved', ''); }}><Check aria-hidden="true" />승인 · 15고마</button>
                </div>
              </div>
            ) : selected.status === 'approved' ? <p className="teacher-today-friend-complete"><Check aria-hidden="true" />15고마 지급 완료</p> : <p className="teacher-today-friend-wait"><Clock3 aria-hidden="true" />학생 제출 대기</p>}
          </>
        ) : <p className="teacher-today-friend-empty">제출물을 선택하세요.</p>}
      </section>
    </div>
  );
}
