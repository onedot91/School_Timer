import { useEffect, useRef, useState } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';
import type { StudentEmotionDefinition } from '../../lib/studentEmotion';
import {
  STUDENT_PET_HATCH_AMOUNT,
  STUDENT_PET_KINDS,
  STUDENT_PET_NAME_MAX_LENGTH,
  getStudentPetKind,
  type StudentPetKind,
  type StudentPetState,
} from '../../lib/studentPet';
import { useModalFocus } from '../../lib/useModalFocus';
import StudentBalanceSummary from './StudentBalanceSummary';
import StudentEmotionSummary from './StudentEmotionSummary';
import StudentPetCard from './StudentPetCard';
import StudentPetStage from './StudentPetStage';
import StudentPurchaseCard from './StudentPurchaseCard';
import StudentSectionCard from './StudentSectionCard';

interface StudentOverviewPageProps {
  studentNumber: number;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading: boolean;
  pet: StudentPetState;
  isPetSaving: boolean;
  todayEmotion: StudentEmotionDefinition | null;
  onFeedPet: () => Promise<boolean>;
  onNamePet: (name: string) => Promise<boolean>;
  onChangePet: (kind: StudentPetKind) => Promise<boolean>;
  onMovePet: (position: StudentPetState['position']) => Promise<boolean>;
  onOpenEmotions: () => void;
  onOpenMissions: () => void;
  onOpenStore: () => void;
}

