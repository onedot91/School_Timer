import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import {
  STUDENT_CHARACTER_DRAW_PRICE,
  STUDENT_CHARACTER_PRIZES,
  type StudentCharacterPrizeId,
  type StudentEconomyAction,
  type StudentEconomyState,
} from '../../lib/studentEconomy';
import { getDailyGachaCapsules } from '../../lib/studentGachaCapsules';
import { getStudentClawDropMotion } from '../../lib/studentGachaMotion';
import { useModalFocus } from '../../lib/useModalFocus';
import StudentConfirmDialog from './StudentConfirmDialog';

interface StudentCharacterGachaProps {
  readonly tabPanelId?: string;
  readonly tabPanelLabelledBy?: string;
  readonly state: StudentEconomyState;
  readonly availableBalance: number;
  readonly isSaving: boolean;
  readonly onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

type GachaStage = 'ready' | 'aiming' | 'rolling' | 'result';

interface ClawPositionStyle extends CSSProperties {
  readonly '--student-claw-x': string;
  readonly '--student-claw-drop': string;
  readonly '--student-claw-cable-scale': number;
}

const CLAW_POSITION_COUNT = 5;
const INITIAL_CLAW_POSITION = 2;
const CLAW_POSITIONS = ['15cqw', '32.5cqw', '50cqw', '67.5cqw', '85cqw'] as const;
const ROLL_DURATION_MS = 2300;
const REDUCED_ROLL_DURATION_MS = 260;
const getClawPosition = (position: number) => CLAW_POSITIONS[position] ?? CLAW_POSITIONS[INITIAL_CLAW_POSITION];
const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const getCharacterById = (characterId: StudentCharacterPrizeId | null) => (
  STUDENT_CHARACTER_PRIZES.find((character) => character.id === characterId) ?? null
);

export default function StudentCharacterGacha({
  tabPanelId,
  tabPanelLabelledBy,
  state,
  availableBalance,
  isSaving,
  onAction,
}: StudentCharacterGachaProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [stage, setStage] = useState<GachaStage>('ready');
  const [clawPosition, setClawPosition] = useState(INITIAL_CLAW_POSITION);
  const [drawnCharacterId, setDrawnCharacterId] = useState<StudentCharacterPrizeId | null>(null);
  const [isRollFinished, setIsRollFinished] = useState(false);
  const [clawDropMotion, setClawDropMotion] = useState({ dropDistance: 0, cableScale: 1 });
  const ownedBeforeDrawRef = useRef<readonly StudentCharacterPrizeId[]>([]);
  const isDrawStartingRef = useRef(false);
  const resultDialogRef = useRef<HTMLElement>(null);
  const controlPanelRef = useRef<HTMLElement>(null);
  const clawCableRef = useRef<HTMLElement>(null);
  const caughtCapsuleRef = useRef<HTMLSpanElement>(null);
  const selectedCapsuleRef = useRef<HTMLImageElement>(null);

  const ownedCharacters = STUDENT_CHARACTER_PRIZES.filter((character) => state.ownedCharacterIds.includes(character.id));
  const canDraw = availableBalance >= STUDENT_CHARACTER_DRAW_PRICE && ownedCharacters.length < STUDENT_CHARACTER_PRIZES.length;
  const drawnCharacter = getCharacterById(drawnCharacterId);
  const clawStyle: ClawPositionStyle = {
    '--student-claw-x': getClawPosition(clawPosition),
    '--student-claw-drop': `${clawDropMotion.dropDistance}px`,
    '--student-claw-cable-scale': clawDropMotion.cableScale,
  };
  const dailyCapsules = getDailyGachaCapsules(getKoreanDateKey());
  const selectedCapsule = dailyCapsules[clawPosition];

  useEffect(() => {
    if (stage !== 'rolling') return;
    const drawnId = state.ownedCharacterIds.find((characterId) => !ownedBeforeDrawRef.current.includes(characterId));
    if (drawnId) setDrawnCharacterId(drawnId);
  }, [stage, state.ownedCharacterIds]);

  useEffect(() => {
    if (stage !== 'rolling') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finishId = window.setTimeout(
      () => setIsRollFinished(true),
      prefersReducedMotion ? REDUCED_ROLL_DURATION_MS : ROLL_DURATION_MS,
    );
    return () => {
      window.clearTimeout(finishId);
    };
  }, [stage]);

  useEffect(() => {
    if (stage === 'rolling' && isRollFinished && drawnCharacterId) setStage('result');
  }, [drawnCharacterId, isRollFinished, stage]);

  useModalFocus({
    dialogRef: resultDialogRef,
    isOpen: stage === 'result',
    returnFocusRef: controlPanelRef,
    onDismiss: () => {
      isDrawStartingRef.current = false;
      setStage('ready');
    },
  });

  const startDraw = async () => {
    if (isDrawStartingRef.current || stage !== 'aiming') return;
    const cable = clawCableRef.current;
    const caughtCapsule = caughtCapsuleRef.current;
    const targetCapsule = selectedCapsuleRef.current;
    if (!cable || !caughtCapsule || !targetCapsule) return;

    const cableRect = cable.getBoundingClientRect();
    const caughtCapsuleRect = caughtCapsule.getBoundingClientRect();
    const targetCapsuleRect = targetCapsule.getBoundingClientRect();
    setClawDropMotion(getStudentClawDropMotion({
      cableHeight: cableRect.height,
      caughtCapsuleCenterY: caughtCapsuleRect.top + caughtCapsuleRect.height / 2,
      targetCapsuleCenterY: targetCapsuleRect.top + targetCapsuleRect.height / 2,
    }));
    isDrawStartingRef.current = true;
    ownedBeforeDrawRef.current = state.ownedCharacterIds;
    setDrawnCharacterId(null);
    setIsRollFinished(false);
    setStage('rolling');
    const saved = await onAction({ type: 'draw_character' });
    if (!saved) {
      isDrawStartingRef.current = false;
      setStage('ready');
    }
  };

  const closeResult = () => {
    isDrawStartingRef.current = false;
    setStage('ready');
  };

  const beginAiming = () => {
    setClawPosition(INITIAL_CLAW_POSITION);
    setIsConfirmOpen(false);
    setStage('aiming');
  };

  const moveClaw = (direction: -1 | 1) => {
    setClawPosition((current) => Math.min(CLAW_POSITION_COUNT - 1, Math.max(0, current + direction)));
  };

  const handleControlsKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (stage !== 'aiming') return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveClaw(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveClaw(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      void startDraw();
    }
  };

  return (
    <section
      id={tabPanelId}
      className={`student-character-gacha stage-${stage}`}
      role={tabPanelId ? 'tabpanel' : undefined}
      aria-labelledby={tabPanelLabelledBy ?? 'student-character-gacha-title'}
      aria-live="polite"
      aria-busy={stage === 'rolling'}
    >
      <svg className="student-claw-capsule-filter" aria-hidden="true" focusable="false">
        <filter id="student-claw-capsule-chroma-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 -1 1 0 0" />
        </filter>
      </svg>
      <div className="student-claw-machine">
        <h3 id="student-character-gacha-title" className="sr-only">고마 인형 뽑기</h3>
        <div className="student-claw-machine-window">
          <div className="student-claw-machine-glow" aria-hidden="true" />
          <div className="student-claw-machine-rail" aria-hidden="true" />
          <div className="student-claw-machine-claw" style={clawStyle} aria-hidden="true">
            <i ref={clawCableRef} /><b /><em />
            <span ref={caughtCapsuleRef}>{selectedCapsule ? <img src={selectedCapsule} alt="" draggable={false} /> : null}</span>
          </div>
          <div className="student-claw-machine-toys" aria-hidden="true">
            {dailyCapsules.map((src, index) => (
              <img
                key={src}
                ref={index === clawPosition ? selectedCapsuleRef : undefined}
                className={index === clawPosition ? 'is-target' : undefined}
                src={src}
                alt=""
                draggable={false}
              />
            ))}
          </div>
        </div>
        <aside
          ref={controlPanelRef}
          className="student-claw-control-panel"
          aria-label="인형 뽑기 조작"
          tabIndex={stage === 'aiming' ? 0 : -1}
          onKeyDown={handleControlsKeyDown}
        >
          <div className="student-claw-control-heading">
            <span>{stage === 'ready' ? '뽑기 시작' : stage === 'aiming' ? '집게 조작' : '뽑는 중'}</span>
            <strong>{STUDENT_CHARACTER_DRAW_PRICE} 고마</strong>
          </div>

          {stage === 'ready' ? (
            <button
              type="button"
              className="student-character-draw-button"
              disabled={!canDraw || isSaving}
              aria-describedby="student-character-gacha-help"
              onClick={() => setIsConfirmOpen(true)}
            >
              <Sparkles aria-hidden="true" />
              {ownedCharacters.length === STUDENT_CHARACTER_PRIZES.length ? '모든 스킨을 모았어요' : '고마 스킨 뽑기'}
            </button>
          ) : (
            <div className="student-claw-operation">
              <div className="student-claw-position" role="status" aria-label={`${clawPosition + 1}번 위치`}>
                {Array.from({ length: CLAW_POSITION_COUNT }, (_, index) => (
                  <span key={index} className={index === clawPosition ? 'is-active' : ''} aria-hidden="true" />
                ))}
              </div>
              <div className="student-claw-direction-buttons">
                <button type="button" disabled={stage !== 'aiming' || clawPosition === 0} onClick={() => moveClaw(-1)}>
                  <ArrowLeft aria-hidden="true" /><span>왼쪽</span>
                </button>
                <button type="button" disabled={stage !== 'aiming'} onClick={() => void startDraw()}>
                  <ArrowDown aria-hidden="true" /><span>{stage === 'rolling' ? '뽑는 중' : '집게 내리기'}</span>
                </button>
                <button type="button" disabled={stage !== 'aiming' || clawPosition === CLAW_POSITION_COUNT - 1} onClick={() => moveClaw(1)}>
                  <ArrowRight aria-hidden="true" /><span>오른쪽</span>
                </button>
              </div>
              <p>버튼이나 방향키로 움직여요.</p>
            </div>
          )}

          <p id="student-character-gacha-help" className={`student-character-gacha-help${availableBalance < STUDENT_CHARACTER_DRAW_PRICE ? '' : ' sr-only'}`}>
            {availableBalance < STUDENT_CHARACTER_DRAW_PRICE ? `사용 가능한 고마가 ${STUDENT_CHARACTER_DRAW_PRICE} 고마보다 적어요.` : '뽑기 전에는 어떤 스킨인지 알 수 없어요.'}
          </p>
        </aside>
      </div>

      <StudentConfirmDialog
        isOpen={isConfirmOpen}
        kicker="고마 스킨 가챠"
        title={`${STUDENT_CHARACTER_DRAW_PRICE} 고마로 뽑을까요?`}
        description="확인 후 집게를 직접 움직여 뽑을 수 있어요."
        confirmLabel="조작 시작"
        isPending={isSaving}
        returnFocusRef={controlPanelRef}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={beginAiming}
      />

      {stage === 'result' && drawnCharacter ? (
        <div className="student-character-gacha-result-backdrop" role="presentation" onClick={closeResult}>
          <section ref={resultDialogRef} className="student-character-gacha-result" role="dialog" aria-modal="true" aria-labelledby="student-character-gacha-result-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="student-character-gacha-result-close" aria-label="결과 닫기" onClick={closeResult}><X aria-hidden="true" /></button>
            <Sparkles aria-hidden="true" />
            <span>획득!</span>
            <img src={drawnCharacter.imageSrc} alt="" />
            <h2 id="student-character-gacha-result-title">{drawnCharacter.name}</h2>
            <p>새 스킨이 바로 적용됐어요.</p>
            <button type="button" onClick={closeResult}>확인</button>
          </section>
        </div>
      ) : null}
    </section>
  );
}
