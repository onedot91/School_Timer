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
  if (!stage) return { blocked, walkerSpeaking };
  stage.querySelectorAll<HTMLElement>('.student-character-showcase').forEach((node) => {
    const box = (node.querySelector('.student-character-image') ?? node).getBoundingClientRect();
    if (box.right <= 0 || box.left >= viewport.width) return;
    const edgeZone = viewport.width * 0.32;
    if (box.left < edgeZone) blocked.add('bottom-left');
    if (box.right > viewport.width - edgeZone) blocked.add('bottom-right');
    if (!node.dataset.encounter && node.querySelector('.student-character-speech')) walkerSpeaking = true;
  });
  return { blocked, walkerSpeaking };
};

interface ActivePeek {
  key: string;
  character: StudentCharacter;
  layout: PeekLayout;
  speech: string | null;
  delayMs: number;
}

const ANALYSIS_SIZE = 220;
const contentBoxCache = new Map<string, Promise<PeekContentBox | null>>();

/** 그림의 실제 선 영역(투명 여백 제외)을 한 번만 계산해 둔다. */
const loadContentBox = (src: string): Promise<PeekContentBox | null> => {
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
        const bounds = findOpaqueBounds(context.getImageData(0, 0, width, height).data, width, height);
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

const randomBetween = ([min, max]: [number, number]) => min + Math.random() * (max - min);

const getStudentKey = (character: StudentCharacter) => character.creatorName ?? character.id;

export default function StudentCharacterPeek({
  characters,
  busyCharacterIds,
  enabled,
}: {
  characters: StudentCharacter[];
  busyCharacterIds: string[];
  enabled: boolean;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [peeks, setPeeks] = useState<ActivePeek[]>([]);
  const charactersRef = useRef(characters);
  const busyRef = useRef(busyCharacterIds);
  const lastCornerRef = useRef<PeekCorner | null>(null);
  const recentIdsRef = useRef<string[]>([]);
  charactersRef.current = characters;
  busyRef.current = busyCharacterIds;

  useEffect(() => {
    if (!enabled) {
      setPeeks([]);
      return;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
      if (document.hidden || reducedMotion.matches || !layer) {
        schedule(randomBetween(PEEK_INTERVAL_MS));
        return;
      }
      const main = pickCharacter();
      if (!main) {
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
        schedule(randomBetween(PEEK_INTERVAL_MS));
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
      if (partner && partnerBox && scene.blocked.size === 0) {
        mainCorner = Math.random() < 0.5 ? 'bottom-left' : 'bottom-right';
        const speak = !scene.walkerSpeaking;
        nextPeeks.push(
          { key: `${stamp}-a`, character: main, layout: computePeekLayout(mainBox, viewport, mainCorner), speech: speak ? main.speech ?? null : null, delayMs: 0 },
          {
            key: `${stamp}-b`,
            character: partner,
            layout: computePeekLayout(partnerBox, viewport, getOppositeCorner(mainCorner)),
            speech: speak ? partner.speech ?? null : null,
            delayMs: 450,
          },
        );
      }
      if (nextPeeks.length === 0) {
        nextPeeks.push({
          key: `${stamp}-a`,
          character: main,
          layout: computePeekLayout(mainBox, viewport, mainCorner),
          // 걷는 캐릭터가 말하는 중이면 말풍선이 겹치지 않게 빼꼼은 조용히 나온다.
          speech: main.speech && !scene.walkerSpeaking && Math.random() < 0.75 ? main.speech : null,
          delayMs: 0,
        });
      }

      lastCornerRef.current = mainCorner;
      recentIdsRef.current = [...nextPeeks.map((peek) => peek.character.id), ...recentIdsRef.current].slice(0, 8);
      setPeeks(nextPeeks);
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
        if (!cancelled) setPeeks([]);
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
    };
  }, [enabled]);

  return (
    <div ref={layerRef} className="student-character-peek-layer" aria-hidden="true">
      {peeks.map(({ key, character, layout, speech, delayMs }) => {
        const facingDirection = layout.corner.endsWith('left') ? 'right' : 'left';
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
          transform: getPeekFacingTransform(character.walkTransform?.[facingDirection]),
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
          <div key={key} className="student-character-peek-group">
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
      })}
    </div>
  );
}
