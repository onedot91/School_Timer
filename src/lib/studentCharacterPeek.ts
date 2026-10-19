// 교실 캐릭터 "모서리 빼꼼" 등장 패턴.
// 아이들 손그림은 모양(세로형/가로형/둥근형), 투명 여백, 얼굴 유무가 제각각이라
// 그림의 실제 선 영역을 기준으로 크기·기울기·나오는 방향을 계산한다.

export type PeekCorner = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
export type PeekShape = 'tall' | 'round' | 'wide';
export type PeekGesture = 'look' | 'wiggle';

export interface PeekContentBox {
  /** 원본 이미지 크기(px) */
  naturalWidth: number;
  naturalHeight: number;
  /** 투명하지 않은(실제로 그려진) 영역 */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * 그림 영역을 cols×rows 칸으로 나눴을 때 칸마다의 선(불투명 픽셀) 비율. 합은 1.
   * 체리·뱀처럼 선이 한쪽에 몰린 그림도 빼꼼했을 때 충분히 보이도록 내미는 정도를 정하는 데 쓴다.
   */
  massGrid?: PeekMassGrid;
}

export interface PeekMassGrid {
  cols: number;
  rows: number;
  /** 왼쪽 위부터 행 순서 */
  cells: number[];
}

export interface PeekViewport {
  width: number;
  height: number;
}

export interface PeekLayout {
  corner: PeekCorner;
  shape: PeekShape;
  /** 화면에 그려질 그림 영역 크기(px) */
  boxWidth: number;
  boxHeight: number;
  /** 원본 이미지를 그림 영역에 맞춰 놓기 위한 값(px) */
  imageWidth: number;
  imageHeight: number;
  imageOffsetX: number;
  imageOffsetY: number;
  /** 발끝(그림 아래 가운데)을 놓을 화면 좌표 */
  anchorX: number;
  anchorY: number;
  angle: number;
  hiddenX: number;
  hiddenY: number;
  shownX: number;
  shownY: number;
  overX: number;
  overY: number;
  /** 말풍선 기준점과 붙는 방향 */
  bubbleX: number;
  bubbleY: number;
  bubbleAlign: 'start' | 'end';
  bubbleSide: 'above' | 'below';
}

/** 들어오기 약 1초·나가기 약 1초는 그대로 두고, 다 나와서 말풍선을 보여 주는 시간을 넉넉히 둔다. */
export const PEEK_DURATION_MS = 7200;
export const PEEK_FIRST_DELAY_MS: [number, number] = [14000, 24000];
export const PEEK_INTERVAL_MS: [number, number] = [30000, 55000];
export const PEEK_PAIR_CHANCE = 0.15;
export const PEEK_TOP_CORNER_CHANCE = 0.3;
/** 원본보다 지나치게 키워 손그림이 흐려지지 않도록 하는 최대 배율 */
export const PEEK_MAX_UPSCALE = 1.15;

const TILT_BY_SHAPE: Record<PeekShape, number> = { tall: 36, round: 15, wide: 0 };

/** 실제 그림 영역의 가로:세로 비율로 형태를 나눈다. */
export const classifyPeekShape = (contentWidth: number, contentHeight: number): PeekShape => {
  if (contentWidth <= 0 || contentHeight <= 0) return 'round';
  const ratio = contentWidth / contentHeight;
  if (ratio >= 1.4) return 'wide';
  if (ratio <= 0.8) return 'tall';
  return 'round';
};

export const isTopCorner = (corner: PeekCorner) => corner.startsWith('top');
export const isLeftCorner = (corner: PeekCorner) => corner.endsWith('left');

/**
 * 모서리를 고른다. 가로형(자동차 등)은 거꾸로 매달리면 어색하므로 아래 모서리만 쓴다.
 * 직전에 쓴 모서리는 피한다.
 */
