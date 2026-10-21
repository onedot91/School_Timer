import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { Heart } from 'lucide-react';
import {
  DEFAULT_PET_BEHAVIOR_CONFIG,
  clampToGround,
  createPetBehaviorState,
  dropPet,
  getPetAnimation,
  getPetDepth,
  moveCarry,
  nudgePet,
  reactToPetTap,
  startCarry,
  startPetting,
  stepPetBehavior,
  stopPetting,
  type PetBehaviorConfig,
  type PetBehaviorState,
  type PetInterest,
  type PetPoint,
  type PetTouchZone,
} from '../../lib/petBehavior';
import {
  PET_ANIMATIONS,
  PET_CARRY_GRIP,
  PET_SPRITE_BACKGROUND_SIZE,
  PET_SPRITE_FRAME,
  getPetFrameColumn,
  getPetFramePosition,
} from '../../lib/petSprites';

interface StudentPetWalkerProps {
  sheetUrl: string;
  name: string;
  kindLabel: string;
  stageRef: RefObject<HTMLDivElement | null>;
  initialPosition: PetPoint;
  gomaPosition: PetPoint;
  hasUnreadMail: boolean;
  onOpenPicker: () => void;
}

const LONG_PRESS_MS = 450;
const PETTING_HEART_INTERVAL_MS = 700;
const DRAG_THRESHOLD_PX = 8;
const HEART_LIFETIME_MS = 1000;
const PET_WIDTH_RATIO = .13;
const GRIP_BLEND_MS = 180;
const SWING_GAIN_DEG_PER_PX_S = .035;
const SWING_LIMIT_DEG = 28;
const SWING_STIFFNESS = 140;
const SWING_DAMPING = 11;
const ANCHOR_X = (PET_SPRITE_FRAME.anchorX / PET_SPRITE_FRAME.width) * 100;
const ANCHOR_Y = (PET_SPRITE_FRAME.anchorY / PET_SPRITE_FRAME.height) * 100;
const GRIP_X = (PET_CARRY_GRIP.x / PET_SPRITE_FRAME.width) * 100;
const GRIP_Y = (PET_CARRY_GRIP.y / PET_SPRITE_FRAME.height) * 100;
const MAILBOX_INTEREST: PetInterest = { point: { x: .29, y: .87 }, facing: -1 };

