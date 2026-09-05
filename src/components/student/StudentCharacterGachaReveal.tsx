import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion, useAnimate, useReducedMotion, type AnimationSequence } from 'motion/react';
import { PawPrint, X } from 'lucide-react';
import { getStudentCapsuleTransfer, STUDENT_GACHA_MOTION, type StudentGachaRect } from '../../lib/studentGachaMotion';
import { useModalFocus } from '../../lib/useModalFocus';

interface StudentCharacterGachaRevealProps {
  readonly capsuleSrc: string;
  readonly character: { readonly name: string; readonly imageSrc: string };
  readonly bonusCharacter?: { readonly name: string; readonly imageSrc: string };
  readonly origin: StudentGachaRect;
  readonly returnFocusRef: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
}

type RevealStage = 'presenting' | 'sealed' | 'opening' | 'result';
const CAPSULE_COLORS: Readonly<Record<string, string>> = {
  pink: '#e8a0b5', red: '#e88368', green: '#7ac5af', purple: '#b8a2db', peach: '#edbea0',
  orange: '#e7b552', blue: '#8cc7d4', brown: '#b79a75', gray: '#b5baa4',
};
const PARTICLES = Array.from({ length: 14 }, (_, index) => {
  const angle = (index / 14) * Math.PI * 2 - Math.PI / 2;
  const radius = index % 2 === 0 ? 174 : 135;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, size: index % 3 === 0 ? 9 : 5 };
});

function CapsuleShell({ color, part }: { readonly color: string; readonly part: 'lid' | 'base' }) {
  const id = useId().replaceAll(':', '');
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id + '-glass'} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fffef1" stopOpacity=".95" /><stop offset=".46" stopColor="#e0f8ec" stopOpacity=".35" /><stop offset="1" stopColor="#9dbcb0" stopOpacity=".8" />
        </linearGradient>
        <linearGradient id={id + '-body'} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#fff5df" /><stop offset=".3" stopColor={color} /><stop offset=".75" stopColor={color} /><stop offset="1" stopColor="#9c7855" />
        </linearGradient>
        <linearGradient id={id + '-rim'} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fffcef" /><stop offset=".48" stopColor={color} /><stop offset="1" stopColor="#9e7856" />
        </linearGradient>
      </defs>
      {part === 'lid' ? (
        <>
          <path d="M16 53 C16 0 84 0 84 53 Q50 69 16 53Z" fill={'url(#' + id + '-glass)'} stroke="#fff7df" strokeWidth=".8" />
          <path d="M18 51 C18 5 80 4 82 51" fill="none" stroke={color} strokeWidth=".8" opacity=".8" />
          <ellipse cx="33" cy="25" rx="11" ry="3.8" transform="rotate(-37 33 25)" fill="white" opacity=".88" />
          <ellipse cx="72" cy="34" rx="2.4" ry="5" transform="rotate(-30 72 34)" fill="white" opacity=".65" />
          <path d="M16 53 Q50 70 84 53" fill="none" stroke={'url(#' + id + '-rim)'} strokeWidth="2" />
        </>
      ) : (
        <>
          <ellipse cx="50" cy="55" rx="34" ry="10" fill={color} stroke="#fce8c9" strokeWidth=".6" />
          <ellipse cx="50" cy="55" rx="30" ry="7.5" fill="#6e644f" opacity=".65" />
          <path d="M16 54 Q50 72 84 54 L82 68 C77 96 23 96 18 68Z" fill={'url(#' + id + '-body)'} stroke="#f9dfb7" strokeWidth=".8" />
          <path d="M17 57 Q50 75 83 57" fill="none" stroke={'url(#' + id + '-rim)'} strokeWidth="3" />
          <path d="M22 68 C26 80 34 85 44 87" fill="none" stroke="#fff9df" strokeWidth="1.4" strokeLinecap="round" opacity=".45" />
          <rect x="44" y="59" width="12" height="15" rx="4.5" fill={'url(#' + id + '-rim)'} stroke="#fff2d4" strokeWidth=".7" />
          <rect x="46" y="65" width="8" height="6" rx="2" fill={color} stroke="#9d7759" strokeWidth=".5" />
        </>
      )}
    </svg>
  );
}

