import { Utensils } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  STUDENT_PET_HATCH_AMOUNT,
  getStudentPetEggStage,
  getStudentPetKind,
  type StudentPetState,
} from '../../lib/studentPet';

interface StudentPetCardProps {
  pet: StudentPetState;
  availableBalance: number;
  isLoading: boolean;
  isSaving: boolean;
  onFeed: () => void;
}

export default function StudentPetCard({
  pet,
  availableBalance,
  isLoading,
  isSaving,
  onFeed,
}: StudentPetCardProps) {
  const isHatched = pet.fedAmount >= STUDENT_PET_HATCH_AMOUNT;
  const progress = Math.min(100, (pet.fedAmount / STUDENT_PET_HATCH_AMOUNT) * 100);
  const eggStage = getStudentPetEggStage(pet.fedAmount);
  const petKind = getStudentPetKind(pet.petKind);

  return (
    <section
      className="student-pet-card"
      aria-label="펫 키우기"
      data-hatched={isHatched ? 'true' : 'false'}
    >
      {isHatched ? (
        <div className="student-pet-card-heading">
          <strong>{pet.name || petKind.label}</strong>
        </div>
      ) : null}

      {isHatched ? (
        <div className="student-pet-hatched-summary">
          <span aria-hidden="true">{petKind.emoji}</span>
          <p>배경을 두 번 눌러 펫 변경</p>
        </div>
      ) : (
        <>
          <div className="student-pet-progress-row">
            <span className="student-pet-progress" aria-label={`부화까지 ${pet.fedAmount} / ${STUDENT_PET_HATCH_AMOUNT} 고마`}>
              <span style={{ width: `${progress}%` }} />
            </span>
            <strong>{pet.fedAmount} / {STUDENT_PET_HATCH_AMOUNT}</strong>
          </div>
          <div className="student-pet-egg-row">
            <span
              className="student-pet-egg-art"
              style={{ '--student-pet-egg-stage': eggStage } as CSSProperties}
              role="img"
              aria-label={`${eggStage + 1}단계 알`}
            />
            <button
              type="button"
              className="student-pet-feed-button"
              onClick={onFeed}
              disabled={isLoading || isSaving || availableBalance < 5}
            >
              <Utensils size={18} aria-hidden="true" />
              {isSaving ? '먹이는 중' : '5 고마 먹이기'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