interface PointerGesture {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  /** Paws minus pointer, in stage units, when the pet was picked up. */
  grabOffset: PetPoint;
  pointer: PetPoint;
  pointerVelocityX: number;
  lastMoveTime: number;
  carryElapsedMs: number;
  carrying: boolean;
  petting: boolean;
  longPressTimer: number;
  heartTimer: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export default function StudentPetWalker({
  sheetUrl,
  name,
  kindLabel,
  stageRef,
  initialPosition,
  gomaPosition,
  hasUnreadMail,
  onOpenPicker,
}: StudentPetWalkerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLButtonElement>(null);
  const swingRef = useRef<HTMLSpanElement>(null);
  const spriteRef = useRef<HTMLSpanElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  const configRef = useRef<PetBehaviorConfig>(DEFAULT_PET_BEHAVIOR_CONFIG);
  const stateRef = useRef<PetBehaviorState | null>(null);
  const stageSizeRef = useRef({ width: 0, height: 0 });
  const gestureRef = useRef<PointerGesture | null>(null);
  const swingRefState = useRef({ angle: 0, velocity: 0 });
  const interestInputsRef = useRef({ gomaPosition, hasUnreadMail });
  const updateInterestsRef = useRef<() => void>(() => undefined);
  const heartIdRef = useRef(0);
  const [hearts, setHearts] = useState<readonly { id: number; left: number }[]>([]);

  if (!stateRef.current) stateRef.current = createPetBehaviorState(initialPosition, configRef.current, Math.random);

  /** Pixels per sprite unit at the pet's current depth. */
  const spriteUnitPx = (state: PetBehaviorState) => {
    const spriteWidth = stageSizeRef.current.width * PET_WIDTH_RATIO;
    return (spriteWidth / PET_SPRITE_FRAME.width) * (.86 + getPetDepth(state.position.y, configRef.current.ground) * .2);
  };

  /** Paws minus pointer, in stage units, when the pointer holds the scruff. */
  const gripOffset = (state: PetBehaviorState): PetPoint => {
    const { width, height } = stageSizeRef.current;
    const unit = spriteUnitPx(state);
    if (width === 0 || height === 0) return { x: 0, y: 0 };
    return {
      x: -((PET_CARRY_GRIP.x - PET_SPRITE_FRAME.anchorX) * state.facing * unit) / width,
      y: ((PET_SPRITE_FRAME.anchorY - PET_CARRY_GRIP.y) * unit) / height,
    };
  };

  const render = () => {
    const state = stateRef.current;
    const root = rootRef.current;
    const body = bodyRef.current;
    const swing = swingRef.current;
    const sprite = spriteRef.current;
    const shadow = shadowRef.current;
    if (!state || !root || !body || !swing || !sprite || !shadow) return;
    const { width, height } = stageSizeRef.current;
    const config = configRef.current;
    const animation = getPetAnimation(state);
    const column = config.calm
      ? 0
      : animation === 'walk'
        ? Math.floor(state.gaitPhase * PET_ANIMATIONS.walk.frames) % PET_ANIMATIONS.walk.frames
        : getPetFrameColumn(animation, state.modeElapsedMs);
    const frame = getPetFramePosition(animation, column);
    const groundY = clampToGround(state.position, config.ground).y;
    const airborne = Math.max(0, groundY - state.position.y) * height;
    const lift = (PET_ANIMATIONS[animation].lift?.[column] ?? 0) * spriteUnitPx(state) + airborne;
    const scale = .86 + getPetDepth(state.position.y, config.ground) * .2;

    root.style.transform = `translate3d(${state.position.x * width}px, ${state.position.y * height}px, 0)`;
    root.style.zIndex = String(3 + Math.round(groundY * 10));
    root.dataset.mode = state.mode;
    body.style.transform = `translate(-${ANCHOR_X}%, -${ANCHOR_Y}%) scale(${scale})`;
    swing.style.transformOrigin = `${state.facing > 0 ? GRIP_X : 100 - GRIP_X}% ${GRIP_Y}%`;
    swing.style.transform = `rotate(${swingRefState.current.angle}deg)`;
    sprite.style.transform = `scaleX(${state.facing})`;
    sprite.style.backgroundPosition = `${frame.x}% ${frame.y}%`;
    shadow.style.transform = `translate(-50%, calc(-50% + ${airborne}px)) scale(${scale * Math.max(.45, 1 - lift / 140)})`;
    shadow.style.opacity = String(Math.max(.35, 1 - lift / 160));
  };

  useEffect(() => {
    interestInputsRef.current = { gomaPosition, hasUnreadMail };
    updateInterestsRef.current();
  }, [gomaPosition, hasUnreadMail]);

  useEffect(() => {
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!stage || !root) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const computeInterests = (): PetInterest[] => {
      const interests: PetInterest[] = [];
      const goma = stage.querySelector<HTMLElement>('.student-goma-stage-character');
      const stageRect = stage.getBoundingClientRect();
      if (goma && stageRect.width > 0 && stageRect.height > 0) {
        const rect = goma.getBoundingClientRect();
        const bottom = (rect.bottom - stageRect.top) / stageRect.height;
        const y = bottom + .02;
        interests.push(
          { point: { x: (rect.right - stageRect.left) / stageRect.width + .04, y }, facing: -1 },
          { point: { x: (rect.left - stageRect.left) / stageRect.width - .04, y }, facing: 1 },
        );
      }
      if (interestInputsRef.current.hasUnreadMail) interests.push(MAILBOX_INTEREST);
      return interests.map((interest) => ({ ...interest, point: clampToGround(interest.point, DEFAULT_PET_BEHAVIOR_CONFIG.ground) }));
    };
    const updateConfig = () => {
      const { width, height } = stageSizeRef.current;
      configRef.current = {
        ...DEFAULT_PET_BEHAVIOR_CONFIG,
        aspectRatio: width > 0 && height > 0 ? width / height : DEFAULT_PET_BEHAVIOR_CONFIG.aspectRatio,
        interests: computeInterests(),
        calm: reducedMotion.matches,
      };
    };
    updateInterestsRef.current = updateConfig;
    const measure = () => {
      stageSizeRef.current = { width: stage.clientWidth, height: stage.clientHeight };
      root.style.setProperty('--student-pet-walker-width', `${Math.round(stage.clientWidth * PET_WIDTH_RATIO)}px`);
      updateConfig();
      render();
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(stage);
    reducedMotion.addEventListener('change', updateConfig);

    let frameId = 0;
    let lastTime = 0;
    const tick = (time: number) => {
      const dt = Math.min(100, Math.max(0, time - lastTime));
      lastTime = time;
      const gesture = gestureRef.current;
      let state = stateRef.current;
      if (state && gesture?.carrying) {
        // Slide the hold from where the pet was touched to its scruff, so it hangs from the pointer.
        gesture.carryElapsedMs += dt;
        const blend = smooth(Math.min(1, gesture.carryElapsedMs / GRIP_BLEND_MS));
        const grip = gripOffset(state);
        state = moveCarry(state, {
          x: gesture.pointer.x + gesture.grabOffset.x + (grip.x - gesture.grabOffset.x) * blend,
          y: gesture.pointer.y + gesture.grabOffset.y + (grip.y - gesture.grabOffset.y) * blend,
        }, configRef.current);
        gesture.pointerVelocityX *= Math.exp(-dt / 120);
      }
      if (state) stateRef.current = stepPetBehavior(state, dt, configRef.current, Math.random);

      // Pendulum swing around the scruff, driven by how fast the pointer moves sideways.
      const swing = swingRefState.current;
      const carrying = gesture?.carrying === true && !configRef.current.calm;
      const target = carrying
        ? Math.max(-SWING_LIMIT_DEG, Math.min(SWING_LIMIT_DEG, gesture.pointerVelocityX * SWING_GAIN_DEG_PER_PX_S))
        : 0;
      const seconds = dt / 1000;
      swing.velocity += ((target - swing.angle) * SWING_STIFFNESS - swing.velocity * SWING_DAMPING) * seconds;
      swing.angle += swing.velocity * seconds;
      if (!carrying && stateRef.current?.fallSpeed === null && Math.abs(swing.angle) < .05 && Math.abs(swing.velocity) < .05) {
        swing.angle = 0;
        swing.velocity = 0;
      }

      render();
      frameId = window.requestAnimationFrame(tick);
    };
    const start = () => {
      if (frameId !== 0 || document.hidden) return;
      lastTime = performance.now();
      frameId = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    };
    const handleVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', handleVisibility);
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      reducedMotion.removeEventListener('change', updateConfig);
      document.removeEventListener('visibilitychange', handleVisibility);
      updateInterestsRef.current = () => undefined;
      const gesture = gestureRef.current;
      if (gesture) {
        window.clearTimeout(gesture.longPressTimer);
        window.clearInterval(gesture.heartTimer);
      }
    };
  }, [stageRef]);