export default function StudentOverviewPage({
  studentNumber,
  balance,
  availableBalance,
  reservedAmount,
  isLoading,
  pet,
  isPetSaving,
  todayEmotion,
  onFeedPet,
  onNamePet,
  onChangePet,
  onMovePet,
  onOpenEmotions,
  onOpenMissions,
  onOpenStore,
}: StudentOverviewPageProps) {
  const [activePetDialog, setActivePetDialog] = useState<'feed' | 'name' | 'picker' | null>(null);
  const [petNameDraft, setPetNameDraft] = useState(pet.name);
  const [petError, setPetError] = useState('');
  const petDialogRef = useRef<HTMLElement>(null);
  const isHatched = pet.fedAmount >= STUDENT_PET_HATCH_AMOUNT;
  const petKind = getStudentPetKind(pet.petKind);

  useEffect(() => {
    setPetNameDraft(pet.name);
    if (isHatched && !pet.name && activePetDialog === null) setActivePetDialog('name');
  }, [activePetDialog, isHatched, pet.name]);

  useModalFocus({
    dialogRef: petDialogRef,
    isOpen: activePetDialog !== null,
    onDismiss: () => {
      if (!isPetSaving) setActivePetDialog(null);
    },
    isDismissible: !isPetSaving,
  });

  const closePetDialog = () => {
    if (isPetSaving) return;
    setPetError('');
    setActivePetDialog(null);
  };

  return (
    <div className="student-view student-overview-view">
      <h1 className="sr-only">학생 개요</h1>

      <section className="student-overview-hero" aria-label="학생 개요">
        <StudentPetStage
          pet={pet}
          onOpenPetPicker={() => {
            setPetError('');
            setActivePetDialog('picker');
          }}
          onMovePet={(position) => { void onMovePet(position); }}
        />
        <div className="student-overview-status">
          <StudentBalanceSummary
            studentNumber={studentNumber}
            balance={balance}
            availableBalance={availableBalance}
            reservedAmount={reservedAmount}
            isLoading={isLoading}
          />
          <StudentEmotionSummary emotion={todayEmotion} onOpen={onOpenEmotions} />
          <StudentPetCard
            pet={pet}
            availableBalance={availableBalance}
            isLoading={isLoading}
            isSaving={isPetSaving}
            onFeed={() => {
              setPetError('');
              setActivePetDialog('feed');
            }}
          />
        </div>
      </section>

      <div className="student-overview-destinations">
        <StudentSectionCard
          tone="mission"
          icon={ClipboardCheck}
          title="미션"
          actionLabel="미션 시작"
          onClick={onOpenMissions}
        />
        <StudentPurchaseCard
          onOpen={onOpenStore}
        />
      </div>

      {activePetDialog ? (
        <div className="student-pet-dialog-backdrop" role="presentation" onClick={closePetDialog}>
          <section
            ref={petDialogRef}
            className="student-pet-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-pet-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="student-pet-dialog-close"
              onClick={closePetDialog}
              disabled={isPetSaving}
              aria-label="펫 창 닫기"
            >
              <X size={22} aria-hidden="true" />
            </button>

            {activePetDialog === 'feed' ? (
              <>
                <span className="student-pet-dialog-visual" aria-hidden="true">🥚</span>
                <div className="student-pet-dialog-copy">
                  <h2 id="student-pet-dialog-title">5 고마 먹이기</h2>
                  <p>{availableBalance} → {Math.max(0, availableBalance - 5)} 고마</p>
                </div>
                <button
                  type="button"
                  className="student-pet-dialog-primary"
                  disabled={isPetSaving || availableBalance < 5}
                  onClick={() => {
                    setPetError('');
                    void onFeedPet().then((saved) => {
                      if (!saved) {
                        setPetError('먹이를 주지 못했습니다. 잔액을 확인해 주세요.');
                        return;
                      }
                      setActivePetDialog(pet.fedAmount + 5 >= STUDENT_PET_HATCH_AMOUNT ? 'name' : null);
                    });
                  }}
                >
                  <Check size={20} aria-hidden="true" />
                  {isPetSaving ? '먹이는 중' : '5 고마 먹이기'}
                </button>
              </>
            ) : null}

            {activePetDialog === 'name' ? (
              <>
                <span className="student-pet-dialog-visual" aria-hidden="true">{petKind.emoji}</span>
                <div className="student-pet-dialog-copy">
                  <span>알이 부화했어요</span>
                  <h2 id="student-pet-dialog-title">펫 이름을 지어 주세요</h2>
                </div>
                <label className="student-pet-name-field">
                  <span>펫 이름</span>
                  <input
                    autoFocus
                    value={petNameDraft}
                    maxLength={STUDENT_PET_NAME_MAX_LENGTH}
                    placeholder="이름 입력"
                    onChange={(event) => {
                      setPetNameDraft(event.target.value);
                      setPetError('');
                    }}
                  />
                  <small>{petNameDraft.length}/{STUDENT_PET_NAME_MAX_LENGTH}</small>
                </label>
                <button
                  type="button"
                  className="student-pet-dialog-primary"
                  disabled={isPetSaving || petNameDraft.trim().length === 0}
                  onClick={() => {
                    void onNamePet(petNameDraft).then((saved) => {
                      if (saved) closePetDialog();
                      else setPetError('이름을 저장하지 못했습니다.');
                    });
                  }}
                >
                  <Check size={20} aria-hidden="true" />
                  {isPetSaving ? '저장 중' : '이름 저장'}
                </button>
              </>
            ) : null}

            {activePetDialog === 'picker' ? (
              <>
                <div className="student-pet-dialog-copy">
                  <h2 id="student-pet-dialog-title">함께할 펫을 골라 주세요</h2>
                </div>
                <div className="student-pet-picker">
                  {STUDENT_PET_KINDS.map((kind) => (
                    <button
                      key={kind.id}
                      type="button"
                      aria-pressed={pet.petKind === kind.id}
                      disabled={isPetSaving}
                      onClick={() => {
                        void onChangePet(kind.id).then((saved) => {
                          if (saved) closePetDialog();
                          else setPetError('펫을 바꾸지 못했습니다.');
                        });
                      }}
                    >
                      <span aria-hidden="true">{kind.emoji}</span>
                      <strong>{kind.label}</strong>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {petError ? <p className="student-pet-dialog-error" role="alert">{petError}</p> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
