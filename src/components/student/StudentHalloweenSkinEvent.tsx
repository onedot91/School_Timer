import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  STUDENT_CHARACTER_PRIZES,
  STUDENT_HALLOWEEN_CHARACTER_IDS,
  type StudentCharacterPrizeId,
} from '../../lib/studentEconomy';
import { useModalFocus } from '../../lib/useModalFocus';

interface StudentHalloweenSkinEventProps {
  /** 지금 받을 수 있는 할로윈 스킨. 비어 있으면 창을 열지 않는다. */
  readonly claimableIds: readonly string[];
  /** 다른 필수 창(펫 이름 짓기 등)이 열려 있으면 기다린다. */
  readonly isBlocked: boolean;
  readonly isSaving: boolean;
  readonly onClaim: (characterId: StudentCharacterPrizeId) => Promise<boolean>;
}

const HALLOWEEN_CHARACTERS = STUDENT_CHARACTER_PRIZES.filter((character) => STUDENT_HALLOWEEN_CHARACTER_IDS.includes(character.id));

// 홈에 들어올 때마다 아직 받지 않은 학생에게 한 번 띄운다. 닫으면 다음에 홈에 들어올 때 다시 뜬다.
export default function StudentHalloweenSkinEvent({ claimableIds, isBlocked, isSaving, onClaim }: StudentHalloweenSkinEventProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<StudentCharacterPrizeId | null>(null);
  const [claimedId, setClaimedId] = useState<StudentCharacterPrizeId | null>(null);
  const [error, setError] = useState('');
  const hasOpenedRef = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const claimedCharacter = HALLOWEEN_CHARACTERS.find((character) => character.id === claimedId) ?? null;

  useEffect(() => {
    if (hasOpenedRef.current || isBlocked || claimableIds.length === 0) return;
    hasOpenedRef.current = true;
    setIsOpen(true);
  }, [claimableIds.length, isBlocked]);

  const close = () => {
    if (isSaving) return;
    setIsOpen(false);
    setError('');
  };

  useModalFocus({
    dialogRef,
    isOpen,
    initialFocusRef: claimedCharacter ? doneButtonRef : undefined,
    onDismiss: close,
    isDismissible: !isSaving,
  });

  if (!isOpen) return null;

  const claim = () => {
    if (!selectedId || isSaving) return;
    setError('');
    void onClaim(selectedId).then((saved) => {
      if (saved) setClaimedId(selectedId);
      else setError('스킨을 받지 못했습니다. 잠시 후 다시 눌러 주세요.');
    });
  };

  return (
    <div className="student-pet-dialog-backdrop" role="presentation" onClick={close}>
      <section
        ref={dialogRef}
        className="student-pet-dialog student-skin-dialog student-halloween-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-halloween-dialog-title"
        aria-busy={isSaving}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="student-pet-dialog-close" onClick={close} disabled={isSaving} aria-label="할로윈 선물 창 닫기">
          <X size={22} aria-hidden="true" />
        </button>
        {claimedCharacter ? (
          <div className="student-halloween-done">
            <img src={claimedCharacter.imageSrc} alt="" />
            <h2 id="student-halloween-dialog-title">{claimedCharacter.name}를 받았어요</h2>
            <button ref={doneButtonRef} type="button" className="student-pet-dialog-primary" onClick={close}>확인</button>
          </div>
        ) : (
          <>
            <div className="student-pet-dialog-copy">
              <span>할로윈 선물</span>
              <h2 id="student-halloween-dialog-title">스킨 하나를 골라 주세요</h2>
              <p>한 번만 받을 수 있어요.</p>
            </div>
            <div className="student-halloween-picker" role="radiogroup" aria-labelledby="student-halloween-dialog-title">
              {HALLOWEEN_CHARACTERS.map((character) => {
                const isClaimable = claimableIds.includes(character.id);
                const isSelected = selectedId === character.id;
                return (
                  <button
                    key={character.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={!isClaimable || isSaving}
                    onClick={() => { setError(''); setSelectedId(character.id); }}
                  >
                    <img src={character.imageSrc} alt="" />
                    <strong>{character.name}</strong>
                    {isClaimable ? null : <small>이미 있어요</small>}
                    {isSelected ? <Check className="student-halloween-check" size={22} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            <div className="student-halloween-actions">
              {error ? <p className="student-pet-dialog-error" role="alert">{error}</p> : null}
              <button type="button" className="student-pet-dialog-primary" disabled={!selectedId || isSaving} onClick={claim}>
                {isSaving ? '받는 중…' : '이 스킨 받기'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
