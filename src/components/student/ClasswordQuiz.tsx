import { AlertCircle, CheckCircle2, Send, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { browserDraftStorage } from '../../lib/featureInputDraft';
import type { ClasswordQuizStudentState } from '../../lib/classwordQuiz';
import { loadSavedClasswordQuizAnswer, readyClasswordQuizInput, saveClasswordQuizInput, settleClasswordQuizInput } from '../../lib/classwordQuizAnswerStore';

type ClasswordQuizProps = {
  readonly studentNumber: number;
  readonly state: ClasswordQuizStudentState | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly readOnly?: boolean;
  readonly loadError: string;
  readonly onSubmit: (answer: string) => Promise<boolean>;
};

type SubmissionState = 'idle' | 'incorrect' | 'error';

export default function ClasswordQuiz({
  studentNumber,
  state,
  loading,
  saving,
  readOnly = false,
  loadError,
  onSubmit,
}: ClasswordQuizProps) {
  const [answer, setAnswer] = useState('');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');

  const inputGeneration = useRef(0);
  const draftCheckSequence = useRef(0);
  const [inputReady, setInputReady] = useState(false);
  const [inputStorageFailed, setInputStorageFailed] = useState(false);
  useEffect(() => {
    const generation = ++inputGeneration.current;
    setSubmissionState('idle');
    setInputReady(false);
    if (!state) return;
    const identity = { dateKey: state.dateKey, studentNumber, questionId: state.question.id };
    void readyClasswordQuizInput(browserDraftStorage(), identity).then((draft) => {
      if (generation !== inputGeneration.current) return;
      setAnswer(state.completed ? loadSavedClasswordQuizAnswer(browserDraftStorage(), identity) || draft : draft);
      setInputReady(true);
    });
    return () => { inputGeneration.current += 1; };
  }, [state?.completed, state?.dateKey, state?.question.id, studentNumber]);

  const submit = async (): Promise<void> => {
    const nextAnswer = answer.trim();
    if (!inputReady || !nextAnswer || loading || readOnly || saving || state?.completed) return;
    const generation = inputGeneration.current;
    setSubmissionState('idle');
    try {
      const correct = await onSubmit(nextAnswer);
      if (!correct && generation === inputGeneration.current) {
        setSubmissionState('incorrect');
      }
    } catch {
      if (generation === inputGeneration.current) setSubmissionState('error');
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
            {readOnly ? null : <strong className="classword-quiz-reward-copy">1~10고마 즉시 지급</strong>}
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
                    const next = event.target.value.replace(/[^\p{L}\s]/gu, '');
                    setAnswer(next);
                    const identity = { dateKey: state.dateKey, studentNumber, questionId: state.question.id };
                    saveClasswordQuizInput(browserDraftStorage(), identity, next);
                    const check = ++draftCheckSequence.current;
                    void settleClasswordQuizInput(browserDraftStorage(), identity).then(saved => { if (check === draftCheckSequence.current) setInputStorageFailed(!saved); });
                    setSubmissionState('idle');
                  }}
                  maxLength={20}
                  autoComplete="off"
                  placeholder="정답 입력"
                  disabled={!inputReady || loading || readOnly || saving || completed}
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
                  disabled={!inputReady || loading || readOnly || saving || completed || !answer.trim()}
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
                          ? '다시 시도'
                          : '제출'}
                </button>
              </div>
              {loadError ? <p role="alert">{loadError}</p> : null}
              {inputStorageFailed ? <p role="status">이 기기에 임시 보관하지 못했어요.</p> : null}
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
