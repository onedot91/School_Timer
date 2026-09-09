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
import { loadStudentStorageFormDraft, readyStudentStorageDrafts, saveStudentStorageFormDraft, subscribeStudentStorageDrafts } from '../../lib/studentStorageCommand';
import { normalizeNumberBaseballInput, restoreNumberBaseballProgressDraft } from '../../lib/studentGameProgressDraft';
import StudentGameConflictNotice from './StudentGameConflictNotice';
import { loadLatestStudentGameForm, type StudentGameConflictReview } from '../../lib/useStudentGameConflict';

type StudentNumberBaseballPageProps = {
  readonly studentNumber: number;
  readonly weekKey: string;
  readonly entry: NumberBaseballProgressEntry;
  readonly hasReward: boolean;
  readonly onSave: (entry: NumberBaseballProgressEntry) => Promise<boolean>;
  readonly onComplete: (entry: NumberBaseballProgressEntry, rewardAmount: number) => Promise<boolean>;
  readonly onBack: () => void;
  readonly conflict?: StudentGameConflictReview | null;
  readonly onConflictRefresh?: () => void;
  readonly onContinueFromLatest?: () => Promise<boolean>;
};

const NUMBER_BASEBALL_DEFAULT_FEEDBACK = '서로 다른 숫자 3개를 골라 보세요.';
const formatNumberBaseballResult = (result: ReturnType<typeof evaluateNumberBaseballGuess>) => (
  getNumberBaseballResultDisplays(result).map((display) => display.value).join(' · ')
);

