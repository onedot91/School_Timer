import { ClipboardCheck } from 'lucide-react';
import StudentBalanceSummary from './StudentBalanceSummary';
import StudentPurchaseCard from './StudentPurchaseCard';
import StudentSectionCard from './StudentSectionCard';

interface StudentOverviewPageProps {
  studentLabel: string;
  characterSrc: string;
  characterAlt: string;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading: boolean;
  onOpenMissions: () => void;
  onOpenStore: () => void;
}

export default function StudentOverviewPage({
  studentLabel,
  characterSrc,
  characterAlt,
  balance,
  availableBalance,
  reservedAmount,
  isLoading,
  onOpenMissions,
  onOpenStore,
}: StudentOverviewPageProps) {
  return (
    <div className="student-view student-overview-view">
      <h1 className="sr-only">학생 개요</h1>

      <section className="student-overview-hero" aria-label="학생 개요">
        <div className="student-character-stage-card">
          <div className="student-character-halo" aria-hidden="true" />
          <img src={characterSrc} alt={characterAlt} width="240" height="240" />
          <div>
            <strong>{studentLabel} 학생</strong>
          </div>
        </div>
        <StudentBalanceSummary
          balance={balance}
          availableBalance={availableBalance}
          reservedAmount={reservedAmount}
          isLoading={isLoading}
        />
      </section>

      <div className="student-overview-destinations">
        <StudentSectionCard
          tone="mission"
          icon={ClipboardCheck}
          title="이번 주 미션"
          actionLabel="미션 하러 가기"
          onClick={onOpenMissions}
        />
        <StudentPurchaseCard
          onOpen={onOpenStore}
        />
      </div>
    </div>
  );
}
