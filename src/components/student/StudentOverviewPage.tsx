import { ClipboardCheck } from 'lucide-react';
import type { StudentEmotionDefinition } from '../../lib/studentEmotion';
import StudentBalanceSummary from './StudentBalanceSummary';
import StudentEmotionSummary from './StudentEmotionSummary';
import StudentPurchaseCard from './StudentPurchaseCard';
import StudentSectionCard from './StudentSectionCard';

interface StudentOverviewPageProps {
  studentNumber: number;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading: boolean;
  todayEmotion: StudentEmotionDefinition | null;
  onOpenEmotions: () => void;
  onOpenMissions: () => void;
  onOpenStore: () => void;
}

export default function StudentOverviewPage({
  studentNumber,
  balance,
  availableBalance,
  reservedAmount,
  isLoading,
  todayEmotion,
  onOpenEmotions,
  onOpenMissions,
  onOpenStore,
}: StudentOverviewPageProps) {
  return (
    <div className="student-view student-overview-view">
      <h1 className="sr-only">학생 개요</h1>

      <section className="student-overview-hero" aria-label="학생 개요">
        <div className="student-character-stage-card" aria-label={`${studentNumber}번 학생 캐릭터 영역`}>
          <strong className="student-character-stage-number">{studentNumber}번</strong>
        </div>
        <div className="student-overview-status">
          <StudentBalanceSummary
            balance={balance}
            availableBalance={availableBalance}
            reservedAmount={reservedAmount}
            isLoading={isLoading}
          />
          <StudentEmotionSummary emotion={todayEmotion} onOpen={onOpenEmotions} />
        </div>
      </section>

      <div className="student-overview-destinations">
        <StudentSectionCard
          tone="mission"
          icon={ClipboardCheck}
          title="미션"
          actionLabel="미션 시작"
          onClick={onOpenMissions}
        />
        <StudentPurchaseCard
          onOpen={onOpenStore}
        />
      </div>
    </div>
  );
}
