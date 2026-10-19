import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { StudentCharacter } from '../../lib/studentCharacters';
import {
  PEEK_DURATION_MS,
  PEEK_FIRST_DELAY_MS,
  PEEK_INTERVAL_MS,
  PEEK_PAIR_CHANCE,
  classifyPeekShape,
  computePeekLayout,
  findOpaqueBounds,
  getMassGrid,
  getOppositeCorner,
  getPeekFacingTransform,
  pickPeekCorner,
  type PeekContentBox,
  type PeekCorner,
  type PeekLayout,
} from '../../lib/studentCharacterPeek';

/** 걸어가는 캐릭터가 있는 쪽의 아래 모서리, 그리고 지금 말하고 있는 걷는 캐릭터가 있는지 */
const readWalkerScene = (stage: Element | null, viewport: { width: number; height: number }) => {
  const blocked = new Set<PeekCorner>();
  let walkerSpeaking = false;
  /** 화면에 있거나 막 들어오는 중인(아직 반대편으로 나가지 않은) 걷는 캐릭터 수 */
  let present = 0;
  if (!stage) return { blocked, walkerSpeaking, present };
  stage.querySelectorAll<HTMLElement>('.student-character-showcase').forEach((node) => {
    const box = (node.querySelector('.student-character-image') ?? node).getBoundingClientRect();
    const exited = node.dataset.direction === 'left' ? box.right <= 0 : box.left >= viewport.width;
    if (!exited) present += 1;
    if (box.right <= 0 || box.left >= viewport.width) return;
    const edgeZone = viewport.width * 0.32;
    if (box.left < edgeZone) blocked.add('bottom-left');
    if (box.right > viewport.width - edgeZone) blocked.add('bottom-right');
    if (!node.dataset.encounter && node.querySelector('.student-character-speech')) walkerSpeaking = true;
  });
  return { blocked, walkerSpeaking, present };
};

/** 걷는 캐릭터와 빼꼼을 합쳐 한 화면에 나오는 캐릭터 수의 최대값 */
export const MAX_CHARACTERS_ON_SCREEN = 3;
/** 자리를 맡아 둔 뒤 걷는 캐릭터가 빠져나갔는지 다시 보는 간격 */
const CROWDED_RETRY_MS: [number, number] = [500, 800];

export interface ActivePeek {
  key: string;
  character: StudentCharacter;
  layout: PeekLayout;
  speech: string | null;
  delayMs: number;
}

const ANALYSIS_SIZE = 220;
const contentBoxCache = new Map<string, Promise<PeekContentBox | null>>();

