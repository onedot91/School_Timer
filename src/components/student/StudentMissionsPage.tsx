import type { AuctionMission } from '../../lib/currency';
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
  onOpenEmotions: () => void;
  onBack: () => void;
}

export default function StudentMissionsPage({
  auctionMissions,
  weeklyMissionStatuses,
  hasSyncError,
  isDailyEmotionMissionCompleted,
  onOpenEmotions,
  onBack,
}: StudentMissionsPageProps) {
  const completedWeeklyMissionCount = WEEKLY_MISSION_DEFINITIONS.filter(
    (mission) => weeklyMissionStatuses[mission.type] === 'completed',
  ).length;
  const getPresentedStatus = (status: WeeklyMissionStatuses[keyof WeeklyMissionStatuses]): StudentMissionStatus => {
    if (hasSyncError && status !== 'completed') return 'error';
    return status;
  };

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
            <strong>{auctionMissions.length + 1}개</strong>
          </div>
          <div className="student-mission-grid">
            <div>
              <StudentMissionCard
                title="감정 구슬 넣기"
                rewardAmount={5}
                status={isDailyEmotionMissionCompleted ? 'completed' : 'incomplete'}
                actionLabel={isDailyEmotionMissionCompleted ? '감정 다시 고르기' : '감정 고르기'}
                onAction={onOpenEmotions}
              />
            </div>
            {auctionMissions.map((mission) => (
              <div key={mission.id}>
                <StudentMissionCard
                  title={mission.content}
                  rewardAmount={mission.rewardAmount}
                  status="incomplete"
                  actionLabel="교실에서 수행"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="student-mission-group" aria-labelledby="weekly-mission-title">
          <div className="student-group-heading">
            <h2 id="weekly-mission-title">주간 미션</h2>
            <strong>{completedWeeklyMissionCount}/{WEEKLY_MISSION_DEFINITIONS.length} 완료</strong>
          </div>
          <div className="student-mission-grid">
            {WEEKLY_MISSION_DEFINITIONS.map((mission) => (
              <div key={mission.type}>
                <StudentMissionCard
                  title={mission.label}
                  rewardAmount={mission.rewardAmount}
                  status={getPresentedStatus(weeklyMissionStatuses[mission.type])}
                  destinationUrl={mission.destinationUrl}
                  actionLabel={weeklyMissionStatuses[mission.type] === 'completed' ? '다시 방문하기' : '미션 수행하기'}
                />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
