// Shared by the browser and the storage command handler: no browser access at module load.

/** Drawings are stored in a square logical canvas, independent of the device's pixel size. */
export const CIRCLE_DRAWING_CANVAS_SIZE = 400;
export const CIRCLE_DRAWING_MAX_POINTS = 600;
export const CIRCLE_DRAWING_REWARD_TIERS = [
  { minimumScore: 90, reward: 20 },
  { minimumScore: 75, reward: 15 },
  { minimumScore: 60, reward: 10 },
  { minimumScore: 0, reward: 5 },
] as const;
export const CIRCLE_DRAWING_REWARDS = CIRCLE_DRAWING_REWARD_TIERS.map(({ reward }) => reward);
export const STUDENT_CIRCLE_DRAWING_STORAGE_KEY = 'school-timer-student-circle-drawing-v1';

/** A drawing must go at least this far around the centre before it can be scored. */
export const CIRCLE_DRAWING_MINIMUM_COVERAGE = 0.5;
const ANGLE_BINS = 36;
const RESAMPLE_STEP = 3;
/** Mean radial error (relative to the radius) at which the accuracy part reaches 0. */
const ZERO_ACCURACY_ERROR = 0.3;
const FULL_COVERAGE = 0.95;

export type CircleDrawingPoint = readonly [number, number];
export type CircleDrawingChallenge = {
  readonly centerX: number;
  readonly centerY: number;
  readonly radius: number;
};
export type CircleDrawingScore = {
  readonly score: number;
  /** 0..1, how close the line stayed to the true circle. */
  readonly accuracy: number;
  /** 0..1, how much of the way around the centre the line went. */
  readonly coverage: number;
};
export type CircleDrawingEntry = {
  readonly score: number;
  /** Encoded as "x,y;x,y" so one drawing stays one stored value. */
  readonly points: string;
  readonly submittedAt: string;
};
export type StudentCircleDrawingProgress = Record<string, CircleDrawingEntry>;

export const getCircleDrawingDateKey = (date = new Date()): string => (
  new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
);

export const getCircleDrawingProgressKey = (studentNumber: number, dateKey: string) => `${studentNumber}:${dateKey}`;
export const getCircleDrawingRewardId = (studentNumber: number, dateKey: string) => (
  `circle-drawing-reward-${studentNumber}-${dateKey}`
);

const hash = (text: string): number => {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
};

/** Every student gets a different, fixed circle each day, so the server can rescore the same drawing. */
export const getCircleDrawingChallenge = (studentNumber: number, dateKey: string): CircleDrawingChallenge => {
  const seed = hash(`circle:${studentNumber}:${dateKey}`);
  const middle = CIRCLE_DRAWING_CANVAS_SIZE / 2;
  return {
    centerX: middle - 24 + (seed % 49),
    centerY: middle - 24 + (Math.floor(seed / 49) % 49),
    radius: 90 + (Math.floor(seed / 2401) % 61),
  };
};

export const getCircleDrawingReward = (score: number): number => (
  CIRCLE_DRAWING_REWARD_TIERS.find(({ minimumScore }) => score >= minimumScore)?.reward ?? 5
);

const isCoordinate = (value: number) => Number.isFinite(value) && value >= 0 && value <= CIRCLE_DRAWING_CANVAS_SIZE;

export const encodeCircleDrawingPoints = (points: readonly CircleDrawingPoint[]): string => (
  points.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(';')
);

export const decodeCircleDrawingPoints = (value: unknown): CircleDrawingPoint[] | null => {
  if (typeof value !== 'string' || value.length === 0 || value.length > CIRCLE_DRAWING_MAX_POINTS * 8) return null;
  const parts = value.split(';');
  if (parts.length > CIRCLE_DRAWING_MAX_POINTS) return null;
  const points: CircleDrawingPoint[] = [];
  for (const part of parts) {
    const match = /^(\d{1,3}),(\d{1,3})$/.exec(part);
    if (!match) return null;
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (!isCoordinate(x) || !isCoordinate(y)) return null;
    points.push([x, y]);
  }
  return points;
};

