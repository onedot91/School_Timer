import { StorageProjectionPatchCache, type StorageProjectionPatch } from './storageProjectionPatch.js';

/** A projection belongs to the selected actor and the server snapshot that produced it. */
export interface StorageResponseContext {
  readonly actor: string | null;
  readonly generation: number;
}
export interface StorageProjection {
  readonly value: Record<string, unknown>;
  readonly updatedAt: string;
  readonly scope?: 'full' | 'student';
  readonly storagePatch?: StorageProjectionPatch;
}
export class StorageResponseActorChangedError extends Error {
  readonly name = 'StorageResponseActorChangedError';
  constructor() { super('SESSION_CHANGED'); }
}

export const compareStorageTimestamps = (left: string, right: string): number => {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) throw new Error('STORAGE_INVALID_RESPONSE');
  if (leftTime !== rightTime) return leftTime < rightTime ? -1 : 1;
  // PostgreSQL keeps microseconds; Date.parse alone would collapse distinct commits in one millisecond.
  const fraction = (value: string) => /\.(\d+)(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.exec(value)?.[1].padEnd(9, '0') ?? '000000000';
  const leftFraction = fraction(left);
  const rightFraction = fraction(right);
  return leftFraction < rightFraction ? -1 : leftFraction > rightFraction ? 1 : 0;
};

export class StorageResponseOrder {
  private actor: string | null | undefined;
  private generation = 0;
  private latest: StorageProjection | null = null;
  private patches: StorageProjectionPatchCache | null = null;

  capture(actor: string | null): StorageResponseContext {
    if (this.actor !== actor) {
      this.actor = actor;
      this.generation += 1;
      this.latest = null;
      this.patches = null;
    }
    return { actor, generation: this.generation };
  }

  current(context: StorageResponseContext, actor: string | null): boolean {
    const current = this.capture(actor);
    return current.actor === context.actor && current.generation === context.generation;
  }

  read(context: StorageResponseContext, actor: string | null): StorageProjection | null {
    if (!this.current(context, actor)) throw new StorageResponseActorChangedError();
    return this.latest;
  }

  accept(context: StorageResponseContext, projection: StorageProjection, actor: string | null): StorageProjection {
    if (!this.current(context, actor)) throw new StorageResponseActorChangedError();
    // Without an actor identifier, never reuse a previous person's projection.
    if (actor === null) return projection.storagePatch
      ? { value: new StorageProjectionPatchCache(compareStorageTimestamps).apply(projection.storagePatch, projection.updatedAt), updatedAt: projection.updatedAt, scope: projection.scope }
      : projection;
    if (projection.storagePatch) {
      if (!this.patches) {
        this.patches = new StorageProjectionPatchCache(compareStorageTimestamps);
        if (this.latest) this.patches.seedLegacy(this.latest.value, this.latest.updatedAt);
      }
      const value = this.patches.apply(projection.storagePatch, projection.updatedAt);
      const updatedAt = this.latest && compareStorageTimestamps(projection.updatedAt, this.latest.updatedAt) < 0 ? this.latest.updatedAt : projection.updatedAt;
      this.latest = { value, updatedAt, scope: projection.scope ?? this.latest?.scope };
      return this.latest;
    }
    if (this.latest && compareStorageTimestamps(projection.updatedAt, this.latest.updatedAt) < 0) return this.latest;
    this.latest = projection;
    this.patches = null;
    return projection;
  }
}

const responses = new StorageResponseOrder();
const readActor = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('school-timer-entry-number-v1');
    return raw !== null && /^(?:[0-9]|1[0-9]|2[0-3])$/.test(raw) ? raw : null;
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
};
export const captureStorageResponseContext = (): StorageResponseContext => responses.capture(readActor());
export const isStorageResponseContextCurrent = (context: StorageResponseContext): boolean => responses.current(context, readActor());
export const acceptStorageProjection = (context: StorageResponseContext, projection: StorageProjection): StorageProjection => responses.accept(context, projection, readActor());
export const readLatestStorageProjection = (context: StorageResponseContext): StorageProjection | null => responses.read(context, readActor());
