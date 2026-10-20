import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check, ImageOff, X } from 'lucide-react';
import { STUDENT_CHARACTER_PRIZES, getStudentCharacterInitials, hasStudentCharacterInitials, type StudentCharacterChoice, type StudentCharacterPrizeId, type StudentEconomyAction, type StudentEconomyState } from '../../lib/studentEconomy';
import { useModalFocus } from '../../lib/useModalFocus';

interface StudentCharacterInitialChoiceProps {
  readonly choice: StudentCharacterChoice;
  readonly state: StudentEconomyState;
  readonly isSaving: boolean;
  readonly returnFocusRef: RefObject<HTMLElement | null>;
  readonly onAction: (action: StudentEconomyAction) => Promise<boolean>;
  readonly onClose: () => void;
}

interface StudentCharacterInitialCardProps {
  readonly character: { readonly name: string; readonly imageSrc: string };
  readonly number: number;
  readonly isSelected: boolean;
  readonly isRevealed: boolean;
  readonly disabled: boolean;
  readonly onChoose: () => void;
}

export function StudentCharacterInitialCard({ character, number, isSelected, isRevealed, disabled, onChoose }: StudentCharacterInitialCardProps) {
  const [imageStatus, setImageStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const label = isRevealed ? character.name : getStudentCharacterInitials(character.name);
  const showSkin = isRevealed && imageStatus !== 'loading';

  return (
    <button type="button" className="student-gacha-initial-card" disabled={disabled}
      data-selected={isSelected} data-revealed={isRevealed} data-image-ready={isRevealed && imageStatus === 'ready'}
      aria-label={`${number}번 ${label}${isRevealed ? ', 선택됨' : ''}`} onClick={onChoose}>
      <span className="student-gacha-initial-number" aria-hidden="true">{isRevealed ? <Check /> : String(number).padStart(2, '0')}</span>
      <span className="student-gacha-initial-art" data-visible={showSkin} aria-hidden="true">
        <span className="student-gacha-initial-silhouette" />
        <span className="student-gacha-initial-question">?</span>
        {isRevealed && imageStatus === 'ready' ? <span className="student-gacha-initial-burst">
          {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
        </span> : null}
        {isRevealed && imageStatus !== 'failed' ? <img className="student-gacha-initial-skin" src={character.imageSrc} alt=""
          onLoad={() => setImageStatus('ready')} onError={() => setImageStatus('failed')} /> : null}
        {isRevealed && imageStatus === 'failed' ? <span className="student-gacha-initial-image-error"><ImageOff /><span>이미지 없음</span></span> : null}
      </span>
      <strong className="student-gacha-initial-label">{label}</strong>
    </button>
  );
}

export default function StudentCharacterInitialChoice({ choice, state, isSaving, returnFocusRef, onAction, onClose }: StudentCharacterInitialChoiceProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef(false);
  const [selectedId, setSelectedId] = useState<StudentCharacterPrizeId | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();
  const result = isSaved && selectedId && state.ownedCharacterIds.includes(selectedId) && !state.pendingCharacterChoice
    ? STUDENT_CHARACTER_PRIZES.find((prize) => prize.id === selectedId) : null;
  const busy = isSaving || isPending || (isSaved && !result);
  const isDismissible = !isSaving && !isPending;
  const eligibleChoices = choice.characterIds.filter((id) => {
    const character = STUDENT_CHARACTER_PRIZES.find((prize) => prize.id === id);
    return character && hasStudentCharacterInitials(character.name);
  });
  // 이전에 받아 둔 후보가 모두 빠지면 선택할 수 없게 되므로 원래 후보를 그대로 보여 준다.
  const displayedChoices = eligibleChoices.length > 0 ? eligibleChoices : result ? [result.id] : choice.characterIds;

  useModalFocus({ dialogRef, isOpen: true, returnFocusRef, isDismissible, onDismiss: onClose });
  useEffect(() => { if (result) confirmRef.current?.focus({ preventScroll: true }); }, [result]);

  const choose = async (characterId: StudentCharacterPrizeId) => {
    if (pendingRef.current || busy || result) return;
    pendingRef.current = true;
    setIsPending(true);
    setError('');
    setSelectedId(characterId);
    try {
      if (await onAction({ type: 'choose_draw_character', drawRequestId: choice.drawRequestId, characterId })) setIsSaved(true);
      else setError('선택 결과 확인 필요');
    } catch {
      setError('선택 결과 확인 필요');
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  };

  return createPortal(
    <div className="student-confirm-dialog-backdrop" role="presentation" onClick={() => { if (isDismissible) onClose(); }}>
      <section ref={dialogRef} className="student-confirm-dialog student-gacha-initial-choice" data-result={Boolean(result)} role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="student-confirm-dialog-close" aria-label="초성 선택 창 닫기" disabled={!isDismissible} onClick={onClose}><X aria-hidden="true" /></button>
        <h2 id={titleId}>{result ? '스킨 획득!' : '초성 선택하기'}</h2>
        <div className="student-gacha-initial-options" data-count={displayedChoices.length}>
          {displayedChoices.map((id, index) => {
            const character = STUDENT_CHARACTER_PRIZES.find((prize) => prize.id === id);
            return character ? <StudentCharacterInitialCard key={id} character={character} number={index + 1}
              isSelected={selectedId === id && (busy || Boolean(result))} isRevealed={result?.id === id}
              disabled={busy || Boolean(result)} onChoose={() => void choose(id)} /> : null;
          })}
        </div>
        <div className="student-gacha-initial-footer">
          {!result && eligibleChoices.length === 0 ? <div className="student-confirm-dialog-actions" data-single-action="true">
            <button type="button" disabled={busy} onClick={() => void choose(choice.characterIds[0])}>남은 스킨 받기</button>
          </div> : null}
          {busy ? <p role="status">선택 결과를 확인하고 있어요.</p> : null}
          {error ? <p role="alert">선택 결과를 확인하지 못했어요. 저장 상태를 확인한 뒤 다시 시도해 주세요.</p> : null}
          {result ? <>
            <p role="status">{result.name} 스킨이 적용됐어요.</p>
            <div className="student-confirm-dialog-actions" data-single-action="true"><button ref={confirmRef} type="button" onClick={onClose}>확인</button></div>
          </> : null}
        </div>
      </section>
    </div>, document.body,
  );
}
