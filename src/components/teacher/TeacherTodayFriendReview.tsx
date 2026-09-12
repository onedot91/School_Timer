import { Check, Clock3 } from 'lucide-react';
import { useState } from 'react';

import type { TodayFriendSubmission } from '../../lib/todayFriend';
import {
  createTodayFriendReviewQueue,
  TODAY_FRIEND_REVIEW_QUEUE_STATUS_LABELS,
} from '../../lib/teacherTodayFriendReviewPresentation';

interface TeacherTodayFriendReviewProps {
  readonly submissions: readonly TodayFriendSubmission[];
  readonly isSaving: boolean;
  readonly onReview: (submissionId: string) => Promise<void>;
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

const GENRE_LABELS = {
  interview: '인터뷰',
  commonality: '공통점 찾기',
  recommendation: '추천하기',
  compliment: '칭찬하기',
  emotion: '감정 찾기',
} as const;

const firstSelectedNumber = (queue: ReturnType<typeof createTodayFriendReviewQueue>): number => (
  queue.find((entry) => entry.status === 'submitted')?.studentNumber
  ?? queue.find((entry) => entry.status === 'approved')?.studentNumber
  ?? 1
);

export default function TeacherTodayFriendReview({ submissions, isSaving, onReview }: TeacherTodayFriendReviewProps) {
  const queue = createTodayFriendReviewQueue(submissions);
  const [selectedNumber, setSelectedNumber] = useState(() => firstSelectedNumber(queue));
  const selected = queue.find((entry) => entry.studentNumber === selectedNumber) ?? queue[0];
  const selectedSubmission = selected?.submission;

  return (
    <div className="teacher-today-friend-review">
      <section className="teacher-today-friend-queue" aria-label="오늘의 친구 제출 목록">
        <header>
          <h3>제출 목록</h3>
          <ul className="teacher-today-friend-queue-legend">
            {(['missing', 'submitted', 'approved'] as const).map((status) => (
              <li key={status} data-status={status}>{TODAY_FRIEND_REVIEW_QUEUE_STATUS_LABELS[status]}</li>
            ))}
          </ul>
        </header>
        <div className="teacher-today-friend-queue-list">
          {queue.map((entry) => (
            <button
              key={entry.studentNumber}
              type="button"
              className={entry.studentNumber === selected?.studentNumber ? 'is-active' : ''}
              data-status={entry.status}
              aria-current={entry.studentNumber === selected?.studentNumber ? 'true' : undefined}
              aria-label={`${entry.studentNumber}번 ${TODAY_FRIEND_REVIEW_QUEUE_STATUS_LABELS[entry.status]}`}
              onClick={() => setSelectedNumber(entry.studentNumber)}
            >
              <strong>{entry.studentNumber}</strong>
            </button>
          ))}
        </div>
      </section>
      <section className="teacher-today-friend-detail" aria-label="오늘의 친구 제출 상세">
        {selectedSubmission && selected.status !== 'missing' ? (
          <>
            <header>
              <div>
                <h3>{selectedSubmission.studentNumber}번 제출</h3>
                <span>{GENRE_LABELS[selectedSubmission.genre]} · 친구 {selectedSubmission.partnerNumber}번</span>
              </div>
              <small data-status={selected.status}>{TODAY_FRIEND_REVIEW_QUEUE_STATUS_LABELS[selected.status]}</small>
            </header>
            <article data-private={selectedSubmission.genre === 'emotion' ? 'true' : undefined}>
              {selectedSubmission.genre === 'emotion' ? <p className="teacher-today-friend-private-label">참여 학생과 교사만 보는 감정 기록</p> : null}
              <p>{getPreview(selectedSubmission)}</p>
            </article>
            {selected.status === 'submitted' ? (
              <div className="teacher-today-friend-review-actions">
                <button type="button" disabled={isSaving} onClick={() => { void onReview(selectedSubmission.id); }}>
                  <Check aria-hidden="true" />승인 · 15고마
                </button>
              </div>
            ) : (
              <p className="teacher-today-friend-complete"><Check aria-hidden="true" />15고마 지급 완료</p>
            )}
          </>
        ) : (
          <p className="teacher-today-friend-wait"><Clock3 aria-hidden="true" />{selected ? `${selected.studentNumber}번 미제출` : '학생 제출 대기'}</p>
        )}
      </section>
    </div>
  );
}