/** Keeps at most `limit` points while preserving the first and last one. */
export const thinCircleDrawingPoints = (
  points: readonly CircleDrawingPoint[],
  limit = CIRCLE_DRAWING_MAX_POINTS,
): CircleDrawingPoint[] => {
  if (points.length <= limit) return [...points];
  const step = (points.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, index) => points[Math.round(index * step)]);
};

/** Evenly spaced samples, so slow parts of a stroke don't count more than fast parts. */
const resample = (points: readonly CircleDrawingPoint[]): CircleDrawingPoint[] => {
  if (points.length === 0) return [];
  const samples: CircleDrawingPoint[] = [points[0]];
  let [previousX, previousY] = points[0];
  let carried = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [x, y] = points[index];
    let segment = Math.hypot(x - previousX, y - previousY);
    let startX = previousX;
    let startY = previousY;
    while (carried + segment >= RESAMPLE_STEP) {
      const ratio = (RESAMPLE_STEP - carried) / segment;
      startX += (x - startX) * ratio;
      startY += (y - startY) * ratio;
      samples.push([startX, startY]);
      segment = Math.hypot(x - startX, y - startY);
      carried = 0;
    }
    carried += segment;
    previousX = x;
    previousY = y;
  }
  return samples;
};

/**
 * Scores how well one stroke matches the given circle, out of 100.
 * Returns null when the stroke doesn't go far enough around the centre to count as a circle.
 */
export const scoreCircleDrawing = (
  points: readonly CircleDrawingPoint[],
  challenge: CircleDrawingChallenge,
): CircleDrawingScore | null => {
  const samples = resample(points);
  if (samples.length < 8) return null;
  const { centerX, centerY, radius } = challenge;
  const bins = new Set<number>();
  let errorTotal = 0;
  for (const [x, y] of samples) {
    const distance = Math.hypot(x - centerX, y - centerY);
    const error = Math.abs(distance - radius) / radius;
    errorTotal += Math.min(error, 1);
    // Points far off the circle don't prove the line went around it.
    if (error < 0.5) {
      const angle = Math.atan2(y - centerY, x - centerX);
      bins.add(Math.min(ANGLE_BINS - 1, Math.floor(((angle + Math.PI) / (2 * Math.PI)) * ANGLE_BINS)));
    }
  }
  const coverage = bins.size / ANGLE_BINS;
  if (coverage < CIRCLE_DRAWING_MINIMUM_COVERAGE) return null;
  const meanError = errorTotal / samples.length;
  const accuracy = Math.max(0, 1 - meanError / ZERO_ACCURACY_ERROR);
  const coverageFactor = Math.min(1, coverage / FULL_COVERAGE) ** 2;
  return {
    score: Math.max(0, Math.min(100, Math.round(100 * accuracy * coverageFactor))),
    accuracy,
    coverage,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export const normalizeStudentCircleDrawingProgress = (value: unknown): StudentCircleDrawingProgress => {
  if (!isRecord(value)) return {};
  const progress: StudentCircleDrawingProgress = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!/^\d{1,2}:\d{4}-\d{2}-\d{2}$/.test(key) || !isRecord(raw)) continue;
    const { score, points, submittedAt } = raw;
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 100) continue;
    if (typeof points !== 'string' || decodeCircleDrawingPoints(points) === null) continue;
    if (typeof submittedAt !== 'string' || !Number.isFinite(Date.parse(submittedAt))) continue;
    progress[key] = { score, points, submittedAt };
  }
  return progress;
};

export const getStudentCircleDrawingProgressFromSettings = (value: unknown): StudentCircleDrawingProgress => (
  normalizeStudentCircleDrawingProgress(isRecord(value) ? value.studentCircleDrawing : undefined)
);

export const loadStoredStudentCircleDrawingProgress = (): StudentCircleDrawingProgress => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(STUDENT_CIRCLE_DRAWING_STORAGE_KEY);
    return normalizeStudentCircleDrawingProgress(stored ? JSON.parse(stored) : undefined);
  } catch {
    return {};
  }
};

export const storeStudentCircleDrawingProgress = (progress: StudentCircleDrawingProgress): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STUDENT_CIRCLE_DRAWING_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
};
