import { Coins } from 'lucide-react';
import { formatCurrency, formatStudentNumberLabel } from '../../lib/currency';
import { getFailureProfileImage, type FailureProfileAssignments } from '../../lib/failureExhibition';
import type { PendingTeacherDeduction } from '../../lib/studentEconomy';
import { StudentPendingDeductionBadge } from './StudentPendingDeductionBadge';

const BalanceSkeleton = ({ size }: { readonly size: 'primary' | 'detail' }) => (
  <>
    <span className={`student-skeleton-block student-balance-skeleton student-balance-skeleton--${size}`} aria-hidden="true" />
    <span className="sr-only">확인 중</span>
  </>
);

interface StudentBalanceSummaryProps {
  studentNumber?: number;
  profileAssignments?: FailureProfileAssignments;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading?: boolean;
  onProfileClick?: () => void;
  pendingDeductions?: readonly PendingTeacherDeduction[];
}

export default function StudentBalanceSummary({
  studentNumber,
  profileAssignments,
  balance,
  availableBalance,
  reservedAmount,
  isLoading = false,
  onProfileClick,
  pendingDeductions = [],
}: StudentBalanceSummaryProps) {
  // While loading, a fixed-width block holds the number's place so the header does not shift when the balance arrives.
  const displayedAvailable = isLoading ? <BalanceSkeleton size="primary" /> : formatCurrency(availableBalance);
  const displayedReserved = isLoading ? <BalanceSkeleton size="detail" /> : formatCurrency(reservedAmount);
  const hasPendingDeduction = !isLoading && pendingDeductions.length > 0;
  const showReserved = !hasPendingDeduction || reservedAmount > 0;
  const profileImage = studentNumber !== undefined
    ? getFailureProfileImage(studentNumber, profileAssignments)
    : undefined;

  return (
    <section className={`student-balance-summary${hasPendingDeduction ? ' has-pending-deduction' : ''}`} aria-label="고마 잔액">
      {studentNumber !== undefined ? (
        <div className="student-balance-student-identity" aria-label={`${formatStudentNumberLabel(studentNumber)} 학생`}>
          {onProfileClick ? (
            <button type="button" className="student-balance-profile-action" aria-label="상점 프로필로 이동" onClick={onProfileClick}>
              <img
                className="student-balance-profile"
                src={profileImage}
                alt=""
                width={192}
                height={192}
              />
            </button>
          ) : (
            <img
              className="student-balance-profile"
              src={profileImage}
              alt=""
              width={192}
              height={192}
            />
          )}
          <strong className="student-balance-student-number" aria-hidden="true">
            {formatStudentNumberLabel(studentNumber)}
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
      <div className={`student-balance-meta${hasPendingDeduction ? ' has-pending-deduction' : ''}`} data-has-reserved={showReserved}>
        {showReserved ? <div className="student-balance-detail student-balance-reserved">
          <span>예약 고마</span>
          <strong>{displayedReserved}</strong>
        </div> : null}
        {!isLoading ? <StudentPendingDeductionBadge deductions={pendingDeductions} /> : null}
      </div>
    </section>
  );
}
