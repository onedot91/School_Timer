import { useState } from 'react';
import type { StudentGameConflictReview } from '../../lib/useStudentGameConflict';

export default function StudentGameConflictNotice({ review, onRefresh, onAdopt }: {
  readonly review: StudentGameConflictReview;
  readonly onRefresh: () => void;
  readonly onAdopt: () => Promise<boolean>;
}) {
  const [copyStatus, setCopyStatus] = useState('');
  const archived = review.state === 'archived';
  return (
    <section className="rounded-xl border border-current p-3 text-sm" aria-label="게임 기록 충돌" onKeyDown={event => event.stopPropagation()}>
      <p role="status">{review.summary}</p>
      <details open={!archived}>
        <summary className="min-h-11 cursor-pointer py-3">{archived ? '이전 입력 보기' : '내 입력과 최신 기록 비교'}</summary>
        <label className="block">내 입력
          <textarea readOnly aria-label="보관한 내 입력" value={review.localText} rows={3} className="block max-h-28 w-full resize-none rounded border p-2 font-mono" />
        </label>
        {review.remoteText ? <label className="mt-2 block">최신 기록
          <textarea readOnly aria-label="최신 게임 기록" value={review.remoteText} rows={3} className="block max-h-28 w-full resize-none rounded border p-2 font-mono" />
        </label> : null}
        <button type="button" className="student-secondary-action mt-2" onClick={() => {
          if (!navigator.clipboard) { setCopyStatus('내 입력을 선택해 복사해 주세요.'); return; }
          void navigator.clipboard.writeText(review.localText).then(() => setCopyStatus('복사했어요.'), () => setCopyStatus('내 입력을 선택해 복사해 주세요.'));
        }}>내 입력 복사</button>
        {copyStatus ? <span role="status">{copyStatus}</span> : null}
      </details>
      {!archived ? <div className="mt-2 flex flex-wrap gap-2">
        {review.state === 'error' || review.error ? <button type="button" className="student-secondary-action" onClick={onRefresh}>최신 기록 다시 확인</button> : null}
        <button type="button" className="student-secondary-action" disabled={review.state !== 'ready'} onClick={() => void onAdopt()}>
          {review.state === 'saving' ? '입력 보관 중' : '최신 기록으로 계속'}
        </button>
      </div> : null}
      {review.error ? <p role="alert">{review.error}</p> : null}
    </section>
  );
}
