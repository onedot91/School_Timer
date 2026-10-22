import { useEffect, useRef, useState } from 'react';
import { Check, ClipboardCheck, Sparkles, X } from 'lucide-react';
import type { StudentEmotionDefinition } from '../../lib/studentEmotion';
import {
  STUDENT_PET_FEED_AMOUNT,
  STUDENT_PET_HATCH_AMOUNT,
  STUDENT_PET_NAME_MAX_LENGTH,
  getStudentPetEggStage,
  getStudentPetHatchMessage,
  getStudentPetKind,
  type StudentPetState,
} from '../../lib/studentPet';
import { useModalFocus } from '../../lib/useModalFocus';
import StudentBalanceSummary from './StudentBalanceSummary';
import { EGG_HATCH_SCENE_MS, EGG_HATCH_SCENE_REDUCED_MS, StudentPetEggFeed, StudentPetEggHatch } from './StudentPetEgg';
import StudentPetPortrait from './StudentPetPortrait';
import StudentPetStage from './StudentPetStage';
import {
  DEFAULT_STUDENT_CHARACTER,
  STUDENT_CHARACTER_PRIZES,
  STUDENT_HOUSE_DESIGNS,
  type StudentCharacterPrizeId,
  type StudentCustomHouseDesign,
  type StudentHouseDesignId,
  type PendingTeacherDeduction,
} from '../../lib/studentEconomy';
import StudentPurchaseCard from './StudentPurchaseCard';
import StudentSectionCard from './StudentSectionCard';
import type { FailureProfileAssignments } from '../../lib/failureExhibition';
import { isStudentFeatureOpen } from '../../lib/studentFeatureRelease';
import StableLabel from '../StableLabel';
import { CLASS_PREP_BLOCKED_MESSAGE } from '../../lib/classPrepGuard';
import { useIsClassPrepBlocking } from '../../lib/classPrepGuardContext';

interface StudentOverviewPageProps {
  studentNumber: number;
  profileAssignments: FailureProfileAssignments;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading: boolean;
  pendingDeductions?: readonly PendingTeacherDeduction[];
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
  pendingDeductions,
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
  const isClassPrepBlocking = useIsClassPrepBlocking();
  const [activePetDialog, setActivePetDialog] = useState<'feed' | 'hatching' | 'name' | 'picker' | null>(null);
  const [eggFeedCount, setEggFeedCount] = useState(0);
  const [eggCracked, setEggCracked] = useState(false);
  const hatchTimerRef = useRef(0);
  const [petNameDraft, setPetNameDraft] = useState(pet.name);
  const [petError, setPetError] = useState('');
  const [isSkinDialogOpen, setIsSkinDialogOpen] = useState(false);
  const [skinError, setSkinError] = useState('');
  const [isHouseDialogOpen, setIsHouseDialogOpen] = useState(false);
  const [houseError, setHouseError] = useState('');
  const petDialogRef = useRef<HTMLElement>(null);
  const skinDialogRef = useRef<HTMLElement>(null);
  const houseDialogRef = useRef<HTMLElement>(null);
  const feedButtonRef = useRef<HTMLButtonElement>(null);
  const petNameInputRef = useRef<HTMLInputElement>(null);
  const needsPetName = pet.pendingNamePetId !== null;
  // The hatch scene and naming the hatched pet are required steps, so they cannot be dismissed.
  const isNamingPet = activePetDialog === 'name' || activePetDialog === 'hatching';
  const eggStage = getStudentPetEggStage(pet.fedAmount);
  const ownedCharacters = STUDENT_CHARACTER_PRIZES.filter((character) => ownedCharacterIds.includes(character.id));
  const ownedHouses = STUDENT_HOUSE_DESIGNS.filter((house) => ownedHouseIds.includes(house.id));

  useEffect(() => () => window.clearTimeout(hatchTimerRef.current), []);

  // Each tap feeds right away; the button shows the cost and is disabled while a feed is saving.
  const feedEgg = () => {
    setPetError('');
    if (isClassPrepBlocking) {
      setPetError(CLASS_PREP_BLOCKED_MESSAGE);
      return;
    }
    void onFeedPet().then((saved) => {
      if (!saved) {
        setPetError('먹이를 주지 못했습니다. 잔액을 확인해 주세요.');
        return;
      }
      const nextFed = pet.fedAmount + STUDENT_PET_FEED_AMOUNT;
      if (nextFed >= STUDENT_PET_HATCH_AMOUNT) {
        // Play the hatch scene, then ask for the new pet's name.
        setActivePetDialog('hatching');
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.clearTimeout(hatchTimerRef.current);
        hatchTimerRef.current = window.setTimeout(() => {
          setEggFeedCount(0);
          setActivePetDialog('name');
        }, reduced ? EGG_HATCH_SCENE_REDUCED_MS : EGG_HATCH_SCENE_MS);
        return;
      }
      setEggCracked(getStudentPetEggStage(nextFed) > eggStage);
      setEggFeedCount((count) => count + 1);
    });
  };