  const spawnHeart = () => {
    heartIdRef.current += 1;
    const id = heartIdRef.current;
    setHearts((current) => [...current.slice(-5), { id, left: 35 + Math.random() * 30 }]);
    window.setTimeout(() => setHearts((current) => current.filter((heart) => heart.id !== id)), HEART_LIFETIME_MS);
  };

  const toStagePoint = (clientX: number, clientY: number): PetPoint | null => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return null;
    return { x: (clientX - bounds.left) / bounds.width, y: (clientY - bounds.top) / bounds.height };
  };

  const touchZone = (clientX: number, clientY: number, facing: 1 | -1): PetTouchZone => {
    const bounds = bodyRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return 'head';
    const along = (clientX - bounds.left) / bounds.width;
    const forward = facing > 0 ? along : 1 - along;
    return forward > .55 && (clientY - bounds.top) / bounds.height < .7 ? 'head' : 'back';
  };

  const endGesture = () => {
    const gesture = gestureRef.current;
    if (!gesture) return null;
    window.clearTimeout(gesture.longPressTimer);
    window.clearInterval(gesture.heartTimer);
    gestureRef.current = null;
    return gesture;
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const state = stateRef.current;
    const point = toStagePoint(event.clientX, event.clientY);
    if (!state || !point) return;
    endGesture();
    event.currentTarget.setPointerCapture(event.pointerId);
    const { clientX, clientY } = event;
    const gesture: PointerGesture = {
      pointerId: event.pointerId,
      startClientX: clientX,
      startClientY: clientY,
      grabOffset: { x: state.position.x - point.x, y: state.position.y - point.y },
      pointer: point,
      pointerVelocityX: 0,
      lastMoveTime: event.timeStamp,
      carryElapsedMs: 0,
      carrying: false,
      petting: false,
      longPressTimer: 0,
      heartTimer: 0,
    };
    gesture.longPressTimer = window.setTimeout(() => {
      const current = stateRef.current;
      if (!current || gestureRef.current !== gesture || gesture.carrying) return;
      gesture.petting = true;
      stateRef.current = startPetting(current, touchZone(clientX, clientY, current.facing));
      spawnHeart();
      gesture.heartTimer = window.setInterval(spawnHeart, PETTING_HEART_INTERVAL_MS);
    }, LONG_PRESS_MS);
    gestureRef.current = gesture;
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current;
    const state = stateRef.current;
    if (!gesture || !state || gesture.pointerId !== event.pointerId || gesture.petting) return;
    const point = toStagePoint(event.clientX, event.clientY);
    if (!point) return;
    if (!gesture.carrying) {
      if (Math.hypot(event.clientX - gesture.startClientX, event.clientY - gesture.startClientY) < DRAG_THRESHOLD_PX) return;
      window.clearTimeout(gesture.longPressTimer);
      gesture.carrying = true;
      gesture.carryElapsedMs = 0;
      stateRef.current = startCarry(state);
    }
    const elapsed = Math.max(1, event.timeStamp - gesture.lastMoveTime);
    const velocity = ((point.x - gesture.pointer.x) * stageSizeRef.current.width * 1000) / elapsed;
    gesture.pointerVelocityX = gesture.pointerVelocityX * .6 + velocity * .4;
    gesture.lastMoveTime = event.timeStamp;
    gesture.pointer = point;
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    const gesture = endGesture();
    const state = stateRef.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!gesture || !state) return;
    if (gesture.carrying) {
      stateRef.current = dropPet(state, configRef.current, Math.random);
    } else if (gesture.petting) {
      stateRef.current = stopPetting(state, Math.random);
    } else {
      stateRef.current = reactToPetTap(state, configRef.current, Math.random);
      spawnHeart();
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    const gesture = endGesture();
    const state = stateRef.current;
    if (!gesture || !state) return;
    if (gesture.carrying) stateRef.current = dropPet(state, configRef.current, Math.random);
    else if (gesture.petting) stateRef.current = stopPetting(state, Math.random);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const state = stateRef.current;
    if (!state) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      onOpenPicker();
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      stateRef.current = reactToPetTap(state, configRef.current, Math.random);
      spawnHeart();
      return;
    }
    const deltas: Record<string, PetPoint> = {
      ArrowLeft: { x: -.03, y: 0 },
      ArrowRight: { x: .03, y: 0 },
      ArrowUp: { x: 0, y: -.02 },
      ArrowDown: { x: 0, y: .02 },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    stateRef.current = nudgePet(state, delta, configRef.current, Math.random);
  };

  return (
    <div ref={rootRef} className="student-pet-walker">
      <span ref={shadowRef} className="student-pet-walker-shadow" aria-hidden="true" />
      <button
        ref={bodyRef}
        type="button"
        className="student-pet-walker-body"
        aria-label={`${name || kindLabel} 쓰다듬기. Enter 키로 펫 바꾸기`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
      >
        <span ref={swingRef} className="student-pet-walker-swing" aria-hidden="true">
          <span
            ref={spriteRef}
            className="student-pet-walker-sprite"
            style={{ backgroundImage: `url(${sheetUrl})`, backgroundSize: PET_SPRITE_BACKGROUND_SIZE }}
          />
        </span>
        {name ? <strong className="student-pet-walker-name">{name}</strong> : null}
        {hearts.map((heart) => (
          <Heart key={heart.id} className="student-pet-walker-heart" style={{ left: `${heart.left}%` }} aria-hidden="true" />
        ))}
      </button>
    </div>
  );
}
