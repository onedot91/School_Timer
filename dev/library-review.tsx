import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasLibraryGame from '../src/components/student/library/CanvasLibraryGame';
import { drawLibraryCharacter } from '../src/components/student/library/CanvasLibraryCharacter';
import { createLibraryRenderer } from '../src/components/student/library/CanvasLibraryRenderer';
import { createLibraryCatNavigation, createLibraryCatState, resolveLibraryCatRoom, stepLibraryCat, type LibraryCatState } from '../src/lib/canvasLibraryCat';
import { getLibraryBearPose, getLibraryBookMotion } from '../src/lib/canvasLibraryPose';
import { completeLibraryAmbientAction, createLibraryAmbientAction, createLibraryAmbientState } from '../src/lib/canvasLibraryAmbient';
import { createFullLibraryRoom, createLibraryPlayer, type LibraryBookDraft, type LibraryPlacedBook, type LibraryScene } from '../src/lib/canvasLibraryWorld';
import StudentFailureExhibitionPage from '../src/components/student/StudentFailureExhibitionPage';
import { LibraryCompetitionPanel } from '../src/components/student/library/LibraryCompetitionPanel';
import { appDataMode } from '../src/lib/dataMode';
import '../src/index.css';

const room = createFullLibraryRoom();
const catNavigation = createLibraryCatNavigation(room);
const draft: LibraryBookDraft = { bookId: 'dev-review-book', studentNumber: 1, title: '작은 책방의 커다란 하루', author: '검수 작가', pageCount: 180, reflection: '책을 함께 읽고 이야기를 나누고 싶어요.' };
const longDraft: LibraryBookDraft = { ...draft, bookId: 'dev-long-book', title: '가'.repeat(50), author: '나'.repeat(30), reflection: '우리 반 친구들과 이 책을 읽고 생각을 나누며 새로운 이야기를 만들어 보고 싶어요.' };
const fullBooks: readonly LibraryPlacedBook[] = room.shelves.flatMap(shelf => shelf.slots).map(slot => ({ ...draft, bookId: `dev-book-${slot.id}`, title: `${slot.id + 1}번째 책 · 작은 책방 이야기`, studentNumber: slot.id % 23 + 1, slotId: slot.id }));
const directions = ['down', 'up', 'left', 'right'] as const;
const directionLabels = { down: '정면', up: '후면', left: '왼쪽', right: '오른쪽' };
const ambientLabels: Readonly<Record<string, string>> = {
  'wall-plant-west': '서쪽 벽 화분', 'wall-plant-east': '동쪽 벽 화분', 'reading-lamp': '스탠드',
  'reading-bench': '벤치', 'bookshop-cat': '책방 고양이', 'tea-set': '차 세트',
};
const startPoints = [
  { label: '입구', point: room.spawn },
  { label: '등록대', point: room.desk.interactionPoint },
  ...room.shelves.map((shelf, index) => ({ label: `책장 ${index + 1}`, point: shelf.interactionPoint })),
  ...(room.readingArea.interactionPoint ? [{ label: '독서 공간', point: room.readingArea.interactionPoint }] : []),
  ...(room.failureBoard ? [{ label: '실패 자랑소', point: room.failureBoard.interactionPoint }] : []),
  ...(room.competitionBoard ? [{ label: '챌린지', point: room.competitionBoard.interactionPoint }] : []),
  ...(room.ambientObjects ?? []).map(object => ({ label: `${ambientLabels[object.id] ?? object.kind} · ${object.id}`, point: object.interactionPoint })),
  ...(room.competitionBoard ? [{ label: '트로피 뒤', point: { x: room.competitionBoard.visualRect.x + room.competitionBoard.visualRect.width / 2, y: room.competitionBoard.footCollider.y - 5 } }] : []),
  ...(room.exit ? [{ label: '출입문 앞', point: { x: room.exit.triggerRect.x + room.exit.triggerRect.width / 2, y: room.exit.triggerRect.y - 8 } }] : []),
];
type PoseMode = 'normal' | 'receive' | 'place' | 'seated';
const catBehaviors = ['look', 'walk', 'sit', 'sleep', 'groom', 'stretch', 'watch', 'yield', 'pet'] as const;
const catBehaviorLabels: Readonly<Record<LibraryCatState['behavior'], string>> = {
  look: '둘러보기', walk: '산책', sit: '앉기', sleep: '잠자기', groom: '앞발 세수', stretch: '기지개',
  watch: '곰 바라보기', yield: '길 양보', pet: '쓰다듬기 반응',
};
const catReactions = ['head-up', 'stretch', 'sleepy'] as const;
const catReactionLabels = { 'head-up': '고개 들기', stretch: '기지개', sleepy: '눈 감고 꼬리 움직이기' };
const catFixtureBehaviors = ['look', 'walk', 'sit', 'sleep', 'groom', 'stretch'] as const;
const nearCatStartIndex = startPoints.length;

