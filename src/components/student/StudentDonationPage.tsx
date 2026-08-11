import type { RefObject } from 'react';

interface StudentDonationPageProps {
  totalAmount: number;
  targetAmount: number;
  canDonate: boolean;
  isCompleted: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onDonate: () => void;
}

export default function StudentDonationPage({ totalAmount, targetAmount, canDonate, isCompleted, triggerRef, onDonate }: StudentDonationPageProps) {
  const progress = targetAmount > 0 ? Math.min(100, (totalAmount / targetAmount) * 100) : 0;
  return (
    <section className="student-donation-page" aria-labelledby="student-donation-title">
      <img src="/donation-bear.png?v=5" alt="학급 기부 캐릭터" />
      <div>
        <h2 id="student-donation-title">학급 기부</h2>
        <strong>{totalAmount} / {targetAmount}</strong>
        <span className="student-donation-progress"><span style={{ width: `${progress}%` }} /></span>
        <button ref={triggerRef} type="button" disabled={!canDonate || isCompleted} onClick={onDonate}>{isCompleted ? '목표 달성' : '기부하기'}</button>
      </div>
    </section>
  );
}
