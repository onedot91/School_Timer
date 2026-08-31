import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';
import type { StudentEmotionDefinition } from '../../lib/studentEmotion';
import {
  STUDENT_PET_FEED_AMOUNT,
  STUDENT_PET_HATCH_AMOUNT,
  STUDENT_PET_NAME_MAX_LENGTH,
  getStudentPetEggStage,
  getStudentPetKind,
  type StudentPetState,
} from '../../lib/studentPet';
import { useModalFocus } from '../../lib/useModalFocus';
import StudentBalanceSummary from './StudentBalanceSummary';
import StudentConfirmDialog from './StudentConfirmDialog';
import StudentPetStage from './StudentPetStage';
import {
  DEFAULT_STUDENT_CHARACTER,
  STUDENT_CHARACTER_PRIZES,
  STUDENT_HOUSE_DESIGNS,
  type StudentCharacterPrizeId,
  type StudentCustomHouseDesign,
  type StudentHouseDesignId,
} from '../../lib/studentEconomy';
import StudentPurchaseCard from './StudentPurchaseCard';
import StudentSectionCard from './StudentSectionCard';
import type { FailureProfileAssignments } from '../../lib/failureExhibition';
import { STUDENT_FEATURE_RELEASES } from '../../lib/studentFeatureRelease';

interface StudentOverviewPageProps {
  studentNumber: number;
  profileAssignments: FailureProfileAssignments;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading: boolean;
  pet: StudentPetState;
  isPetSaving: boolean;
  todayEmotion: StudentEmotionDefinition | null;
  hasUnreadMail: boolean;
  isHouseRepaired: boolean;
  ownedCharacterIds: readonly StudentCharacterPrizeId[];
  activeCharacterId: StudentCharacterPrizeId | null;
  isCharacterSaving: boolean;
  ownedHouseIds: readonly StudentHouseDesignId[];
  activeHouseId: StudentHouseDesignId | 'custom' | null;
  customHouseDesign: StudentCustomHouseDesign | null;
  isHouseSaving: boolean;
  onFeedPet: () => Promise<boolean>;
  onNamePet: (name: string) => Promise<boolean>;
  onChangePet: (petId: string) => Promise<boolean>;
  onMovePet: (position: StudentPetState['position']) => Promise<boolean>;
  onMoveGoma: (position: StudentPetState['gomaPosition']) => Promise<boolean>;
  onSelectCharacter: (characterId: StudentCharacterPrizeId | null) => Promise<boolean>;
  onSelectHouse: (houseId: StudentHouseDesignId | 'custom' | null) => Promise<boolean>;
  onOpenEmotions: () => void;
  onOpenMissions: () => void;
  onOpenStore: () => void;
  onOpenProfileShop: () => void;
  onOpenMailbox: () => void;
  onOpenLibrary: () => void;
}

