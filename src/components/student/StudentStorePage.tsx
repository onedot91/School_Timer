import type { ReactNode } from 'react';
import StudentBalanceSummary from './StudentBalanceSummary';
import StudentHeader from './StudentHeader';

interface StudentStorePageProps {
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading: boolean;
  children: ReactNode;
  onBack: () => void;
}

export default function StudentStorePage({
  balance,
  availableBalance,
  reservedAmount,
  isLoading,
  children,
  onBack,
}: StudentStorePageProps) {
  return (
    <div className="student-view student-store-view">
      <StudentHeader
        title="고마 쓰기"
        onBack={onBack}
      />
      <StudentBalanceSummary
        balance={balance}
        availableBalance={availableBalance}
        reservedAmount={reservedAmount}
        isLoading={isLoading}
      />
      <section className="student-store-heading" aria-labelledby="student-store-auction-title">
        <div>
          <h2 id="student-store-auction-title">경매장</h2>
        </div>
      </section>
      <div className="student-store-content">{children}</div>
    </div>
  );
}