export const pickPeekCorner = (
  random: () => number,
  shape: PeekShape,
  previousCorner?: PeekCorner | null,
  blockedCorners: ReadonlySet<PeekCorner> = new Set(),
): PeekCorner => {
  const allowTop = shape !== 'wide';
  const bottom: PeekCorner[] = ['bottom-left', 'bottom-right'];
  const topCorners: PeekCorner[] = allowTop ? ['top-left', 'top-right'] : [];
  let candidates = allowTop && random() < PEEK_TOP_CORNER_CHANCE ? topCorners : bottom;
  // 걸어가는 캐릭터가 막 들어오거나 나가는 아래 모서리는 피한다.
  const open = candidates.filter((corner) => !blockedCorners.has(corner));
  if (open.length === 0) {
    const fallback = [...bottom, ...topCorners].filter((corner) => !blockedCorners.has(corner));
    candidates = fallback.length > 0 ? fallback : candidates;
  } else {
    candidates = open;
  }
  const filtered = candidates.filter((corner) => corner !== previousCorner);
  const pool = filtered.length > 0 ? filtered : candidates;
  return pool[Math.floor(random() * pool.length) % pool.length];
};

/**
 * 걸어 다니는 캐릭터 한 마리의 크기(TimerPage의 가장 큰 걷기 경로와 같은 계산).
 * 빼꼼은 이 크기를 기준으로 키워서, 걷는 캐릭터와 같은 세계에 있는 것처럼 보이게 한다.
 */
export const getWalkerReferenceSize = (viewport: PeekViewport, remPx = 16) =>
  Math.min(viewport.width * 0.31, viewport.height * 0.33, remPx * 16);

/** 걷는 캐릭터 대비 빼꼼 크기 배율 */
export const PEEK_SIZE_FACTOR: Record<PeekShape, number> = { tall: 1.7, round: 1.5, wide: 2.4 };

/** 머리 방향(그림 위쪽)이 화면 안쪽을 향하도록 회전 각도를 정한다. */
export const getPeekAngle = (corner: PeekCorner, shape: PeekShape) => {
  const tilt = TILT_BY_SHAPE[shape];
  switch (corner) {
    case 'bottom-left':
      return tilt;
    case 'bottom-right':
      return tilt === 0 ? 0 : -tilt;
    case 'top-left':
      return 180 - tilt;
    case 'top-right':
      return -(180 - tilt);
  }
};

const round = (value: number) => Math.round(value * 10) / 10;