  useEffect(() => {
    setPetNameDraft(pet.name);
    if (needsPetName && activePetDialog === null) setActivePetDialog('name');
  }, [activePetDialog, needsPetName, pet.name]);

  useModalFocus({
    dialogRef: petDialogRef,
    isOpen: activePetDialog !== null,
    initialFocusRef: activePetDialog === 'name' ? petNameInputRef : undefined,
    onDismiss: () => {
      if (!isPetSaving && !isNamingPet) setActivePetDialog(null);
    },
    isDismissible: !isPetSaving && !isNamingPet,
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

  const savePetName = () => {
    if (isPetSaving || petNameDraft.trim().length === 0) return;
    void onNamePet(petNameDraft).then((saved) => {
      if (saved) closePetDialog();
      else setPetError('이름을 저장하지 못했습니다.');
    });
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
          onOpenEgg={isStudentFeatureOpen('petEgg') ? () => {
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
            pendingDeductions={pendingDeductions}
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
                <img src="/student-house-after.webp" alt="" />
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
                  <img className={`student-home-house-${customHouseDesign.theme}`} src="/student-house-after.webp" alt="" />
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
        <div className="student-pet-dialog-backdrop" role="presentation" onClick={isNamingPet ? undefined : closePetDialog}>
          <section
            ref={petDialogRef}
            className="student-pet-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-pet-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            {isNamingPet ? null : (
              <button
                type="button"
                className="student-pet-dialog-close"
                onClick={closePetDialog}
                disabled={isPetSaving}
                aria-label="펫 창 닫기"
              >
                <X size={22} aria-hidden="true" />
              </button>
            )}

            {activePetDialog === 'feed' ? (
              <StudentPetEggFeed
                fedAmount={pet.fedAmount}
                hatchAmount={STUDENT_PET_HATCH_AMOUNT}
                feedAmount={STUDENT_PET_FEED_AMOUNT}
                stage={eggStage}
                availableBalance={availableBalance}
                isSaving={isPetSaving}
                feedCount={eggFeedCount}
                cracked={eggCracked}
                feedButtonRef={feedButtonRef}
                onRequestFeed={feedEgg}
              />
            ) : null}

            {activePetDialog === 'hatching' ? <StudentPetEggHatch /> : null}

            {activePetDialog === 'name' ? (
              <>
                <div className="student-pet-hatch" aria-hidden="true">
                  <svg className="student-pet-hatch-shell student-pet-hatch-shell-left" viewBox="0 0 40 28">
                    <path d="M3 6 L9 12 L15 4 L21 11 L27 4 L33 12 L37 6 C39 18 31 26 20 26 C9 26 1 18 3 6 Z" />
                  </svg>
                  <StudentPetPortrait kind={pet.petKind} className="student-pet-dialog-visual student-pet-hatch-pet" />
                  <svg className="student-pet-hatch-shell student-pet-hatch-shell-right" viewBox="0 0 40 28">
                    <path d="M3 6 L9 12 L15 4 L21 11 L27 4 L33 12 L37 6 C39 18 31 26 20 26 C9 26 1 18 3 6 Z" />
                  </svg>
                  <Sparkles className="student-pet-hatch-sparkle student-pet-hatch-sparkle-left" />
                  <Sparkles className="student-pet-hatch-sparkle student-pet-hatch-sparkle-right" />
                  {petNameDraft.trim() ? <strong className="student-pet-hatch-name">{petNameDraft.trim()}</strong> : null}
                </div>
                <div className="student-pet-dialog-copy">
                  <h2 id="student-pet-dialog-title">{getStudentPetHatchMessage(pet.petKind)}</h2>
                </div>
                <label className="student-pet-name-field">
                  <span className="sr-only">펫 이름</span>
                  <input
                    ref={petNameInputRef}
                    value={petNameDraft}
                    maxLength={STUDENT_PET_NAME_MAX_LENGTH}
                    placeholder="이름을 지어 주세요"
                    onChange={(event) => {
                      setPetNameDraft(event.target.value);
                      setPetError('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                      event.preventDefault();
                      savePetName();
                    }}
                  />
                  <small>{petNameDraft.length}/{STUDENT_PET_NAME_MAX_LENGTH}</small>
                </label>
                <button
                  type="button"
                  className="student-pet-dialog-primary"
                  disabled={isPetSaving || petNameDraft.trim().length === 0}
                  onClick={savePetName}
                >
                  <Check size={20} aria-hidden="true" />
                  <StableLabel busy={isPetSaving} busyLabel="저장 중" label="이름 짓기" />
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
                      <StudentPetPortrait kind={ownedPet.kind} />
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
    </div>
  );
}
