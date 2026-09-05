import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
} from 'react';
import { BookOpen, LogOut, X } from 'lucide-react';
import { createLibraryAudio } from '../../../lib/canvasLibraryAudio';
import { CANVAS_LIBRARY_PALETTE } from './CanvasLibraryPalette';
import { useModalFocus } from '../../../lib/useModalFocus';
import { CanvasLibraryPlacementExpectedError } from '../../../lib/canvasLibraryClient';
import {
  createLibraryPlayer,
  createSmallLibraryRoom,
  isLibraryExitIntent,
  resolveLibraryBookRoom,
  getNearbyLibraryTarget,
  findLibraryPlayerPath,
  placeLibraryDraft,
  stepLibraryPlayer,
  type LibraryAmbientObject,
  type LibraryBookDraft,
  type LibraryPlacedBook,
  type LibraryPoint,
  type LibraryRoom,
  type LibraryScene,
  type LibraryShelf,
  type LibraryTarget,
} from '../../../lib/canvasLibraryWorld';
import { createLibraryAmbientState, createLibraryAmbientAction, completeLibraryAmbientAction, getLibraryAmbientLabel, type LibraryAmbientAction } from '../../../lib/canvasLibraryAmbient';
import { createLibraryCatNavigation, createLibraryCatState, stepLibraryCat, resolveLibraryCatRoom, startLibraryCatPet, finishLibraryCatPet, cancelLibraryCatPet, type LibraryCatState } from '../../../lib/canvasLibraryCat';
import { createLibraryRenderer } from './CanvasLibraryRenderer';
import { getLibraryActionDuration, getLibraryBearPose, getLibraryBookThickness, getLibraryBookTone, LIBRARY_WALK_FRAME_MS } from '../../../lib/canvasLibraryPose';
import StudentConfirmDialog from '../StudentConfirmDialog';
import { MAX_BOOK_REFLECTION_LENGTH, normalizeBookReflection } from '../../../lib/studentLife';

type PlaceBook = (draft: LibraryBookDraft, slotId: number) => Promise<LibraryPlacedBook | null>;

type CanvasLibraryGameBaseProps = {
  readonly studentNumber: number;
  readonly room?: LibraryRoom;
  readonly unplacedBooks?: readonly LibraryBookDraft[];
  readonly onBack?: () => void;
  readonly renderFailureBoard?: (onClose: () => void, returnFocusRef: RefObject<HTMLCanvasElement | null>) => ReactNode;
  readonly renderCompetition?: (onClose: () => void, returnFocusRef: RefObject<HTMLCanvasElement | null>) => ReactNode;
  readonly seasonId?: string | null;
  readonly initialFailureBoardOpen?: boolean;
  readonly boardNoteCount?: number;
  readonly catSeed?: number;
  readonly initialCatState?: LibraryCatState;
};

export type CanvasLibraryGameProps = CanvasLibraryGameBaseProps & (
  | { readonly books?: undefined; readonly onPlace?: undefined }
  | { readonly books: readonly LibraryPlacedBook[]; readonly onPlace: PlaceBook }
);

type GameModal =
  | { readonly kind: 'reading' }
  | { readonly kind: 'failure-board' }
  | { readonly kind: 'competition-board' }
  | { readonly kind: 'registration' }
  | { readonly kind: 'confirm-registration'; readonly draft: LibraryBookDraft }
  | { readonly kind: 'confirm-exit' }
  | { readonly kind: 'slots'; readonly shelfId: string }
  | { readonly kind: 'details'; readonly book: LibraryPlacedBook }
  | null;

const MOVEMENT_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']);

const movementVector = (keys: ReadonlySet<string>): LibraryPoint => ({
  x: Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a')),
  y: Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w')),
});

const isPointInside = (point: LibraryPoint, rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
);

const sameTarget = (first: LibraryTarget | null, second: LibraryTarget | null) => first?.id === second?.id
  && Math.round(first?.interactionPoint.x ?? 0) === Math.round(second?.interactionPoint.x ?? 0)
  && Math.round(first?.interactionPoint.y ?? 0) === Math.round(second?.interactionPoint.y ?? 0);

const validateRegistration = (title: string, author: string, reflection: string): string | null => {
  const normalizedTitle = title.trim();
  const normalizedAuthor = author.trim();
  if (normalizedTitle.length < 1 || normalizedTitle.length > 50) return '책 제목은 1~50자로 입력해 주세요.';
  if (normalizedAuthor.length < 1 || normalizedAuthor.length > 30) return '글쓴이는 1~30자로 입력해 주세요.';
  if (!normalizeBookReflection(reflection)) return `한 줄 감상을 1~${MAX_BOOK_REFLECTION_LENGTH}자로 적어 주세요.`;
  return null;
};

const useDialogFocus = (
  dialogRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onDismiss: () => void,
  sceneRef: RefObject<HTMLCanvasElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
  isDismissible = true,
) => {
  useModalFocus({
    dialogRef,
    isOpen,
    onDismiss,
    initialFocusRef,
    returnFocusRef: sceneRef,
    isDismissible,
  });
};