export const computePeekLayout = (
  box: PeekContentBox,
  viewport: PeekViewport,
  corner: PeekCorner,
  /** 그림을 좌우 반전해서 보여 주는지(진행 방향 맞춤) */
  mirrored = false,
): PeekLayout => {
  const contentWidth = Math.max(1, box.width);
  const contentHeight = Math.max(1, box.height);
  const shape = classifyPeekShape(contentWidth, contentHeight);
  const shortSide = Math.min(viewport.width, viewport.height);

  // 형태별 목표 크기: 세로형은 키, 둥근형은 긴 변, 가로형은 너비 기준
  const walkerSize = getWalkerReferenceSize(viewport);
  let scale: number;
  if (shape === 'wide') {
    const targetWidth = Math.min(viewport.width * 0.4, walkerSize * PEEK_SIZE_FACTOR.wide);
    scale = targetWidth / contentWidth;
  } else if (shape === 'tall') {
    scale = Math.min(viewport.height * 0.5, walkerSize * PEEK_SIZE_FACTOR.tall) / contentHeight;
  } else {
    scale = Math.min(shortSide * 0.44, walkerSize * PEEK_SIZE_FACTOR.round) / Math.max(contentWidth, contentHeight);
  }
  scale = Math.min(scale, PEEK_MAX_UPSCALE);

  const boxWidth = contentWidth * scale;
  const boxHeight = contentHeight * scale;
  const left = isLeftCorner(corner);
  const top = isTopCorner(corner);
  const angle = getPeekAngle(corner, shape);
  const sideSign = left ? 1 : -1;

  let anchorX: number;
  let anchorY: number;
  let hiddenX = 0;
  let hiddenY = 0;
  let shownX = 0;
  let shownY = 0;
  let overX = 0;
  let overY = 0;
  let bubbleX: number;
  let bubbleY: number;

  if (shape === 'wide') {
    // 가로형: 기울이지 않고 아래 모서리 옆에서 앞부분(진행 방향)만 쑥 내민다.
    anchorX = left ? 0 : viewport.width;
    anchorY = viewport.height - viewport.height * 0.025;
    // 기본 상태(0)는 그림의 가운데가 화면 가장자리에 걸친 상태
    hiddenX = -sideSign * (boxWidth / 2 + 32);
    shownX = sideSign * boxWidth * 0.08;
    overX = sideSign * boxWidth * 0.11;
    const frontX = anchorX + sideSign * (boxWidth / 2) + shownX;
    bubbleX = frontX - sideSign * boxWidth * 0.12;
    // 말풍선은 앞부분(얼굴 쪽)에 그려진 선의 맨 위에 붙인다. 뱀처럼 꼬리만 높이 솟은 그림 대비.
    const frontTop = getFrontTopRatio(box.massGrid, left, mirrored);
    bubbleY = anchorY - boxHeight + frontTop * boxHeight - 10;
  } else {
    // 세로형·둥근형: 모서리에 발끝을 두고 기울인 몸의 축을 따라 머리부터 내민다.
    // 발끝을 모서리에서 살짝 안쪽에 두어 얼굴이 화면 가장자리에 잘리지 않게 한다.
    const inset = boxWidth * 0.2;
    anchorX = left ? inset : viewport.width - inset;
    anchorY = top ? 0 : viewport.height;
    const radians = (angle * Math.PI) / 180;
    // 축 방향 이동(translateY 양수 = 발 쪽 = 화면 밖)
    hiddenY = boxHeight + boxWidth * 0.6 + 24;
    const showRatio = getPeekShowRatio(shape, (ratio) => getVisibleMass(box.massGrid, {
      boxWidth, boxHeight, anchorX, anchorY, radians, mirrored, viewport,
      translateY: boxHeight * (1 - ratio),
    }));
    shownY = boxHeight * (1 - showRatio);
    overY = shownY - boxHeight * 0.035;
    const headDirX = Math.sin(radians);
    const headDirY = -Math.cos(radians);
    const visibleLength = boxHeight - shownY;
    const headX = anchorX + headDirX * visibleLength;
    const headY = anchorY + headDirY * visibleLength;
    bubbleX = headX + headDirX * 18;
    bubbleY = headY + headDirY * 18;
  }

  return {
    corner,
    shape,
    boxWidth: round(boxWidth),
    boxHeight: round(boxHeight),
    imageWidth: round(box.naturalWidth * scale),
    imageHeight: round(box.naturalHeight * scale),
    imageOffsetX: round(-box.x * scale),
    imageOffsetY: round(-box.y * scale),
    anchorX: round(anchorX),
    anchorY: round(anchorY),
    angle,
    hiddenX: round(hiddenX),
    hiddenY: round(hiddenY),
    shownX: round(shownX),
    shownY: round(shownY),
    overX: round(overX),
    overY: round(overY),
    bubbleX: round(Math.min(Math.max(bubbleX, 12), viewport.width - 12)),
    bubbleY: round(Math.min(Math.max(bubbleY, 12), viewport.height - 12)),
    bubbleAlign: left ? 'start' : 'end',
    bubbleSide: top && shape !== 'wide' ? 'below' : 'above',
  };
};

export const PEEK_MIN_VISIBLE_MASS = 0.42;
export const PEEK_MAX_SHOW_RATIO = 0.85;

/**
 * 몸의 몇 %를 내밀지 정한다. 기본은 절반 남짓이고, 그만큼 내밀어도 그려진 선이
 * PEEK_MIN_VISIBLE_MASS보다 적게 보이는 그림은 충분히 보일 때까지 더 내민다.
 * visibleMassAt(ratio)은 그만큼 내밀었을 때 화면 안에 들어오는 선의 비율(모르면 undefined).
 */
export const getPeekShowRatio = (shape: PeekShape, visibleMassAt?: (ratio: number) => number | undefined) => {
  const base = shape === 'tall' ? 0.58 : 0.6;
  if (!visibleMassAt) return base;
  let best = base;
  let bestMass = -1;
  for (let step = 0; base + step * 0.02 <= PEEK_MAX_SHOW_RATIO + 1e-9; step += 1) {
    const ratio = Math.round((base + step * 0.02) * 100) / 100;
    const mass = visibleMassAt(ratio);
    if (mass === undefined) return base;
    if (mass >= PEEK_MIN_VISIBLE_MASS) return ratio;
    if (mass > bestMass) {
      best = ratio;
      bestMass = mass;
    }
  }
  return best;
};

