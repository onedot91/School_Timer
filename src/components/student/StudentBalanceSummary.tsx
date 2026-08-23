import { Coins } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { getFailureProfileImage, type FailureProfileAssignments } from '../../lib/failureExhibition';

interface StudentBalanceSummaryProps {
  studentNumber?: number;
  profileAssignments?: FailureProfileAssignments;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading?: boolean;
}

export default function StudentBalanceSummary({
  studentNumber,
  profileAssignments,
  balance,
  availableBalance,
  reservedAmount,
  isLoading = false,
}: StudentBalanceSummaryProps) {
  const displayedAvailable = isLoading ? '확인 중' : formatCurrency(availableBalance);
  const displayedReserved = isLoading ? '확인 중' : formatCurrency(reservedAmount);
  const profileImage = studentNumber !== undefined
    ? getFailureProfileImage(studentNumber, profileAssignments)
    : undefined;

  return (
    <section className="student-balance-summary" aria-label="고마 잔액">
      {studentNumber !== undefined ? (
        <div className="student-balance-student-identity" aria-label={`${studentNumber}번 학생`}>
          <img
            className="student-balance-profile"
            src={profileImage}
            alt=""
            width={192}
            height={192}
          />
          <strong className="student-balance-student-number" aria-hidden="true">
            {studentNumber}번
          </strong>
        </div>
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
