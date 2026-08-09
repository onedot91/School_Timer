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
        title="고마 사용"
        onBack={onBack}
      />
      <StudentBalanceSummary
        balance={balance}
        availableBalance={availableBalance}
        reservedAmount={reservedAmount}
        isLoading={isLoading}
      />
      <div className="student-store-content">{children}</div>
    </div>
  );
}
