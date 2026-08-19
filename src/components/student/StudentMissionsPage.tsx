import { ArrowRight, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';
import type { AuctionMission } from '../../lib/currency';
import {
  SUDOKU_DIFFICULTIES,
  SUDOKU_REWARDS,
  type SudokuDifficulty,
} from '../../lib/sudoku';
import { useModalFocus } from '../../lib/useModalFocus';
import {
  WEEKLY_MISSION_DEFINITIONS,
  type WeeklyMissionStatuses,
} from '../../lib/weeklyMission';
import StudentHeader from './StudentHeader';
import StudentMissionCard, { type StudentMissionStatus } from './StudentMissionCard';

interface StudentMissionsPageProps {
  auctionMissions: AuctionMission[];
  weeklyMissionStatuses: WeeklyMissionStatuses;
  hasSyncError: boolean;
  isDailyEmotionMissionCompleted: boolean;
  isSudokuMissionCompleted: boolean;
  activeSudokuDifficulty: SudokuDifficulty | null;
  completedSudokuDifficulty: SudokuDifficulty | null;
  onOpenEmotions: () => void;
  onOpenSudoku: (difficulty: SudokuDifficulty) => void;
  onBack: () => void;
}

const DIFFICULTY_LABELS: Record<SudokuDifficulty, string> = {
  basic: '기본',
  challenge: '도전',
};

const DIFFICULTY_DESCRIPTIONS: Record<SudokuDifficulty, string> = {
  basic: '6×6 판에서 1부터 6까지 풀어요.',
  challenge: '9×9 판에서 1부터 9까지 풀어요.',
};

export default function StudentMissionsPage({
  auctionMissions,
  weeklyMissionStatuses,
  hasSyncError,
  isDailyEmotionMissionCompleted,
  isSudokuMissionCompleted,
  activeSudokuDifficulty,
  completedSudokuDifficulty,
  onOpenEmotions,
  onOpenSudoku,
  onBack,
}: StudentMissionsPageProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [isSudokuSettingsOpen, setIsSudokuSettingsOpen] = useState(false);
  const sudokuSettingsDialogRef = useRef<HTMLElement>(null);
  const completedWeeklyMissionCount = WEEKLY_MISSION_DEFINITIONS.filter(
    (mission) => weeklyMissionStatuses[mission.type] === 'completed',
  ).length;
  const getPresentedStatus = (status: WeeklyMissionStatuses[keyof WeeklyMissionStatuses]): StudentMissionStatus => {
    if (hasSyncError && status !== 'completed') return 'error';
    return status;
  };
  const sudokuDifficultyToOpen = activeSudokuDifficulty ?? completedSudokuDifficulty;
  const missionEntrance = (order: number) => ({
    initial: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px)' },
    animate: { opacity: 1, transform: 'translateY(0px)' },
    transition: {
      duration: shouldReduceMotion ? 0.12 : 0.22,
      delay: shouldReduceMotion ? 0 : order * 0.035,
      ease: [0.23, 1, 0.32, 1] as const,
    },
  });

  useModalFocus({
    dialogRef: sudokuSettingsDialogRef,
    isOpen: isSudokuSettingsOpen,
    onDismiss: () => setIsSudokuSettingsOpen(false),
  });

  return (
    <div className="student-view student-missions-view">
      <StudentHeader
        title="미션"
        onBack={onBack}
      />

      <main className="student-mission-groups">
        <section className="student-mission-group" aria-labelledby="daily-mission-title">
          <div className="student-group-heading">
            <h2 id="daily-mission-title">일일 미션</h2>
            <strong>{auctionMissions.length + 2}개</strong>
          </div>
          <div className="student-mission-grid">
            <motion.div {...missionEntrance(0)}>
              <StudentMissionCard
                title="감정 구슬 넣기"
                rewardAmount={5}
                status={isDailyEmotionMissionCompleted ? 'completed' : 'incomplete'}
                actionLabel={isDailyEmotionMissionCompleted ? '감정 다시 고르기' : '감정 고르기'}
                onAction={onOpenEmotions}
              />
            </motion.div>
            <motion.div {...missionEntrance(1)}>
              <StudentMissionCard
                title="스도쿠"
                description={activeSudokuDifficulty
                  ? `${DIFFICULTY_LABELS[activeSudokuDifficulty]} 문제를 풀고 있어요.`
                  : isSudokuMissionCompleted
                    ? '오늘 푼 문제를 다시 확인할 수 있어요.'
                    : '난이도를 고르고 시작해요.'}
                rewardAmount={[SUDOKU_REWARDS.basic, SUDOKU_REWARDS.challenge]}
                status={activeSudokuDifficulty ? 'inProgress' : isSudokuMissionCompleted ? 'completed' : 'incomplete'}
                actionLabel={activeSudokuDifficulty ? '이어 풀기' : isSudokuMissionCompleted ? '다시 보기' : '문제 풀기'}
                onAction={() => {
                  if (sudokuDifficultyToOpen) {
                    onOpenSudoku(sudokuDifficultyToOpen);
                    return;
                  }
                  setIsSudokuSettingsOpen(true);
                }}
              />
            </motion.div>
            {auctionMissions.map((mission, index) => (
              <motion.div key={mission.id} {...missionEntrance(index + 2)}>
                <StudentMissionCard
                  title={mission.content}
                  rewardAmount={mission.rewardAmount}
                  status="incomplete"
                  actionLabel="교실에서 수행"
                />
              </motion.div>
            ))}
          </div>
        </section>

        <section className="student-mission-group" aria-labelledby="weekly-mission-title">
          <div className="student-group-heading">
            <h2 id="weekly-mission-title">주간 미션</h2>
            <strong>{completedWeeklyMissionCount}/{WEEKLY_MISSION_DEFINITIONS.length} 완료</strong>
          </div>
          <div className="student-mission-grid">
            {WEEKLY_MISSION_DEFINITIONS.map((mission, index) => (
              <motion.div key={mission.type} {...missionEntrance(index + auctionMissions.length + 2)}>
                <StudentMissionCard
                  title={mission.label}
                  rewardAmount={mission.rewardAmount}
                  status={getPresentedStatus(weeklyMissionStatuses[mission.type])}
                  destinationUrl={mission.destinationUrl}
                  actionLabel={weeklyMissionStatuses[mission.type] === 'completed' ? '다시 방문하기' : '미션 수행하기'}
                />
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {isSudokuSettingsOpen ? (
          <motion.div
            className="student-confirm-dialog-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.1 : 0.18, ease: [0.23, 1, 0.32, 1] }}
            onClick={() => setIsSudokuSettingsOpen(false)}
          >
          <motion.section
            ref={sudokuSettingsDialogRef}
            className="student-confirm-dialog student-sudoku-settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-sudoku-settings-title"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.96)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.97)' }}
            transition={{ duration: shouldReduceMotion ? 0.1 : 0.18, ease: [0.23, 1, 0.32, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="student-confirm-dialog-close"
              aria-label="스도쿠 설정 닫기"
              onClick={() => setIsSudokuSettingsOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
            <span className="student-confirm-dialog-kicker">오늘의 스도쿠</span>
            <h2 id="student-sudoku-settings-title">난이도를 골라 주세요</h2>
            <p>한 번 시작하면 다 풀 때까지 바꿀 수 없어요.</p>
            <div className="student-sudoku-settings-options" aria-label="난이도 선택">
              {SUDOKU_DIFFICULTIES.map((difficulty) => (
                <button
                  type="button"
                  key={difficulty}
                  className={`student-sudoku-settings-option is-${difficulty}`}
                  onClick={() => {
                    setIsSudokuSettingsOpen(false);
                    onOpenSudoku(difficulty);
                  }}
                >
                  <span className="student-sudoku-settings-option-size" aria-hidden="true">
                    {difficulty === 'basic' ? '6×6' : '9×9'}
                  </span>
                  <span className="student-sudoku-settings-option-copy">
                    <span>{DIFFICULTY_LABELS[difficulty]}</span>
                    <small>{DIFFICULTY_DESCRIPTIONS[difficulty]}</small>
                  </span>
                  <span className="student-sudoku-settings-option-reward">
                    <strong>+{SUDOKU_REWARDS[difficulty]}</strong>
                    <small>고마</small>
                  </span>
                  <span className="student-sudoku-settings-option-action" aria-hidden="true">
                    이 난이도로 시작
                    <ArrowRight />
                  </span>
                </button>
              ))}
            </div>
          </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
