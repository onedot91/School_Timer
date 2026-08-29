import { CheckCircle2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getKoreanDateKey, type ClasswordBoard as ClasswordBoardData, type ClasswordInitial } from '../../lib/classword';
import type { ClasswordQuizStudentState } from '../../lib/classwordQuiz';
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
  readonly onMissionCompleted: () => void;
  readonly onBack: () => void;
};

const EMPTY_BOARD: ClasswordBoardData = {
  dateKey: '2000-01-01',
  topic: '',
  entries: [],
};

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
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
  CLASSWORD_STUDENT_ALREADY_ENTERED: '오늘은 한 칸만 채울 수 있어요.',
  CLASSWORD_INITIAL_OCCUPIED: '방금 다른 친구가 이 칸을 채웠어요.',
  CLASSWORD_ENTRY_CONFLICT: '방금 다른 친구가 이 칸을 채웠어요.',
  CLASSWORD_TOPIC_REQUIRED: '오늘의 주제가 아직 정해지지 않았어요.',
  BACKEND_WRITE_DISABLED: '읽기 전용 모드에서는 낱말을 바꿀 수 없어요.',
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ClasswordClientError) return ERROR_MESSAGES[error.code] ?? '낱말판을 저장하지 못했어요.';
  return '낱말판을 저장하지 못했어요.';
};

export default function StudentClasswordPage({
  studentNumber,
  profileAssignments,
  onRewardBalance,
  onMissionCompleted,
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
  const dateKey = getKoreanDateKey();

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const nextBoard = await loadClasswordBoard(dateKey);
      setBoard(nextBoard);
      setLoading(false);
      if (nextBoard.entries.length === 14) {
        if (completionCountRef.current < 14) void playClasswordSound('complete');
      }
      completionCountRef.current = nextBoard.entries.length;
    } catch (error) {
      setLoading(false);
      setFeedback({ kind: 'error', message: getErrorMessage(error) });
    }
  }, [dateKey]);

  const refreshQuiz = useCallback(async (): Promise<void> => {
    try {
      const nextState = await loadClasswordQuizStudentState(dateKey, studentNumber);
      setQuizState(nextState);
      setQuizLoadError('');
    } catch {
      setQuizLoadError('낱말 퀴즈를 불러오지 못했어요.');
    } finally {
      setQuizLoading(false);
    }
  }, [dateKey, studentNumber]);

  useEffect(() => {
    void refresh();
    void refreshQuiz();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
        void refreshQuiz();
      }
    }, 3000);
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
        void refreshQuiz();
      }
    };
    window.addEventListener('focus', refreshOnReturn);
    window.addEventListener(CLASSWORD_LOCAL_CHANGE_EVENT, refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnReturn);
      window.removeEventListener(CLASSWORD_LOCAL_CHANGE_EVENT, refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [refresh, refreshQuiz]);

  const submitQuiz = async (answer: string): Promise<boolean> => {
    setQuizSaving(true);
    try {
      const result = await submitClasswordQuizAnswer({ dateKey, studentNumber, answer });
      setQuizState(result.state);
      setQuizLoadError('');
      void playClasswordSound(result.correct ? 'success' : 'error');
      return result.correct;
    } catch (error) {
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
    readonly initial: ClasswordInitial;
    readonly word: string;
  }): Promise<ClasswordSaveResult> => {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await saveClasswordEntry({
        ...input,
        dateKey,
        studentNumber,
      }, board.topic);
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
      onMissionCompleted();
      if (result.balance !== null) onRewardBalance(result.balance);
      return 'saved';
    } catch (error) {
      const message = getErrorMessage(error);
      const conflict = error instanceof ClasswordClientError
        && (error.code === 'CLASSWORD_ENTRY_CONFLICT' || error.code === 'CLASSWORD_INITIAL_OCCUPIED');
      setFeedback({ kind: 'error', message });
      void playClasswordSound('error');
      void refresh();
      return conflict ? 'conflict' : 'error';
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entryId: string): Promise<boolean> => {
    setSaving(true);
    setFeedback(null);
    try {
      await removeClasswordEntry(entryId, studentNumber);
      setBoard((currentBoard) => ({
        ...currentBoard,
        entries: currentBoard.entries.filter((entry) => entry.id !== entryId),
      }));
      return true;
    } catch (error) {
      setFeedback({ kind: 'error', message: getErrorMessage(error) });
      void playClasswordSound('error');
      void refresh();
      return false;
    } finally {
      setSaving(false);
    }
  };

  const completed = board.entries.length === 14;
  const topicCopy = loading
    ? { lead: '오늘의 낱말판을 ', emphasis: '펼치는 중이에요.' }
    : board.topic
      ? { lead: '오늘의 주제는 ', emphasis: board.topic, trailing: '입니다.' }
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
        <ClasswordBoard
          board={board}
          studentNumber={studentNumber}
          profileAssignments={profileAssignments}
          disabled={loading || !board.topic}
          saving={saving}
          onSave={save}
          onDelete={remove}
          onSelect={() => {
            setFeedback(null);
            void playClasswordSound('select');
          }}
        />
        <ClasswordQuiz
          state={quizState}
          loading={quizLoading}
          saving={quizSaving}
          loadError={quizLoadError}
          onSubmit={submitQuiz}
        />
      </main>
    </div>
  );
}
