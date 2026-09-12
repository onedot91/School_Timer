import '../../classword.css';
import { CheckCircle2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getKoreanDateKey, type ClasswordBoard as ClasswordBoardData, type ClasswordInitial } from '../../lib/classword';
import { browserDraftStorage } from '../../lib/featureInputDraft';
import type { ClasswordQuizStudentState } from '../../lib/classwordQuiz';
import { EMPTY_CLASSWORD_DRAFT, readyClasswordDraft, classwordDraftVersion, confirmClasswordDraft, settleClasswordDraft, storeClasswordDraft, type ClasswordDraft } from '../../lib/classwordDraft';
import { getClasswordDisplayDate, isClasswordWeekday } from '../../lib/classwordSchedule';
import { playClasswordSound } from '../../lib/classwordAudio';
import {
  CLASSWORD_LOCAL_CHANGE_EVENT,
  ClasswordClientError,
  loadClasswordBoard,
  loadClasswordQuizStudentState,
  removeClasswordEntry,
  saveClasswordEntry,
  submitClasswordQuizAnswer,
} from '../../lib/classwordClient';
import type { FailureProfileAssignments } from '../../lib/failureExhibition';
import ClasswordBoard, { type ClasswordSaveResult } from './ClasswordBoard';
import ClasswordQuiz from './ClasswordQuiz';
import StudentHeader from './StudentHeader';

type StudentClasswordPageProps = {
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly onRewardBalance: (balance: number) => void;
  readonly onMissionSubmitted: (awarded: boolean) => void;
  readonly onBack: () => void;
};

const EMPTY_BOARD: ClasswordBoardData = {
  dateKey: '2000-01-01',
  topic: '',
  entries: [],
};

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  CLASSWORD_REWARD_PENDING: '보유 고마 한도 때문에 지급하지 못했어요. 선생님께 알려 주세요.',
  CLASSWORD_REWARD_LIMIT_EXCEEDED: '보유 고마 한도 때문에 지급하지 못했어요. 선생님께 알려 주세요.',
  CLASSWORD_REWARD_EVIDENCE_MISMATCH: '보상 기록을 확인해야 해요. 선생님께 알려 주세요.',
  CLASSWORD_CONFIRMATION_REQUIRED: '지급 확인 중이에요. 같은 정답으로 다시 시도해 주세요.',
  CLASSWORD_REWARD_SAVE_FAILED: '보상을 저장하지 못했어요. 같은 정답으로 다시 시도해 주세요.',
  empty: '낱말을 입력해 주세요.',
  same_topic: '주제와 다른 낱말을 찾아 주세요.',
  number_only: '숫자만 쓸 수 없어요.',
  special_character: '특수 문자는 쓸 수 없어요.',
  too_long: '낱말은 8글자까지 쓸 수 있어요.',
  jamo_only: '완성된 한글 낱말을 써 주세요.',
  repeated_character: '다른 낱말을 써 주세요.',
  blocked_word: '다른 낱말을 써 주세요.',
  non_korean_start: '한글 낱말로 시작해 주세요.',
  wrong_initial: '선택한 초성으로 시작하는 낱말을 써 주세요.',
  CLASSWORD_ENTRY_CHANGED: '다른 화면에서 내 낱말이 바뀌었어요. 확인한 뒤 다시 저장해 주세요.',
  CLASSWORD_STUDENT_ALREADY_ENTERED: '오늘은 한 칸만 채울 수 있어요.',
  CLASSWORD_INITIAL_OCCUPIED: '방금 다른 친구가 이 칸을 채웠어요.',
  CLASSWORD_ENTRY_CONFLICT: '방금 다른 친구가 이 칸을 채웠어요.',
  CLASSWORD_TOPIC_REQUIRED: '오늘의 주제가 아직 정해지지 않았어요.',
  BACKEND_WRITE_DISABLED: '읽기 전용 모드에서는 낱말을 바꿀 수 없어요.',
  CLASSWORD_WEEKEND_CLOSED: '주말에는 쉬어요. 월요일에 다시 만나요.',
  TODAY_ONLY: '날짜가 바뀌었어요. 오늘 낱말판을 확인해 주세요.',
  STORAGE_PROTOCOL_REQUIRED: '화면을 새로고침한 뒤 다시 저장해 주세요.',
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ClasswordClientError) return ERROR_MESSAGES[error.code] ?? '낱말판을 저장하지 못했어요.';
  return '낱말판을 저장하지 못했어요.';
};

