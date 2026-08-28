import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Delete, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  NUMBER_BASEBALL_MAX_ATTEMPTS,
  appendNumberBaseballAttempt,
  createNumberBaseballAnswer,
  evaluateNumberBaseballGuess,
  getNumberBaseballOutDigits,
  getNumberBaseballReward,
  getNumberBaseballResultDisplays,
  getNumberBaseballStatus,
  type NumberBaseballGuess,
  type NumberBaseballProgressEntry,
} from '../../lib/numberBaseball';
import StudentHeader from './StudentHeader';
import { StudentNumberBaseballHistory } from './StudentNumberBaseballHistory';

type StudentNumberBaseballPageProps = {
  readonly studentNumber: number;
  readonly weekKey: string;
  readonly entry: NumberBaseballProgressEntry;
  readonly hasReward: boolean;
  readonly onSave: (entry: NumberBaseballProgressEntry) => Promise<boolean>;
  readonly onComplete: (entry: NumberBaseballProgressEntry, rewardAmount: number) => Promise<boolean>;
  readonly onBack: () => void;
};

const NUMBER_BASEBALL_DEFAULT_FEEDBACK = '서로 다른 숫자 3개를 골라 보세요.';
const formatNumberBaseballResult = (result: ReturnType<typeof evaluateNumberBaseballGuess>) => (
  getNumberBaseballResultDisplays(result).map((display) => display.value).join(' · ')
);

