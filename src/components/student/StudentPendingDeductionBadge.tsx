import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock3 } from 'lucide-react';
import { getPendingTeacherDeductionAmount, type PendingTeacherDeduction } from '../../lib/studentEconomy';
import StudentConfirmDialog from './StudentConfirmDialog';

export function StudentPendingDeductionBadge({ deductions }: { readonly deductions: readonly PendingTeacherDeduction[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const amount = getPendingTeacherDeductionAmount(deductions);
  if (amount === 0) return null;
  const close = () => setIsOpen(false);
  return <>
    <button ref={triggerRef} type="button" className="student-pending-deduction-badge" aria-haspopup="dialog"
      onClick={() => setIsOpen(true)} aria-label={`차감 대기 ${amount.toLocaleString('ko-KR')}고마, 사유 보기`}>
      <span className="student-pending-deduction-heading" aria-hidden="true"><Clock3 size={16} />차감 대기</span>
      <strong className="student-pending-deduction-amount" aria-hidden="true">{amount.toLocaleString('ko-KR')}<small>고마</small></strong>
    </button>
    {isOpen ? createPortal(<StudentConfirmDialog isOpen={isOpen} title={`차감 대기 ${amount.toLocaleString('ko-KR')}고마`}
      description="보유 고마와 예금이 충분해지면 자동으로 차감돼요." confirmLabel="확인" cancelLabel={null}
      isPending={false} returnFocusRef={triggerRef} onCancel={close} onConfirm={close}>
      <ul className="student-pending-deduction-list">{deductions.map(item => <li key={item.id}>
        <strong>{item.amount.toLocaleString('ko-KR')}고마</strong><p>{item.teacherReason}</p>
      </li>)}</ul>
    </StudentConfirmDialog>, document.body) : null}
  </>;
}
