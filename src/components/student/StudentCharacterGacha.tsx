import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { motion, useAnimate, useReducedMotion, type AnimationSequence } from 'motion/react';
import { ArrowDown, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import {
  STUDENT_CHARACTER_DRAW_PRICE,
  STUDENT_CHARACTER_PRIZES,
  type StudentCharacterPrizeId,
  type StudentEconomyAction,
  type StudentEconomyState,
} from '../../lib/studentEconomy';
import { getDailyGachaCapsules } from '../../lib/studentGachaCapsules';
import {
  getCommittedStudentGachaPrizes,
  getStudentClawDropMotion,
  STUDENT_GACHA_MOTION,
  type StudentGachaRect,
} from '../../lib/studentGachaMotion';
import StudentConfirmDialog from './StudentConfirmDialog';
import StudentCharacterGachaReveal from './StudentCharacterGachaReveal';

interface StudentCharacterGachaProps {
  readonly tabPanelId?: string;
  readonly tabPanelLabelledBy?: string;
  readonly state: StudentEconomyState;
  readonly availableBalance: number;
  readonly isSaving: boolean;
  readonly onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

type GachaStage = 'ready' | 'aiming' | 'rolling' | 'reveal';
interface ClawPositionStyle extends CSSProperties {
  readonly '--student-claw-x': string;
}

const CLAW_POSITIONS = [15, 32.5, 50, 67.5, 85] as const;
const CAPSULE_ANGLES = [-6, 5, -2, 4, -5] as const;
const CAPSULE_SCALES = [.96, .94, 1.02, .95, .98] as const;
const INITIAL_CLAW_POSITION = 2;
const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export default function StudentCharacterGacha({
  tabPanelId, tabPanelLabelledBy, state, availableBalance, isSaving, onAction,
}: StudentCharacterGachaProps) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const reduceMotion = useReducedMotion();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [stage, setStage] = useState<GachaStage>('ready');
  const [clawPosition, setClawPosition] = useState(INITIAL_CLAW_POSITION);
  const [drawnCharacterIds, setDrawnCharacterIds] = useState<readonly StudentCharacterPrizeId[]>([]);
  const [isRollFinished, setIsRollFinished] = useState(false);
  const [isDrawSaved, setIsDrawSaved] = useState(false);
  const [machineCycle, setMachineCycle] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [origin, setOrigin] = useState<StudentGachaRect | null>(null);
  const [dailyCapsules, setDailyCapsules] = useState(() => getDailyGachaCapsules(getKoreanDateKey()));
  const [clawDropMotion, setClawDropMotion] = useState({ dropDistance: 0, cableScale: 1 });
  const ownedBeforeDrawRef = useRef<readonly StudentCharacterPrizeId[]>([]);
  const isDrawStartingRef = useRef(false);
  const runRef = useRef(0);
  const controlPanelRef = useRef<HTMLElement>(null);
  const clawCableRef = useRef<HTMLDivElement>(null);
  const caughtCapsuleRef = useRef<HTMLSpanElement>(null);
  const selectedCapsuleRef = useRef<HTMLDivElement>(null);
  const ownsAll = state.ownedCharacterIds.length >= STUDENT_CHARACTER_PRIZES.length;
  const canDraw = availableBalance >= STUDENT_CHARACTER_DRAW_PRICE && !ownsAll;
  const drawnCharacters = drawnCharacterIds.flatMap((id) => {
    const character = STUDENT_CHARACTER_PRIZES.find((prize) => prize.id === id);
    return character ? [character] : [];
  });
  const selectedCapsule = dailyCapsules[clawPosition];
  const clawStyle: ClawPositionStyle = { '--student-claw-x': CLAW_POSITIONS[clawPosition] + 'cqw' };

  useEffect(() => () => { runRef.current += 1; }, []);

  useEffect(() => {
    if (stage !== 'rolling') return;
    const ids = getCommittedStudentGachaPrizes(isDrawSaved, ownedBeforeDrawRef.current, state.ownedCharacterIds, state.activeCharacterId);
    if (ids.length > 0) setDrawnCharacterIds((previous) => previous.join(',') === ids.join(',') ? previous : ids);
  }, [stage, isDrawSaved, state.ownedCharacterIds, state.activeCharacterId]);

  useEffect(() => {
    if (stage !== 'rolling') return;
    let cancelled = false;
    const timing = STUDENT_GACHA_MOTION;
    const downAt = timing.prepareMs / 1000;
    const gripAt = downAt + timing.dropMs / 1000;
    const liftAt = gripAt + timing.gripMs / 1000;
    const sequence: AnimationSequence = reduceMotion ? [
      ['.student-claw-capsule-slot.is-target', { opacity: [1, 0] }, { duration: timing.reducedMs / 1000, at: 0 }],
      ['.student-claw-caught', { opacity: [0, 1] }, { duration: timing.reducedMs / 1000, at: 0 }],
    ] : [
      ['.student-claw-head', { y: [0, -2] }, { duration: downAt }],
      ['.student-claw-target-light', { opacity: [0, .85, .3] }, { duration: liftAt, at: 0 }],
      ['.student-claw-head', { y: clawDropMotion.dropDistance }, { duration: timing.dropMs / 1000, at: downAt, ease: timing.mechanicalEase }],
      ['.student-claw-cable', { scaleY: [1, clawDropMotion.cableScale] }, { duration: timing.dropMs / 1000, at: downAt, ease: timing.mechanicalEase }],
      ['.student-claw-capsule-slot.is-target img', { rotate: [CAPSULE_ANGLES[clawPosition], 0], scale: [CAPSULE_SCALES[clawPosition], 1] }, { duration: timing.dropMs / 1000, at: downAt, ease: timing.ease }],
      ['.student-claw-jaw-left', { rotate: [14, 14, 3] }, { duration: liftAt, at: 0, times: [0, gripAt / liftAt, 1], ease: timing.mechanicalEase }],
      ['.student-claw-jaw-right', { rotate: [-14, -14, -3] }, { duration: liftAt, at: 0, times: [0, gripAt / liftAt, 1], ease: timing.mechanicalEase }],
      ['.student-claw-capsule-slot.is-target', { opacity: [1, 1, 0] }, { duration: liftAt + .001, at: 0, times: [0, liftAt / (liftAt + .001), 1] }],
      ['.student-claw-caught', { opacity: [0, 0, 1] }, { duration: liftAt + .001, at: 0, times: [0, liftAt / (liftAt + .001), 1] }],
      ['.student-claw-head', { y: 0 }, { duration: timing.liftMs / 1000, at: liftAt, ease: timing.mechanicalEase }],
      ['.student-claw-cable', { scaleY: 1 }, { duration: timing.liftMs / 1000, at: liftAt, ease: timing.mechanicalEase }],
      ['.student-claw-caught img', { rotate: [0, -3, 2, -.7, 0] }, { duration: timing.liftMs / 1000, at: liftAt, ease: timing.ease }],
      ['.student-claw-target-light', { opacity: 0 }, { duration: .25, at: liftAt }],
    ];
    const controls = animate(sequence);
    void controls.then(() => { if (!cancelled) setIsRollFinished(true); });
    return () => { cancelled = true; controls.stop(); };
  }, [stage, animate, reduceMotion, clawDropMotion, clawPosition]);

  useEffect(() => {
    if (stage !== 'rolling' || !isRollFinished || !isDrawSaved || drawnCharacterIds.length === 0) return;
    const capsule = caughtCapsuleRef.current;
    if (!capsule) return;
    const rect = capsule.getBoundingClientRect();
    setOrigin({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    setStage('reveal');
  }, [stage, isRollFinished, isDrawSaved, drawnCharacterIds]);

  const resetMachine = () => {
    runRef.current += 1;
    isDrawStartingRef.current = false;
    setStage('ready');
    setOrigin(null);
    setMachineCycle((value) => value + 1);
  };

  const startDraw = async () => {
    if (isDrawStartingRef.current || stage !== 'aiming' || isSaving || !canDraw) return;
    const cable = clawCableRef.current;
    const caughtCapsule = caughtCapsuleRef.current;
    const targetCapsule = selectedCapsuleRef.current;
    if (!cable || !caughtCapsule || !targetCapsule) return;
    const cableRect = cable.getBoundingClientRect();
    const caughtRect = caughtCapsule.getBoundingClientRect();
    const targetRect = targetCapsule.getBoundingClientRect();
    setClawDropMotion(getStudentClawDropMotion({
      cableHeight: cableRect.height,
      caughtCapsuleCenterY: caughtRect.top + caughtRect.height / 2,
      targetCapsuleCenterY: targetRect.top + targetRect.height / 2,
    }));
    isDrawStartingRef.current = true;
    const run = ++runRef.current;
    ownedBeforeDrawRef.current = state.ownedCharacterIds;
    setDrawnCharacterIds([]);
    setIsDrawSaved(false);
    setIsRollFinished(false);
    setErrorMessage('');
    setStage('rolling');
    try {
      const saved = await onAction({ type: 'draw_character' });
      if (run !== runRef.current) return;
      if (saved) setIsDrawSaved(true);
      else {
        resetMachine();
        setErrorMessage('뽑기를 완료하지 못했어요. 잔액을 확인한 뒤 다시 시도해 주세요.');
      }
    } catch {
      if (run !== runRef.current) return;
      resetMachine();
      setErrorMessage('뽑기를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const beginAiming = () => {
    setDailyCapsules(getDailyGachaCapsules(getKoreanDateKey()));
    setClawPosition(INITIAL_CLAW_POSITION);
    setIsConfirmOpen(false);
    setErrorMessage('');
    setStage('aiming');
  };
  const moveClaw = (direction: -1 | 1) => setClawPosition((value) => Math.min(CLAW_POSITIONS.length - 1, Math.max(0, value + direction)));
  const handleControlsKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (stage !== 'aiming') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveClaw(event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      void startDraw();
    }
  };
  const rollMessage = isRollFinished ? '뽑기 결과를 확인하고 있어요.' : '캡슐을 조심조심 꺼내고 있어요.';

  return (
    <section ref={scope} id={tabPanelId} className={'student-character-gacha stage-' + stage}
      role={tabPanelId ? 'tabpanel' : undefined} aria-labelledby={tabPanelLabelledBy ?? 'student-character-gacha-title'} aria-busy={stage === 'rolling'}>
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
          <div key={machineCycle} className="student-claw-scene" aria-hidden="true">
            <div className="student-claw-machine-claw" style={clawStyle}>
              <div ref={clawCableRef} className="student-claw-cable" />
              <div className="student-claw-head">
                <div className="student-claw-motor" />
                <b className="student-claw-jaw-left" /><em className="student-claw-jaw-right" />
                <span ref={caughtCapsuleRef} className="student-claw-caught" style={{ visibility: stage === 'reveal' ? 'hidden' : undefined }}>
                  <img src={selectedCapsule} alt="" draggable={false} />
                </span>
              </div>
            </div>
            <div className="student-claw-machine-toys">
              {dailyCapsules.map((src, index) => (
                <div key={src} ref={index === clawPosition ? selectedCapsuleRef : undefined}
                  className={'student-claw-capsule-slot' + (index === clawPosition ? ' is-target' : '')} style={{ left: CLAW_POSITIONS[index] + '%' }}>
                  {index === clawPosition ? <span className="student-claw-target-light" /> : null}
                  <motion.img src={src} alt="" draggable={false} initial={false} style={{ rotate: CAPSULE_ANGLES[index], scale: CAPSULE_SCALES[index] }} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside ref={controlPanelRef} className="student-claw-control-panel" aria-label="인형 뽑기 조작" tabIndex={stage === 'aiming' ? 0 : -1} onKeyDown={handleControlsKeyDown}>
          <div className="student-claw-control-heading">
            <span>{stage === 'ready' ? '뽑기 시작' : stage === 'aiming' ? '집게 조작' : '뽑는 중'}</span>
            <strong>{STUDENT_CHARACTER_DRAW_PRICE} 고마</strong>
            {STUDENT_CHARACTER_PRIZES.length - state.ownedCharacterIds.length === 1
              ? <small>마지막 스킨이 기다리고 있어요</small> : null}
          </div>
          {stage === 'ready' ? (
            <button type="button" className="student-character-draw-button" disabled={!canDraw || isSaving} aria-describedby="student-character-gacha-help" onClick={() => setIsConfirmOpen(true)}>
              <Sparkles aria-hidden="true" />{ownsAll ? '모든 스킨을 모았어요' : '고마 스킨 뽑기'}
            </button>
          ) : (
            <div className="student-claw-operation">
              <div className="student-claw-position" role="status" aria-label={(clawPosition + 1) + '번 위치'}>
                {CLAW_POSITIONS.map((position, index) => <span key={position} className={index === clawPosition ? 'is-active' : ''} aria-hidden="true" />)}
              </div>
              <div className="student-claw-direction-buttons">
                <button type="button" disabled={stage !== 'aiming' || clawPosition === 0} onClick={() => moveClaw(-1)}><ArrowLeft aria-hidden="true" /><span>왼쪽</span></button>
                <button type="button" disabled={stage !== 'aiming' || isSaving || !canDraw} onClick={() => void startDraw()}><ArrowDown aria-hidden="true" /><span>{stage === 'rolling' ? '뽑는 중' : '집게 내리기'}</span></button>
                <button type="button" disabled={stage !== 'aiming' || clawPosition === CLAW_POSITIONS.length - 1} onClick={() => moveClaw(1)}><ArrowRight aria-hidden="true" /><span>오른쪽</span></button>
              </div>
              <p>{stage === 'aiming' ? '버튼이나 방향키로 움직여요.' : rollMessage}</p>
            </div>
          )}
          <p id="student-character-gacha-help" className={'student-character-gacha-help' + (availableBalance < STUDENT_CHARACTER_DRAW_PRICE && stage !== 'rolling' && stage !== 'reveal' ? '' : ' sr-only')}>
            {availableBalance < STUDENT_CHARACTER_DRAW_PRICE ? '사용 가능한 고마가 100 고마보다 적어요.' : '뽑기 전에는 어떤 스킨인지 알 수 없어요.'}
          </p>
          {errorMessage ? <p className="student-character-gacha-help" role="alert">{errorMessage}</p> : null}
        </aside>
      </div>
      <p className="sr-only" role="status">{stage === 'rolling' ? rollMessage : ''}</p>
      <StudentConfirmDialog isOpen={isConfirmOpen} kicker="고마 스킨 가챠" title="100 고마로 뽑을까요?" description="확인 후 집게를 직접 움직여 뽑을 수 있어요."
        confirmLabel="조작 시작" isPending={isSaving} returnFocusRef={controlPanelRef} onCancel={() => setIsConfirmOpen(false)} onConfirm={beginAiming} />
      {stage === 'reveal' && origin && drawnCharacters[0] ? (
        <StudentCharacterGachaReveal capsuleSrc={selectedCapsule} character={drawnCharacters[0]} bonusCharacter={drawnCharacters[1]} origin={origin} returnFocusRef={controlPanelRef} onClose={resetMachine} />
      ) : null}
    </section>
  );
}