const ambientPreviews = [
  { id: 'lamp-off', label: '스탠드 끄기', objectId: 'reading-lamp', completedActions: 0 },
  { id: 'lamp-on', label: '스탠드 켜기', objectId: 'reading-lamp', completedActions: 1 },
  { id: 'water-west', label: '서쪽 화분 물 주기', objectId: 'wall-plant-west', completedActions: 0 },
  { id: 'water-east', label: '동쪽 화분 물 주기', objectId: 'wall-plant-east', completedActions: 0 },
  { id: 'leaves', label: '화분 잎 살펴보기', objectId: 'wall-plant-west', completedActions: 1 },
  { id: 'sit', label: '벤치 앉기', objectId: 'reading-bench', completedActions: 0 },
  { id: 'pet-first', label: '고양이 첫 반응 · 고개 들기', objectId: 'bookshop-cat', completedActions: 0 },
  { id: 'pet-second', label: '고양이 두 번째 · 기지개', objectId: 'bookshop-cat', completedActions: 1 },
  { id: 'pet-third', label: '고양이 세 번째 · 꼬리 반응', objectId: 'bookshop-cat', completedActions: 2 },
  { id: 'pour', label: '차 따르기', objectId: 'tea-set', completedActions: 0 },
  { id: 'drink', label: '차 마시기', objectId: 'tea-set', completedActions: 1 },
] as const;

function buildAmbientScene(previewId: string, time: number, reduced: boolean): LibraryScene | null {
  const preview = ambientPreviews.find(candidate => candidate.id === previewId);
  const object = room.ambientObjects?.find(candidate => candidate.id === preview?.objectId);
  if (!preview || !object) return null;
  let state = createLibraryAmbientState();
  for (let index = 0; index < preview.completedActions; index += 1) {
    state = completeLibraryAmbientAction(state, createLibraryAmbientAction(state, object, 0)).state;
  }
  const action = createLibraryAmbientAction(state, object, 0);
  const finished = reduced || time >= action.durationMs;
  const aim = object.actionPoint ?? object.interactionPoint;
  const dx = aim.x - object.interactionPoint.x;
  const dy = aim.y - object.interactionPoint.y;
  const facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  return {
    ...buildScene(facing, false, -1, 'normal', time, reduced),
    player: { ...createLibraryPlayer(room), position: object.interactionPoint, facing, isWalking: false },
    nearbyTarget: { kind: 'ambient', id: object.id, objectId: object.id, interactionPoint: object.interactionPoint },
    ambientState: finished ? completeLibraryAmbientAction(state, action).state : state,
    ambientAction: finished ? undefined : action,
  };
}

function buildCatScene(behavior: LibraryCatState['behavior'], facing: LibraryScene['player']['facing'], reaction: LibraryCatState['reaction'], time: number, reduced: boolean): LibraryScene {
  const initial = createLibraryCatState(room, catNavigation, 42, createLibraryPlayer(room));
  return {
    ...buildScene('down', false, -1, 'normal', time, reduced),
    player: createLibraryPlayer(room),
    ambientState: createLibraryAmbientState(),
    catState: initial ? { ...initial, behavior, facing, elapsedMs: reduced ? 0 : time, remainingMs: Math.max(0, 1000 - time), reaction } : undefined,
  };
}

