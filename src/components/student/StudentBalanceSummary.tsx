import { Coins } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';

interface StudentBalanceSummaryProps {
  studentNumber?: number;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading?: boolean;
}

export default function StudentBalanceSummary({
  studentNumber,
  balance,
  availableBalance,
  reservedAmount,
  isLoading = false,
}: StudentBalanceSummaryProps) {
  const displayedAvailable = isLoading ? '확인 중' : formatCurrency(availableBalance);
  const displayedReserved = isLoading ? '확인 중' : formatCurrency(reservedAmount);

  return (
    <section className="student-balance-summary" aria-label="고마 잔액">
      {studentNumber !== undefined ? (
        <strong className="student-balance-student-number" aria-label={`${studentNumber}번 학생`}>
          {studentNumber}번
        </strong>
      ) : null}
      <div className="student-balance-primary">
        <div className="student-balance-primary-heading">
          <Coins size={24} aria-hidden="true" />
          <span>사용 가능 고마</span>
        </div>
        <strong>{displayedAvailable}</strong>
      </div>
      <div className="student-balance-meta">
        <div className="student-balance-detail student-balance-reserved">
          <span>예약 고마</span>
          <strong>{displayedReserved}</strong>
        </div>
      </div>
    </section>
  );
}