export default function CanvasLibraryGame(props: CanvasLibraryGameProps) {
  const { studentNumber, room: suppliedRoom, unplacedBooks = [], onBack } = props;
  const defaultRoomRef = useRef<LibraryRoom | null>(null);
  if (!defaultRoomRef.current) defaultRoomRef.current = createSmallLibraryRoom();
  const baseRoom = suppliedRoom ?? defaultRoomRef.current;
  const controlledBooks = props.books;
  const [localBooks, setLocalBooks] = useState<readonly LibraryPlacedBook[]>([]);
  const books = controlledBooks ?? localBooks;
  const room = useMemo(() => resolveLibraryBookRoom(baseRoom, books), [baseRoom, books]);
  const catNavigation = useMemo(() => createLibraryCatNavigation(room), [room]);
  const [initialCatState] = useState(() => import.meta.env.DEV && props.initialCatState
    ? props.initialCatState
    : createLibraryCatState(room, catNavigation, import.meta.env.DEV && props.catSeed !== undefined ? props.catSeed : Math.floor(Math.random() * 0x100000000), createLibraryPlayer(room, studentNumber)));

  const [carriedDraft, setCarriedDraft] = useState<LibraryBookDraft | null>(null);
  const [nearbyTarget, setNearbyTarget] = useState<LibraryTarget | null>(null);
  const [modal, setModal] = useState<GameModal>(() => props.initialFailureBoardOpen && props.renderFailureBoard ? { kind: 'failure-board' } : null);
  const [pausedByBlur, setPausedByBlur] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [displayScale, setDisplayScale] = useState(1);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [reflection, setReflection] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [seasonNotice, setSeasonNotice] = useState<string | null>(null);
  const previousSeasonRef = useRef(props.seasonId);
  const preserveRegistrationRef = useRef(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [isPlacing, setIsPlacing] = useState(false);
  const [readingBookIndex, setReadingBookIndex] = useState(0);
  const [ambientState, setAmbientState] = useState(createLibraryAmbientState);
  const [ambientBusy, setAmbientBusy] = useState(false);
  const [ambientNotice, setAmbientNotice] = useState<string | null>(null);
  const ambientNoticeTimerRef = useRef<number | null>(null);
  const ambientApproachRef = useRef<{ objectId: string; path: readonly LibraryPoint[]; stalledMs: number } | null>(null);
  const receiveApproachRef = useRef<{ book: LibraryBookDraft; path: readonly LibraryPoint[]; stalledMs: number; waiting: boolean } | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [clerkGreeting, setClerkGreeting] = useState(false);
  const clerkGreetingRef = useRef(false);
  const pausedAtRef = useRef<number | null>(null);
  const audioRef = useRef<ReturnType<typeof createLibraryAudio> | null>(null);
  const pendingSoundRef = useRef<{ readonly kind: 'place'; readonly startedAt: number } | null>(null);
  const [placementNotice, setPlacementNotice] = useState<string | null>(null);
  const placementNoticeTimerRef = useRef<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createLibraryRenderer> | null>(null);
  const heldKeyboardRef = useRef(new Set<string>());
  const pausedRef = useRef(false);
  const modalRef = useRef<GameModal>(null);
  const booksRef = useRef(books);
  const carriedDraftRef = useRef(carriedDraft);
  const nearbyTargetRef = useRef<LibraryTarget | null>(null);
  const hasMovedRef = useRef(false);
  const placementCueTimerRef = useRef<number | null>(null);
  const placementPendingRef = useRef(false);
  const mountedRef = useRef(true);
  const exitCompletedRef = useRef(false);
  const exitArmedRef = useRef(true);
  const onBackRef = useRef(onBack);
  const sceneStateRef = useRef<LibraryScene>({
    player: createLibraryPlayer(room, studentNumber),
    placedBooks: books,
    carriedDraft: null,
    nearbyTarget: null,
    selectedSlotId: null,
    timeMs: 0,
    reducedMotion: false,
    ambientState,
    catState: initialCatState,
    clerkState: room.desk.clerk ? { timeMs: 0 } : undefined,
  });

  const registrationDialogRef = useRef<HTMLElement>(null);
  const registrationTitleRef = useRef<HTMLInputElement>(null);
  const slotDialogRef = useRef<HTMLElement>(null);
  const firstSlotRef = useRef<HTMLButtonElement>(null);
  const detailsDialogRef = useRef<HTMLElement>(null);
  const detailsCloseRef = useRef<HTMLButtonElement>(null);
  const readingDialogRef = useRef<HTMLElement>(null);
  const readingCloseRef = useRef<HTMLButtonElement>(null);
  const slotButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const registrationTitleId = useId();
  const slotTitleId = useId();
  const detailsTitleId = useId();
  const readingTitleId = useId();

  modalRef.current = modal;
  booksRef.current = books;
  carriedDraftRef.current = carriedDraft;
  onBackRef.current = onBack;

  const unlockAudio = () => {
    if (pausedRef.current || document.hidden) return;
    void audioRef.current?.unlock();
  };

  const playPlacementSound = () => {
    if (!pausedRef.current && !document.hidden) audioRef.current?.play('place');
  };

  const clearHeldInput = () => {
    heldKeyboardRef.current.clear();
    const current = sceneStateRef.current;
    if (current.player.isWalking) sceneStateRef.current = { ...current, player: { ...current.player, isWalking: false } };
  };

  const showAmbientNotice = (message: string | null) => {
    if (ambientNoticeTimerRef.current !== null) window.clearTimeout(ambientNoticeTimerRef.current);
    setAmbientNotice(message);
    ambientNoticeTimerRef.current = message ? window.setTimeout(() => {
      setAmbientNotice(null);
      ambientNoticeTimerRef.current = null;
    }, 2000) : null;
  };

  const beginReceive = (book: LibraryBookDraft, time: number) => {
    receiveApproachRef.current = null;
    carriedDraftRef.current = book;
    setCarriedDraft(book);
    clearHeldInput();
    const current = sceneStateRef.current;
    sceneStateRef.current = { ...current, carriedDraft: book,
      player: { ...current.player, facing: room.desk.clerk ? 'up' : current.player.facing, isWalking: false },
      action: current.reducedMotion ? undefined : { kind: 'receive', startedAt: time } };
    setReceiving(!current.reducedMotion);
    if (current.reducedMotion) showAmbientNotice('책장에 꽂아 주세요');
  };

  const finishAmbientAction = (action: LibraryAmbientAction) => {
    const current = sceneStateRef.current;
    const result = completeLibraryAmbientAction(current.ambientState ?? createLibraryAmbientState(), action);
    sceneStateRef.current = { ...current, ambientState: result.state, ambientAction: undefined,
      catState: action.kind === 'pet' && current.catState ? finishLibraryCatPet(current.catState) : current.catState };
    setAmbientState(result.state);
    setAmbientBusy(false);
    showAmbientNotice(result.notice);
  };

  const beginAmbientAction = (object: LibraryAmbientObject, time: number) => {
    const current = sceneStateRef.current;
    const action = createLibraryAmbientAction(current.ambientState ?? createLibraryAmbientState(), object, time);
    const target = object.actionPoint ?? object.interactionPoint;
    const dx = target.x - current.player.position.x;
    const dy = target.y - current.player.position.y;
    const facing = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
    const actionScene = { ...current, ambientAction: action, player: { ...current.player, facing, isWalking: false } } satisfies LibraryScene;
    const canReach = action.kind === 'sit' || [0.25, 0.5, 0.75].every(progress => getLibraryBearPose({ ...actionScene, reducedMotion: false, timeMs: time + action.durationMs * progress }, room).reachable);
    if (!canReach) {
      sceneStateRef.current = { ...current, catState: current.catState?.behavior === 'pet' ? cancelLibraryCatPet(current.catState) : current.catState };
      ambientApproachRef.current = null;
      setAmbientBusy(false);
      showAmbientNotice('조금 더 가까이 다가가 주세요');
      return;
    }
    sceneStateRef.current = actionScene;
    ambientApproachRef.current = null;
    setAmbientBusy(true);
    if (current.reducedMotion) finishAmbientAction(action);
  };

  const standFromBench = () => {
    const current = sceneStateRef.current;
    if (!current.ambientState?.benchObjectId) return false;
    const next = { ...current.ambientState, benchObjectId: null };
    sceneStateRef.current = { ...current, ambientState: next };
    setAmbientState(next);
    showAmbientNotice(null);
    clearHeldInput();
    return true;
  };

  const closeModal = () => {
    if (placementPendingRef.current) return;
    clearHeldInput();
    setFormError(null);
    setSlotError(null);
    setModal(null);
    modalRef.current = null;
    sceneStateRef.current = { ...sceneStateRef.current, selectedSlotId: null, seated: false };
  };

  const finishExit = () => {
    if (exitCompletedRef.current || placementPendingRef.current || !onBackRef.current) return;
    exitCompletedRef.current = true;
    clearHeldInput();
    onBackRef.current();
  };

  const requestExit = () => {
    const current = sceneStateRef.current;
    if (!onBackRef.current || exitCompletedRef.current || pausedRef.current || modalRef.current
      || placementPendingRef.current || current.action || current.ambientAction || ambientApproachRef.current
      || (receiveApproachRef.current && !receiveApproachRef.current.waiting)) return;
    clearHeldInput();
    exitArmedRef.current = false;
    modalRef.current = { kind: 'confirm-exit' };
    setModal(modalRef.current);
  };

  useDialogFocus(
    registrationDialogRef,
    modal?.kind === 'registration',
    closeModal,
    canvasRef,
    registrationTitleRef,
  );
  useDialogFocus(slotDialogRef, modal?.kind === 'slots', closeModal, canvasRef, firstSlotRef, !isPlacing);
  useDialogFocus(detailsDialogRef, modal?.kind === 'details', closeModal, canvasRef, detailsCloseRef);
  useDialogFocus(readingDialogRef, modal?.kind === 'reading', closeModal, canvasRef, readingCloseRef);

  useEffect(() => {
    const previous = previousSeasonRef.current;
    previousSeasonRef.current = props.seasonId;
    if (!previous || !props.seasonId || previous === props.seasonId) return;
    if (modalRef.current?.kind !== 'slots' && modalRef.current?.kind !== 'registration' && modalRef.current?.kind !== 'confirm-registration') return;
    preserveRegistrationRef.current = modalRef.current.kind === 'registration' || modalRef.current.kind === 'confirm-registration';
    clearHeldInput();
    setModal(null);
    setSeasonNotice('새 달 책장이 열렸어요. 작성한 책은 그대로예요. 자리를 다시 골라 주세요.');
    sceneStateRef.current = { ...sceneStateRef.current, selectedSlotId: null };
  }, [props.seasonId]);

  useEffect(() => {
    if (modal?.kind !== 'slots' || isPlacing) return;
    const dialog = slotDialogRef.current;
    if (!dialog || dialog.contains(document.activeElement)) return;
    const button = slotButtonRefs.current[activeSlotIndex] ?? firstSlotRef.current;
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }, [activeSlotIndex, isPlacing, modal?.kind]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateScale = () => {
      const nextScale = Math.max(1, Math.floor(Math.min(stage.clientWidth / room.width, stage.clientHeight / room.height)));
      setDisplayScale(nextScale);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [room]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      sceneStateRef.current = { ...sceneStateRef.current, reducedMotion: media.matches };
      rendererRef.current?.draw(sceneStateRef.current);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createLibraryRenderer(canvas, room);
    rendererRef.current = renderer;
    renderer.draw(sceneStateRef.current);
    let frameId = 0;
    let previousTime = performance.now();
    const drawFrame = (time: number) => {
      const elapsedMs = Math.min(32, Math.max(0, time - previousTime));
      previousTime = time;
      const held = new Set(heldKeyboardRef.current);
      const input = movementVector(held);
      let current = sceneStateRef.current;
      if (current.clerkState && !pausedRef.current && modalRef.current === null) {
        const previous = current.clerkState;
        const timeMs = previous.timeMs + elapsedMs;
        const greetingStartedAt = previous.greetingStartedAt ??
          (!current.action && !current.ambientAction && !receiveApproachRef.current && !carriedDraftRef.current
            && Math.hypot(current.player.position.x - room.desk.interactionPoint.x, current.player.position.y - room.desk.interactionPoint.y) <= 90 ? timeMs : undefined);
        current = { ...current, clerkState: { timeMs, greetingStartedAt } };
        const greetingVisible = greetingStartedAt !== undefined && timeMs - greetingStartedAt < 3000;
        if (greetingVisible !== clerkGreetingRef.current) {
          clerkGreetingRef.current = greetingVisible;
          setClerkGreeting(greetingVisible);
        }
      }
      if (current.catState) {
        current = { ...current, catState: stepLibraryCat(room, catNavigation, current.catState, current.player, input, elapsedMs, {
          paused: pausedRef.current || modalRef.current !== null || Boolean(current.action || current.ambientAction || ambientApproachRef.current || receiveApproachRef.current),
          reducedMotion: current.reducedMotion,
        }) };
      }
      let activeRoom = resolveLibraryCatRoom(room, current.catState, current.player);
      if (!pausedRef.current && modalRef.current === null) {
        const reception = receiveApproachRef.current;
        if (reception && !reception.waiting && room.desk.clerk) {
          while (reception.path.length > 1 && Math.hypot(reception.path[0].x - current.player.position.x, reception.path[0].y - current.player.position.y) < 0.01) reception.path = reception.path.slice(1);
          const target = reception.path[0] ?? room.desk.clerk.receivePoint;
          const dx = target.x - current.player.position.x;
          const dy = target.y - current.player.position.y;
          const distance = Math.hypot(dx, dy);
          if (distance <= 1.5 && reception.path.length <= 1) {
            sceneStateRef.current = current;
            beginReceive(reception.book, time);
            current = sceneStateRef.current;
          } else {
            const next = stepLibraryPlayer(activeRoom, current.player, { x: dx / distance, y: dy / distance }, Math.min(elapsedMs, distance * 10));
            const moved = Math.hypot(next.position.x - current.player.position.x, next.position.y - current.player.position.y);
            reception.stalledMs = moved < 0.05 ? reception.stalledMs + elapsedMs : 0;
            current = { ...current, player: next };
            if (reception.stalledMs > 250) {
              reception.waiting = true;
              showAmbientNotice('조금 더 가까이 다가와 직원에게 말을 걸어 주세요');
            }
          }
        }
        const approach = ambientApproachRef.current;
        if (approach) {
          const object = activeRoom.ambientObjects?.find(item => item.id === approach.objectId);
          if (object) {
            while (approach.path.length > 1 && Math.hypot(approach.path[0].x - current.player.position.x, approach.path[0].y - current.player.position.y) < 0.01) approach.path = approach.path.slice(1);
            const waypoint = approach.path[0] ?? object.interactionPoint;
            const dx = waypoint.x - current.player.position.x;
            const dy = waypoint.y - current.player.position.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= 1.5 && approach.path.length <= 1) {
              sceneStateRef.current = current;
              beginAmbientAction(object, time);
              current = sceneStateRef.current;
            } else {
              const next = stepLibraryPlayer(activeRoom, current.player, { x: dx / distance, y: dy / distance }, Math.min(elapsedMs, distance * 10));
              const moved = Math.hypot(next.position.x - current.player.position.x, next.position.y - current.player.position.y);
              approach.stalledMs = moved < 0.05 ? approach.stalledMs + elapsedMs : 0;
              current = { ...current, player: next };
              if (approach.stalledMs > 250) {
                if (current.catState && object.kind === 'cat') current = { ...current, catState: cancelLibraryCatPet(current.catState) };
                ambientApproachRef.current = null;
                setAmbientBusy(false);
                showAmbientNotice('조금 더 가까이 다가가 주세요');
              }
            }
          } else {
            ambientApproachRef.current = null;
            setAmbientBusy(false);
          }
        }
        if (current.ambientAction && (current.reducedMotion || time - current.ambientAction.startedAt >= current.ambientAction.durationMs)) {
          sceneStateRef.current = current;
          finishAmbientAction(current.ambientAction);
          current = sceneStateRef.current;
        }
      }
      const pendingSound = pendingSoundRef.current;
      if (pendingSound && (current.reducedMotion || time - pendingSound.startedAt >= 400)) {
        pendingSoundRef.current = null;
        if (time - pendingSound.startedAt < 650) playPlacementSound();
      }
      const actionTime = pausedRef.current ? current.timeMs : time;
      const action = current.action && actionTime - current.action.startedAt < getLibraryActionDuration(current.action, room) && !current.reducedMotion ? current.action : undefined;
      if (current.action?.kind === 'receive' && !action && !pausedRef.current) {
        setReceiving(false);
        showAmbientNotice('책장에 꽂아 주세요');
      }
      activeRoom = resolveLibraryCatRoom(room, current.catState, current.player);
      const canMove = !exitCompletedRef.current && !placementPendingRef.current && !pausedRef.current && modalRef.current === null && !action && !current.ambientAction && !ambientApproachRef.current && (!receiveApproachRef.current || receiveApproachRef.current.waiting) && !current.ambientState?.benchObjectId;
      const player = canMove && (input.x !== 0 || input.y !== 0)
        ? stepLibraryPlayer(activeRoom, current.player, input, elapsedMs)
        : current.player.isWalking && ((!ambientApproachRef.current && !receiveApproachRef.current) || pausedRef.current)
          ? { ...current.player, isWalking: false }
          : current.player;
      if (!hasMovedRef.current && player.position !== current.player.position) {
        hasMovedRef.current = true;
        setHasMoved(true);
      }
      const walkTimeMs = player.isWalking
        ? current.player.isWalking ? (current.walkTimeMs ?? 0) + elapsedMs : 0
        : 0;
      const target = getNearbyLibraryTarget(resolveLibraryCatRoom(room, current.catState, player), player, booksRef.current);
      current = {
        ...current,
        player,
        placedBooks: booksRef.current,
        carriedDraft: carriedDraftRef.current,
        nearbyTarget: target,
        timeMs: pausedRef.current ? current.timeMs : time,
        walkTimeMs,
        action,
        seated: modalRef.current?.kind === 'reading',
      };
      sceneStateRef.current = current;
      if (canMove && exitArmedRef.current && isLibraryExitIntent(room, player, input)) requestExit();
      canvas.dataset.playerX = player.position.x.toFixed(2);
      canvas.dataset.playerY = player.position.y.toFixed(2);
      canvas.dataset.nearbyTarget = target?.id ?? '';
      canvas.dataset.facing = player.facing;
      canvas.dataset.action = action?.kind ?? '';
      canvas.dataset.receiveApproach = receiveApproachRef.current ? receiveApproachRef.current.waiting ? 'waiting' : 'approaching' : '';
      canvas.dataset.clerkState = current.clerkState ? JSON.stringify(current.clerkState) : '';
      canvas.dataset.ambientAction = current.ambientAction?.kind ?? (ambientApproachRef.current ? 'approach' : '');
      canvas.dataset.ambientState = JSON.stringify(current.ambientState);
      canvas.dataset.catState = current.catState ? JSON.stringify(current.catState) : '';
      canvas.dataset.seated = String(current.seated);
      canvas.dataset.walkPhase = String(Math.floor(walkTimeMs / LIBRARY_WALK_FRAME_MS) % 4);
      if (!sameTarget(target, nearbyTargetRef.current)) {
        nearbyTargetRef.current = target;
        setNearbyTarget(target);
      }
      renderer.draw(current);
      frameId = requestAnimationFrame(drawFrame);
    };
    frameId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [room, catNavigation]);

  useEffect(() => {
    sceneStateRef.current = { ...sceneStateRef.current, boardNoteCount: props.boardNoteCount ?? 0 };
  }, [props.boardNoteCount]);

  useEffect(() => {
    const target = getNearbyLibraryTarget(resolveLibraryCatRoom(room, sceneStateRef.current.catState, sceneStateRef.current.player), sceneStateRef.current.player, books);
    sceneStateRef.current = { ...sceneStateRef.current, placedBooks: books, nearbyTarget: target };
    nearbyTargetRef.current = target;
    setNearbyTarget(target);
  }, [books, room]);

  useEffect(() => {
    sceneStateRef.current = { ...sceneStateRef.current, carriedDraft };
  }, [carriedDraft]);

  useEffect(() => {
    mountedRef.current = true;
    audioRef.current = createLibraryAudio();
    audioRef.current.setEnabled(true);
    const handleBlur = () => {
      pausedAtRef.current ??= performance.now();
      pausedRef.current = true;
      audioRef.current?.setPaused(true);
      pendingSoundRef.current = null;
      clearHeldInput();
      setPausedByBlur(true);
    };
    const handleFocus = () => {
      if (!document.hidden && pausedAtRef.current !== null) {
        const pauseDuration = performance.now() - pausedAtRef.current;
        const current = sceneStateRef.current;
        sceneStateRef.current = { ...current,
          action: current.action ? { ...current.action, startedAt: current.action.startedAt + pauseDuration } : undefined,
          ambientAction: current.ambientAction ? { ...current.ambientAction, startedAt: current.ambientAction.startedAt + pauseDuration } : undefined,
        };
        pausedAtRef.current = null;
      }
      pausedRef.current = document.hidden;
      audioRef.current?.setPaused(document.hidden);
      setPausedByBlur(document.hidden);
    };
    const handleVisibility = () => {
      if (document.hidden) handleBlur();
      else handleFocus();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      heldKeyboardRef.current.delete(key);
      if (key === 'arrowdown' || key === 's') exitArmedRef.current = true;
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      mountedRef.current = false;
      clearHeldInput();
      if (placementCueTimerRef.current !== null) window.clearTimeout(placementCueTimerRef.current);
      if (placementNoticeTimerRef.current !== null) window.clearTimeout(placementNoticeTimerRef.current);
      pendingSoundRef.current = null;
      ambientApproachRef.current = null;
      receiveApproachRef.current = null;
      if (ambientNoticeTimerRef.current !== null) window.clearTimeout(ambientNoticeTimerRef.current);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('visibilitychange', handleVisibility);
      const audio = audioRef.current;
      audioRef.current = null;
      audio?.dispose();
    };
  }, []);

  const openModal = (nextModal: Exclude<GameModal, null>) => {
    clearHeldInput();
    setSlotError(null);
    setModal(nextModal);
  };

  const interact = () => {
    if (modalRef.current || pausedRef.current || sceneStateRef.current.action || sceneStateRef.current.ambientAction || ambientApproachRef.current) return;
    canvasRef.current?.focus({ preventScroll: true });
    if (standFromBench()) return;
    const target = sceneStateRef.current.nearbyTarget;
    if (!target) return;
    if (receiveApproachRef.current) {
      if (target.kind === 'registration-desk') {
        const current = sceneStateRef.current;
        const path = findLibraryPlayerPath(resolveLibraryCatRoom(room, current.catState, current.player), current.player, room.desk.clerk?.receivePoint ?? room.desk.interactionPoint);
        receiveApproachRef.current.path = path ?? [];
        receiveApproachRef.current.waiting = path === null;
        receiveApproachRef.current.stalledMs = 0;
        if (!path) showAmbientNotice('조금 더 가까이 다가와 직원에게 말을 걸어 주세요');
        clearHeldInput();
      } else showAmbientNotice('직원에게 책을 먼저 받아 주세요');
      return;
    }
    if (target.kind === 'ambient') {
      if (carriedDraftRef.current) {
        showAmbientNotice('책을 먼저 꽂아 주세요');
        return;
      }
      let activeRoom = resolveLibraryCatRoom(room, sceneStateRef.current.catState, sceneStateRef.current.player);
      let object = activeRoom.ambientObjects?.find(item => item.id === target.objectId);
      if (!object) return;
      const current = sceneStateRef.current;
      if (object.kind === 'cat' && current.catState) {
        sceneStateRef.current = { ...current, catState: startLibraryCatPet(room, catNavigation, current.catState, current.player) };
        activeRoom = resolveLibraryCatRoom(room, sceneStateRef.current.catState, current.player);
        object = activeRoom.ambientObjects?.find(item => item.id === target.objectId);
        if (!object) return;
      }
      clearHeldInput();
      showAmbientNotice(null);
      if (Math.hypot(object.interactionPoint.x - sceneStateRef.current.player.position.x, object.interactionPoint.y - sceneStateRef.current.player.position.y) <= 1.5) {
        beginAmbientAction(object, performance.now());
      } else {
        const path = findLibraryPlayerPath(activeRoom, sceneStateRef.current.player, object.interactionPoint);
        if (!path) {
          const stopped = sceneStateRef.current;
          sceneStateRef.current = { ...stopped, catState: stopped.catState?.behavior === 'pet' ? cancelLibraryCatPet(stopped.catState) : stopped.catState };
          showAmbientNotice('조금 더 가까이 다가가 주세요');
          return;
        }
        ambientApproachRef.current = { objectId: object.id, path, stalledMs: 0 };
        setAmbientBusy(true);
      }
      canvasRef.current?.focus({ preventScroll: true });
    } else if (target.kind === 'failure-board') {
      if (props.renderFailureBoard) openModal({ kind: 'failure-board' });
    } else if (target.kind === 'competition-board') {
      if (props.renderCompetition) openModal({ kind: 'competition-board' });
    } else if (target.kind === 'reading-nook') {
      setReadingBookIndex(0);
      sceneStateRef.current = { ...sceneStateRef.current, seated: true };
      openModal({ kind: 'reading' });
    } else if (target.kind === 'registration-desk') {
      if (carriedDraftRef.current) {
        showAmbientNotice('들고 있는 책을 먼저 꽂아 주세요');
        return;
      }
      if (!preserveRegistrationRef.current) {
        setTitle('');
        setAuthor('');
        setReflection('');
      }
      preserveRegistrationRef.current = false;
      setSeasonNotice(null);
      setFormError(null);
      openModal({ kind: 'registration' });
    } else if (target.kind === 'shelf' || target.kind === 'placed-book') {
      setSeasonNotice(null);
      setActiveSlotIndex(0);
      openModal({ kind: 'slots', shelfId: target.shelfId });
    }
  };

  const handleSceneKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const key = event.key.toLowerCase();
    if (modalRef.current || pausedRef.current) return;
    if (receiveApproachRef.current && !receiveApproachRef.current.waiting) {
      if (MOVEMENT_KEYS.has(key) || key === 'e' || key === 'enter' || key === 'escape') event.preventDefault();
      return;
    }
    if (sceneStateRef.current.ambientAction) {
      if (MOVEMENT_KEYS.has(key) || key === 'e' || key === 'enter' || key === 'escape') event.preventDefault();
      return;
    }
    if (ambientApproachRef.current && (MOVEMENT_KEYS.has(key) || key === 'escape')) {
      const current = sceneStateRef.current;
      if (current.catState?.behavior === 'pet') sceneStateRef.current = { ...current, catState: cancelLibraryCatPet(current.catState) };
      ambientApproachRef.current = null;
      setAmbientBusy(false);
      clearHeldInput();
      event.preventDefault();
      if (key === 'escape') return;
    }
    if (sceneStateRef.current.ambientState?.benchObjectId && (MOVEMENT_KEYS.has(key) || key === 'escape')) {
      event.preventDefault();
      standFromBench();
    }
    if (MOVEMENT_KEYS.has(key)) {
      event.preventDefault();
      if (!event.repeat && (key === 'arrowdown' || key === 's')) exitArmedRef.current = true;
      heldKeyboardRef.current.add(key);
      return;
    }
    if ((key === 'e' || key === 'ㄷ' || event.code === 'KeyE' || key === 'enter') && !event.repeat) {
      event.preventDefault();
      interact();
    }
  };

  const handleCanvasPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (modalRef.current || pausedRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) * room.width / rect.width,
      y: (event.clientY - rect.top) * room.height / rect.height,
    };
    const target = sceneStateRef.current.nearbyTarget;
    if (target?.kind === 'ambient') {
      const object = resolveLibraryCatRoom(room, sceneStateRef.current.catState, sceneStateRef.current.player).ambientObjects?.find(item => item.id === target.objectId);
      if (object && isPointInside(point, object.visualRect)) interact();
      return;
    }
    if (target?.kind === 'competition-board' && room.competitionBoard && isPointInside(point, room.competitionBoard.visualRect)) {
      interact();
      return;
    }
    if (target?.kind === 'reading-nook' && room.readingArea.beanbagVisualRect && isPointInside(point, room.readingArea.beanbagVisualRect)) {
      interact();
      return;
    }
    if (target?.kind === 'failure-board' && room.failureBoard && isPointInside(point, room.failureBoard.visualRect)) {
      interact();
      return;
    }
    if (target?.kind === 'registration-desk' && (isPointInside(point, room.desk.visualRect)
      || (room.desk.clerk && isPointInside(point, room.desk.clerk.visualRect)))) {
      interact();
      return;
    }
    if (!target || (target.kind !== 'shelf' && target.kind !== 'placed-book')) return;
    const shelf = room.shelves.find((candidate) => candidate.id === target.shelfId);
    if (shelf && isPointInside(point, shelf.visualRect)) interact();
  };

  const registerBook = () => {
    const error = validateRegistration(title, author, reflection);
    if (error) {
      setFormError(error);
      return;
    }
    const draft = {
      studentNumber,
      title: title.trim(),
      author: author.trim(),
      pageCount: 0,
      reflection: reflection.trim(),
    } satisfies LibraryBookDraft;
    setFormError(null);
    openModal({ kind: 'confirm-registration', draft });
  };

  const carryExistingBook = (book: LibraryBookDraft) => {
    if (carriedDraftRef.current || receiveApproachRef.current || sceneStateRef.current.action) return;
    clearHeldInput();
    if (room.desk.clerk) {
      const current = sceneStateRef.current;
      const path = findLibraryPlayerPath(resolveLibraryCatRoom(room, current.catState, current.player), current.player, room.desk.clerk.receivePoint);
      receiveApproachRef.current = { book, path: path ?? [], stalledMs: 0, waiting: path === null };
      if (!path) showAmbientNotice('조금 더 가까이 다가와 직원에게 말을 걸어 주세요');
      setReceiving(true);
    } else beginReceive(book, performance.now());
    setPlacementNotice(null);
    setFormError(null);
    setModal(null);
    modalRef.current = null;
  };

  const chooseSlot = async (shelf: LibraryShelf, slotIndex: number) => {
    const slot = shelf.slots[slotIndex];
    if (!slot || placementPendingRef.current) return;
    const occupied = booksRef.current.find((book) => book.slotId === slot.id);
    if (occupied) {
      setModal({ kind: 'details', book: occupied });
      return;
    }
    const draft = carriedDraftRef.current;
    if (!draft) {
      setSlotError('먼저 등록대에서 책을 받아 주세요.');
      return;
    }
    placementPendingRef.current = true;
    setIsPlacing(true);
    setSlotError(null);
    let placedBook: LibraryPlacedBook | null = null;
    try {
      if (controlledBooks && props.onPlace) {
        placedBook = await props.onPlace(draft, slot.id);
      } else {
        const result = placeLibraryDraft(room, booksRef.current, draft, slot.id);
        placedBook = result.placedBook;
        if (placedBook) setLocalBooks(result.placedBooks);
      }
    } catch (error) {
      if (error instanceof CanvasLibraryPlacementExpectedError) {
        if (mountedRef.current) {
          if (error.code === 'LIBRARY_SEASON_CHANGED') {
            setModal(null);
            setSeasonNotice(error.message);
            sceneStateRef.current = { ...sceneStateRef.current, selectedSlotId: null };
          } else setSlotError(error.message);
        }
        return;
      }
      if (mountedRef.current) setSlotError('저장하지 못했어요. 책은 그대로 들고 있어요. 다시 시도해 주세요.');
      return;
    } finally {
      placementPendingRef.current = false;
      if (mountedRef.current) setIsPlacing(false);
    }
    if (!mountedRef.current) return;
    if (!placedBook) {
      setSlotError('책을 꽂지 못했습니다. 다시 선택해 주세요.');
      return;
    }
    const nextBooks = booksRef.current.some((book) => book.slotId === placedBook?.slotId)
      ? booksRef.current
      : [...booksRef.current, placedBook];
    booksRef.current = nextBooks;
    carriedDraftRef.current = null;
    setCarriedDraft(null);
    sceneStateRef.current = {
      ...sceneStateRef.current,
      placedBooks: nextBooks,
      carriedDraft: null,
      selectedSlotId: placedBook.slotId,
      action: { kind: 'place', startedAt: performance.now(), slotId: placedBook.slotId },
    };
    pendingSoundRef.current = { kind: 'place', startedAt: sceneStateRef.current.action?.startedAt ?? performance.now() };
    setPlacementNotice(`${placedBook.slotId + 1}번 자리에 책을 꽂았어요.`);
    if (placementNoticeTimerRef.current !== null) window.clearTimeout(placementNoticeTimerRef.current);
    placementNoticeTimerRef.current = window.setTimeout(() => {
      setPlacementNotice(null);
      placementNoticeTimerRef.current = null;
    }, 2800);
    setModal(null);
    if (placementCueTimerRef.current !== null) window.clearTimeout(placementCueTimerRef.current);
    if (sceneStateRef.current.reducedMotion) {
      sceneStateRef.current = { ...sceneStateRef.current, selectedSlotId: null };
    } else {
      placementCueTimerRef.current = window.setTimeout(() => {
        sceneStateRef.current = { ...sceneStateRef.current, selectedSlotId: null };
        placementCueTimerRef.current = null;
      }, 650);
    }
  };

  const activeShelf = modal?.kind === 'slots'
    ? room.shelves.find((shelf) => shelf.id === modal.shelfId) ?? null
    : null;
  const activeSlot = activeShelf?.slots[activeSlotIndex] ?? activeShelf?.slots[0] ?? null;
  const activeSlotBook = activeSlot
    ? books.find((book) => book.slotId === activeSlot.id) ?? null
    : null;
  const activeSlotLabel = activeSlot
    ? activeSlotBook?.title ?? `빈자리 ${activeSlot.id + 1}`
    : '';

  const moveSlotFocus = (event: ReactKeyboardEvent<HTMLButtonElement>, shelf: LibraryShelf, index: number) => {
    const slot = shelf.slots[index];
    if (!slot || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const nextRow = slot.row + Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp');
    const nextColumn = slot.column + Number(event.key === 'ArrowRight') - Number(event.key === 'ArrowLeft');
    const nextIndex = shelf.slots.findIndex((candidate) => candidate.row === nextRow && candidate.column === nextColumn);
    if (nextIndex < 0) return;
    setActiveSlotIndex(nextIndex);
    sceneStateRef.current = { ...sceneStateRef.current, selectedSlotId: shelf.slots[nextIndex]?.id ?? null };
    const button = slotButtonRefs.current[nextIndex];
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  };

  const statusText = seasonNotice ?? (pausedByBlur
    ? '일시 멈춤'
    : ambientNotice
      ? ambientNotice
    : ambientState.benchObjectId
      ? '잠깐 쉬는 중 · E 또는 이동키로 일어나기'
    : ambientBusy
      ? '살펴보는 중…'
    : receiving
      ? '직원에게 책을 받는 중…'
    : carriedDraft
      ? `운반 중 · ${carriedDraft.title}`
      : placementNotice
        ? placementNotice
      : clerkGreeting && room.desk.clerk
        ? '책을 받아 가세요'
      : hasMoved
        ? ''
        : 'WASD 또는 방향키로 이동');
  const ambientObject = resolveLibraryCatRoom(room, sceneStateRef.current.catState, sceneStateRef.current.player).ambientObjects?.find(item => item.id === (ambientState.benchObjectId ?? (nearbyTarget?.kind === 'ambient' ? nearbyTarget.objectId : null)));
  const nearbyActionLabel = ambientState.benchObjectId
    ? '일어나기'
    : nearbyTarget?.kind === 'ambient' && ambientObject
      ? getLibraryAmbientLabel(ambientObject, ambientState)
    : nearbyTarget?.kind === 'registration-desk'
    ? room.desk.clerk ? '직원에게 말 걸기' : '가까운 곳 살펴보기: 책 등록'
    : nearbyTarget?.kind === 'failure-board'
      ? '가까운 곳 살펴보기: 실패 자랑소'
      : nearbyTarget?.kind === 'competition-board'
        ? '가까운 곳 살펴보기: 전국 책방 챌린지'
      : nearbyTarget?.kind === 'reading-nook'
        ? '가까운 곳 살펴보기: 앉아서 책 읽기'
      : nearbyTarget?.kind === 'shelf' || nearbyTarget?.kind === 'placed-book'
      ? '가까운 곳 살펴보기: 책장 열기'
        : null;
  const readingBook = books[readingBookIndex % Math.max(1, books.length)];
  const cueRect = ambientObject ? ambientObject.visualRect
    : nearbyTarget?.kind === 'registration-desk' ? room.desk.clerk?.visualRect ?? room.desk.visualRect
    : nearbyTarget?.kind === 'failure-board' ? room.failureBoard?.visualRect
      : nearbyTarget?.kind === 'competition-board' ? room.competitionBoard?.visualRect
      : nearbyTarget?.kind === 'reading-nook' ? room.readingArea.beanbagVisualRect
        : nearbyTarget && 'shelfId' in nearbyTarget ? room.shelves.find(shelf => shelf.id === nearbyTarget.shelfId)?.visualRect : null;

  return (
    <main className="student-canvas-library" aria-label="우리 반 도서관 게임" onPointerDownCapture={unlockAudio} onKeyDownCapture={unlockAudio}>
      <div ref={stageRef} className="student-canvas-library-stage">
        <div
          className="student-canvas-library-frame"
          style={{ width: room.width * displayScale, height: room.height * displayScale }}
        >
          <canvas
            ref={canvasRef}
            className="student-canvas-library-scene"
            width={room.width}
            height={room.height}
            tabIndex={0}
            role="application"
            aria-label="우리 반 도서관. WASD 또는 방향키로 이동하고 E 또는 Enter로 가까운 곳을 살펴보세요."
            onKeyDown={handleSceneKeyDown}
            onBlur={clearHeldInput}
            onPointerUp={handleCanvasPointerUp}
          />

          {onBack ? (
            <button type="button" className="student-canvas-library-back" aria-label="도서관 나가기" disabled={isPlacing || ambientBusy || (receiving && !receiveApproachRef.current?.waiting)} onClick={requestExit}>
              <LogOut aria-hidden="true" />
            </button>
          ) : null}

          {nearbyActionLabel && cueRect && !modal && !ambientBusy ? (
            <button type="button" className="student-canvas-library-world-cue" style={{left: `${(cueRect.x + cueRect.width / 2) / room.width * 100}%`, top: `${Math.max(42, cueRect.y - (ambientObject?.kind === 'cat' ? 12 + 22 / displayScale : 16)) / room.height * 100}%`}} onClick={interact} aria-label={nearbyActionLabel}>
              <kbd>E</kbd><span>{nearbyActionLabel.replace('가까운 곳 살펴보기: ', '')}</span>
            </button>
          ) : null}

          {statusText ? (
            <p className="student-canvas-library-status" title={statusText}>
              {carriedDraft ? <BookOpen aria-hidden="true" /> : null}
              <span>{statusText}</span>
            </p>
          ) : null}
          <span className="student-canvas-library-visually-hidden" aria-live="polite">{ambientNotice ?? placementNotice ?? nearbyActionLabel ?? statusText}</span>

        </div>
      </div>

      {modal?.kind === 'failure-board' ? props.renderFailureBoard?.(closeModal, canvasRef) : null}
      {modal?.kind === 'competition-board' ? props.renderCompetition?.(closeModal, canvasRef) : null}

      {modal?.kind === 'confirm-registration' ? (
        <StudentConfirmDialog
          isOpen
          kicker="등록대"
          title="이 책을 받을까요?"
          description="책 정보를 한 번 더 확인해 주세요."
          confirmLabel="확인하고 받기"
          cancelLabel="다시 수정"
          isPending={false}
          returnFocusRef={canvasRef}
          onCancel={() => openModal({ kind: 'registration' })}
          onConfirm={() => carryExistingBook(modal.draft)}
        >
          <p><strong>{modal.draft.title}</strong></p>
          <p>글쓴이: {modal.draft.author}</p>
          <p>한 줄 감상: {modal.draft.reflection}</p>
        </StudentConfirmDialog>
      ) : null}

      {modal?.kind === 'reading' ? (
        <div className="student-canvas-library-scrim student-canvas-library-reading-scrim" role="presentation" onPointerDown={closeModal}>
          <section ref={readingDialogRef} className="student-canvas-library-dialog student-canvas-library-reading-dialog" role="dialog" aria-modal="true" aria-labelledby={readingTitleId} onPointerDown={event => event.stopPropagation()}>
            <button ref={readingCloseRef} type="button" className="student-canvas-library-dialog-close" aria-label="독서 마치고 일어나기" onClick={closeModal}><X aria-hidden="true" /></button>
            <span className="student-canvas-library-kicker">창가 독서 코너</span>
            <h1 id={readingTitleId}>잠깐, 책 한 권</h1>
            <div className="student-canvas-library-reading-page">
              <BookOpen aria-hidden="true" />
              <h2>{readingBook?.title ?? '첫 책을 기다리고 있어요'}</h2>
              <p>{readingBook ? readingBook.author || '글쓴이 없음' : '등록대에서 책을 받아 서가에 꽂아 주세요.'}</p>
              {readingBook?.reflection ? <p>{readingBook.reflection}</p> : null}
              {readingBook ? <small>{readingBook.studentNumber}번 친구가 꽂은 책</small> : null}
            </div>
            <div className="student-canvas-library-actions">
              {books.length > 1 ? <button type="button" onClick={() => { setReadingBookIndex(index => index + 1); }}>다른 책 펼치기</button> : null}
              <button type="button" onClick={closeModal}>일어나기</button>
            </div>
          </section>
        </div>
      ) : null}

      {modal?.kind === 'registration' ? (
        <div className="student-canvas-library-scrim" role="presentation" onPointerDown={closeModal}>
          <section
            ref={registrationDialogRef}
            className="student-canvas-library-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={registrationTitleId}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="student-canvas-library-dialog-close" aria-label="책 등록 닫기" onClick={closeModal}><X aria-hidden="true" /></button>
            <span className="student-canvas-library-kicker">등록대</span>
            <h1 id={registrationTitleId}>읽은 책 등록</h1>
            {room.desk.clerk ? <p>어서 오세요! 읽은 책을 알려 주세요.</p> : null}
            {books.length >= 100 ? (
              <p className="student-canvas-library-error" role="status">100자리가 모두 찼어요. 꽂힌 책은 읽을 수 있어요.</p>
            ) : (
            <form onSubmit={(event) => { event.preventDefault(); registerBook(); }}>
              <label>
                <span>책 제목</span>
                <input ref={registrationTitleRef} value={title} maxLength={50} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>
                <span>글쓴이</span>
                <input value={author} maxLength={30} onChange={(event) => setAuthor(event.target.value)} />
              </label>
              <label>
                <span>한 줄 감상</span>
                <input value={reflection} maxLength={MAX_BOOK_REFLECTION_LENGTH} placeholder="이 책을 읽고 어떤 생각이 들었나요?" onChange={(event) => setReflection(event.target.value)} />
              </label>
              {formError ? <p className="student-canvas-library-error" role="alert">{formError}</p> : null}
              <div className="student-canvas-library-actions">
                <button type="button" onClick={closeModal}>취소</button>
                <button type="submit">책 받기</button>
              </div>
            </form>
            )}
            {unplacedBooks.length > 0 ? (
              <div className="student-canvas-library-legacy-books" aria-label="내가 전에 등록한 책">
                <strong>전에 등록한 책 가져가기</strong>
                <div>
                  {unplacedBooks.map((book) => (
                    <button key={book.bookId} type="button" onClick={() => carryExistingBook(book)}>
                      <span>{book.title}</span>
                      <small>{book.author || '글쓴이 없음'}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {modal?.kind === 'slots' && activeShelf ? (
        <div className="student-canvas-library-scrim" role="presentation" onPointerDown={closeModal}>
          <section
            ref={slotDialogRef}
            className="student-canvas-library-dialog student-canvas-library-slot-dialog"
            role="dialog"
            aria-modal="true"
            aria-busy={isPlacing}
            aria-labelledby={slotTitleId}
            data-shelf-columns={activeShelf.columns}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="student-canvas-library-dialog-close" aria-label="책장 닫기" disabled={isPlacing} onClick={closeModal}><X aria-hidden="true" /></button>
            <span className="student-canvas-library-kicker">책장</span>
            <h1 id={slotTitleId}>책을 둘 자리</h1>
            {activeSlot ? (
              <p className="student-canvas-library-slot-caption" aria-live="polite">
                <span>{isPlacing ? '책을 저장하고 있어요…' : `${activeSlot.id + 1}번 · ${activeSlotBook ? '책' : '빈자리'}`}</span>
                <strong>{activeSlotLabel}</strong>
              </p>
            ) : null}
            <div
              className="student-canvas-library-slot-grid"
              data-columns={activeShelf.columns}
              style={{
                gridTemplateColumns: `repeat(${activeShelf.columns}, minmax(${activeShelf.columns === 15 ? 44 : 0}px, 1fr))`,
                gridTemplateRows: `repeat(${activeShelf.rows}, minmax(${room.failureBoard ? 96 : 44}px, 1fr))`,
              }}
            >
              {activeShelf.slots.map((slot, index) => {
                const occupied = books.find((book) => book.slotId === slot.id);
                const label = occupied?.title ?? `빈자리 ${slot.id + 1}`;
                const spineThickness = occupied ? getLibraryBookThickness(occupied.pageCount) : null;
                return (
                  <button
                    key={slot.id}
                    ref={(element) => {
                      slotButtonRefs.current[index] = element;
                      if (index === 0) firstSlotRef.current = element;
                    }}
                    type="button"
                    className={`${occupied ? 'is-occupied' : 'is-empty'}${index === activeSlotIndex ? ' is-selected' : ''}`}
                    aria-label={label}
                    tabIndex={index === activeSlotIndex ? 0 : -1}
                    disabled={isPlacing}
                    onFocus={() => {
                      setActiveSlotIndex(index);
                      sceneStateRef.current = { ...sceneStateRef.current, selectedSlotId: slot.id };
                    }}
                    onKeyDown={(event) => moveSlotFocus(event, activeShelf, index)}
                    onClick={() => void chooseSlot(activeShelf, index)}
                  >
                    <span
                      className="student-canvas-library-slot-spine"
                      data-state={occupied ? 'book' : 'empty'}
                      data-tone={occupied ? getLibraryBookTone(occupied) : undefined}
                      style={occupied ? { backgroundColor: CANVAS_LIBRARY_PALETTE.bookSpines[getLibraryBookTone(occupied)][0], width: `${Math.min(88, 48 + (spineThickness ?? 8) * 2)}%` } : undefined}
                      data-thickness={spineThickness ?? undefined}
                      data-height={slot.id % 3}
                      aria-hidden="true"
                    >
                      <span className="student-canvas-library-slot-number">{slot.id + 1}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {slotError ? <p className="student-canvas-library-error" role="alert">{slotError}</p> : null}
          </section>
        </div>
      ) : null}

      <StudentConfirmDialog
        isOpen={modal?.kind === 'confirm-exit'}
        title={carriedDraft || receiveApproachRef.current ? '들고 있는 책의 운반을 취소하고 나갈까요?' : '책방 밖으로 나갈까요?'}
        description={carriedDraft || receiveApproachRef.current ? '새로 입력한 미배치 책 내용은 남지 않아요. 이미 등록된 책은 삭제되지 않아요.' : '읽던 책은 다음에 다시 살펴볼 수 있어요.'}
        confirmLabel={carriedDraft || receiveApproachRef.current ? '운반 취소하고 나가기' : '나가기'}
        cancelLabel="책방에 머물기"
        isPending={false}
        returnFocusRef={canvasRef}
        onCancel={closeModal}
        onConfirm={finishExit}
      />

      {modal?.kind === 'details' ? (
        <div className="student-canvas-library-scrim" role="presentation" onPointerDown={closeModal}>
          <section
            ref={detailsDialogRef}
            className="student-canvas-library-dialog student-canvas-library-book-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailsTitleId}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button ref={detailsCloseRef} type="button" className="student-canvas-library-dialog-close" aria-label="책 정보 닫기" onClick={closeModal}><X aria-hidden="true" /></button>
            <span className="student-canvas-library-kicker">책 정보</span>
            <h1 id={detailsTitleId}>{modal.book.title}</h1>
            <dl className="student-canvas-library-book-info">
              <div><dt>글쓴이</dt><dd>{modal.book.author}</dd></div>
              <div><dt>한 줄 감상</dt><dd>{modal.book.reflection || '아직 감상이 없어요.'}</dd></div>
              <div><dt>등록한 학생</dt><dd>{modal.book.studentNumber}번</dd></div>
            </dl>
            <div className="student-canvas-library-actions is-single">
              <button type="button" onClick={closeModal}>도서관으로</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