export default function StudentClasswordPage({
  studentNumber,
  profileAssignments,
  onRewardBalance,
  onMissionSubmitted,
  onBack,
}: StudentClasswordPageProps) {
  const reducedMotion = useReducedMotion();
  const [board, setBoard] = useState<ClasswordBoardData>(EMPTY_BOARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quizState, setQuizState] = useState<ClasswordQuizStudentState | null>(null);
  const [quizLoading, setQuizLoading] = useState(true);
  const [quizSaving, setQuizSaving] = useState(false);
  const [quizLoadError, setQuizLoadError] = useState('');
  const [feedback, setFeedback] = useState<{ readonly kind: 'status' | 'error'; readonly message: string } | null>(null);
  const completionCountRef = useRef(0);
  const readGenerationRef = useRef(0);
  const boardReadSequenceRef = useRef(0);
  const quizReadSequenceRef = useRef(0);
  const [dateKey, setDateKey] = useState(getKoreanDateKey);
  const displayDateKey = getClasswordDisplayDate(dateKey);
  const readOnly = !isClasswordWeekday(dateKey);
  const currentBoard = board.dateKey === displayDateKey
    ? board
    : { ...EMPTY_BOARD, dateKey: displayDateKey };
  const currentQuizState = quizState?.dateKey === displayDateKey ? quizState : null;
  const [initialDraft, setInitialDraft] = useState<ClasswordDraft>(EMPTY_CLASSWORD_DRAFT);
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    let active = true;
    setDraftReady(false);
    void readyClasswordDraft(browserDraftStorage(), studentNumber, displayDateKey).then((draft) => {
      if (active) { setInitialDraft(draft); setDraftReady(true); }
    });
    return () => { active = false; };
  }, [studentNumber, displayDateKey]);
  const draftCheckSequence = useRef(0);
  const saveDraft = (draft: ClasswordDraft): void => {
    const sequence = ++draftCheckSequence.current;
    storeClasswordDraft(browserDraftStorage(), studentNumber, displayDateKey, draft);
    void settleClasswordDraft(browserDraftStorage(), studentNumber, displayDateKey).then((saved) => {
      if (sequence !== draftCheckSequence.current) return;
      if (!saved) setFeedback({ kind: 'error', message: '이 기기에 임시 보관하지 못했어요.' });
      else setFeedback(current => current?.message === '이 기기에 임시 보관하지 못했어요.' ? null : current);
    });
  };

  const refresh = useCallback(async (): Promise<void> => {
    const generation = readGenerationRef.current;
    const sequence = ++boardReadSequenceRef.current;
    try {
      const nextBoard = await loadClasswordBoard(displayDateKey);
      if (getKoreanDateKey() !== dateKey || generation !== readGenerationRef.current || sequence !== boardReadSequenceRef.current) return;
      setBoard(nextBoard);
      setLoading(false);
      if (!readOnly && nextBoard.entries.length === 14) {
        if (completionCountRef.current < 14) void playClasswordSound('complete');
      }
      completionCountRef.current = nextBoard.entries.length;
    } catch (error) {
      if (getKoreanDateKey() !== dateKey || generation !== readGenerationRef.current || sequence !== boardReadSequenceRef.current) return;
      setLoading(false);
      setFeedback({ kind: 'error', message: getErrorMessage(error) });
    }
  }, [dateKey, displayDateKey, readOnly]);

  const refreshQuiz = useCallback(async (): Promise<void> => {
    const generation = readGenerationRef.current;
    const sequence = ++quizReadSequenceRef.current;
    try {
      const nextState = await loadClasswordQuizStudentState(displayDateKey, studentNumber);
      if (getKoreanDateKey() !== dateKey || generation !== readGenerationRef.current || sequence !== quizReadSequenceRef.current) return;
      setQuizState(nextState);
      setQuizLoadError('');
    } catch {
      if (getKoreanDateKey() !== dateKey || generation !== readGenerationRef.current || sequence !== quizReadSequenceRef.current) return;
      setQuizLoadError('낱말 퀴즈를 불러오지 못했어요.');
    } finally {
      if (getKoreanDateKey() === dateKey) setQuizLoading(false);
    }
  }, [dateKey, displayDateKey, studentNumber]);

  useEffect(() => {
    setLoading(true);
    setQuizLoading(true);
    setFeedback(null);
    setQuizLoadError('');
    completionCountRef.current = 0;
    void refresh();
    void refreshQuiz();
    const refreshOnReturn = () => {
      const today = getKoreanDateKey();
      if (today !== dateKey) {
        setDateKey(today);
        return;
      }
      if (document.visibilityState === 'visible') {
        void refresh();
        void refreshQuiz();
      }
    };
    const interval = window.setInterval(refreshOnReturn, 3000);
    const midnight = Date.parse(`${dateKey}T00:00:00+09:00`) + 86_400_000;
    const rollover = window.setTimeout(refreshOnReturn, Math.max(1, midnight - Date.now()));
    window.addEventListener('focus', refreshOnReturn);
    window.addEventListener(CLASSWORD_LOCAL_CHANGE_EVENT, refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(rollover);
      window.removeEventListener('focus', refreshOnReturn);
      window.removeEventListener(CLASSWORD_LOCAL_CHANGE_EVENT, refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [dateKey, refresh, refreshQuiz]);

  const submitQuiz = async (answer: string): Promise<boolean> => {
    const today = getKoreanDateKey();
    if (!isClasswordWeekday(today) || today !== dateKey || quizSaving || quizLoading) {
      setDateKey(today);
      return false;
    }
    readGenerationRef.current += 1;
    setQuizSaving(true);
    try {
      const result = await submitClasswordQuizAnswer({ dateKey, studentNumber, answer, expectedQuestionId: currentQuizState?.question.id });
      readGenerationRef.current += 1;
      if (result.balance !== null) onRewardBalance(result.balance);
      if (getKoreanDateKey() !== dateKey) return result.correct;
      setQuizState(result.correct
        ? { ...result.state, rewardAmount: result.rewardAmount }
        : result.state);
      setQuizLoadError('');
      void playClasswordSound(result.correct ? 'success' : 'error');
      return result.correct;
    } catch (error) {
      if (getKoreanDateKey() !== dateKey) throw error;
      const message = getErrorMessage(error);
      setQuizLoadError(message === '낱말판을 저장하지 못했어요.'
        ? '정답을 확인하지 못했어요.'
        : message);
      void playClasswordSound('error');
      throw error;
    } finally {
      setQuizSaving(false);
    }
  };

  const save = async (input: {
    readonly entryId?: string;
    readonly expectedRevision?: string;
    readonly initial: ClasswordInitial;
    readonly word: string;
  }): Promise<ClasswordSaveResult> => {
    const today = getKoreanDateKey();
    if (!isClasswordWeekday(today) || today !== dateKey || saving || loading) {
      setDateKey(today);
      return 'error';
    }
    readGenerationRef.current += 1;
    setSaving(true);
    setFeedback(null);
    const submittedDraftVersion = classwordDraftVersion(browserDraftStorage(), studentNumber, displayDateKey);
    try {
      const result = await saveClasswordEntry({
        ...input,
        dateKey,
        studentNumber,
      }, currentBoard.topic);
      readGenerationRef.current += 1;
      if (submittedDraftVersion) await confirmClasswordDraft(browserDraftStorage(), studentNumber, displayDateKey, submittedDraftVersion);
      if (result.balance !== null) onRewardBalance(result.balance);
      if (getKoreanDateKey() !== dateKey) return 'saved';
      setBoard((currentBoard) => ({
        ...currentBoard,
        entries: [
          ...currentBoard.entries.filter((entry) => (
            entry.id !== result.entry.id && entry.studentNumber !== studentNumber
          )),
          result.entry,
        ],
      }));
      void playClasswordSound('success');
      onMissionSubmitted(result.awarded);
      return 'saved';
    } catch (error) {
      if (getKoreanDateKey() !== dateKey) return 'error';
      const message = getErrorMessage(error);
      const conflict = error instanceof ClasswordClientError
        && (error.code === 'CLASSWORD_ENTRY_CONFLICT' || error.code === 'CLASSWORD_INITIAL_OCCUPIED'
          || error.code === 'CLASSWORD_STUDENT_ALREADY_ENTERED' || error.code === 'CLASSWORD_ENTRY_CHANGED');
      setFeedback({ kind: 'error', message });
      void playClasswordSound('error');
      void refresh();
      return conflict ? 'conflict' : 'error';
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entryId: string): Promise<boolean> => {
    const today = getKoreanDateKey();
    if (!isClasswordWeekday(today) || today !== dateKey || saving || loading) {
      setDateKey(today);
      return false;
    }
    readGenerationRef.current += 1;
    setSaving(true);
    setFeedback(null);
    const submittedDraftVersion = classwordDraftVersion(browserDraftStorage(), studentNumber, displayDateKey);
    try {
      await removeClasswordEntry(entryId, studentNumber);
      if (submittedDraftVersion) await confirmClasswordDraft(browserDraftStorage(), studentNumber, displayDateKey, submittedDraftVersion);
      readGenerationRef.current += 1;
      if (getKoreanDateKey() !== dateKey) return true;
      setBoard((currentBoard) => ({
        ...currentBoard,
        entries: currentBoard.entries.filter((entry) => entry.id !== entryId),
      }));
      return true;
    } catch (error) {
      if (getKoreanDateKey() !== dateKey) return false;
      setFeedback({ kind: 'error', message: getErrorMessage(error) });
      void playClasswordSound('error');
      void refresh();
      return false;
    } finally {
      setSaving(false);
    }
  };

  const completed = !readOnly && currentBoard.entries.length === 14;
  const topicCopy = loading
    ? { lead: '오늘의 낱말판을 ', emphasis: '펼치는 중이에요.' }
    : currentBoard.topic
      ? { lead: displayDateKey !== dateKey ? '금요일의 주제는 ' : '오늘의 주제는 ', emphasis: currentBoard.topic, trailing: '입니다.' }
      : { lead: '오늘의 주제를 ', emphasis: '준비하고 있어요.' };
  return (
    <div className="student-view student-classword-view">
      <StudentHeader
        title={(
          <span className="classword-header-topic">
            <span>{topicCopy.lead}</span>
            <strong>{topicCopy.emphasis}</strong>
            {'trailing' in topicCopy ? <span>{topicCopy.trailing}</span> : null}
          </span>
        )}
        onBack={onBack}
        backLabel="미션으로 돌아가기"
        backText="미션"
        status={readOnly ? <span role="status">{displayDateKey !== dateKey ? '주말에는 쉬어요 · 금요일 낱말판' : '주말에는 쉬어요'}</span> : undefined}
      />

      <main className={`classword-paper${completed ? ' is-complete' : ''}`} aria-busy={loading || saving || quizSaving}>
        {feedback ? (
          <p className={`classword-feedback is-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
            {feedback.message}
          </p>
        ) : null}
        {completed ? (
          <motion.div
            className="classword-complete-banner"
            initial={reducedMotion ? false : { opacity: 0, transform: 'scale(0.96)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            role="status"
          >
            <CheckCircle2 aria-hidden="true" /> 열네 칸 완성!
            {reducedMotion ? null : <span className="classword-particles" aria-hidden="true" />}
          </motion.div>
        ) : null}
        {draftReady ? <ClasswordBoard
          key={`${studentNumber}:${displayDateKey}`}
          board={currentBoard}
          initialDraft={initialDraft}
          onDraftChange={saveDraft}
          studentNumber={studentNumber}
          profileAssignments={profileAssignments}
          disabled={readOnly || loading || !currentBoard.topic}
          saving={saving}
          onSave={save}
          onDelete={remove}
          onSelect={() => {
            setFeedback(null);
            void playClasswordSound('select');
          }}
        /> : null}
        <ClasswordQuiz
          key={`${dateKey}:${studentNumber}:${currentQuizState?.question.id ?? 'loading'}`}
          studentNumber={studentNumber}
          state={currentQuizState}
          loading={quizLoading}
          saving={quizSaving}
          readOnly={readOnly}
          loadError={quizLoadError}
          onSubmit={submitQuiz}
        />
      </main>
    </div>
  );
}