export default function StudentNumberBaseballPage({
  studentNumber,
  weekKey,
  entry,
  hasReward,
  onSave,
  onComplete,
  onBack,
  conflict,
  onConflictRefresh,
  onContinueFromLatest,
}: StudentNumberBaseballPageProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const answer = useMemo(() => createNumberBaseballAnswer(studentNumber, weekKey), [studentNumber, weekKey]);
  const status = getNumberBaseballStatus(entry, answer);
  const progressKey = `${studentNumber}:${weekKey}`;
  const currentConflict = conflict?.key === progressKey ? conflict : null;
  const hasConflict = !!currentConflict && currentConflict.state !== 'archived';
  const gameIdRef = useRef(entry.gameId);
  gameIdRef.current = entry.gameId;
  const inputEditedRef = useRef(false);
  const [selectedDigits, setSelectedDigits] = useState<readonly number[]>(() => normalizeNumberBaseballInput(
    loadStudentStorageFormDraft(studentNumber, 'student.baseball.input', progressKey), entry.gameId,
  ));
  const [pendingEntry, setPendingEntry] = useState<NumberBaseballProgressEntry | null>(() => (
    restoreNumberBaseballProgressDraft(studentNumber, weekKey, loadLatestStudentGameForm(studentNumber, 'baseball', progressKey)?.draft.payload)
  ));
  const pendingEntryRef = useRef(pendingEntry);
  pendingEntryRef.current = pendingEntry;
  const [feedback, setFeedback] = useState(NUMBER_BASEBALL_DEFAULT_FEEDBACK);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [confirmedCompletion, setConfirmedCompletion] = useState(false);
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
    ? hasReward || confirmedCompletion ? '보상 지급을 완료했어요.' : '저장 확인이 필요해요.'
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

  useEffect(() => {
    let active = true;
    inputEditedRef.current = false;
    savingRef.current = false;
    setIsSaving(false);
    setConfirmedCompletion(false);
    const restore = () => {
      if (!active) return;
      if (!inputEditedRef.current) setSelectedDigits(normalizeNumberBaseballInput(
        loadStudentStorageFormDraft(studentNumber, 'student.baseball.input', progressKey), entry.gameId,
      ));
      const pending = restoreNumberBaseballProgressDraft(studentNumber, weekKey, loadLatestStudentGameForm(studentNumber, 'baseball', progressKey)?.draft.payload);
      if (!savingRef.current) {
        const previous = pendingEntryRef.current;
        pendingEntryRef.current = pending;
        setPendingEntry(pending);
        if (previous && !pending) {
          const input = normalizeNumberBaseballInput(loadStudentStorageFormDraft(studentNumber, 'student.baseball.input', progressKey), entry.gameId);
          const guess = previous.attempts.at(-1)?.guess;
          if (guess && input.length === 3 && input.every((digit, index) => digit === guess[index])) {
            inputEditedRef.current = true;
            setSelectedDigits([]);
            saveStudentStorageFormDraft(studentNumber, 'student.baseball.input', { gameId: entry.gameId, digits: [] }, progressKey);
          }
        }
      }
    };
    restore();
    void readyStudentStorageDrafts().then(restore);
    const unsubscribe = subscribeStudentStorageDrafts(restore);
    return () => { active = false; unsubscribe(); };
  }, [entry.gameId, progressKey, studentNumber, weekKey]);

  const changeDigits = (digits: readonly number[]) => {
    inputEditedRef.current = true;
    saveStudentStorageFormDraft(studentNumber, 'student.baseball.input', { gameId: entry.gameId, digits }, progressKey);
    setSelectedDigits(digits);
  };

  const toggleDigit = (digit: number) => {
    if (hasConflict || isTerminal || savingRef.current || pendingEntry) return;
    changeDigits(selectedDigits.includes(digit)
      ? selectedDigits.filter((value) => value !== digit)
      : selectedDigits.length < 3 ? [...selectedDigits, digit] : selectedDigits);
  };

  const saveAttempt = async (nextEntry: NumberBaseballProgressEntry) => {
    if (hasConflict || savingRef.current) return;
    const latest = nextEntry.attempts.at(-1);
    const result = latest ? evaluateNumberBaseballGuess(answer, latest.guess) : null;
    const rewardAmount = result?.strikes === 3 ? getNumberBaseballReward(nextEntry.attempts.length) : null;
    savingRef.current = true;
    setPendingEntry(nextEntry);
    setIsSaving(true);
    const saved = rewardAmount === null
      ? await onSave(nextEntry)
      : await onComplete(nextEntry, rewardAmount);
    if (gameIdRef.current !== nextEntry.gameId) return;
    savingRef.current = false;
    setIsSaving(false);
    if (!saved) {
      setFeedback('저장을 확인하지 못했어요. 입력은 보관했어요.');
      return;
    }
    setPendingEntry(null);
    changeDigits([]);
    if (rewardAmount !== null) {
      setConfirmedCompletion(true);
      setIsCelebrating(true);
      if (celebrationTimeoutRef.current !== null) window.clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = window.setTimeout(() => setIsCelebrating(false), 760);
    } else if (nextEntry.attempts.length >= NUMBER_BASEBALL_MAX_ATTEMPTS) {
      setFeedback('이번 주 기회를 모두 사용했어요. 다음 주에 다시 도전해요.');
    } else {
      setFeedback(result ? formatNumberBaseballResult(result) : NUMBER_BASEBALL_DEFAULT_FEEDBACK);
    }
  };

  const submitGuess = async () => {
    if (hasConflict) return;
    if (pendingEntry) { await saveAttempt(pendingEntry); return; }
    if (selectedDigits.length !== 3 || isTerminal || savingRef.current) {
      if (selectedDigits.length !== 3) setFeedback('서로 다른 숫자 3개를 모두 골라 주세요.');
      return;
    }
    const guess: NumberBaseballGuess = [selectedDigits[0] ?? 1, selectedDigits[1] ?? 2, selectedDigits[2] ?? 3];
    const nextEntry = appendNumberBaseballAttempt(entry, answer, guess);
    if (nextEntry) await saveAttempt(nextEntry);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      toggleDigit(Number(event.key));
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      if (!hasConflict && !savingRef.current && !pendingEntry) changeDigits(selectedDigits.slice(0, -1));
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
          <div className={`student-baseball-play${isTerminal ? ` is-${status}` : ''}`} style={currentConflict ? { overflowY: 'auto', gridTemplateRows: 'auto', alignContent: 'start' } : undefined}>
            {currentConflict && onConflictRefresh && onContinueFromLatest ? <StudentGameConflictNotice
              review={currentConflict}
              onRefresh={onConflictRefresh}
              onAdopt={async () => {
                const continued = await onContinueFromLatest();
                if (continued) { pendingEntryRef.current = null; setPendingEntry(null); setFeedback(NUMBER_BASEBALL_DEFAULT_FEEDBACK); setConfirmedCompletion(false); }
                return continued;
              }}
            /> : null}
            {hasConflict ? null : isTerminal ? (
              <div className={`student-baseball-finish is-${status}${isCelebrating ? ' is-celebrating' : ''}`} role="status">
                {status === 'completed' ? <Sparkles aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
                <div>
                  <strong>{status === 'completed' ? '정답을 맞혔어요!' : '이번 주 기회를 모두 썼어요'}</strong>
                  <span className="student-baseball-finish-details">
                    {status === 'completed' && solvedReward && (hasReward || confirmedCompletion) ? (
                      <><b>{answer.join('')}</b><em>+{solvedReward} 고마</em></>
                    ) : status === 'completed' ? (
                      <span>{isSaving ? '저장 중' : '보상 저장 확인 필요'}</span>
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
                    disabled={selectedDigits.length === 0 || isSaving || pendingEntry !== null}
                    onClick={() => changeDigits(selectedDigits.slice(0, -1))}
                  >
                    <Delete aria-hidden="true" />
                    <span>한 칸 지우기</span>
                  </button>
                  <button
                    type="button"
                    className="student-baseball-submit"
                    disabled={(!pendingEntry && selectedDigits.length !== 3) || isSaving}
                    onClick={() => void submitGuess()}
                  >
                    {isSaving ? '저장 중' : pendingEntry ? '저장 다시 확인' : '확인하기'}
                  </button>
                </div>
              </>
            )}
            {!hasConflict && isTerminal && pendingEntry ? (
              <button type="button" className="student-baseball-submit" disabled={isSaving} onClick={() => void saveAttempt(pendingEntry)}>
                {isSaving ? '저장 중' : '저장 다시 확인'}
              </button>
            ) : null}
            {!hasConflict && !isTerminal && shouldShowFeedback ? (
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