/** 가로형 앞부분(화면 안쪽 끝 25%)에서 선이 시작되는 높이(0=맨 위, 1=맨 아래) */
export const getFrontTopRatio = (grid: PeekMassGrid | undefined, left: boolean, mirrored: boolean) => {
  if (!grid || grid.cells.length !== grid.cols * grid.rows) return 0;
  const frontCols = Math.max(1, Math.round(grid.cols * 0.25));
  for (let row = 0; row < grid.rows; row += 1) {
    for (let index = 0; index < frontCols; index += 1) {
      const screenCol = left ? grid.cols - 1 - index : index;
      const col = mirrored ? grid.cols - 1 - screenCol : screenCol;
      if (grid.cells[row * grid.cols + col] > 0.002) return row / grid.rows;
    }
  }
  return 0;
};

/** 빼꼼 자세에서 화면 안에 보이는 선의 비율 */
export const getVisibleMass = (
  grid: PeekMassGrid | undefined,
  pose: {
    boxWidth: number;
    boxHeight: number;
    anchorX: number;
    anchorY: number;
    radians: number;
    mirrored: boolean;
    viewport: PeekViewport;
    translateY: number;
  },
) => {
  if (!grid || grid.cells.length !== grid.cols * grid.rows) return undefined;
  const cos = Math.cos(pose.radians);
  const sin = Math.sin(pose.radians);
  let visible = 0;
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const mass = grid.cells[row * grid.cols + col];
      if (!mass) continue;
      const u = (col + 0.5) / grid.cols;
      const x = (pose.mirrored ? 1 - u : u) * pose.boxWidth - pose.boxWidth / 2;
      const y = ((row + 0.5) / grid.rows) * pose.boxHeight - pose.boxHeight + pose.translateY;
      const screenX = pose.anchorX + x * cos - y * sin;
      const screenY = pose.anchorY + x * sin + y * cos;
      if (screenX >= 0 && screenX <= pose.viewport.width && screenY >= 0 && screenY <= pose.viewport.height) {
        visible += mass;
      }
    }
  }
  return visible;
};

/** 반대쪽 아래 모서리 (짝꿍 빼꼼용) */
export const getOppositeCorner = (corner: PeekCorner): PeekCorner => {
  const vertical = isTopCorner(corner) ? 'top' : 'bottom';
  return `${vertical}-${isLeftCorner(corner) ? 'right' : 'left'}` as PeekCorner;
};

/**
 * 빼꼼할 때는 좌우 반전만 이어받는다. 걷기용 90° 회전(위에서 본 거북이 등)은
 * 빼꼼 자세에서는 오히려 어색하므로 쓰지 않는다.
 */
export const getPeekFacingTransform = (walkTransform: string | undefined) =>
  walkTransform && /scaleX\(\s*-1\s*\)/.test(walkTransform) ? 'scaleX(-1)' : 'none';

/** 알파 채널에서 실제 그림 영역을 찾는다. alpha는 RGBA 배열(4칸 간격). */
export const findOpaqueBounds = (
  data: ArrayLike<number>,
  width: number,
  height: number,
  threshold = 24,
): { x: number; y: number; width: number; height: number } | null => {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

/** 그림 영역을 cols×rows 칸으로 나눠 칸마다 선 비율을 구한다. */
export const getMassGrid = (
  data: ArrayLike<number>,
  width: number,
  bounds: { x: number; y: number; width: number; height: number },
  cols = 16,
  rows = 16,
  threshold = 24,
): PeekMassGrid => {
  const counts = new Array<number>(cols * rows).fill(0);
  let total = 0;
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    const row = Math.min(rows - 1, Math.floor(((y - bounds.y) / bounds.height) * rows));
    const offset = y * width * 4;
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      if (data[offset + x * 4 + 3] > threshold) {
        const col = Math.min(cols - 1, Math.floor(((x - bounds.x) / bounds.width) * cols));
        counts[row * cols + col] += 1;
        total += 1;
      }
    }
  }
  return { cols, rows, cells: counts.map((count) => (total > 0 ? count / total : 0)) };
};