export default function StudentOverviewPage({
  studentNumber,
  profileAssignments,
  balance,
  availableBalance,
  reservedAmount,
  isLoading,
  pet,
  isPetSaving,
  todayEmotion,
  hasUnreadMail,
  isHouseRepaired,
  ownedCharacterIds,
  activeCharacterId,
  isCharacterSaving,
  ownedHouseIds,
  activeHouseId,
  customHouseDesign,
  isHouseSaving,
  onFeedPet,
  onNamePet,
  onChangePet,
  onMovePet,
  onMoveGoma,
  onSelectCharacter,
  onSelectHouse,
  onOpenEmotions,
  onOpenMissions,
  onOpenStore,
  onOpenProfileShop,
  onOpenMailbox,
  onOpenLibrary,
}: StudentOverviewPageProps) {
  const [activePetDialog, setActivePetDialog] = useState<'feed' | 'name' | 'picker' | null>(null);
  const [petNameDraft, setPetNameDraft] = useState(pet.name);
  const [petError, setPetError] = useState('');
  const [isFeedConfirmationOpen, setIsFeedConfirmationOpen] = useState(false);
  const [isSkinDialogOpen, setIsSkinDialogOpen] = useState(false);
  const [skinError, setSkinError] = useState('');
  const [isHouseDialogOpen, setIsHouseDialogOpen] = useState(false);
  const [houseError, setHouseError] = useState('');
  const petDialogRef = useRef<HTMLElement>(null);
  const skinDialogRef = useRef<HTMLElement>(null);
  const houseDialogRef = useRef<HTMLElement>(null);
  const feedButtonRef = useRef<HTMLButtonElement>(null);
  const needsPetName = pet.pendingNamePetId !== null;
  const petKind = getStudentPetKind(pet.petKind);
  const eggStage = getStudentPetEggStage(pet.fedAmount);
  const ownedCharacters = STUDENT_CHARACTER_PRIZES.filter((character) => ownedCharacterIds.includes(character.id));
  const ownedHouses = STUDENT_HOUSE_DESIGNS.filter((house) => ownedHouseIds.includes(house.id));

  useEffect(() => {
    setPetNameDraft(pet.name);
    if (needsPetName && activePetDialog === null) setActivePetDialog('name');
  }, [activePetDialog, needsPetName, pet.name]);

  useModalFocus({
    dialogRef: petDialogRef,
    isOpen: activePetDialog !== null,
    onDismiss: () => {
      if (!isPetSaving) setActivePetDialog(null);
    },
    isDismissible: !isPetSaving,
  });

  useModalFocus({
    dialogRef: houseDialogRef,
    isOpen: isHouseDialogOpen,
    onDismiss: () => {
      if (!isHouseSaving) setIsHouseDialogOpen(false);
    },
    isDismissible: !isHouseSaving,
  });

  useModalFocus({
    dialogRef: skinDialogRef,
    isOpen: isSkinDialogOpen,
    onDismiss: () => {
      if (!isCharacterSaving) setIsSkinDialogOpen(false);
    },
    isDismissible: !isCharacterSaving,
  });

  const closePetDialog = () => {
    if (isPetSaving) return;
    setPetError('');
    setActivePetDialog(null);
  };

  const closeSkinDialog = () => {
    if (isCharacterSaving) return;
    setSkinError('');
    setIsSkinDialogOpen(false);
  };

  const closeHouseDialog = () => {
    if (isHouseSaving) return;
    setHouseError('');
    setIsHouseDialogOpen(false);
  };

  const selectHouse = (houseId: StudentHouseDesignId | 'custom' | null) => {
    setHouseError('');
    void onSelectHouse(houseId).then((saved) => {
      if (saved) closeHouseDialog();
      else setHouseError('집을 바꾸지 못했습니다.');
    });
  };

  return (
    <div className="student-view student-overview-view">
      <h1 className="sr-only">학생 개요</h1>

      <section className="student-overview-hero" aria-label="학생 개요">
        <StudentPetStage
          pet={pet}
          hasUnreadMail={hasUnreadMail}
          isHouseRepaired={isHouseRepaired}
          activeCharacterId={activeCharacterId}
          activeHouseId={activeHouseId}
          customHouseTheme={customHouseDesign?.theme ?? null}
          todayEmotion={todayEmotion}
          onOpenMailbox={onOpenMailbox}
          onOpenLibrary={onOpenLibrary}
          onOpenEmotions={onOpenEmotions}
          onOpenEgg={STUDENT_FEATURE_RELEASES.petEgg ? () => {
            setPetError('');
            setActivePetDialog('feed');
          } : undefined}
          onOpenPetPicker={() => {
            setPetError('');
            setActivePetDialog('picker');
          }}
          onOpenSkinPicker={() => {
            setSkinError('');
            setIsSkinDialogOpen(true);
          }}
          onOpenHousePicker={() => {
            setHouseError('');
            setIsHouseDialogOpen(true);
          }}
          onMovePet={(position) => { void onMovePet(position); }}
          onMoveGoma={(position) => { void onMoveGoma(position); }}
        />
      </section>

      <div className="student-overview-destinations">
        <StudentSectionCard
          tone="mission"
          icon={ClipboardCheck}
          title="고마 벌기"
          direction="left"
          onClick={onOpenMissions}
        />
        <div className="student-overview-balance-dock">
          <StudentBalanceSummary
            studentNumber={studentNumber}
            profileAssignments={profileAssignments}
            balance={balance}
            availableBalance={availableBalance}
            reservedAmount={reservedAmount}
            isLoading={isLoading}
            onProfileClick={onOpenProfileShop}
          />
        </div>
        <StudentPurchaseCard
          onOpen={onOpenStore}
        />
      </div>

      {isSkinDialogOpen ? (
        <div className="student-pet-dialog-backdrop" role="presentation" onClick={closeSkinDialog}>
          <section
            ref={skinDialogRef}
            className="student-pet-dialog student-skin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-skin-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="student-pet-dialog-close"
              onClick={closeSkinDialog}
              disabled={isCharacterSaving}
              aria-label="스킨 선택 창 닫기"
            >
              <X size={22} aria-hidden="true" />
            </button>
            <div className="student-pet-dialog-copy">
              <span>스킨 고르기</span>
              <h2 id="student-skin-dialog-title">함께할 고마를 골라 주세요</h2>
            </div>
            <div className="student-skin-picker">
              {[DEFAULT_STUDENT_CHARACTER, ...ownedCharacters].map((character) => {
                const active = activeCharacterId === character.id;
                return (
                  <button
                    key={character.id}
                    type="button"
                    aria-pressed={active}
                    disabled={isCharacterSaving || active}
                    onClick={() => {
                      setSkinError('');
                      void onSelectCharacter(character.id).then((saved) => {
                        if (saved) closeSkinDialog();
                        else setSkinError('스킨을 바꾸지 못했습니다.');
                      });
                    }}
                  >
                    <img src={character.imageSrc} alt="" />
                    <span>
                      <strong>{character.name}</strong>
                      <small>{active ? '사용 중' : '선택하기'}</small>
                    </span>
                    {active ? <Check size={20} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            {skinError ? <p className="student-pet-dialog-error" role="alert">{skinError}</p> : null}
          </section>
        </div>
      ) : null}

      {isHouseDialogOpen ? (
        <div className="student-pet-dialog-backdrop" role="presentation" onClick={closeHouseDialog}>
          <section
            ref={houseDialogRef}
            className="student-pet-dialog student-skin-dialog student-house-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-house-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="student-pet-dialog-close"
              onClick={closeHouseDialog}
              disabled={isHouseSaving}
              aria-label="집 선택 창 닫기"
            >
              <X size={22} aria-hidden="true" />
            </button>
            <div className="student-pet-dialog-copy">
              <span>집 고르기</span>
              <h2 id="student-house-dialog-title">살고 싶은 집을 골라 주세요</h2>
            </div>
            <div className="student-skin-picker student-house-picker">
              <button
                type="button"
                aria-pressed={activeHouseId === null}
                disabled={isHouseSaving || activeHouseId === null}
                onClick={() => selectHouse(null)}
              >
                <img src="/student-house-after.png" alt="" />
                <span><strong>나무집</strong><small>{activeHouseId === null ? '사용 중' : '선택하기'}</small></span>
                {activeHouseId === null ? <Check size={20} aria-hidden="true" /> : null}
              </button>
              {ownedHouses.map((house) => {
                const active = activeHouseId === house.id;
                return (
                  <button
                    key={house.id}
                    type="button"
                    aria-pressed={active}
                    disabled={isHouseSaving || active}
                    onClick={() => selectHouse(house.id)}
                  >
                    <img src={house.imageSrc} alt="" />
                    <span><strong>{house.name}</strong><small>{active ? '사용 중' : '선택하기'}</small></span>
                    {active ? <Check size={20} aria-hidden="true" /> : null}
                  </button>
                );
              })}
              {customHouseDesign ? (
                <button
                  type="button"
                  aria-pressed={activeHouseId === 'custom'}
                  disabled={isHouseSaving || activeHouseId === 'custom'}
                  onClick={() => selectHouse('custom')}
                >
                  <img className={`student-home-house-${customHouseDesign.theme}`} src="/student-house-after.png" alt="" />
                  <span><strong>{customHouseDesign.name}</strong><small>{activeHouseId === 'custom' ? '사용 중' : '선택하기'}</small></span>
                  {activeHouseId === 'custom' ? <Check size={20} aria-hidden="true" /> : null}
                </button>
              ) : null}
            </div>
            {houseError ? <p className="student-pet-dialog-error" role="alert">{houseError}</p> : null}
          </section>
        </div>
      ) : null}

      {activePetDialog ? (
        <div className="student-pet-dialog-backdrop" role="presentation" onClick={closePetDialog}>
          <section
            ref={petDialogRef}
            className="student-pet-dialog"
            role="dialog"
            aria-modal={isFeedConfirmationOpen ? undefined : 'true'}
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
                <span
                  className="student-pet-dialog-egg-art"
                  style={{ '--student-pet-egg-stage': eggStage } as CSSProperties}
                  aria-hidden="true"
                />
                <div className="student-pet-dialog-copy">
                  <h2 id="student-pet-dialog-title">알 성장</h2>
                  <div className="student-pet-dialog-progress" aria-label={`알 성장 ${pet.fedAmount} / ${STUDENT_PET_HATCH_AMOUNT} 고마`}>
                    <div className="student-pet-dialog-progress-track" aria-hidden="true">
                      <span style={{ width: `${(pet.fedAmount / STUDENT_PET_HATCH_AMOUNT) * 100}%` }} />
                    </div>
                    <strong>{pet.fedAmount} / {STUDENT_PET_HATCH_AMOUNT}</strong>
                  </div>
                  <p>부화까지 {STUDENT_PET_HATCH_AMOUNT - pet.fedAmount} 고마</p>
                </div>
                <button
                  ref={feedButtonRef}
                  type="button"
                  className="student-pet-dialog-primary"
                  disabled={isPetSaving || availableBalance < 5}
                  onClick={() => {
                    setPetError('');
                    setIsFeedConfirmationOpen(true);
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
                  {pet.ownedPets.map((ownedPet) => {
                    const ownedKind = getStudentPetKind(ownedPet.kind);
                    return (
                    <button
                      key={ownedPet.id}
                      type="button"
                      aria-pressed={pet.activePetId === ownedPet.id}
                      disabled={isPetSaving}
                      onClick={() => {
                        void onChangePet(ownedPet.id).then((saved) => {
                          if (saved) closePetDialog();
                          else setPetError('펫을 바꾸지 못했습니다.');
                        });
                      }}
                    >
                      <span aria-hidden="true">{ownedKind.emoji}</span>
                      <strong>{ownedPet.name || ownedKind.label}</strong>
                    </button>
                    );
                  })}
                </div>
              </>
            ) : null}

            {petError ? <p className="student-pet-dialog-error" role="alert">{petError}</p> : null}
          </section>
        </div>
      ) : null}
      <StudentConfirmDialog
        isOpen={isFeedConfirmationOpen}
        kicker="알 먹이기"
        title={`${STUDENT_PET_FEED_AMOUNT} 고마를 사용할까요?`}
        description="먹이를 주면 사용 가능한 고마가 줄어요."
        confirmLabel="먹이기"
        isPending={isPetSaving}
        returnFocusRef={feedButtonRef}
        onCancel={() => setIsFeedConfirmationOpen(false)}
        onConfirm={() => {
          void onFeedPet().then((saved) => {
            if (!saved) {
              setPetError('먹이를 주지 못했습니다. 잔액을 확인해 주세요.');
              setIsFeedConfirmationOpen(false);
              return;
            }
            setIsFeedConfirmationOpen(false);
            if (pet.fedAmount + STUDENT_PET_FEED_AMOUNT >= STUDENT_PET_HATCH_AMOUNT) {
              setActivePetDialog('name');
            }
          });
        }}
      />
    </div>
  );
}
