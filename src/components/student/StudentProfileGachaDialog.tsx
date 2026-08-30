import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react';
import { Gift, LoaderCircle, Shuffle, Sparkles, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { FAILURE_PROFILE_OPTIONS, FAILURE_RANDOM_PROFILE_OPTION } from '../../lib/failureExhibition';
import type { StudentProfilePurchaseOutcome } from '../../lib/studentProfilePurchase';
import { useModalFocus } from '../../lib/useModalFocus';

export type StudentProfileGachaCard = {
  readonly id: string;
  readonly imageSrc: string;
  readonly label: string;
};

type StudentProfileGachaStage = 'confirm' | 'saving' | 'shuffling' | 'revealing' | 'result';

interface StudentProfileGachaDialogProps {
  readonly isOpen: boolean;
  readonly price: number;
  readonly availableProfiles: readonly StudentProfileGachaCard[];
  readonly onPurchase: () => Promise<StudentProfilePurchaseOutcome>;
  readonly onClose: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
}

export const STUDENT_PROFILE_GACHA_MOTION = Object.freeze({
  shuffleMs: 3200,
  revealMs: 560,
  reducedMs: 220,
});
const PROFILE_GACHA_SAVE_MIN_MS = 600;
const PROFILE_GACHA_DECK_SIZE = 12;
export const PROFILE_GACHA_WINNER_INDEX = 10;
const PROFILE_GACHA_MOTION_STYLE: CSSProperties & {
  '--student-profile-gacha-shuffle': string;
  '--student-profile-gacha-reveal': string;
  '--student-profile-gacha-reduced': string;
} = {
  '--student-profile-gacha-shuffle': `${STUDENT_PROFILE_GACHA_MOTION.shuffleMs}ms`,
  '--student-profile-gacha-reveal': `${STUDENT_PROFILE_GACHA_MOTION.revealMs}ms`,
  '--student-profile-gacha-reduced': `${STUDENT_PROFILE_GACHA_MOTION.reducedMs}ms`,
};
const PROFILE_GACHA_REEL_TRANSFORMS = [
  'translate3d(-5%, 0, 0)',
  'translate3d(-3.5%, 0, 0)',
  'translate3d(-31%, 0, 0)',
  'translate3d(-53%, 0, 0)',
  'translate3d(-65%, 0, 0)',
  'translate3d(-69.5%, 0, 0)',
  'translate3d(-71.5%, 0, 0)',
  'translate3d(-72.2%, 0, 0)',
  'translate3d(-72.5%, 0, 0)',
  'translate3d(-72.5%, 0, 0)',
] as const;
const PROFILE_GACHA_REEL_TIMES = [0, 0.0375, 0.25, 0.47, 0.65, 0.77, 0.86, 0.92, 0.95, 1] as const;
const PROFILE_GACHA_SLOWDOWN_START_MS = 2080;
const PROFILE_GACHA_WINNER_LOCK_START_MS = 2660;

const getStringSeed = (value: string): number => {
  let seed = 0;
  for (const character of value) seed = ((seed * 31) + character.charCodeAt(0)) >>> 0;
  return seed;
};

export const getStudentProfileGachaDeck = (
  profiles: readonly StudentProfileGachaCard[],
  resultImage: string,
  count = PROFILE_GACHA_DECK_SIZE,
): StudentProfileGachaCard[] => {
  const candidates = profiles.filter((profile) => profile.imageSrc !== resultImage);
  const resultProfile = profiles.find((profile) => profile.imageSrc === resultImage)
    ?? FAILURE_PROFILE_OPTIONS.find((profile) => profile.imageSrc === resultImage);
  if (candidates.length === 0 || !resultProfile || count <= 0) return [];

  const offset = getStringSeed(resultImage) % candidates.length;
  const winnerIndex = Math.min(PROFILE_GACHA_WINNER_INDEX, count - 1);
  return Array.from({ length: count }, (_, index) => {
    if (index === winnerIndex) return resultProfile;
    const decoyIndex = index > winnerIndex ? index - 1 : index;
    return candidates[(offset + (decoyIndex * 7)) % candidates.length];
  });
};

export const getStudentProfileGachaShuffleDuration = (reduceMotion: boolean): number => (
  reduceMotion ? 0 : STUDENT_PROFILE_GACHA_MOTION.shuffleMs
);

export const getStudentProfileGachaRevealDuration = (reduceMotion: boolean): number => (
  reduceMotion ? STUDENT_PROFILE_GACHA_MOTION.reducedMs : STUDENT_PROFILE_GACHA_MOTION.revealMs
);

const preloadProfileImages = async (imageSources: readonly string[]): Promise<void> => {
  await Promise.all([...new Set(imageSources)].map((imageSource) => new Promise<void>((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = imageSource;
    if (image.complete) resolve();
  })));
};

const getProfileLabel = (profileImage: string): string => (
  FAILURE_PROFILE_OPTIONS.find((profile) => profile.imageSrc === profileImage)?.label ?? '새 동물'
);

export default function StudentProfileGachaDialog({
  isOpen,
  price,
  availableProfiles,
  onPurchase,
  onClose,
  returnFocusRef,
}: StudentProfileGachaDialogProps) {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<StudentProfileGachaStage>('confirm');
  const [receipt, setReceipt] = useState<Extract<StudentProfilePurchaseOutcome, { ok: true }> | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const resultButtonRef = useRef<HTMLButtonElement>(null);
  const requestIdRef = useRef(0);
  const isStartingRef = useRef(false);
  const revealTimerRef = useRef<number | null>(null);
  const resultTimerRef = useRef<number | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  const isProcessing = stage === 'saving' || stage === 'shuffling' || stage === 'revealing';
  const isDismissible = stage === 'confirm' || stage === 'result';
  const isArcadeStage = stage === 'shuffling' || stage === 'revealing' || stage === 'result';
  const isResultStage = stage === 'result';
  const stageLayoutKey = stage === 'shuffling' || stage === 'revealing' || stage === 'result' ? 'arcade' : stage;
  const resultLabel = receipt ? getProfileLabel(receipt.profileImage) : '';
  const shuffleCards = useMemo(
    () => getStudentProfileGachaDeck(availableProfiles, receipt?.profileImage ?? ''),
    [availableProfiles, receipt?.profileImage],
  );
  const clearStageTimers = () => {
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    if (resultTimerRef.current !== null) window.clearTimeout(resultTimerRef.current);
    revealTimerRef.current = null;
    resultTimerRef.current = null;
  };

  useModalFocus({
    dialogRef,
    isOpen,
    onDismiss: onClose,
    initialFocusRef: startButtonRef,
    returnFocusRef,
    isDismissible,
  });

  useEffect(() => {
    if (!isOpen) {
      requestIdRef.current += 1;
      isStartingRef.current = false;
      clearStageTimers();
      setStage('confirm');
      setReceipt(null);
      setErrorMessage('');
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      clearStageTimers();
    };
  }, [isOpen]);

  useEffect(() => {
    if (stage === 'result') resultButtonRef.current?.focus({ preventScroll: true });
    else if (stage === 'saving' || stage === 'shuffling' || stage === 'revealing') dialogRef.current?.focus({ preventScroll: true });
    else if (errorMessage) startButtonRef.current?.focus({ preventScroll: true });
  }, [errorMessage, stage]);

  const handleClose = () => {
    if (!isDismissible) return;
    onClose();
    window.setTimeout(() => {
      const target = returnFocusRef?.current;
      if (target?.isConnected && !target.matches(':disabled, [aria-disabled="true"]')) {
        target.focus({ preventScroll: true });
      }
    }, reduceMotion ? 220 : 500);
  };

  const handleStart = async () => {
    if (stage !== 'confirm' || isStartingRef.current) return;
    isStartingRef.current = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const saveStartedAt = window.performance.now();
    setErrorMessage('');
    setStage('saving');

    let outcome: StudentProfilePurchaseOutcome;
    try {
      outcome = await onPurchase();
    } catch {
      outcome = { ok: false, message: '프로필을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    }
    const remainingSaveTime = PROFILE_GACHA_SAVE_MIN_MS - (window.performance.now() - saveStartedAt);
    if (!reduceMotion && remainingSaveTime > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, remainingSaveTime));
    }
    if (requestId !== requestIdRef.current) return;
    if (outcome.ok === false) {
      isStartingRef.current = false;
      setErrorMessage(outcome.message);
      setStage('confirm');
      return;
    }

    if (reduceMotion) {
      setReceipt(outcome);
      setStage('revealing');
      resultTimerRef.current = window.setTimeout(() => {
        resultTimerRef.current = null;
        if (requestId === requestIdRef.current) {
          isStartingRef.current = false;
          setStage('result');
        }
      }, getStudentProfileGachaRevealDuration(true));
      return;
    }

    const pendingDeck = getStudentProfileGachaDeck(availableProfiles, outcome.profileImage);
    await preloadProfileImages([...pendingDeck.map((profile) => profile.imageSrc), outcome.profileImage]);
    if (requestId !== requestIdRef.current) return;
    setReceipt(outcome);
    setStage('shuffling');
    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;
      if (requestId === requestIdRef.current) {
        setStage('revealing');
        resultTimerRef.current = window.setTimeout(() => {
          resultTimerRef.current = null;
          if (requestId === requestIdRef.current) {
            isStartingRef.current = false;
            setStage('result');
          }
        }, getStudentProfileGachaRevealDuration(false));
      }
    }, getStudentProfileGachaShuffleDuration(false));
  };

  const stageStatus = stage === 'saving'
    ? '카드를 준비하고 있어요'
    : stage === 'shuffling'
      ? '카드가 빠르게 돌고 있어요'
      : stage === 'revealing'
        ? '마지막 카드를 확인하고 있어요'
        : stage === 'result' && receipt
          ? `${resultLabel} 프로필이 정해졌어요`
          : errorMessage || '랜덤 프로필 구매를 확인해 주세요';

  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <motion.div
          className="student-profile-gacha-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.18 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            aria-busy={isProcessing}
            tabIndex={-1}
            className="student-profile-gacha-dialog"
            style={PROFILE_GACHA_MOTION_STYLE}
            layout={!reduceMotion}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 20px, 0) scale(0.97)' }}
            animate={{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 14px, 0) scale(0.98)' }}
            transition={reduceMotion
              ? { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
              : { type: 'spring', stiffness: 360, damping: 34, mass: 0.82 }}
          >
            {isDismissible ? (
              <button type="button" className="student-profile-gacha-close" aria-label="랜덤 프로필 창 닫기" onClick={handleClose}>
                <X aria-hidden="true" />
              </button>
            ) : null}

            <span className="sr-only" aria-live="polite" aria-atomic="true">{stageStatus}</span>

            <AnimatePresence initial={false}>
              <motion.div
                key={stageLayoutKey}
                className="student-profile-gacha-stage"
                initial={stage === 'shuffling'
                  ? { opacity: 1, transform: 'translate3d(0, 0, 0)' }
                  : reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, transform: 'translate3d(0, 8px, 0)' }}
                animate={reduceMotion
                  ? { opacity: 1, transition: { duration: 0.22 } }
                  : { opacity: 1, transform: 'translate3d(0, 0, 0)', transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } }}
                exit={reduceMotion
                  ? { opacity: 0, transition: { duration: 0 } }
                  : {
                    opacity: 0,
                    transform: 'translate3d(0, -8px, 0)',
                    transition: { duration: stageLayoutKey === 'saving' ? 0 : 0.16, ease: [0.4, 0, 1, 1] },
                  }}
              >
                {stage === 'confirm' ? (
                  <div className="student-profile-gacha-confirm">
                    <div className="student-profile-gacha-kicker"><Gift aria-hidden="true" />랜덤 프로필</div>
                    <div className="student-profile-gacha-hero-card">
                      <img src={FAILURE_RANDOM_PROFILE_OPTION.imageSrc} alt="물음표가 그려진 랜덤 프로필 카드" width={192} height={192} />
                      <span>{price === 0 ? '첫 1회 무료' : `${price} 고마`}</span>
                    </div>
                    <div className="student-profile-gacha-copy">
                      <h2 id={headingId}>{price === 0 ? '첫 동물 친구를 뽑아 볼까요?' : '새 동물 친구를 뽑아 볼까요?'}</h2>
                      <p id={descriptionId}>카드를 섞은 뒤 한 명이 정해져요.</p>
                      {errorMessage ? <p className="student-profile-gacha-error" role="alert">{errorMessage}</p> : null}
                    </div>
                    <div className="student-profile-gacha-actions">
                      <button type="button" onClick={handleClose}>취소</button>
                      <button ref={startButtonRef} type="button" onClick={() => void handleStart()} autoFocus><Shuffle aria-hidden="true" />뽑기 시작</button>
                    </div>
                  </div>
                ) : null}

                {stage === 'saving' ? (
                  <div className="student-profile-gacha-processing">
                    <div className="student-profile-gacha-card-back"><img src={FAILURE_RANDOM_PROFILE_OPTION.imageSrc} alt="" width={192} height={192} /></div>
                    <LoaderCircle className="student-profile-gacha-loader" aria-hidden="true" />
                    <h2 id={headingId}>카드를 준비하고 있어요</h2>
                    <p id={descriptionId}>프로필을 안전하게 저장한 뒤 뽑기를 시작할게요.</p>
                  </div>
                ) : null}

                {isArcadeStage && receipt ? (
                  <div className="student-profile-gacha-sequence" data-stage={stage}>
                    <div className="student-profile-gacha-reel" data-stage={stage} aria-hidden="true">
                      <div className="student-profile-gacha-reel-lights">
                        {Array.from({ length: 10 }, (_, index) => (
                          <motion.span
                            key={index}
                            initial={{ opacity: stage === 'shuffling' ? 0.28 : reduceMotion ? 0.45 : 1 }}
                            animate={{ opacity: stage === 'shuffling' ? [0.28, 1, 0.28] : 1 }}
                            transition={stage === 'shuffling'
                              ? { duration: 0.42, delay: index * 0.04, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }
                              : { duration: reduceMotion ? 0.22 : 0.24, delay: reduceMotion ? 0 : index * 0.025, ease: [0.23, 1, 0.32, 1] }}
                          />
                        ))}
                      </div>
                      <div className="student-profile-gacha-reel-window">
                        {stage === 'shuffling' ? (
                          <>
                            <motion.div
                              className="student-profile-gacha-reel-track"
                              initial={{ transform: PROFILE_GACHA_REEL_TRANSFORMS[0] }}
                              animate={{ opacity: 1, transform: [...PROFILE_GACHA_REEL_TRANSFORMS] }}
                              transition={{
                                duration: STUDENT_PROFILE_GACHA_MOTION.shuffleMs / 1000,
                                times: [...PROFILE_GACHA_REEL_TIMES],
                                ease: 'linear',
                              }}
                            >
                              {(shuffleCards.length > 0 ? shuffleCards : Array.from({ length: PROFILE_GACHA_DECK_SIZE }, (_, index) => ({
                                id: `random-${index}`,
                                imageSrc: FAILURE_RANDOM_PROFILE_OPTION.imageSrc,
                                label: '',
                              }))).map((card, index) => (
                                <div
                                  key={`${card.id}-${index}`}
                                  className="student-profile-gacha-reel-card"
                                  data-gacha-winner={index === PROFILE_GACHA_WINNER_INDEX ? 'true' : undefined}
                                >
                                  <img src={card.imageSrc} alt="" width={192} height={192} />
                                </div>
                              ))}
                            </motion.div>
                            <motion.div
                              className="student-profile-gacha-selection-gate"
                              initial={{ opacity: 0.7, transform: 'translate3d(-50%, -50%, 0) scale(1)' }}
                              animate={{
                                opacity: [0.7, 1, 0.82, 1, 0.9],
                                transform: [
                                  'translate3d(-50%, -50%, 0) scale(1)',
                                  'translate3d(-50%, -50%, 0) scale(1.055)',
                                  'translate3d(-50%, -50%, 0) scale(1)',
                                  'translate3d(-50%, -50%, 0) scale(1.04)',
                                  'translate3d(-50%, -50%, 0) scale(1)',
                                ],
                              }}
                              transition={{
                                duration: 0.88,
                                delay: PROFILE_GACHA_SLOWDOWN_START_MS / 1000,
                                times: [0, 0.2, 0.42, 0.7, 1],
                                ease: [0.23, 1, 0.32, 1],
                              }}
                            />
                          </>
                        ) : null}
                        <motion.div
                          className="student-profile-gacha-winning-frame"
                          initial={reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, transform: 'translate3d(-50%, -50%, 0) scale(0.58) rotateY(0deg)' }}
                          animate={stage === 'shuffling'
                            ? {
                              opacity: [0, 0, 1, 1],
                              transform: [
                                'translate3d(-50%, -50%, 0) scale(0.58) rotateY(0deg)',
                                'translate3d(-50%, -50%, 0) scale(0.58) rotateY(0deg)',
                                'translate3d(-50%, -50%, 0) scale(0.58) rotateY(0deg)',
                                'translate3d(-50%, -50%, 0) scale(0.58) rotateY(0deg)',
                              ],
                            }
                            : reduceMotion
                              ? { opacity: 1 }
                              : stage === 'revealing'
                                ? {
                                  opacity: 1,
                                  transform: [
                                    'translate3d(-50%, -50%, 0) scale(0.58) rotateY(0deg)',
                                    'translate3d(-50%, -50%, 0) scale(0.82) rotateY(-10deg)',
                                    'translate3d(-50%, -50%, 0) scale(1) rotateY(0deg)',
                                  ],
                                }
                                : { opacity: 1, transform: 'translate3d(-50%, -50%, 0) scale(1) rotateY(0deg)' }}
                          transition={stage === 'shuffling'
                            ? {
                              duration: 0.34,
                              delay: PROFILE_GACHA_WINNER_LOCK_START_MS / 1000,
                              times: [0, 0.18, 0.72, 1],
                              ease: [0.23, 1, 0.32, 1],
                            }
                            : { duration: reduceMotion ? 0.22 : STUDENT_PROFILE_GACHA_MOTION.revealMs / 1000, ease: [0.23, 1, 0.32, 1] }}
                        >
                          <div className="student-profile-gacha-flip-face student-profile-gacha-flip-front">
                            <Sparkles aria-hidden="true" />
                            <img src={receipt.profileImage} alt="" width={192} height={192} />
                          </div>
                        </motion.div>
                      </div>
                    </div>
                    <div className="student-profile-gacha-copy student-profile-gacha-sequence-copy">
                      <span className="student-profile-gacha-result-label" data-visible={isResultStage ? 'true' : 'false'} aria-hidden={!isResultStage}>새로운 동물 친구</span>
                      <h2 id={headingId}>{stage === 'shuffling' ? '어떤 친구가 나올까요?' : isResultStage ? `${resultLabel} 친구를 만났어요!` : '마지막 카드를 확인하고 있어요'}</h2>
                      <p id={descriptionId}>{isResultStage
                        ? receipt.price === 0
                          ? '고마 스킨 뽑기와 건축 사무소가 열렸어요.'
                          : '새 프로필이 바로 적용됐어요.'
                        : stage === 'shuffling'
                          ? '카드가 빠르게 돌고 있어요.'
                          : '가운데 카드가 열리면 새로운 친구를 만날 수 있어요.'}</p>
                    </div>
                    <motion.button
                      ref={resultButtonRef}
                      type="button"
                      className="student-profile-gacha-result-action student-profile-gacha-sequence-action"
                      data-visible={isResultStage ? 'true' : 'false'}
                      aria-hidden={!isResultStage}
                      tabIndex={isResultStage ? 0 : -1}
                      disabled={!isResultStage}
                      initial={false}
                      animate={isResultStage
                        ? { opacity: 1, transform: 'translate3d(0, 0, 0)' }
                        : { opacity: 0, transform: 'translate3d(0, 8px, 0)' }}
                      transition={{ duration: reduceMotion ? 0.22 : 0.24, ease: [0.23, 1, 0.32, 1] }}
                      onClick={handleClose}
                    >
                      확인
                    </motion.button>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
