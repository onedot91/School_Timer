import { CheckCircle2, CloudAlert, Delete, LoaderCircle, PencilLine, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  SUDOKU_REWARDS,
  createSudokuPuzzle,
  getSudokuCompletedDigits,
  getSudokuMatchingIndices,
  getSudokuProgressKey,
  isSudokuSolved,
  type StudentSudokuProgress,
  type SudokuDifficulty,
  type SudokuProgressEntry,
} from '../../lib/sudoku';
import { getKoreanIsoWeekKey } from '../../lib/weeklyMission';
import StudentHeader from './StudentHeader';
import StudentSudokuBoard from './StudentSudokuBoard';
import StudentSudokuCelebration from './StudentSudokuCelebration';

interface StudentSudokuPageProps {
  studentNumber: number;
  difficulty: SudokuDifficulty;
  progress: StudentSudokuProgress;
  hasReward: boolean;
  onSave: (key: string, entry: SudokuProgressEntry) => Promise<boolean>;
  onComplete: (key: string, entry: SudokuProgressEntry, difficulty: SudokuDifficulty) => Promise<boolean>;
  onBack: () => void;
}

const DIFFICULTY_LABELS: Record<SudokuDifficulty, string> = {
  basic: '기본',
  challenge: '도전',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type InteractionMode = 'keyboard' | 'pointer';

export default function StudentSudokuPage({
  studentNumber,
  difficulty,
  progress,
  hasReward,
  onSave,
  onComplete,
  onBack,
}: StudentSudokuPageProps) {
  const weekKey = getKoreanIsoWeekKey();
  const puzzle = useMemo(
    () => createSudokuPuzzle(studentNumber, weekKey, difficulty),
    [difficulty, studentNumber, weekKey],
  );
  const progressKey = getSudokuProgressKey(studentNumber, weekKey, difficulty);
  const savedEntry = progress[progressKey]?.puzzleId === puzzle.id ? progress[progressKey] : undefined;
  const [cells, setCells] = useState<readonly number[]>(savedEntry?.cells ?? puzzle.puzzle);
  const [selectedIndex, setSelectedIndex] = useState(() => puzzle.puzzle.findIndex((value) => value === 0));
  const [feedback, setFeedback] = useState('빈칸을 선택하고 숫자를 입력하세요.');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('pointer');
  const [lastEditedIndex, setLastEditedIndex] = useState<number | null>(null);
  const [feedbackSequence, setFeedbackSequence] = useState(0);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const completionInFlightRef = useRef(false);
  const loadedPuzzleIdRef = useRef<string | null>(null);
  const saveSequenceRef = useRef(0);
  const savedStateTimeoutRef = useRef<number | null>(null);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const matchingIndices = useMemo(
    () => getSudokuMatchingIndices(cells, selectedIndex),
    [cells, selectedIndex],
  );
  const completedDigits = useMemo(() => getSudokuCompletedDigits(cells), [cells]);
  const isCompleted = (
    savedEntry?.completedAt !== null && savedEntry?.completedAt !== undefined
  ) || hasReward;
  const selectedValue = cells[selectedIndex] ?? 0;

  const showSavedState = () => {
    if (savedStateTimeoutRef.current !== null) window.clearTimeout(savedStateTimeoutRef.current);
    setSaveState('saved');
    savedStateTimeoutRef.current = window.setTimeout(() => setSaveState('idle'), 1200);
  };

  useEffect(() => () => {
    if (savedStateTimeoutRef.current !== null) window.clearTimeout(savedStateTimeoutRef.current);
    if (celebrationTimeoutRef.current !== null) window.clearTimeout(celebrationTimeoutRef.current);
  }, []);

  useEffect(() => {
    const nextCells = savedEntry?.cells ?? puzzle.puzzle;
    const isNewPuzzle = loadedPuzzleIdRef.current !== puzzle.id;
    const hasDifferentCells = cells.some((value, index) => value !== nextCells[index]);
    if (isNewPuzzle || hasDifferentCells) {
      setCells(nextCells);
      setSelectedIndex(puzzle.puzzle.findIndex((value) => value === 0));
      setFeedback(isCompleted ? '이번 주 보상을 받았습니다.' : '빈칸을 선택하고 숫자를 입력하세요.');
      setSaveState('idle');
      setLastEditedIndex(null);
      setIsCelebrating(false);
      completionInFlightRef.current = false;
    } else if (isCompleted && !completionInFlightRef.current) {
      setFeedback('이번 주 보상을 받았습니다.');
      setSaveState('idle');
    }
    loadedPuzzleIdRef.current = puzzle.id;
  }, [isCompleted, progressKey, puzzle, savedEntry?.cells]);

  const commitCells = (nextCells: readonly number[], mode: InteractionMode) => {
    if (isCompleted || selectedIndex < 0 || puzzle.puzzle[selectedIndex] !== 0) return;
    setCells(nextCells);
    setInteractionMode(mode);
    setLastEditedIndex(selectedIndex);
    setFeedbackSequence((current) => current + 1);
    setFeedback('빈칸을 선택하고 숫자를 입력하세요.');

    const entry: SudokuProgressEntry = { puzzleId: puzzle.id, cells: nextCells, completedAt: null };
    const sequence = saveSequenceRef.current + 1;
    saveSequenceRef.current = sequence;
    setSaveState('saving');
    if (isSudokuSolved(puzzle, nextCells) && !completionInFlightRef.current) {
      completionInFlightRef.current = true;
      void onComplete(progressKey, entry, difficulty).then((saved) => {
        if (saved) {
          setFeedback(`${DIFFICULTY_LABELS[difficulty]} 미션 완료! ${SUDOKU_REWARDS[difficulty]} 고마를 받았어요.`);
          setIsCelebrating(true);
          celebrationTimeoutRef.current = window.setTimeout(() => setIsCelebrating(false), 760);
        }
        else {
          completionInFlightRef.current = false;
          setFeedback('보상을 저장하지 못했습니다. 잠시 후 다시 시도하세요.');
        }
        if (saveSequenceRef.current === sequence) setSaveState(saved ? 'saved' : 'error');
      });
      return;
    }
    void onSave(progressKey, entry).then((saved) => {
      if (saveSequenceRef.current === sequence) {
        if (saved) showSavedState();
        else setSaveState('error');
      }
      if (!saved) setFeedback('입력을 저장하지 못했습니다. 연결을 확인하세요.');
    });
  };

  const enterDigit = (digit: number, mode: InteractionMode) => {
    if (selectedIndex < 0 || puzzle.puzzle[selectedIndex] !== 0 || completedDigits.has(digit)) return;
    const nextCells = [...cells];
    nextCells[selectedIndex] = digit;
    commitCells(nextCells, mode);
  };

  const moveSelection = (rowOffset: number, columnOffset: number) => {
    if (selectedIndex < 0) return;
    const row = Math.floor(selectedIndex / puzzle.gridSize);
    const column = selectedIndex % puzzle.gridSize;
    setInteractionMode('keyboard');
    setSelectedIndex(
      Math.max(0, Math.min(puzzle.gridSize - 1, row + rowOffset)) * puzzle.gridSize
        + Math.max(0, Math.min(puzzle.gridSize - 1, column + columnOffset)),
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (/^[1-9]$/.test(event.key) && Number(event.key) <= puzzle.gridSize) {
      event.preventDefault();
      enterDigit(Number(event.key), 'keyboard');
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault();
      enterDigit(0, 'keyboard');
      return;
    }
    const movementByKey: Partial<Record<string, readonly [number, number]>> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    const movement = movementByKey[event.key];
    if (!movement) return;
    event.preventDefault();
    moveSelection(movement[0], movement[1]);
  };

  return (
    <div className={`student-view student-sudoku-view is-${difficulty}`}>
      <StudentHeader
        title="스도쿠"
        onBack={onBack}
        actions={(
          <div className="student-sudoku-header-state" aria-label={`현재 ${DIFFICULTY_LABELS[difficulty]} 난이도, ${SUDOKU_REWARDS[difficulty]} 고마, 매주 월요일 새 문제로 바뀌어요`}>
            <strong>{DIFFICULTY_LABELS[difficulty]}</strong>
            <span>+{SUDOKU_REWARDS[difficulty]} 고마</span><span className="student-sudoku-weekly-note">매주 월요일 새 문제로 바뀌어요</span>
            {isCompleted || saveState !== 'idle' ? (
              <span className={`student-sudoku-save-state is-${saveState}`} role="status" aria-live="polite">
                {isCompleted ? <CheckCircle2 size={18} aria-hidden="true" /> : null}
                {saveState === 'saving' ? <LoaderCircle className="student-spin" size={18} aria-hidden="true" /> : null}
                {!isCompleted && saveState === 'saved' ? <CheckCircle2 size={18} aria-hidden="true" /> : null}
                {!isCompleted && saveState === 'error' ? <CloudAlert size={18} aria-hidden="true" /> : null}
                {isCompleted ? '완료' : saveState === 'saving' ? '저장 중' : saveState === 'saved' ? '저장됨' : '저장 오류'}
              </span>
            ) : null}
          </div>
        )}
      />
      <main className="student-sudoku-main" onKeyDown={handleKeyDown}>
        <section className="student-sudoku-panel" aria-label="스도쿠 미션">
          <div className="student-sudoku-workspace">
            <div className={`student-sudoku-board-stage ${isCompleted ? 'is-completed' : ''}`}>
              <StudentSudokuBoard
                cells={cells}
                puzzleCells={puzzle.puzzle}
                selectedIndex={selectedIndex}
                matchingIndices={matchingIndices}
                lastEditedIndex={lastEditedIndex}
                feedbackSequence={feedbackSequence}
                interactionMode={interactionMode}
                difficultyLabel={DIFFICULTY_LABELS[difficulty]}
                gridSize={puzzle.gridSize}
                boxRows={puzzle.boxRows}
                boxColumns={puzzle.boxColumns}
                onSelect={(index, mode) => {
                  setInteractionMode(mode);
                  setSelectedIndex(index);
                }}
              />
              <StudentSudokuCelebration isActive={isCelebrating} />
            </div>

            <div className="student-sudoku-controls">
              <p className={saveState === 'error' ? 'is-error' : isCompleted ? 'is-complete' : ''} aria-live="polite">
                {saveState === 'error'
                  ? <TriangleAlert size={20} aria-hidden="true" />
                  : isCompleted
                    ? <CheckCircle2 size={20} aria-hidden="true" />
                    : <PencilLine size={20} aria-hidden="true" />}
                <span>{feedback}</span>
              </p>
              <div className="student-sudoku-keypad" aria-label="숫자 입력">
                {Array.from({ length: puzzle.gridSize }, (_, index) => index + 1).map((digit) => (
                  <button
                    type="button"
                    key={digit}
                    className={`${selectedValue === digit ? 'is-current' : ''} ${completedDigits.has(digit) ? 'is-complete' : ''}`}
                    aria-pressed={selectedValue === digit}
                    aria-hidden={completedDigits.has(digit)}
                    tabIndex={completedDigits.has(digit) ? -1 : undefined}
                    onClick={(event) => enterDigit(digit, event.detail === 0 ? 'keyboard' : 'pointer')}
                    disabled={isCompleted || completedDigits.has(digit)}
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  className="student-sudoku-erase"
                  onClick={(event) => enterDigit(0, event.detail === 0 ? 'keyboard' : 'pointer')}
                  disabled={isCompleted}
                >
                  <Delete size={20} aria-hidden="true" />
                  지우기
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