export default function StudentNumberBaseballPage({
  studentNumber,
  weekKey,
  entry,
  onSave,
  onComplete,
  onBack,
}: StudentNumberBaseballPageProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const answer = useMemo(() => createNumberBaseballAnswer(studentNumber, weekKey), [studentNumber, weekKey]);
  const status = getNumberBaseballStatus(entry, answer);
  const [selectedDigits, setSelectedDigits] = useState<readonly number[]>([]);
  const [feedback, setFeedback] = useState(NUMBER_BASEBALL_DEFAULT_FEEDBACK);
  const [isSaving, setIsSaving] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const isTerminal = status === 'completed' || status === 'exhausted';
  const remainingAttempts = NUMBER_BASEBALL_MAX_ATTEMPTS - entry.attempts.length;
  const attempts = entry.attempts;
  const outDigits = getNumberBaseballOutDigits(answer, attempts);
  const solvedReward = status === 'completed' ? getNumberBaseballReward(entry.attempts.length) : null;
  const latestAttempt = entry.attempts.at(-1);
  const latestResult = latestAttempt ? evaluateNumberBaseballGuess(answer, latestAttempt.guess) : null;
  const restoredFeedback = status === 'completed'
    ? '보상 지급을 완료했어요.'
    : status === 'exhausted'
      ? '기록을 다시 확인해 보세요.'
      : latestResult
        ? formatNumberBaseballResult(latestResult)
        : NUMBER_BASEBALL_DEFAULT_FEEDBACK;
  const displayedFeedback = feedback === NUMBER_BASEBALL_DEFAULT_FEEDBACK ? restoredFeedback : feedback;
  const latestResultFeedback = latestResult ? formatNumberBaseballResult(latestResult) : null;
  const shouldShowFeedback = !isTerminal
    && displayedFeedback !== NUMBER_BASEBALL_DEFAULT_FEEDBACK
    && displayedFeedback !== latestResultFeedback;

  useEffect(() => () => {
    if (celebrationTimeoutRef.current !== null) window.clearTimeout(celebrationTimeoutRef.current);
  }, []);

  const toggleDigit = (digit: number) => {
    if (isTerminal || isSaving) return;
    setSelectedDigits((current) => (
      current.includes(digit)
        ? current.filter((value) => value !== digit)
        : current.length < 3 ? [...current, digit] : current
    ));
  };

  const submitGuess = async () => {
    if (selectedDigits.length !== 3 || isTerminal || isSaving) {
      if (selectedDigits.length !== 3) setFeedback('서로 다른 숫자 3개를 모두 골라 주세요.');
      return;
    }
    const guess: NumberBaseballGuess = [
      selectedDigits[0] ?? 1,
      selectedDigits[1] ?? 2,
      selectedDigits[2] ?? 3,
    ];
    const nextEntry = appendNumberBaseballAttempt(entry, answer, guess);
    if (!nextEntry) return;
    const result = evaluateNumberBaseballGuess(answer, guess);
    const rewardAmount = result.strikes === 3 ? getNumberBaseballReward(nextEntry.attempts.length) : null;
    setIsSaving(true);
    const saved = rewardAmount === null
      ? await onSave(nextEntry)
      : await onComplete(nextEntry, rewardAmount);
    setIsSaving(false);
    if (!saved) {
      setFeedback('기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setSelectedDigits([]);
    if (rewardAmount !== null) {
      setIsCelebrating(true);
      if (celebrationTimeoutRef.current !== null) window.clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = window.setTimeout(() => setIsCelebrating(false), 760);
    } else if (nextEntry.attempts.length >= NUMBER_BASEBALL_MAX_ATTEMPTS) {
      setFeedback('이번 주 기회를 모두 사용했어요. 다음 주에 다시 도전해요.');
    } else {
      setFeedback(formatNumberBaseballResult(result));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      toggleDigit(Number(event.key));
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      setSelectedDigits((current) => current.slice(0, -1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitGuess();
    }
  };

  return (
    <div className="student-view student-baseball-view">
      <StudentHeader
        title={(
          <span className="student-baseball-title">
            <span className="is-coral">숫자</span>
            <span className="is-mint">야구</span>
          </span>
        )}
        onBack={onBack}
        actions={<strong className="student-baseball-attempts">남은 기회 {remainingAttempts}/9</strong>}
      />
      <main className="student-baseball-main" onKeyDown={handleKeyDown}>
        <section className="student-baseball-panel" aria-label="숫자 야구 미션">
          <div className={`student-baseball-play${isTerminal ? ` is-${status}` : ''}`}>
            {isTerminal ? (
              <div className={`student-baseball-finish is-${status}${isCelebrating ? ' is-celebrating' : ''}`} role="status">
                {status === 'completed' ? <Sparkles aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
                <div>
                  <strong>{status === 'completed' ? '정답을 맞혔어요!' : '이번 주 기회를 모두 썼어요'}</strong>
                  <span className="student-baseball-finish-details">
                    {status === 'completed' && solvedReward ? (
                      <><b>{answer.join('')}</b><em>+{solvedReward} 고마</em></>
                    ) : (
                      <>정답은 <b>{answer.join('')}</b> · 다음 주에 다시 도전해요</>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="student-baseball-slots" aria-label={`현재 입력 ${selectedDigits.join('') || '없음'}`}>
                  {(['백의 자리', '십의 자리', '일의 자리'] as const).map((label, index) => (
                    <span key={label} className={selectedDigits[index] ? 'is-filled' : ''} aria-label={label}>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {selectedDigits[index] ? (
                          <motion.b
                            key={selectedDigits[index]}
                            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'scale(.86)' }}
                            animate={{ opacity: 1, transform: 'scale(1)' }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'scale(.86)' }}
                          >
                            {selectedDigits[index]}
                          </motion.b>
                        ) : <i aria-hidden="true">?</i>}
                      </AnimatePresence>
                    </span>
                  ))}
                </div>
                <div className="student-baseball-keypad" aria-label="숫자 선택">
                  {Array.from({ length: 9 }, (_, index) => index + 1).map((digit) => {
                    const isOutDigit = outDigits.includes(digit);
                    return (
                      <button
                        type="button"
                        key={digit}
                        className={isOutDigit ? 'is-out' : undefined}
                        aria-label={isOutDigit ? `${digit}, 아웃 숫자` : `${digit}`}
                        aria-pressed={selectedDigits.includes(digit)}
                        onClick={() => toggleDigit(digit)}
                      >
                        {digit}
                      </button>
                    );
                  })}
                </div>
                <div className="student-baseball-actions">
                  <button
                    type="button"
                    className="student-baseball-delete"
                    aria-label="마지막 숫자 지우기"
                    disabled={selectedDigits.length === 0}
                    onClick={() => setSelectedDigits((current) => current.slice(0, -1))}
                  >
                    <Delete aria-hidden="true" />
                    <span>한 칸 지우기</span>
                  </button>
                  <button
                    type="button"
                    className="student-baseball-submit"
                    disabled={selectedDigits.length !== 3 || isSaving}
                    onClick={() => void submitGuess()}
                  >
                    {isSaving ? '저장 중' : '확인하기'}
                  </button>
                </div>
              </>
            )}
            {!isTerminal && shouldShowFeedback ? (
              <p className="student-baseball-feedback" aria-live="polite">
                {displayedFeedback}
              </p>
            ) : !isTerminal ? (
              <span className="sr-only" aria-live="polite">{displayedFeedback}</span>
            ) : null}
            {isCelebrating ? (
              <div className={`student-baseball-celebration is-reward-${solvedReward ?? 5}`} aria-hidden="true">
                <span className="student-baseball-celebration-halo is-outer" />
                <span className="student-baseball-celebration-halo is-inner" />
                {Array.from({ length: 12 }, (_, index) => <i key={index} className={`is-particle-${index + 1}`} />)}
              </div>
            ) : null}
          </div>

          <StudentNumberBaseballHistory answer={answer} attempts={attempts} />
        </section>
      </main>
    </div>
  );
}
