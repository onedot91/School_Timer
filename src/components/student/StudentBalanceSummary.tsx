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
  const displayedAvailable = isLoading ? '확인 중' : formatCurrency(availableBalance);
  const displayedBalance = isLoading ? '확인 중' : formatCurrency(balance);
  const displayedReserved = isLoading ? '확인 중' : formatCurrency(reservedAmount);

  return (
    <section className={`student-balance-summary ${hasReservedBalance ? '' : 'student-balance-summary-simple'}`} aria-label="고마 잔액">
      <div className="student-balance-primary">
        <div className="student-balance-primary-heading">
          <Coins size={24} aria-hidden="true" />
          <span>사용 가능 고마</span>
        </div>
        <strong>{displayedAvailable}</strong>
      </div>
      {hasReservedBalance ? (
        <div className="student-balance-meta">
          <div className="student-balance-detail">
            <span>총 보유</span>
            <strong>{displayedBalance}</strong>
          </div>
          <div className="student-balance-detail student-balance-reserved">
            <span>입찰 예약</span>
            <strong>{displayedReserved}</strong>
          </div>
        </div>
      ) : null}
    </section>
  );
}