function buildScene(facing: LibraryScene['player']['facing'], carrying: boolean, frame: number, mode: PoseMode, time: number, reduced: boolean): LibraryScene {
  const point = mode === 'receive' ? room.desk.interactionPoint : mode === 'place' ? room.shelves[1].interactionPoint : { x: 350, y: 270 };
  return {
    player: { ...createLibraryPlayer(room), position: point, facing, isWalking: frame >= 0 && mode === 'normal' },
    carriedDraft: mode === 'place' ? null : carrying || mode === 'receive' ? draft : null,
    placedBooks: mode === 'place' ? [{ ...draft, slotId: 30 }] : [],
    nearbyTarget: null,
    selectedSlotId: null,
    timeMs: time,
    walkTimeMs: frame >= 0 ? frame * 140 + (time % 140) : 0,
    action: mode === 'receive' || mode === 'place' ? { kind: mode, startedAt: 0, slotId: mode === 'place' ? 30 : undefined } : undefined,
    seated: mode === 'seated',
    reducedMotion: reduced,
  };
}

function CharacterCell({ facing, carrying, frame, mode, time, reduced }: { facing: LibraryScene['player']['facing']; carrying: boolean; frame: number; mode: PoseMode; time: number; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = buildScene(facing, carrying, frame, mode, time, reduced);
  const pose = getLibraryBearPose(scene, room);
  const book = getLibraryBookMotion(scene, room);
  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, 48, 48);
    context.fillStyle = '#f7e6bf';
    context.fillRect(0, 0, 48, 48);
    context.fillStyle = '#d6c198';
    context.fillRect(3, 43, 42, 1);
    context.save();
    context.translate(24 - pose.feet.x, 43 - pose.feet.y);
    drawLibraryCharacter(context, scene, room);
    context.restore();
  });
  const label = `${directionLabels[facing]} · ${carrying ? '운반' : '빈손'} · ${frame < 0 ? '정지' : `보행 ${frame}`}`;
  return <figure className="review-cell" data-direction={facing} data-carrying={carrying} data-frame={frame}>
    <canvas ref={ref} width={48} height={48} aria-label={label} title={`손 ${pose.hand.x},${pose.hand.y} / 책 ${book ? `${book.center.x.toFixed(1)},${book.center.y.toFixed(1)}` : '없음'}`} />
    <figcaption>{label}</figcaption>
  </figure>;
}

function ScenePreview({ scene }: { scene: LibraryScene }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createLibraryRenderer> | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    renderer.current = createLibraryRenderer(ref.current, room);
    return () => renderer.current?.dispose();
  }, []);
  useEffect(() => renderer.current?.draw(scene), [scene]);
  return <canvas id="review-scene" ref={ref} aria-label="실제 책방 렌더러 자세 미리보기" />;
}

function RecordingPreview({ source }: { source: string }) {
  const [metadata, setMetadata] = useState({ width: 0, height: 0, duration: Number.NaN, position: 0 });
  const readMetadata = (video: HTMLVideoElement) => {
    const duration = Number.isFinite(video.duration) ? video.duration : video.seekable.length ? video.seekable.end(video.seekable.length - 1) : Number.NaN;
    setMetadata({ width: video.videoWidth, height: video.videoHeight, duration, position: video.currentTime });
  };
  return <div className="review-recording-preview">
    <video src={source} controls preload="metadata" aria-label="녹화한 실제 책방 Canvas 영상" onLoadedMetadata={event => readMetadata(event.currentTarget)} onDurationChange={event => readMetadata(event.currentTarget)} onTimeUpdate={event => readMetadata(event.currentTarget)} />
    <output aria-live="polite">영상 {metadata.width}×{metadata.height} · 길이 {Number.isFinite(metadata.duration) ? `${metadata.duration.toFixed(2)}초` : 'WebM 메타데이터에 없음'} · 재생 {metadata.position.toFixed(2)}초</output>
  </div>;
}

