import type { RefObject } from 'react';
import { getDailyDonationCharacterSource } from '../../lib/dailyDonationCharacter';
import { getKoreanLocalDateKey } from '../../lib/studentEmotion';

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
  const donationCharacterSource = getDailyDonationCharacterSource(getKoreanLocalDateKey());
  return (
    <section className="student-donation-page" aria-labelledby="student-donation-title">
      <picture className={`student-donation-animation${isCompleted ? ' is-completed' : ''}`}>
        <img
          src={isCompleted ? '/donation-thanks-075x.gif' : donationCharacterSource}
          alt={isCompleted ? '기부 감사합니다 애니메이션' : '학급 기부 캐릭터'}
        />
      </picture>
      <div>
        <h2 id="student-donation-title">학급 기부</h2>
        <strong>{totalAmount} / {targetAmount}</strong>
        <span
          className="student-donation-progress"
          role="progressbar"
          aria-label="학급 기부 진행률"
          aria-valuemin={0}
          aria-valuemax={targetAmount}
          aria-valuenow={Math.min(totalAmount, targetAmount)}
        >
          <span style={{ width: `${progress}%` }} />
        </span>
        <button ref={triggerRef} type="button" disabled={!canDonate || isCompleted} onClick={onDonate}>{isCompleted ? '목표 달성' : '기부하기'}</button>
      </div>
    </section>
  );
}
