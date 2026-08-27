import { ArrowRight, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRef, useState, type CSSProperties } from 'react';
import type { AuctionMission } from '../../lib/currency';
import { NUMBER_BASEBALL_REWARDS, type NumberBaseballStatus } from '../../lib/numberBaseball';
import {
  getSudokuRules,
  SUDOKU_DIFFICULTIES,
  SUDOKU_REWARDS,
  type SudokuDifficulty,
} from '../../lib/sudoku';
import { useModalFocus } from '../../lib/useModalFocus';
import {
  BOOK_STACK_WEEKLY_REWARD,
  FAILURE_EXHIBITION_WEEKLY_REWARD,
  PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
  WEEKLY_MISSION_DEFINITIONS,
  type WeeklyMissionStatuses,
} from '../../lib/weeklyMission';
import StudentBalanceSummary from './StudentBalanceSummary';
import StudentHeader from './StudentHeader';
import StudentMissionCard, {
  StudentMissionStatusFace,
  StudentMissionTeacherFace,
  type StudentMissionStatus,
} from './StudentMissionCard';
import type { FailureProfileAssignments } from '../../lib/failureExhibition';
import { DAILY_WRITING_REWARD } from '../../lib/dailyWriting';
import {
  CLASSROOM_ROLE_MISSION_REWARD,
  getStudentClassroomRole,
  getTodayClassroomRoleDateKey,
  type ClassroomRoleMissionSettings,
} from '../../lib/classroomRoleMission';

interface StudentMissionsPageProps {
  studentNumber: number;
  profileAssignments: FailureProfileAssignments;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading: boolean;
  auctionMissions: AuctionMission[];
  classroomRoleMission: ClassroomRoleMissionSettings;
  weeklyMissionStatuses: WeeklyMissionStatuses;
  hasSyncError: boolean;
  isDailyEmotionMissionCompleted: boolean;
  hasDailyWritingMission: boolean;
  isDailyWritingMissionCompleted: boolean;
  isWeeklySudokuMissionCompleted: boolean;
  isFailureExhibitionMissionCompleted: boolean;
  isBookStackMissionCompleted: boolean;
  activeSudokuDifficulty: SudokuDifficulty | null;
  completedSudokuDifficulty: SudokuDifficulty | null;
  numberBaseballStatus: NumberBaseballStatus;
  onOpenEmotions: () => void;
  onOpenMailbox: () => void;
  onOpenFailureExhibition: () => void;
  onOpenBookStack: () => void;
  onOpenSudoku: (difficulty: SudokuDifficulty) => void;
  onOpenNumberBaseball: () => void;
  onBack: () => void;
}

const DIFFICULTY_LABELS: Record<SudokuDifficulty, string> = {
  basic: '기본',
  challenge: '도전',
};

const StudentSudokuPreview = ({ difficulty }: { difficulty: SudokuDifficulty }) => {
  const { gridSize, boxRows, boxColumns } = getSudokuRules(difficulty);
  const cells = Array.from({ length: gridSize * gridSize }, (_, index) => {
    const row = Math.floor(index / gridSize);
    const column = index % gridSize;
    const value = (row * boxColumns + Math.floor(row / boxRows) + column) % gridSize + 1;
    return (row * 2 + column) % 4 === 1 ? 0 : value;
  });

  return (
    <span
      className={`student-sudoku-settings-preview is-${difficulty}`}
      style={{ '--student-sudoku-preview-size': gridSize } as CSSProperties}
      aria-hidden="true"
    >
      {cells.map((value, index) => {
        const row = Math.floor(index / gridSize);
        const column = index % gridSize;
        const isBoxEndColumn = (column + 1) % boxColumns === 0 && column + 1 < gridSize;
        const isBoxEndRow = (row + 1) % boxRows === 0 && row + 1 < gridSize;
        return (
          <span
            key={index}
            className={`${value === 0 ? 'is-empty' : ''} ${isBoxEndColumn ? 'is-box-end-column' : ''} ${isBoxEndRow ? 'is-box-end-row' : ''}`}
          >
            {value || ''}
          </span>
        );
      })}
    </span>
  );
};

