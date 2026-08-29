import { CheckCircle2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ClasswordQuizStudentState } from '../../lib/classwordQuiz';

type ClasswordQuizProps = {
  readonly state: ClasswordQuizStudentState | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly loadError: string;
  readonly onSubmit: (answer: string) => Promise<boolean>;
};

export default function ClasswordQuiz({
  state,
  loading,
  saving,
  loadError,
  onSubmit,
}: ClasswordQuizProps) {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!state?.completed) return;
    setAnswer('');
    setFeedback('정답이에요! 오늘 퀴즈를 완료했어요.');
  }, [state?.completed]);

  const submit = async (): Promise<void> => {
    const nextAnswer = answer.trim();
    if (!nextAnswer || saving || state?.completed) return;
    setFeedback('');
    try {
      const correct = await onSubmit(nextAnswer);
      if (correct) {
        setAnswer('');
        setFeedback('정답이에요! 오늘 퀴즈를 완료했어요.');
      } else {
        setFeedback('아직 정답이 아니에요. 뜻과 예문을 다시 살펴보세요.');
      }
    } catch {
      setFeedback('정답을 확인하지 못했어요. 잠시 후 다시 해 주세요.');
    }
  };

  const completed = state?.completed ?? false;
  return (
    <section className={`classword-quiz${completed ? ' is-complete' : ''}`} aria-labelledby="classword-quiz-title">
      <header>
        <h2 id="classword-quiz-title">오늘의 낱말 퀴즈</h2>
        {completed ? <span><CheckCircle2 aria-hidden="true" /> 완료</span> : null}
      </header>
      {state ? (
        <div className="classword-quiz-body">
          <strong className="classword-quiz-initial" aria-label={`초성 힌트 ${state.question.initialHint}`}>
            {state.question.initialHint}
          </strong>
          <div className="classword-quiz-copy">
            <p><span>뜻</span><strong>{state.question.meaning}</strong></p>
            <p><span>예문</span>{state.question.example}</p>
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}>
            <label htmlFor="classword-quiz-answer" className="sr-only">정답 낱말</label>
            <div>
              <input
                id="classword-quiz-answer"
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value.replace(/[^\p{L}\s]/gu, ''));
                  setFeedback('');
                }}
                maxLength={20}
                autoComplete="off"
                placeholder={completed ? '오늘 퀴즈 완료' : '정답 낱말'}
                disabled={saving || completed}
              />
              <button type="submit" disabled={saving || completed || !answer.trim()}>
                {completed ? <CheckCircle2 aria-hidden="true" /> : <Send aria-hidden="true" />}
                {saving ? '확인 중' : completed ? '완료' : '확인'}
              </button>
            </div>
            <p className="classword-quiz-feedback" role="status" aria-live="polite">
              {feedback || (completed ? '이 퀴즈는 다시 제출할 수 없어요.' : '\u00a0')}
            </p>
          </form>
        </div>
      ) : (
        <p className="classword-quiz-unavailable" role={loadError ? 'alert' : 'status'}>
          {loadError || (loading ? '오늘의 문제를 불러오는 중이에요.' : '오늘의 문제를 준비하고 있어요.')}
        </p>
      )}
    </section>
  );
}
