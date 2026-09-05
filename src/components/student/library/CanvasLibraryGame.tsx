import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
} from 'react';
import { BookOpen, LogOut, Volume2, VolumeX, X } from 'lucide-react';
import { useModalFocus } from '../../../lib/useModalFocus';
import { CanvasLibraryPlacementExpectedError } from '../../../lib/canvasLibraryClient';
import {
  createLibraryPlayer,
  createSmallLibraryRoom,
  getNearbyLibraryTarget,
  placeLibraryDraft,
  stepLibraryPlayer,
  type LibraryBookDraft,
  type LibraryPlacedBook,
  type LibraryPoint,
  type LibraryRoom,
  type LibraryScene,
  type LibraryShelf,
  type LibraryTarget,
} from '../../../lib/canvasLibraryWorld';
import { createLibraryRenderer } from './CanvasLibraryRenderer';
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

const sameTarget = (first: LibraryTarget | null, second: LibraryTarget | null) => first?.id === second?.id;

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
  const room = suppliedRoom ?? defaultRoomRef.current;
  const controlledBooks = props.books;

  const [localBooks, setLocalBooks] = useState<readonly LibraryPlacedBook[]>([]);
  const books = controlledBooks ?? localBooks;
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
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [readingBookIndex, setReadingBookIndex] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);

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
  const sceneStateRef = useRef<LibraryScene>({
    player: createLibraryPlayer(room, studentNumber),
    placedBooks: books,
    carriedDraft: null,
    nearbyTarget: null,
    selectedSlotId: null,
    timeMs: 0,
    reducedMotion: false,
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
  soundEnabledRef.current = soundEnabled;

  const playBookSound = async (kind: 'receive' | 'place') => {
    if (!soundEnabledRef.current) return;
    try {
      const audio = audioRef.current ?? new AudioContext();
      audioRef.current = audio;
      if (audio.state === 'suspended') await audio.resume();
      if (!mountedRef.current || !soundEnabledRef.current || audio.state !== 'running') return;
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      tone.type = 'sine';
      tone.frequency.setValueAtTime(kind === 'receive' ? 520 : 360, now);
      tone.frequency.exponentialRampToValueAtTime(kind === 'receive' ? 760 : 180, now + 0.12);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      tone.connect(gain);
      gain.connect(audio.destination);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      tone.start();
      tone.stop(now + 0.17);
    } catch {
      if (mountedRef.current) setSoundEnabled(false);
      soundEnabledRef.current = false;
    }
  };

  const clearHeldInput = () => {
    heldKeyboardRef.current.clear();
    const current = sceneStateRef.current;
    if (current.player.isWalking) sceneStateRef.current = { ...current, player: { ...current.player, isWalking: false } };
  };

  const closeModal = () => {
    if (placementPendingRef.current) return;
    clearHeldInput();
    setFormError(null);
    setSlotError(null);
    setModal(null);
    sceneStateRef.current = { ...sceneStateRef.current, selectedSlotId: null, seated: false };
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
    (slotButtonRefs.current[activeSlotIndex] ?? firstSlotRef.current)?.focus({ preventScroll: true });
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
      const action = current.action && time - current.action.startedAt < 500 && !current.reducedMotion ? current.action : undefined;
      const canMove = !pausedRef.current && modalRef.current === null && !action;
      const player = canMove && (input.x !== 0 || input.y !== 0)
        ? stepLibraryPlayer(room, current.player, input, elapsedMs)
        : current.player.isWalking
          ? { ...current.player, isWalking: false }
          : current.player;
      if (!hasMovedRef.current && player.position !== current.player.position) {
        hasMovedRef.current = true;
        setHasMoved(true);
      }
      const target = getNearbyLibraryTarget(room, player, booksRef.current);
      current = {
        ...current,
        player,
        placedBooks: booksRef.current,
        carriedDraft: carriedDraftRef.current,
        nearbyTarget: target,
        timeMs: time,
        action,
        seated: modalRef.current?.kind === 'reading',
      };
      sceneStateRef.current = current;
      canvas.dataset.playerX = player.position.x.toFixed(2);
      canvas.dataset.playerY = player.position.y.toFixed(2);
      canvas.dataset.nearbyTarget = target?.id ?? '';
      canvas.dataset.facing = player.facing;
      canvas.dataset.action = action?.kind ?? '';
      canvas.dataset.seated = String(current.seated);
      if (!sameTarget(target, nearbyTargetRef.current)) {
        nearbyTargetRef.current = target;
        setNearbyTarget(target);
      }
      renderer.draw(current);
      frameId = requestAnimationFrame(drawFrame);
    };
    frameId = requestAnimationFrame(drawFrame);
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(frameId);
      renderer.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [room]);

  useEffect(() => {
    sceneStateRef.current = { ...sceneStateRef.current, boardNoteCount: props.boardNoteCount ?? 0 };
  }, [props.boardNoteCount]);

  useEffect(() => {
    const target = getNearbyLibraryTarget(room, sceneStateRef.current.player, books);
    sceneStateRef.current = { ...sceneStateRef.current, placedBooks: books, nearbyTarget: target };
    nearbyTargetRef.current = target;
    setNearbyTarget(target);
  }, [books, room]);

  useEffect(() => {
    sceneStateRef.current = { ...sceneStateRef.current, carriedDraft };
  }, [carriedDraft]);

  useEffect(() => {
    mountedRef.current = true;
    const handleBlur = () => {
      pausedRef.current = true;
      clearHeldInput();
      setPausedByBlur(true);
    };
    const handleFocus = () => {
      pausedRef.current = false;
      setPausedByBlur(false);
    };
    const handleVisibility = () => {
      if (document.hidden) handleBlur();
      else handleFocus();
    };
    const handleKeyUp = (event: KeyboardEvent) => heldKeyboardRef.current.delete(event.key.toLowerCase());
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearHeldInput();
      if (placementCueTimerRef.current !== null) window.clearTimeout(placementCueTimerRef.current);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('visibilitychange', handleVisibility);
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio && audio.state !== 'closed') void audio.close().catch(() => undefined);
    };
  }, []);

  const openModal = (nextModal: Exclude<GameModal, null>) => {
    clearHeldInput();
    setSlotError(null);
    setModal(nextModal);
  };

  const interact = () => {
    if (modalRef.current || pausedRef.current || sceneStateRef.current.action) return;
    const target = sceneStateRef.current.nearbyTarget;
    if (!target) return;
    if (target.kind === 'failure-board') {
      if (props.renderFailureBoard) openModal({ kind: 'failure-board' });
    } else if (target.kind === 'competition-board') {
      if (props.renderCompetition) openModal({ kind: 'competition-board' });
    } else if (target.kind === 'reading-nook') {
      setReadingBookIndex(0);
      sceneStateRef.current = { ...sceneStateRef.current, seated: true };
      openModal({ kind: 'reading' });
    } else if (target.kind === 'registration-desk') {
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
    if (MOVEMENT_KEYS.has(key)) {
      event.preventDefault();
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
    if (target?.kind === 'registration-desk' && isPointInside(point, room.desk.visualRect)) {
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
    clearHeldInput();
    setCarriedDraft(book);
    sceneStateRef.current = { ...sceneStateRef.current, action: { kind: 'receive', startedAt: performance.now() } };
    void playBookSound('receive');
    setFormError(null);
    setModal(null);
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
    void playBookSound('place');
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
    slotButtonRefs.current[nextIndex]?.focus();
  };

  const statusText = seasonNotice ?? (pausedByBlur
    ? '일시 멈춤'
    : carriedDraft
      ? `운반 중 · ${carriedDraft.title}`
      : hasMoved
        ? ''
        : 'WASD 또는 방향키로 이동');
  const nearbyActionLabel = nearbyTarget?.kind === 'registration-desk'
    ? '가까운 곳 살펴보기: 책 등록'
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
  const cueRect = nearbyTarget?.kind === 'registration-desk' ? room.desk.visualRect
    : nearbyTarget?.kind === 'failure-board' ? room.failureBoard?.visualRect
      : nearbyTarget?.kind === 'competition-board' ? room.competitionBoard?.visualRect
      : nearbyTarget?.kind === 'reading-nook' ? room.readingArea.beanbagVisualRect
        : nearbyTarget && 'shelfId' in nearbyTarget ? room.shelves.find(shelf => shelf.id === nearbyTarget.shelfId)?.visualRect : null;

  return (
    <main className="student-canvas-library" aria-label="우리 반 도서관 게임">
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
            <button type="button" className="student-canvas-library-back" aria-label="도서관 나가기" onClick={onBack}>
              <LogOut aria-hidden="true" />
            </button>
          ) : null}

          <button type="button" className="student-canvas-library-sound" aria-label={soundEnabled ? '효과음 끄기' : '효과음 켜기'} aria-pressed={soundEnabled} onClick={() => { const enabled = !soundEnabled; soundEnabledRef.current = enabled; setSoundEnabled(enabled); if (enabled) void playBookSound('receive'); }}>
            {soundEnabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
          </button>

          {nearbyActionLabel && cueRect && !modal ? (
            <button type="button" className="student-canvas-library-world-cue" style={{left: `${(cueRect.x + cueRect.width / 2) / room.width * 100}%`, top: `${Math.max(8, cueRect.y - 16) / room.height * 100}%`}} onClick={interact} aria-label={nearbyActionLabel}>
              <kbd>E</kbd><span>{nearbyActionLabel.replace('가까운 곳 살펴보기: ', '')}</span>
            </button>
          ) : null}

          {statusText ? (
            <p className="student-canvas-library-status">
              {carriedDraft ? <BookOpen aria-hidden="true" /> : null}
              <span>{statusText}</span>
            </p>
          ) : null}
          <span className="student-canvas-library-visually-hidden" aria-live="polite">{nearbyActionLabel ?? statusText}</span>

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
              {books.length > 1 ? <button type="button" onClick={() => setReadingBookIndex(index => index + 1)}>다른 책 펼치기</button> : null}
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
                <span>{activeSlot.id + 1}번 · {activeSlotBook ? '책' : '빈자리'}</span>
                <strong>{activeSlotLabel}</strong>
              </p>
            ) : null}
            <div
              className="student-canvas-library-slot-grid"
              data-columns={activeShelf.columns}
              style={{
                gridTemplateColumns: `repeat(${activeShelf.columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${activeShelf.rows}, minmax(${room.failureBoard ? 96 : 44}px, 1fr))`,
              }}
            >
              {activeShelf.slots.map((slot, index) => {
                const occupied = books.find((book) => book.slotId === slot.id);
                const label = occupied?.title ?? `빈자리 ${slot.id + 1}`;
                const spineThickness = occupied ? Math.min(7, Math.max(3, Math.round(occupied.pageCount / 100))) : null;
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
                      data-tone={slot.id % 3}
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
