import { captureStorageResponseContext, isStorageResponseContextCurrent, StorageResponseActorChangedError, type StorageResponseContext } from './storageResponseOrder';
import type { TodayFriendState } from './todayFriendState';

// Only a short-lived display snapshot. Every load still verifies the server state.
export class TodayFriendTeacherCache {
  private generation = 0;
  private snapshot: { dateKey: string; state: TodayFriendState; context: StorageResponseContext; expiresAt: number } | null = null;
  private pending = new Map<string, { context: StorageResponseContext; promise: Promise<TodayFriendState> }>();

  peek(dateKey: string): TodayFriendState | null {
    const snapshot = this.snapshot;
    if (!snapshot || !isStorageResponseContextCurrent(snapshot.context) || snapshot.expiresAt <= Date.now()) {
      this.snapshot = null;
      return null;
    }
    return snapshot.dateKey === dateKey ? snapshot.state : null;
  }

  invalidate(): void {
    this.generation += 1;
    this.snapshot = null;
    this.pending.clear();
  }

  async load(dateKey: string, loader: () => Promise<TodayFriendState>): Promise<TodayFriendState> {
    const context = captureStorageResponseContext();
    const existing = this.pending.get(dateKey);
    if (context.actor === '0' && existing && isStorageResponseContextCurrent(existing.context)) return existing.promise;
    const generation = this.generation;
    const promise = loader().then(state => {
      if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
      if (context.actor === '0' && generation === this.generation) {
        this.snapshot = { dateKey, state, context, expiresAt: Date.now() + 60_000 };
      }
      return state;
    });
    this.pending.set(dateKey, { context, promise });
    try { return await promise; }
    finally { if (this.pending.get(dateKey)?.promise === promise) this.pending.delete(dateKey); }
  }
}
