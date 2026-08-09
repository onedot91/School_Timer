import { Coins } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';

interface StudentBalanceSummaryProps {
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading?: boolean;
}

export default function StudentBalanceSummary({
  balance,
  availableBalance,
  reservedAmount,
  isLoading = false,
}: StudentBalanceSummaryProps) {
  const hasReservedBalance = reservedAmount > 0;
  const displayedBalance = isLoading ? '확인 중' : formatCurrency(balance);
  const displayedAvailable = isLoading ? '확인 중' : formatCurrency(availableBalance);

  return (
    <section className={`student-balance-summary ${hasReservedBalance ? '' : 'student-balance-summary-simple'}`} aria-label="고마 잔액">
      <div className="student-balance-primary">
        <Coins size={24} aria-hidden="true" />
        <span>{hasReservedBalance ? '보유 고마' : '사용 가능 고마'}</span>
        <strong>{hasReservedBalance ? displayedBalance : displayedAvailable}</strong>
      </div>
      {hasReservedBalance ? (
        <div className="student-balance-meta">
          <div className="student-balance-detail">
            <span>사용 가능</span>
            <strong>{displayedAvailable}</strong>
          </div>
          <div className="student-balance-detail student-balance-reserved">
            <span>입찰 예약</span>
            <strong>{formatCurrency(reservedAmount)}</strong>
          </div>
        </div>
      ) : (
        <div className="student-balance-empty-reservation">
          <span>입찰 예약</span>
          <strong>없음</strong>
        </div>
      )}
    </section>
  );
}
