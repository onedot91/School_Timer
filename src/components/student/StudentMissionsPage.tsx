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
  onBack: () => void;
}

export default function StudentMissionsPage({
  auctionMissions,
  weeklyMissionStatuses,
  hasSyncError,
  onBack,
}: StudentMissionsPageProps) {
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
        <section className="student-mission-group" aria-labelledby="weekly-mission-title">
          <div className="student-group-heading">
            <h2 id="weekly-mission-title">주간 미션</h2>
            <strong>{WEEKLY_MISSION_DEFINITIONS.filter((mission) => weeklyMissionStatuses[mission.type] === 'completed').length}/{WEEKLY_MISSION_DEFINITIONS.length} 완료</strong>
          </div>
          <div className="student-mission-grid">
            {WEEKLY_MISSION_DEFINITIONS.map((mission) => (
              <div key={mission.type}>
                <StudentMissionCard
                  title={mission.label}
                  description={mission.description}
                  rewardAmount={mission.rewardAmount}
                  status={getPresentedStatus(weeklyMissionStatuses[mission.type])}
                  destinationUrl={mission.destinationUrl}
                  actionLabel={weeklyMissionStatuses[mission.type] === 'completed' ? '다시 방문하기' : '미션 수행하기'}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="student-mission-group" aria-labelledby="daily-mission-title">
          <div className="student-group-heading">
            <h2 id="daily-mission-title">일일 미션</h2>
            <strong>{auctionMissions.length}개</strong>
          </div>
          {auctionMissions.length > 0 ? (
            <div className="student-mission-grid">
              {auctionMissions.map((mission) => (
                <div key={mission.id}>
                  <StudentMissionCard
                    title={mission.content}
                    description="교실에서 수행한 뒤 선생님의 안내에 따라 확인받으세요."
                    rewardAmount={mission.rewardAmount}
                    status="incomplete"
                    actionLabel="교실에서 수행"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="student-empty-state">지금 등록된 일일 미션이 없습니다.</div>
          )}
        </section>
      </main>
    </div>
  );
}