export default function StudentCharacterGachaReveal({ capsuleSrc, character, bonusCharacter, origin, returnFocusRef, onClose }: StudentCharacterGachaRevealProps) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<RevealStage>('presenting');
  const [imageStatuses, setImageStatuses] = useState<readonly ('loading' | 'ready' | 'failed')[]>(['loading', 'loading']);
  const isDouble = Boolean(bonusCharacter);
  const prizes = bonusCharacter ? [character, bonusCharacter] : [character];
  const imagesReady = prizes.every((_, index) => imageStatuses[index] !== 'loading');
  const [capsuleFailed, setCapsuleFailed] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const travelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const prizeImageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const openingRef = useRef(false);
  const isDismissible = stage === 'sealed' || stage === 'result';
  const colorName = capsuleSrc.split('-').at(-1)?.replace('.png', '') ?? 'peach';
  const capsuleColor = CAPSULE_COLORS[colorName] ?? CAPSULE_COLORS.peach;
  const readyToOpen = stage === 'sealed' && imagesReady;
  const settleImage = (index: number, status: 'ready' | 'failed') => setImageStatuses((previous) => previous.map((value, item) => item === index ? status : value));
  const message = stage === 'presenting' ? isDouble ? '특별한 더블 캡슐! 스킨 두 개가 기다리고 있어요.' : '캡슐을 가져왔어요.'
    : stage === 'sealed' ? !imagesReady ? '스킨을 준비하고 있어요.' : '캡슐을 눌러 열어 보세요.'
      : stage === 'opening' ? '새로운 고마를 만나는 중이에요.'
        : prizes.map((prize) => prize.name).join(', ') + (isDouble ? ' 스킨 두 개 획득! 첫 번째 스킨이 바로 적용됐어요.' : ' 획득! 새 스킨이 바로 적용됐어요.');

  useModalFocus({ dialogRef: scope, isOpen: true, initialFocusRef: scope, returnFocusRef, isDismissible, onDismiss: onClose });

  useEffect(() => {
    prizeImageRefs.current.forEach((image, index) => {
      if (image?.complete) settleImage(index, image.naturalWidth > 0 ? 'ready' : 'failed');
    });
    const timeout = window.setTimeout(() => setImageStatuses((previous) => previous.map((status) => status === 'loading' ? 'failed' : status)), 4000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (readyToOpen) openRef.current?.focus({ preventScroll: true });
    if (stage === 'result') confirmRef.current?.focus({ preventScroll: true });
  }, [readyToOpen, stage]);

  useLayoutEffect(() => {
    if (stage !== 'presenting' || !heroRef.current || !travelRef.current) return;
    const target = heroRef.current.getBoundingClientRect();
    const transfer = getStudentCapsuleTransfer(origin, target);
    let cancelled = false;
    const element = travelRef.current;
    if (!reduceMotion) element.style.transform = 'translateX(' + transfer.x + 'px) translateY(' + transfer.y + 'px) scale(' + transfer.scale + ')';
    element.style.visibility = 'visible';
    const controls = reduceMotion
      ? animate(element, { opacity: [0, 1] }, { duration: STUDENT_GACHA_MOTION.reducedMs / 1000 })
      : animate(element, { x: [transfer.x, 0], y: [transfer.y, 0], scale: [transfer.scale, 1] }, { duration: STUDENT_GACHA_MOTION.transferMs / 1000, ease: STUDENT_GACHA_MOTION.ease });
    void controls.then(() => { if (!cancelled) setStage('sealed'); });
    return () => { cancelled = true; controls.stop(); };
  }, [stage, animate, origin, reduceMotion]);

  useLayoutEffect(() => {
    if (stage !== 'opening') return;
    let cancelled = false;
    const duration = (isDouble ? STUDENT_GACHA_MOTION.doubleRevealMs : STUDENT_GACHA_MOTION.revealMs) / 1000;
    const splitAt = isDouble ? .38 : .28;
    const prizeAt = isDouble ? .46 : .3;
    const hero = heroRef.current?.getBoundingClientRect();
    const leftPrize = scope.current?.querySelector('.student-gacha-prize-primary')?.getBoundingClientRect();
    const spread = hero && leftPrize ? hero.left + hero.width / 2 - leftPrize.left - leftPrize.width / 2 : 120;
    const doubleSequence: AnimationSequence = isDouble ? [
      ['.student-gacha-prize-primary', { x: [spread, 0], y: [22, 0], rotate: [-7, 0], scale: [.65, 1.04, 1] }, { duration: .85, at: prizeAt, ease: STUDENT_GACHA_MOTION.ease }],
      ['.student-gacha-prize-bonus', { x: [-spread, 0], y: [22, 0], rotate: [7, 0], scale: [.65, 1.04, 1] }, { duration: .85, at: prizeAt, ease: STUDENT_GACHA_MOTION.ease }],
      ['.student-gacha-skin-name', { opacity: [0, 1], y: [6, 0] }, { duration: .2, at: 1.15 }],
      ['.student-gacha-orbit-outer', { rotate: [0, 155], opacity: [.35, .85, 0], scale: [1, 1.16] }, { duration: 1.3, at: .1, ease: STUDENT_GACHA_MOTION.ease }],
      ['.student-gacha-orbit-inner', { rotate: [0, -125], opacity: [.35, .7, 0], scale: [1, 1.2] }, { duration: 1.3, at: .1, ease: STUDENT_GACHA_MOTION.ease }],
    ] : [];
    const sequence: AnimationSequence = reduceMotion ? [
      ['.student-gacha-closed', { opacity: 0 }, { duration: STUDENT_GACHA_MOTION.reducedMs / 1000, at: 0 }],
      ['.student-gacha-prize, .student-gacha-result-copy, .student-gacha-result-action', { opacity: 1 }, { duration: STUDENT_GACHA_MOTION.reducedMs / 1000, at: 0 }],
      ...(isDouble ? [['.student-gacha-skin-name', { opacity: 1 }, { duration: STUDENT_GACHA_MOTION.reducedMs / 1000, at: 0 }]] satisfies AnimationSequence : []),
    ] : [
      ['.student-gacha-capsule-travel', { scale: isDouble ? [1, .9, 1.06, .97, 1] : [1, .94, 1.025, 1] }, { duration: isDouble ? .5 : .38, at: 0, ease: STUDENT_GACHA_MOTION.ease }],
      ['.student-gacha-seam', { opacity: isDouble ? [0, 1, .4, 1, 0] : [0, 1, 0], scaleX: [.55, 1.18, 1.3] }, { duration: isDouble ? .7 : .5, at: .08 }],
      ['.student-gacha-closed', { opacity: [1, 0] }, { duration: .16, at: splitAt - .12 }],
      ['.student-gacha-shell', { opacity: [0, 1] }, { duration: .12, at: splitAt - .12 }],
      ['.student-gacha-lid', { y: [0, isDouble ? -136 : -112], rotate: [0, isDouble ? -24 : -18], opacity: [1, 1, 0] }, { duration: .58, at: splitAt, ease: STUDENT_GACHA_MOTION.ease }],
      ['.student-gacha-base', { y: [0, isDouble ? 92 : 82], rotate: [0, isDouble ? 12 : 8], opacity: [1, 1, 0] }, { duration: .58, at: splitAt, ease: STUDENT_GACHA_MOTION.ease }],
      ['.student-gacha-prize', { opacity: [0, 1], scale: isDouble ? [1, 1] : [.62, 1.04, 1], y: isDouble ? [0, 0] : [26, 0, 0] }, { duration: isDouble ? .3 : .72, at: prizeAt, ease: STUDENT_GACHA_MOTION.ease }],
      ['.student-gacha-halo', { opacity: [.35, isDouble ? 1 : .9, .55], scale: [.9, isDouble ? 1.25 : 1.12, 1] }, { duration: 1, at: .12 }],
      ...doubleSequence,
      ...PARTICLES.map((particle, index): AnimationSequence[number] => [
        '.student-gacha-particle-' + index,
        { x: [0, particle.x * (isDouble ? 1.25 : 1)], y: [0, particle.y * (isDouble ? 1.15 : 1)], scale: [.2, 1, .5], opacity: [0, 1, 1, 0], rotate: [0, index % 2 === 0 ? 95 : -95] },
        { duration: isDouble ? .85 : .68, at: prizeAt + .02 + index * .012, ease: STUDENT_GACHA_MOTION.ease },
      ]),
      ['.student-gacha-result-copy', { opacity: [0, 1], y: [10, 0] }, { duration: .24, at: duration - .44 }],
      ['.student-gacha-result-action', { opacity: [0, 1], y: [8, 0] }, { duration: .22, at: duration - .22 }],
    ];
    const controls = animate(sequence);
    void controls.then(() => { if (!cancelled) setStage('result'); });
    return () => { cancelled = true; controls.stop(); };
  }, [stage, animate, reduceMotion, isDouble, scope]);

  const openCapsule = () => {
    if (!readyToOpen || openingRef.current) return;
    openingRef.current = true;
    scope.current?.focus({ preventScroll: true });
    setStage('opening');
  };

  return createPortal(
    <div className="student-gacha-reveal-backdrop" data-variant={isDouble ? 'double' : 'single'} onClick={(event) => { if (event.target === event.currentTarget && isDismissible) onClose(); }}>
      <motion.div className="student-gacha-reveal-scrim" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: (reduceMotion ? STUDENT_GACHA_MOTION.reducedMs : STUDENT_GACHA_MOTION.transferMs) / 1000 }} />
      <section ref={scope} className="student-gacha-reveal" role="dialog" aria-modal="true" aria-labelledby="student-gacha-reveal-title" aria-busy={!isDismissible || !imagesReady} tabIndex={-1} data-stage={stage} data-variant={isDouble ? 'double' : 'single'}>
        <h2 id="student-gacha-reveal-title" className="student-gacha-reveal-title">{isDouble ? '특별한 더블 캡슐' : '고마 스킨 뽑기'}</h2>
        <button type="button" className="student-gacha-reveal-close" aria-label="결과 닫기" disabled={!isDismissible} onClick={onClose}><X aria-hidden="true" /></button>
        <div className="student-gacha-hero-area">
          <div ref={heroRef} className="student-gacha-reveal-hero">
            <div className="student-gacha-halo" aria-hidden="true" />
            <div className="student-gacha-ground" aria-hidden="true" />
            {isDouble && !reduceMotion ? <div className="student-gacha-orbits" aria-hidden="true">
              <svg className="student-gacha-orbit student-gacha-orbit-outer" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="46" ry="31" transform="rotate(-28 50 50)" /><circle cx="10" cy="33" r="1.1" /></svg>
              <svg className="student-gacha-orbit student-gacha-orbit-inner" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="42" ry="27" transform="rotate(30 50 50)" /><circle cx="83" cy="76" r=".9" /></svg>
            </div> : null}
            <div ref={travelRef} className="student-gacha-capsule-travel">
              <button ref={openRef} className="student-gacha-open" type="button" disabled={!readyToOpen} aria-hidden={stage === 'opening' || stage === 'result'} aria-label="캡슐 눌러서 열기" onClick={openCapsule}>
                <span className="student-gacha-closed">
                  {capsuleFailed ? <><CapsuleShell part="lid" color={capsuleColor} /><CapsuleShell part="base" color={capsuleColor} /></>
                    : <img src={capsuleSrc} alt="" draggable={false} onError={() => setCapsuleFailed(true)} />}
                </span>
              </button>
              <div className="student-gacha-shell student-gacha-lid"><CapsuleShell part="lid" color={capsuleColor} /></div>
              <div className="student-gacha-shell student-gacha-base"><CapsuleShell part="base" color={capsuleColor} /></div>
            </div>
            <div className="student-gacha-prize" aria-hidden={stage !== 'result'}>
              {prizes.map((prize, index) => <div key={index} className={'student-gacha-prize-skin ' + (index === 0 ? 'student-gacha-prize-primary' : 'student-gacha-prize-bonus')}>
                <div className="student-gacha-skin-art">
                  {imageStatuses[index] === 'failed' ? <span className="student-gacha-prize-fallback" role="img" aria-label={prize.name}><PawPrint aria-hidden="true" /></span>
                    : <img ref={(element) => { prizeImageRefs.current[index] = element; }} src={prize.imageSrc} alt="" draggable={false} onLoad={() => settleImage(index, 'ready')} onError={() => settleImage(index, 'failed')} />}
                </div>
                {isDouble ? <span className="student-gacha-skin-name">{prize.name}</span> : null}
              </div>)}
            </div>
            {!reduceMotion ? <>
              <div className="student-gacha-seam" aria-hidden="true" />
              <div className="student-gacha-particles" aria-hidden="true">{PARTICLES.map((particle, index) => <i key={index} className={'student-gacha-particle student-gacha-particle-' + index} style={{ width: particle.size, height: particle.size }} />)}</div>
            </> : null}
          </div>
        </div>
        <div className="student-gacha-caption">
          <p className="student-gacha-open-hint" aria-hidden="true" data-visible={stage === 'sealed'}>{!imagesReady ? '스킨을 준비하고 있어요' : isDouble ? '더블 캡슐! 눌러서 열기' : '눌러서 열기'}</p>
          <div className="student-gacha-result-copy" aria-hidden={stage !== 'result'}>
            <span>{isDouble ? '한 번에 두 고마!' : '새로운 고마'}</span><h3>{isDouble ? '스킨 2개 획득!' : character.name}</h3><p>{isDouble ? '첫 번째 스킨이 바로 적용됐어요.' : '새 스킨이 바로 적용됐어요.'}</p>
          </div>
          <button ref={confirmRef} type="button" className="student-gacha-result-action" disabled={stage !== 'result'} aria-hidden={stage !== 'result'} onClick={onClose}>확인</button>
        </div>
        <p className="sr-only" role="status">{message}</p>
      </section>
    </div>, document.body,
  );
}
