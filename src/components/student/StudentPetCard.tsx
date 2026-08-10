import type { CSSProperties } from 'react';
import {
  getStudentPetEggStage,
  type StudentPetState,
} from '../../lib/studentPet';

interface StudentPetCardProps {
  pet: StudentPetState;
  availableBalance: number;
  isLoading: boolean;
  isSaving: boolean;
  onOpenFeed: () => void;
}

export default function StudentPetCard({
  pet,
  availableBalance,
  isLoading,
  isSaving,
  onOpenFeed,
}: StudentPetCardProps) {
  const progress = Math.min(100, pet.fedAmount);
  const eggStage = getStudentPetEggStage(pet.fedAmount);

  return (
    <section
      className="student-pet-card"
      aria-label="펫 키우기"
    >
      <div className="student-pet-progress-row">
        <span className="student-pet-progress" aria-label={`부화까지 ${pet.fedAmount} / 100 고마`}>
          <span style={{ width: `${progress}%` }} />
        </span>
        <strong>{pet.fedAmount} / 100</strong>
      </div>
      <button
        type="button"
        className="student-pet-egg-art"
        style={{ '--student-pet-egg-stage': eggStage } as CSSProperties}
        onClick={onOpenFeed}
        disabled={isLoading || isSaving || availableBalance < 5}
        aria-label={`${eggStage + 1}단계 알. 눌러서 5 고마 먹이기`}
      />
    </section>
  );
}