/** 그림의 실제 선 영역(투명 여백 제외)을 한 번만 계산해 둔다. */
export const loadContentBox = (src: string): Promise<PeekContentBox | null> => {
  const cached = contentBoxCache.get(src);
  if (cached) return cached;
  const promise = new Promise<PeekContentBox | null>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      if (!naturalWidth || !naturalHeight) {
        resolve(null);
        return;
      }
      const fullBox = { naturalWidth, naturalHeight, x: 0, y: 0, width: naturalWidth, height: naturalHeight };
      try {
        const ratio = Math.min(1, ANALYSIS_SIZE / Math.max(naturalWidth, naturalHeight));
        const width = Math.max(1, Math.round(naturalWidth * ratio));
        const height = Math.max(1, Math.round(naturalHeight * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          resolve(fullBox);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const bounds = findOpaqueBounds(pixels, width, height);
        if (!bounds) {
          resolve(fullBox);
          return;
        }
        const scaleBack = 1 / ratio;
        const x = Math.max(0, Math.floor(bounds.x * scaleBack));
        const y = Math.max(0, Math.floor(bounds.y * scaleBack));
        resolve({
          naturalWidth,
          naturalHeight,
          x,
          y,
          width: Math.min(naturalWidth - x, Math.ceil(bounds.width * scaleBack)),
          height: Math.min(naturalHeight - y, Math.ceil(bounds.height * scaleBack)),
          massGrid: getMassGrid(pixels, width, bounds),
        });
      } catch {
        resolve(fullBox);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
  contentBoxCache.set(src, promise);
  return promise;
};

/** 모서리 쪽에서 화면 안쪽으로 향하도록 좌우를 뒤집는지 (걷기 방향 설정을 그대로 따른다) */
export const getPeekFacing = (character: StudentCharacter, corner: PeekCorner) =>
  getPeekFacingTransform(character.walkTransform?.[corner.endsWith('left') ? 'right' : 'left']);

const randomBetween = ([min, max]: [number, number]) => min + Math.random() * (max - min);

const getStudentKey = (character: StudentCharacter) => character.creatorName ?? character.id;

export default function StudentCharacterPeek({
  characters,
  busyCharacterIds,
  enabled,
  onActiveChange,
}: {
  characters: StudentCharacter[];
  busyCharacterIds: string[];
  enabled: boolean;
  /** 빼꼼이 자리를 기다리거나 나와 있는 동안 true. 그동안 새 걷는 캐릭터가 들어오지 않게 하는 데 쓴다. */
  onActiveChange?: (active: boolean) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [peeks, setPeeks] = useState<ActivePeek[]>([]);
  const charactersRef = useRef(characters);
  const busyRef = useRef(busyCharacterIds);
  const lastCornerRef = useRef<PeekCorner | null>(null);
  const recentIdsRef = useRef<string[]>([]);
  const onActiveChangeRef = useRef(onActiveChange);
  charactersRef.current = characters;
  busyRef.current = busyCharacterIds;
  onActiveChangeRef.current = onActiveChange;

  useEffect(() => {
    const setActive = (active: boolean) => onActiveChangeRef.current?.(active);
    if (!enabled) {
      setPeeks([]);
      setActive(false);
      return;
    }
    let cancelled = false;
    let scheduleTimer = 0;
    const cleanupTimers = new Set<number>();

    const schedule = (delay: number) => {
      scheduleTimer = window.setTimeout(run, delay);
    };

    const pickCharacter = () => {
      const busy = new Set(busyRef.current);
      const recent = new Set(recentIdsRef.current);
      const all = charactersRef.current;
      const fresh = all.filter((character) => !busy.has(character.id) && !recent.has(character.id));
      const pool = fresh.length > 0 ? fresh : all.filter((character) => !busy.has(character.id));
      return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    };

    const run = async () => {
      if (cancelled) return;
      const layer = layerRef.current;
      if (document.hidden || !layer) {
        setActive(false);
        schedule(randomBetween(PEEK_INTERVAL_MS));
        return;
      }
      // 이미 걷는 캐릭터가 3마리면(들어오는 중 포함) 번잡하지 않게 자리가 날 때까지 기다린다.
      // 걷는 캐릭터는 쉬지 않고 이어 들어오므로, 먼저 자리를 맡아(새 입장 보류) 한 마리가 나가기를 기다린다.
      const crowdedNow = () => {
        const rect = layer.getBoundingClientRect();
        const size = { width: rect.width || window.innerWidth, height: rect.height || window.innerHeight };
        return readWalkerScene(layer.parentElement, size).present >= MAX_CHARACTERS_ON_SCREEN;
      };
      if (crowdedNow()) {
        setActive(true);
        schedule(randomBetween(CROWDED_RETRY_MS));
        return;
      }
      const main = pickCharacter();
      if (!main) {
        setActive(false);
        schedule(randomBetween(PEEK_INTERVAL_MS));
        return;
      }
      // 같은 학생이 만든 다른 캐릭터가 있으면 가끔 양쪽에서 함께 빼꼼
      const busy = new Set(busyRef.current);
      const partner = Math.random() < PEEK_PAIR_CHANCE
        ? charactersRef.current.find((character) =>
          character.id !== main.id && getStudentKey(character) === getStudentKey(main) && !busy.has(character.id))
        : undefined;

      const [mainBox, partnerBox] = await Promise.all([
        loadContentBox(main.imageSrc),
        partner ? loadContentBox(partner.imageSrc) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (!mainBox) {
        setActive(false);
        schedule(randomBetween(PEEK_INTERVAL_MS));
        return;
      }
      if (crowdedNow()) {
        setActive(true);
        schedule(randomBetween(CROWDED_RETRY_MS));
        return;
      }

      const rect = layer.getBoundingClientRect();
      const viewport = { width: rect.width || window.innerWidth, height: rect.height || window.innerHeight };
      const scene = readWalkerScene(layer.parentElement, viewport);
      const mainShape = classifyPeekShape(mainBox.width, mainBox.height);
      let mainCorner = pickPeekCorner(Math.random, mainShape, lastCornerRef.current, scene.blocked);
      const nextPeeks: ActivePeek[] = [];
      const stamp = Date.now().toString(36);

      // 짝꿍은 아래 두 모서리에서 마주 보듯 나오므로, 걷는 캐릭터가 모서리 근처에 없을 때만 한다.
      if (partner && partnerBox && scene.blocked.size === 0
        && scene.present + 2 <= MAX_CHARACTERS_ON_SCREEN) {
        mainCorner = Math.random() < 0.5 ? 'bottom-left' : 'bottom-right';
        const speak = !scene.walkerSpeaking;
        nextPeeks.push(
          { key: `${stamp}-a`, character: main, layout: computePeekLayout(mainBox, viewport, mainCorner, getPeekFacing(main, mainCorner) !== 'none'), speech: speak ? main.speech ?? null : null, delayMs: 0 },
          {
            key: `${stamp}-b`,
            character: partner,
            layout: computePeekLayout(partnerBox, viewport, getOppositeCorner(mainCorner), getPeekFacing(partner, getOppositeCorner(mainCorner)) !== 'none'),
            speech: speak ? partner.speech ?? null : null,
            delayMs: 450,
          },
        );
      }
      if (nextPeeks.length === 0) {
        nextPeeks.push({
          key: `${stamp}-a`,
          character: main,
          layout: computePeekLayout(mainBox, viewport, mainCorner, getPeekFacing(main, mainCorner) !== 'none'),
          // 걷는 캐릭터가 말하는 중이면 말풍선이 겹치지 않게 빼꼼은 조용히 나온다.
          speech: main.speech && !scene.walkerSpeaking && Math.random() < 0.75 ? main.speech : null,
          delayMs: 0,
        });
      }

      lastCornerRef.current = mainCorner;
      recentIdsRef.current = [...nextPeeks.map((peek) => peek.character.id), ...recentIdsRef.current].slice(0, 8);
      setPeeks(nextPeeks);
      setActive(true);
      // 빼꼼이 다 나왔을 때 근처에 걷던 캐릭터가 돌아보도록 알린다.
      const first = nextPeeks[0].layout;
      const reactTimer = window.setTimeout(() => {
        cleanupTimers.delete(reactTimer);
        if (cancelled) return;
        layer.dispatchEvent(new CustomEvent('studentcharacterpeek', {
          bubbles: true,
          detail: { x: first.anchorX, y: first.anchorY },
        }));
      }, PEEK_DURATION_MS * 0.2);
      cleanupTimers.add(reactTimer);
      const longestDelay = Math.max(...nextPeeks.map((peek) => peek.delayMs));
      const clearTimer = window.setTimeout(() => {
        cleanupTimers.delete(clearTimer);
        if (!cancelled) {
          setPeeks([]);
          setActive(false);
        }
      }, PEEK_DURATION_MS + longestDelay + 120);
      cleanupTimers.add(clearTimer);
      schedule(randomBetween(PEEK_INTERVAL_MS) + longestDelay);
    };

    const forced = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('peek')
      : null;
    schedule(forced === 'now' ? 1500 : randomBetween(PEEK_FIRST_DELAY_MS));

    return () => {
      cancelled = true;
      window.clearTimeout(scheduleTimer);
      cleanupTimers.forEach((timer) => window.clearTimeout(timer));
      setPeeks([]);
      setActive(false);
    };
  }, [enabled]);

  return (
    <div ref={layerRef} className="student-character-peek-layer" aria-hidden="true">
      {peeks.map(({ key, ...peek }) => <StudentCharacterPeekFigure key={key} {...peek} />)}
    </div>
  );
}

/** 빼꼼 한 마리(그림 + 말풍선). 화면 검토용으로도 따로 쓸 수 있게 분리한다. */
export function StudentCharacterPeekFigure({ character, layout, speech, delayMs }: Omit<ActivePeek, 'key'>) {
  const style = {
    '--peek-duration': `${PEEK_DURATION_MS}ms`,
    '--peek-delay': `${delayMs}ms`,
    '--peek-accent': character.themeColor || '#7AA160',
    '--peek-angle': `${layout.angle}deg`,
    '--peek-hidden-x': `${layout.hiddenX}px`,
    '--peek-hidden-y': `${layout.hiddenY}px`,
    '--peek-shown-x': `${layout.shownX}px`,
    '--peek-shown-y': `${layout.shownY}px`,
    '--peek-over-x': `${layout.overX}px`,
    '--peek-over-y': `${layout.overY}px`,
    left: `${layout.anchorX - layout.boxWidth / 2}px`,
    top: `${layout.anchorY - layout.boxHeight}px`,
    width: `${layout.boxWidth}px`,
    height: `${layout.boxHeight}px`,
  } as CSSProperties;
  const artStyle = {
    transform: getPeekFacing(character, layout.corner),
  } as CSSProperties;
  const imageStyle = {
    width: `${layout.imageWidth}px`,
    height: `${layout.imageHeight}px`,
    left: `${layout.imageOffsetX}px`,
    top: `${layout.imageOffsetY}px`,
  } as CSSProperties;
  const bubbleStyle = {
    '--peek-duration': `${PEEK_DURATION_MS}ms`,
    '--peek-delay': `${delayMs}ms`,
    '--peek-accent': character.themeColor || '#7AA160',
    left: `${layout.bubbleX}px`,
    top: `${layout.bubbleY}px`,
  } as CSSProperties;
  return (
    <div className="student-character-peek-group">
      <div
        className="student-character-peek"
        data-corner={layout.corner}
        data-shape={layout.shape}
        data-gesture={character.peekGesture ?? 'look'}
        style={style}
      >
        <div className="student-character-peek-gesture">
          <div className="student-character-peek-bob">
            <div className="student-character-peek-art" style={artStyle}>
              <img src={character.imageSrc} alt="" draggable={false} style={imageStyle} />
            </div>
          </div>
        </div>
      </div>
      {speech ? (
        <div
          className="student-character-peek-speech"
          data-align={layout.bubbleAlign}
          data-side={layout.bubbleSide}
          style={bubbleStyle}
        >
          {speech}
        </div>
      ) : null}
    </div>
  );
}