const TEACHER_MISSION_ILLUSTRATION_PATHS = [
  '/mission-illustrations/teacher-mission-1.png',
  '/mission-illustrations/teacher-mission-2.png',
  '/mission-illustrations/teacher-mission-3.png',
  '/mission-illustrations/teacher-mission-4.png',
] as const;

export default function StudentMissionsPage({
  studentNumber,
  profileAssignments,
  balance,
  availableBalance,
  reservedAmount,
  isLoading,
  auctionMissions,
  classroomRoleMission,
  weeklyMissionStatuses,
  hasSyncError,
  isDailyEmotionMissionCompleted,
  hasDailyWritingMission,
  isDailyWritingMissionCompleted,
  isWeeklySudokuMissionCompleted,
  isFailureExhibitionMissionCompleted,
  isBookStackMissionCompleted,
  activeSudokuDifficulty,
  completedSudokuDifficulty,
  numberBaseballStatus,
  onOpenEmotions,
  onOpenMailbox,
  onOpenFailureExhibition,
  onOpenBookStack,
  onOpenSudoku,
  onOpenNumberBaseball,
  onBack,
}: StudentMissionsPageProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [isSudokuSettingsOpen, setIsSudokuSettingsOpen] = useState(false);
  const sudokuSettingsDialogRef = useRef<HTMLElement>(null);
  const sudokuSettingsTriggerRef = useRef<HTMLElement>(null);
  const completedExternalWeeklyMissionCount = WEEKLY_MISSION_DEFINITIONS.filter(
    (mission) => weeklyMissionStatuses[mission.type] === 'completed',
  ).length;
  const classroomRoleAssignment = getStudentClassroomRole(
    classroomRoleMission,
    studentNumber,
    getTodayClassroomRoleDateKey(),
  );
  const completedWeeklyMissionCount = completedExternalWeeklyMissionCount
    + (isWeeklySudokuMissionCompleted ? 1 : 0)
    + (numberBaseballStatus === 'completed' ? 1 : 0)
    + (isFailureExhibitionMissionCompleted ? 1 : 0)
    + (isBookStackMissionCompleted ? 1 : 0);
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
    returnFocusRef: sudokuSettingsTriggerRef,
  });

  return (
    <div className="student-view student-missions-view">
      <StudentHeader
        title="미션"
        onBack={onBack}
        status={(
          <span className="student-mission-status-legend" aria-label="미션 상태 안내" role="group">
            <span className="student-mission-status-legend-item" data-status="incomplete">
              <StudentMissionStatusFace status="incomplete" compact />
              진행 전
            </span>
            <span className="student-mission-status-legend-item" data-status="inProgress">
              <StudentMissionStatusFace status="inProgress" compact />
              진행 중
            </span>
            <span className="student-mission-status-legend-item" data-status="completed">
              <StudentMissionStatusFace status="completed" compact />
              완료
            </span>
            <span className="student-mission-status-legend-item" data-status="attention">
              <StudentMissionStatusFace status="error" compact />
              오류 발생
            </span>
            <span className="student-mission-status-legend-item is-teacher">
              <StudentMissionTeacherFace compact />
              선생님 확인 필요
            </span>
          </span>
        )}
        actions={(
          <StudentBalanceSummary
            studentNumber={studentNumber}
            profileAssignments={profileAssignments}
            balance={balance}
            availableBalance={availableBalance}
            reservedAmount={reservedAmount}
            isLoading={isLoading}
          />
        )}
      />

      <main className="student-mission-groups">
        <section className="student-mission-group" aria-labelledby="daily-mission-title">
          <div className="student-group-heading">
            <h2 id="daily-mission-title">
              일일 미션
              <span className="student-group-heading-description">(매일매일 할 수 있는 미션)</span>
            </h2>
            <strong>{auctionMissions.length + 3}개</strong>
          </div>
          <div className="student-mission-grid">
            {auctionMissions.map((mission, index) => (
              <motion.div key={mission.id} {...missionEntrance(index)}>
                <StudentMissionCard
                  title={mission.content}
                  illustrationSrc={TEACHER_MISSION_ILLUSTRATION_PATHS[mission.illustrationIndex]}
                  illustrationTitle={mission.content}
                  rewardAmount={mission.rewardAmount}
                  verificationMode="manual"
                  actionLabel="교실에서 수행"
                  disabledAppearance={false}
                />
              </motion.div>
            ))}
            <motion.div {...missionEntrance(auctionMissions.length)}>
              <StudentMissionCard
                title="1인 1역"
                illustrationSrc="/mission-illustrations/classroom-role.png"
                illustrationCaption={classroomRoleAssignment?.roleName ?? '오늘 역할 없음'}
                rewardAmount={CLASSROOM_ROLE_MISSION_REWARD}
                verificationMode="manual"
                disabledAppearance={!classroomRoleAssignment}
                actionLabel={classroomRoleAssignment
                  ? `${classroomRoleAssignment.roleName} 역할 수행`
                  : '오늘 역할 없음'}
              />
            </motion.div>
            <motion.div {...missionEntrance(auctionMissions.length + 1)}>
              <StudentMissionCard
                title="감정 구슬 넣기"
                illustrationSrc="/mission-illustrations/emotion-orbs.png"
                rewardAmount={5}
                verificationMode="automatic"
                status={isDailyEmotionMissionCompleted ? 'completed' : 'incomplete'}
                actionLabel={isDailyEmotionMissionCompleted ? '감정 다시 고르기' : '감정 고르기'}
                onAction={onOpenEmotions}
              />
            </motion.div>
            <motion.div className="student-writing-mission" {...missionEntrance(auctionMissions.length + 2)}>
              <StudentMissionCard
                title="글밥짓기"
                illustrationSrc="/mission-illustrations/writing.png"
                rewardAmount={DAILY_WRITING_REWARD}
                verificationMode="manual"
                actionLabel={hasDailyWritingMission
                  ? isDailyWritingMissionCompleted ? '편지 다시 보기' : '글밥 편지 확인'
                  : '아직 미션 없음'}
                onAction={hasDailyWritingMission ? onOpenMailbox : undefined}
              />
            </motion.div>
          </div>
        </section>

        <section className="student-mission-group" aria-labelledby="weekly-mission-title">
          <div className="student-group-heading">
            <h2 id="weekly-mission-title">
              주간 미션
              <span className="student-group-heading-description">(일주일에 한 번 할 수 있는 미션)</span>
            </h2>
            <strong>{completedWeeklyMissionCount}/{WEEKLY_MISSION_DEFINITIONS.length + 4} 완료</strong>
          </div>
          <div className="student-mission-grid">
            <motion.div {...missionEntrance(auctionMissions.length + 2)}>
              <StudentMissionCard
                title="스도쿠"
                illustrationSrc="/mission-illustrations/sudoku.png"
                description={activeSudokuDifficulty
                  ? `${DIFFICULTY_LABELS[activeSudokuDifficulty]} 문제를 풀고 있어요.`
                  : isWeeklySudokuMissionCompleted
                    ? '이번 주에 푼 문제를 다시 확인할 수 있어요.'
                    : undefined}
                rewardAmount={[SUDOKU_REWARDS.basic, SUDOKU_REWARDS.challenge]}
                verificationMode="automatic"
                status={activeSudokuDifficulty ? 'inProgress' : isWeeklySudokuMissionCompleted ? 'completed' : 'incomplete'}
                actionLabel={activeSudokuDifficulty ? '이어 풀기' : isWeeklySudokuMissionCompleted ? '다시 보기' : '문제 풀기'}
                onAction={() => {
                  if (sudokuDifficultyToOpen) {
                    onOpenSudoku(sudokuDifficultyToOpen);
                    return;
                  }
                  sudokuSettingsTriggerRef.current = document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null;
                  setIsSudokuSettingsOpen(true);
                }}
              />
            </motion.div>
            <motion.div className="student-number-baseball-mission" {...missionEntrance(auctionMissions.length + 3)}>
              <StudentMissionCard
                title="숫자 야구"
                illustrationSrc="/mission-illustrations/number-baseball.png"
                description={numberBaseballStatus === 'completed'
                  ? '이번 주의 정답과 기록을 다시 볼 수 있어요.'
                  : numberBaseballStatus === 'exhausted'
                    ? '이번 주의 기회를 모두 사용했어요.'
                    : numberBaseballStatus === 'inProgress'
                      ? '이번 주의 숫자를 맞히고 있어요.'
                      : undefined}
                rewardAmount={NUMBER_BASEBALL_REWARDS}
                verificationMode="automatic"
                status={numberBaseballStatus}
                actionLabel={numberBaseballStatus === 'incomplete'
                  ? '게임 시작'
                  : numberBaseballStatus === 'inProgress'
                    ? '이어 하기'
                    : '결과 보기'}
                onAction={onOpenNumberBaseball}
              />
            </motion.div>
            <motion.div {...missionEntrance(auctionMissions.length + 4)}>
              <StudentMissionCard
                title="실패 전시하기"
                illustrationSrc="/mission-illustrations/failure-exhibition.png"
                rewardAmount={FAILURE_EXHIBITION_WEEKLY_REWARD}
                verificationMode="automatic"
                status={isFailureExhibitionMissionCompleted ? 'completed' : 'incomplete'}
                actionLabel={isFailureExhibitionMissionCompleted ? '전시한 글 보기' : '실패 전시하기'}
                onAction={onOpenFailureExhibition}
              />
            </motion.div>
            <motion.div {...missionEntrance(auctionMissions.length + 5)}>
              <StudentMissionCard
                title="읽은 책 쌓기"
                illustrationSrc="/mission-illustrations/book-stacking.png"
                rewardAmount={BOOK_STACK_WEEKLY_REWARD}
                verificationMode="automatic"
                status={isBookStackMissionCompleted ? 'completed' : 'incomplete'}
                actionLabel={isBookStackMissionCompleted ? '쌓은 책 보기' : '책 쌓기'}
                onAction={onOpenBookStack}
              />
            </motion.div>
            {WEEKLY_MISSION_DEFINITIONS.map((mission, index) => (
              <motion.div key={mission.type} {...missionEntrance(index + auctionMissions.length + 6)}>
                <StudentMissionCard
                  title={mission.label}
                  illustrationSrc={mission.type === PERSONAL_QUESTION_WEEKLY_MISSION_TYPE
                    ? '/mission-illustrations/newspaper-question.png'
                    : undefined}
                  rewardAmount={mission.rewardAmount}
                  verificationMode="automatic"
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
            aria-describedby="student-sudoku-settings-description"
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
            <span className="student-confirm-dialog-kicker">이번 주 스도쿠</span>
            <h2 id="student-sudoku-settings-title">난이도를 골라 주세요</h2>
            <p id="student-sudoku-settings-description">한 번 시작하면 다 풀 때까지 바꿀 수 없어요.</p>
            <div className="student-sudoku-settings-options" aria-label="난이도 선택">
              {SUDOKU_DIFFICULTIES.map((difficulty) => (
                <button
                  type="button"
                  key={difficulty}
                  className={`student-sudoku-settings-option is-${difficulty}`}
                  aria-label={`${difficulty === 'basic' ? '6×6' : '9×9'} ${DIFFICULTY_LABELS[difficulty]}, 보상 +${SUDOKU_REWARDS[difficulty]}고마, 이 난이도로 시작`}
                  onClick={() => {
                    setIsSudokuSettingsOpen(false);
                    onOpenSudoku(difficulty);
                  }}
                >
                  <span className="student-sudoku-settings-option-header">
                    <span className="student-sudoku-settings-option-size" aria-hidden="true">
                      {difficulty === 'basic' ? '6×6' : '9×9'}
                    </span>
                    <span className="student-sudoku-settings-option-copy">
                      <span>{DIFFICULTY_LABELS[difficulty]}</span>
                    </span>
                    <span className="student-sudoku-settings-option-reward">
                      <strong>+{SUDOKU_REWARDS[difficulty]}</strong>
                      <small>고마</small>
                    </span>
                  </span>
                  <StudentSudokuPreview difficulty={difficulty} />
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