function Review() {
  const [game, setGame] = useState(false);
  const [controls, setControls] = useState(true);
  const [mode, setMode] = useState<PoseMode>('normal');
  const [ambientPreview, setAmbientPreview] = useState('');
  const [ambientDiagnostics, setAmbientDiagnostics] = useState({ state: '', action: '', cat: '' });
  const [catPreview, setCatPreview] = useState<LibraryCatState['behavior'] | ''>('');
  const [catReaction, setCatReaction] = useState<LibraryCatState['reaction']>('head-up');
  const [catSeed, setCatSeed] = useState(42);
  const [catFixture, setCatFixture] = useState<(typeof catFixtureBehaviors)[number] | ''>('');
  const [reduced, setReduced] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [time, setTime] = useState(0);
  const [facing, setFacing] = useState<LibraryScene['player']['facing']>('down');
  const [carrying, setCarrying] = useState(true);
  const [boardNoteCount, setBoardNoteCount] = useState(0);
  const [books, setBooks] = useState<readonly LibraryPlacedBook[]>([]);
  const [saveMode, setSaveMode] = useState<'success' | 'failure' | 'delayed'>('success');
  const [startIndex, setStartIndex] = useState(0);
  const [gameVersion, setGameVersion] = useState(0);
  const [metrics, setMetrics] = useState({ width: innerWidth, height: innerHeight, fps: 0 });
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState('');
  const [inputDuration, setInputDuration] = useState(250);
  const driverQueueRef = useRef<Array<{ readonly key: string; readonly duration: number }>>([]);
  const driverActiveRef = useRef<{ readonly key: string; readonly timer: number } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const gameSetup = useMemo(() => {
    const baseRoom = { ...room, spawn: startPoints[startIndex]?.point ?? room.spawn };
    const player = createLibraryPlayer(baseRoom);
    let cat = createLibraryCatState(baseRoom, catNavigation, catSeed, player);
    if (cat && catFixture) {
      if (catFixture === 'walk') {
        cat = stepLibraryCat(baseRoom, catNavigation, { ...cat, remainingMs: 0 }, player, { x: 0, y: 0 }, 16);
      } else {
        const duration = { look: 3000, sit: 6000, sleep: 12000, groom: 4000, stretch: 1000 };
        cat = { ...cat, behavior: catFixture, elapsedMs: 0, remainingMs: duration[catFixture] ?? 3000 };
      }
    }
    const dynamicCat = resolveLibraryCatRoom(baseRoom, cat, player).ambientObjects?.find(object => object.kind === 'cat');
    return {
      room: startIndex === nearCatStartIndex && dynamicCat ? { ...baseRoom, spawn: dynamicCat.interactionPoint } : baseRoom,
      initialCatState: startIndex === nearCatStartIndex || catFixture ? cat : undefined,
    };
  }, [startIndex, catSeed, catFixture, gameVersion]);

  const releaseDriver = () => {
    driverQueueRef.current = [];
    const active = driverActiveRef.current;
    if (!active) return;
    window.clearTimeout(active.timer);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: active.key, code: active.key, bubbles: true }));
    driverActiveRef.current = null;
  };
  const runNextInput = () => {
    if (driverActiveRef.current) return;
    const input = driverQueueRef.current.shift();
    if (!input) return;
    const canvas = document.querySelector<HTMLCanvasElement>('.student-canvas-library-scene');
    if (!canvas || document.hidden || document.querySelector('.student-canvas-library [aria-modal="true"]')) {
      releaseDriver();
      return;
    }
    canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: input.key, code: input.key, bubbles: true, cancelable: true }));
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: input.key, code: input.key, bubbles: true }));
      driverActiveRef.current = null;
      runNextInput();
    }, input.duration);
    driverActiveRef.current = { key: input.key, timer };
  };
  const driveInput = (key: string, duration = inputDuration) => {
    driverQueueRef.current.push({ key, duration });
    runNextInput();
  };

  useEffect(() => {
    const visibility = () => { if (document.hidden) releaseDriver(); };
    window.addEventListener('blur', releaseDriver);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      releaseDriver();
      window.removeEventListener('blur', releaseDriver);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [game, gameVersion, startIndex]);

  useEffect(() => {
    let frame = 0;
    let count = 0;
    let start = performance.now();
    const update = (now: number) => {
      count += 1;
      if (now - start >= 1000) {
        setMetrics({ width: innerWidth, height: innerHeight, fps: Math.round(count * 1000 / (now - start)) });
        const canvas = document.querySelector<HTMLCanvasElement>('.student-canvas-library-scene');
        const nextDiagnostics = { state: canvas?.dataset.ambientState ?? '', action: canvas?.dataset.ambientAction ?? '', cat: canvas?.dataset.catState ?? '' };
        setAmbientDiagnostics(previous => previous.state === nextDiagnostics.state && previous.action === nextDiagnostics.action && previous.cat === nextDiagnostics.cat ? previous : nextDiagnostics);
        count = 0;
        start = now;
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    const key = (event: KeyboardEvent) => { if (event.key === 'F8') { event.preventDefault(); setControls(value => !value); } };
    window.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', key); };
  }, []);

  useEffect(() => {
    if (!animate || game) return;
    let frame = 0;
    const start = performance.now();
    const update = (now: number) => { setTime((now - start) % (ambientPreview || catPreview ? 1200 : mode === 'normal' ? 560 : 700)); frame = requestAnimationFrame(update); };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [animate, game, mode, ambientPreview, catPreview]);

  useEffect(() => () => {
    if (recorderRef.current) {
      recorderRef.current.onstop = null;
      recorderRef.current.ondataavailable = null;
      if (recorderRef.current.state === 'recording') recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
  }, []);

  const targetCanvas = () => document.querySelector<HTMLCanvasElement>(game ? '.student-canvas-library-scene' : '#review-scene');
  const takeScreenshot = () => {
    targetCanvas()?.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = game ? `library-game-${Date.now()}.png` : `library-review-${catPreview ? `cat-${catPreview}-${facing}` : ambientPreview || mode}-${Math.round(time)}ms${reduced ? '-reduced' : ''}.png`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };
  const exportAtlas = () => {
    const cells = Array.from(document.querySelectorAll<HTMLCanvasElement>('.review-cell canvas'));
    const sheet = document.createElement('canvas');
    sheet.width = 800;
    sheet.height = Math.ceil(cells.length / 5) * 184;
    const context = sheet.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#fff8e5';
    context.fillRect(0, 0, sheet.width, sheet.height);
    context.font = '12px sans-serif';
    for (const [index, cell] of cells.entries()) {
      const x = index % 5 * 160;
      const y = Math.floor(index / 5) * 184;
      context.drawImage(cell, x + 8, y + 8, 144, 144);
      context.fillStyle = '#253044';
      context.fillText(cell.getAttribute('aria-label') ?? '', x + 8, y + 172);
    }
    const link = document.createElement('a');
    link.href = sheet.toDataURL('image/png');
    link.download = 'bookshop-character-atlas.png';
    link.click();
  };
  const startRecording = () => {
    const canvas = targetCanvas();
    if (!canvas || typeof MediaRecorder === 'undefined' || !canvas.captureStream) { setCaptureError('이 브라우저는 Canvas 녹화를 지원하지 않습니다.'); return; }
    try {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      setVideoUrl(null);
      videoUrlRef.current = null;
      const stream = canvas.captureStream(30);
      streamRef.current = stream;
      const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('WebM 녹화를 지원하지 않습니다.');
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
        videoUrlRef.current = url;
        setVideoUrl(url);
        setRecording(false);
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      setRecording(true);
      setCaptureError('');
      document.querySelector<HTMLCanvasElement>('.student-canvas-library-scene')?.focus();
    } catch (error) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCaptureError(error instanceof Error ? error.message : '녹화를 시작하지 못했습니다.');
    }
  };
  const resetBooks = (full: boolean) => { setBooks(full ? fullBooks : []); setGameVersion(version => version + 1); };
  const place = async (book: LibraryBookDraft, slotId: number) => {
    if (saveMode === 'delayed') await new Promise(resolve => window.setTimeout(resolve, 2500));
    if (saveMode === 'failure') throw new Error('개발 검수용 저장 실패');
    if (books.some(book => book.slotId === slotId)) return null;
    const placed = { ...book, slotId };
    setBooks(current => [...current, placed]);
    return placed;
  };
  const previewTime = animate && mode === 'normal' ? Math.floor(time / 140) % 4 : 0;
  const previewScene = catPreview ? buildCatScene(catPreview, facing, catReaction, time, reduced) : buildAmbientScene(ambientPreview, time, reduced) ?? buildScene(facing, carrying, previewTime, mode, time, reduced);
  return <div className="library-review">
    <style>{`
      body:has(.library-review) { margin:0; background:#edf1e6; color:#253044; overflow:auto; font-family:system-ui,sans-serif; }
      .library-review { padding:20px; }
      .library-review h1 { font-size:24px; font-weight:750; margin:0 0 8px; }
      .library-review h2 { margin:24px 0 10px; font-size:18px; }
      .review-controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:12px; background:#fff8e5; border:1px solid #9b876b; border-radius:10px; margin:12px 0; }
      .review-controls label { display:flex; gap:6px; align-items:center; }
      .review-controls button,.review-controls select,.review-controls input[type=number],.review-controls a { padding:8px 12px; border:1px solid #596b78; border-radius:5px; background:white; color:#253044; min-height:36px; }
      .review-controls input[type=number] { width:120px; }
      .review-controls button:disabled { opacity:.45; }
      .review-controls button[aria-pressed=true] { background:#c8e3bc; }
      .review-controls output { font-variant-numeric:tabular-nums; }
      .review-atlas { display:grid; grid-template-columns:repeat(5, 160px); gap:10px; }
      .review-cell { margin:0; padding:8px; background:#fff8e5; border:1px solid #b99872; border-radius:6px; }
      .review-cell canvas { width:144px; height:144px; image-rendering:pixelated; }
      .review-cell figcaption { font-size:11px; padding-top:6px; white-space:nowrap; }
      #review-scene { width:624px; height:376px; image-rendering:pixelated; max-width:100%; }
      .review-game-controls { max-height:calc(100dvh - 20px); overflow:auto; position:fixed; z-index:200; right:10px; bottom:10px; width:min(460px,calc(100vw - 20px)); font-size:12px; box-shadow:0 4px 20px #0004; }
      .review-game-controls summary { cursor:pointer; font-weight:700; padding:4px; }
      .review-game-controls .review-controls { margin:0; }
      .review-note { font-size:13px; margin:8px 0; }
      .review-diagnostics { width:100%; font-size:11px; overflow-wrap:anywhere; white-space:pre-wrap; }
      .review-recording-preview { width:100%; max-width:624px; }
      .review-recording-preview video { display:block; width:100%; max-height:376px; background:#253044; }
      .review-recording-preview output { display:block; padding:6px 0; font-size:12px; }
      .review-game-controls>summary { background:#fff8e5; padding:10px; border:1px solid #9b876b; border-radius:8px; }
    `}</style>
    {!game ? <>
      <h1>책방 개발 검수</h1>
      <p className="review-note">개발 서버 전용 · 실제 캐릭터 도안과 렌더러 사용 · 모든 책 데이터는 이 화면의 임시 상태입니다.</p>
      <div className="review-controls">
        <button disabled={recording} onClick={() => setGame(true)}>실제 게임 검수 열기</button>
        <output>{metrics.width} × {metrics.height} · 화면 {metrics.fps} FPS</output>
        <span>F8: 게임 검수 도구 표시/숨기기</span>
        <label>게시판 메모 <select value={boardNoteCount} onChange={event => setBoardNoteCount(Number(event.target.value))}>{[0, 1, 24].map(count => <option key={count} value={count}>{count}개</option>)}</select></label>
      </div>
      <div className="review-controls">
        {(['normal', 'receive', 'place', 'seated'] as const).map(value => <button key={value} aria-pressed={!ambientPreview && !catPreview && mode === value} onClick={() => { setMode(value); setAmbientPreview(''); setCatPreview(''); setTime(0); }}>{({ normal:'기본', receive:'책 받기', place:'책 꽂기', seated:'앉기' })[value]}</button>)}
        <label>생활 동작 <select value={ambientPreview} onChange={event => { setAmbientPreview(event.target.value); setCatPreview(''); setTime(0); }}><option value="">캐릭터 기본 검수</option>{ambientPreviews.map(preview => <option key={preview.id} value={preview.id}>{preview.label}</option>)}</select></label>
        <label>고양이 동작 <select value={catPreview} onChange={event => { setCatPreview(catBehaviors.find(value => value === event.target.value) ?? ''); setAmbientPreview(''); setAnimate(false); setTime(0); }}><option value="">고정 고양이 · 기존 검수</option>{catBehaviors.map(value => <option key={value} value={value}>{catBehaviorLabels[value]}</option>)}</select></label>
        {catPreview ? <label>쓰다듬기 반응 <select value={catReaction} onChange={event => { const value = catReactions.find(candidate => candidate === event.target.value); if (value) setCatReaction(value); }}>{catReactions.map(value => <option key={value} value={value}>{catReactionLabels[value]}</option>)}</select></label> : null}
        <button aria-pressed={reduced} onClick={() => setReduced(value => !value)}>동작 줄이기</button>
        <button aria-pressed={animate} onClick={() => setAnimate(value => !value)}>실시간 재생</button>
        <label>시간 <input type="range" min={0} max={900} step={10} value={Math.min(900, time)} onChange={event => { setAnimate(false); setTime(Number(event.target.value)); }} /><output>{Math.round(time)}ms</output></label>
        {[0, 450, 900].map(value => <button key={value} onClick={() => { setAnimate(false); setTime(value); }}>{value}ms</button>)}
      </div>
      <div className="review-controls">
        <label>장면 방향 <select value={facing} onChange={event => { const next = directions.find(value => value === event.target.value); if (next) setFacing(next); }}>{directions.map(value => <option key={value} value={value}>{directionLabels[value]}</option>)}</select></label>
        <button aria-pressed={carrying} onClick={() => setCarrying(value => !value)}>책 운반</button>
        <button onClick={takeScreenshot}>장면 PNG 저장</button>
        <button disabled={recording} onClick={startRecording}>장면 녹화 시작</button>
        <button disabled={!recording} onClick={() => recorderRef.current?.stop()}>녹화 종료</button>
        {videoUrl ? <a href={videoUrl} download="library-review.webm">WebM 내려받기</a> : null}
      </div>
      {videoUrl ? <RecordingPreview key={videoUrl} source={videoUrl} /> : null}
      <ScenePreview scene={{ ...previewScene, boardNoteCount }} />
      {ambientPreview ? <output className="review-diagnostics" aria-label="생활 동작 미리보기 상태">{JSON.stringify({ state: previewScene.ambientState, action: previewScene.ambientAction ?? null })}</output> : null}
      {catPreview ? <output className="review-diagnostics" aria-label="고양이 미리보기 상태">{JSON.stringify(previewScene.catState)}</output> : null}
      {captureError ? <p role="alert">{captureError}</p> : null}
      <h2>방향별 도안 · 논리 픽셀 3배</h2><div className="review-controls"><button onClick={exportAtlas}>도안 PNG 저장</button></div>
      <div className="review-atlas">{directions.flatMap(direction => [false, true].flatMap(carry => [-1,0,1,2,3].map(frame => <CharacterCell key={`${direction}-${carry}-${frame}`} facing={direction} carrying={carry} frame={frame} mode={ambientPreview || catPreview ? 'normal' : mode} time={time} reduced={reduced} />)))}</div>
    </> : <>
      <CanvasLibraryGame key={`${startIndex}-${gameVersion}-${catSeed}-${catFixture}`} catSeed={catSeed} initialCatState={gameSetup.initialCatState} studentNumber={1} room={gameSetup.room} books={books} boardNoteCount={boardNoteCount} unplacedBooks={[draft, longDraft]} onPlace={place}
        renderFailureBoard={(onClose, returnFocusRef) => <StudentFailureExhibitionPage embedded studentNumber={1} profileAssignments={{}} stories={[{ id:'dev-story', studentNumber:2, failure:'책을 읽다가 중요한 내용을 잊어버렸어요.', lesson:'다음에는 짧게 메모하면서 읽어 보려고 해요.', stamps:[], createdAt:'2026-09-05T00:00:00Z', updatedAt:'2026-09-05T00:00:00Z' }]} isSaving={false} onCreate={async()=>false} onStamp={async()=>false} onOpenBookshelf={()=>undefined} onBack={()=>undefined} onRequestClose={onClose} returnFocusRef={returnFocusRef} />}
        renderCompetition={appDataMode === 'mock' ? (onClose, returnFocusRef) => <LibraryCompetitionPanel onClose={onClose} onSnapshot={() => undefined} returnFocusRef={returnFocusRef} /> : undefined}
        onBack={() => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); setGame(false); }} />
      {controls ? <details className="review-game-controls">
        <summary>개발 검수 · {metrics.width}×{metrics.height} · {metrics.fps} FPS · {recording ? '녹화 중' : `${books.length}권`}</summary>
        <div className="review-controls">
          <label>출발 위치 <select value={startIndex} disabled={recording} onChange={event => { setStartIndex(Number(event.target.value)); setGameVersion(version => version + 1); }}>{startPoints.map((point,index) => <option key={point.label} value={index}>{point.label}</option>)}<option value={nearCatStartIndex}>시드 고양이 옆</option></select></label>
          <label>고양이 시드 <input type="number" aria-label="고양이 시드" value={catSeed} disabled={recording} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) setCatSeed(Math.trunc(value) >>> 0); }} /></label>
          <button disabled={recording} onClick={() => setCatSeed(Math.floor(Math.random() * 0x100000000))}>새 시드로 재시작</button>
          <label>고양이 시작 동작 <select value={catFixture} disabled={recording} onChange={event => setCatFixture(catFixtureBehaviors.find(value => value === event.target.value) ?? '')}><option value="">자율 생활</option>{catFixtureBehaviors.map(value => <option key={value} value={value}>{catBehaviorLabels[value]}</option>)}</select></label>
          <label>게시판 메모 <select value={boardNoteCount} onChange={event => setBoardNoteCount(Number(event.target.value))}>{[0, 1, 24].map(count => <option key={count} value={count}>{count}개</option>)}</select></label>
          <label>저장 응답 <select value={saveMode} onChange={event => { const value = event.target.value; if (value === 'success' || value === 'failure' || value === 'delayed') setSaveMode(value); }}><option value="success">성공</option><option value="failure">실패</option><option value="delayed">2.5초 지연 후 성공</option></select></label>
          <button disabled={recording} onClick={() => resetBooks(false)}>빈 책방으로 초기화</button>
          <button disabled={recording} onClick={() => resetBooks(true)}>100권 채우기</button>
          <button disabled={recording} onClick={() => setGameVersion(version => version + 1)}>같은 위치에서 재시작</button>
          <label>키 입력 유지 <select value={inputDuration} onChange={event => setInputDuration(Number(event.target.value))}><option value={100}>100ms</option><option value={250}>250ms</option><option value={1000}>1000ms</option></select></label>
          {([['ArrowLeft', '왼쪽'], ['ArrowRight', '오른쪽'], ['ArrowUp', '위쪽'], ['ArrowDown', '아래쪽']] as const).map(([key, label]) => <button key={key} onPointerDown={event => event.preventDefault()} onClick={() => driveInput(key)}>{label} {inputDuration}ms</button>)}
          <button onPointerDown={event => event.preventDefault()} onClick={() => driveInput('e', 40)}>상호작용 E</button>
          <button onPointerDown={event => event.preventDefault()} onClick={() => { for (let index = 0; index < 6; index += 1) driveInput('e', 40); }}>E 6회 연타</button>
          <button onPointerDown={event => event.preventDefault()} onClick={() => driveInput('Escape', 40)}>Escape</button>
          <button onClick={releaseDriver}>키 입력 중단</button>
          <button onClick={() => window.dispatchEvent(new Event('blur'))}>창 비활성 이벤트</button>
          <button onClick={() => { window.dispatchEvent(new Event('focus')); document.querySelector<HTMLCanvasElement>('.student-canvas-library-scene')?.focus({ preventScroll: true }); }}>창 활성 이벤트</button>
          <output className="review-diagnostics" aria-label="실제 게임 생활 상태">{ambientDiagnostics.state || '생활 상태 대기 중'}{ambientDiagnostics.action ? `\n진행 동작: ${ambientDiagnostics.action}` : ''}</output>
          <output className="review-diagnostics" aria-label="실제 게임 고양이 상태">{ambientDiagnostics.cat || '고양이 상태 대기 중'}</output>
          <p>개발용 키보드 드라이버: 실제 게임 Canvas에 keydown/keyup을 순서대로 전달합니다.</p>
          <button onClick={takeScreenshot}>게임 PNG 저장</button>
          <button disabled={recording} onClick={startRecording}>게임 녹화 시작</button>
          <button disabled={!recording} onClick={() => recorderRef.current?.stop()}>녹화 종료</button>
          {videoUrl ? <a href={videoUrl} download="library-game-review.webm">WebM 내려받기</a> : null}
          {videoUrl ? <RecordingPreview key={videoUrl} source={videoUrl} /> : null}
          <button onClick={() => setControls(false)}>도구 숨기기 (F8 복귀)</button>
          <p>녹화는 Canvas 화면만 포함합니다. 모달·오디오는 포함하지 않습니다. 실패 게시판은 고정 예시이며 챌린지는 mock 모드에서만 열립니다.</p>
          {captureError ? <p role="alert">{captureError}</p> : null}
        </div>
      </details> : null}
    </>}
  </div>;
}

const rootElement = document.getElementById('root');
if (rootElement && import.meta.env.DEV) {
  const reactRoot = createRoot(rootElement);
  reactRoot.render(<Review />);
  import.meta.hot?.dispose(() => reactRoot.unmount());
}
