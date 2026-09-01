import { AlertCircle, CheckCircle2, Send, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getDailyClasswordQuizAnswer, type ClasswordQuizStudentState } from '../../lib/classwordQuiz';
import { loadSavedClasswordQuizAnswer } from '../../lib/classwordQuizAnswerStore';

type ClasswordQuizProps = {
  readonly studentNumber: number;
  readonly state: ClasswordQuizStudentState | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly loadError: string;
  readonly onSubmit: (answer: string) => Promise<boolean>;
};

type SubmissionState = 'idle' | 'incorrect' | 'error';

export default function ClasswordQuiz({
  studentNumber,
  state,
  loading,
  saving,
  loadError,
  onSubmit,
}: ClasswordQuizProps) {
  const [answer, setAnswer] = useState('');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');

  useEffect(() => {
    if (!state?.completed) return;
    const savedAnswer = loadSavedClasswordQuizAnswer(window.localStorage, {
      dateKey: state.dateKey,
      studentNumber,
      questionId: state.question.id,
    });
    setAnswer(savedAnswer || getDailyClasswordQuizAnswer(state.dateKey));
  }, [state?.completed, state?.dateKey, state?.question.id, studentNumber]);

  const submit = async (): Promise<void> => {
    const nextAnswer = answer.trim();
    if (!nextAnswer || saving || state?.completed) return;
    setSubmissionState('idle');
    try {
      const correct = await onSubmit(nextAnswer);
      if (!correct) {
        setSubmissionState('incorrect');
      }
    } catch {
      setSubmissionState('error');
    }
  };

  const completed = state?.completed ?? false;
  return (
    <section className={`classword-quiz${completed ? ' is-complete' : ''}`} aria-labelledby="classword-quiz-title">
      <header>
        <h2 id="classword-quiz-title" className="sr-only">보너스 문제</h2>
      </header>
      {state ? (
        <div className="classword-quiz-body">
          <span className="classword-quiz-heading-art">
            <img src="/classword/bonus-question.png" alt="" aria-hidden="true" width="1448" height="1086" />
            <strong className="classword-quiz-reward-copy">1~10고마 즉시 지급</strong>
          </span>
          <div className="classword-quiz-copy">
            <p><span>뜻</span><strong>{state.question.meaning}</strong></p>
            <div className="classword-quiz-examples">
              <span>예시</span>
              <div className="classword-quiz-example-list">
                {state.question.examples.map((example) => (
                  <p key={example.register}>
                    <span className="classword-quiz-example">
                      {example.prefix}
                      <strong className="classword-quiz-example-hint">{state.question.initialHint}</strong>
                      {example.suffix}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          </div>
          <div className="classword-quiz-answer">
            <strong className="classword-quiz-initial">
              <span>초성 힌트:</span> {state.question.initialHint}
            </strong>
            <form onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}>
              <label htmlFor="classword-quiz-answer" className="sr-only">정답 입력</label>
              <div>
                <input
                  id="classword-quiz-answer"
                  value={answer}
                  onChange={(event) => {
                    setAnswer(event.target.value.replace(/[^\p{L}\s]/gu, ''));
                    setSubmissionState('idle');
                  }}
                  maxLength={20}
                  autoComplete="off"
                  placeholder="정답 입력"
                  disabled={saving || completed}
                />
                <button
                  type="submit"
                  className={completed
                    ? 'is-correct'
                    : submissionState === 'incorrect'
                      ? 'is-incorrect'
                      : submissionState === 'error'
                        ? 'is-error'
                        : undefined}
                  disabled={saving || completed || !answer.trim()}
                  data-reward-amount={completed && state.rewardAmount !== null ? state.rewardAmount : undefined}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {completed
                    ? <CheckCircle2 aria-hidden="true" />
                    : submissionState === 'incorrect'
                      ? <XCircle aria-hidden="true" />
                      : submissionState === 'error'
                        ? <AlertCircle aria-hidden="true" />
                        : <Send aria-hidden="true" />}
                  {saving
                    ? '제출 중'
                    : completed
                      ? state.rewardAmount === null
                        ? '정답'
                        : `정답 ${state.rewardAmount}고마`
                      : submissionState === 'incorrect'
                        ? '오답'
                        : submissionState === 'error'
                          ? '오류'
                          : '제출'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <p className="classword-quiz-unavailable" role={loadError ? 'alert' : 'status'}>
          {loadError || (loading ? '오늘의 문제를 불러오는 중이에요.' : '오늘의 문제를 준비하고 있어요.')}
        </p>
      )}
    </section>
  );
}
