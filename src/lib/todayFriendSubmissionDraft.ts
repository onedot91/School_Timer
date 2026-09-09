import { parseTodayFriendPayload } from './todayFriendCodec';
import { createStudentSaveDraftStore } from './studentSaveDraft';
import type { TodayFriendPayload, TodayFriendSubmission } from './todayFriend';
import type { TodayFriendStudentMission } from './todayFriendState';

export interface TodayFriendPendingSubmission {
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly payload: TodayFriendPayload;
  readonly submit: boolean;
  readonly planningRevision?: TodayFriendStudentMission['planningRevision'];
  readonly expectedStudentNumber: number | null;
}

export const selectLatestTodayFriendSubmission = (
  latest: TodayFriendSubmission | null,
  confirmed: TodayFriendSubmission,
): TodayFriendSubmission => (
  latest?.id === confirmed.id && latest.storageRevision !== undefined && confirmed.storageRevision !== undefined
    && latest.storageRevision > confirmed.storageRevision ? latest : confirmed
);

const scopeFor = (mission: TodayFriendStudentMission) => ({
  studentNumber: mission.studentNumber,
  feature: 'todayFriend',
  entityId: JSON.stringify([mission.dateKey, mission.partnerNumber, mission.genre, mission.question]),
});

const defaultStore = createStudentSaveDraftStore();

export const createTodayFriendSubmissionDraftStore = (
  store = defaultStore,
) => {
  const load = (mission: TodayFriendStudentMission): TodayFriendPendingSubmission | null => {
    const saved = store.load(scopeFor(mission));
    const value = saved?.draft.payload;
    if (!saved || !value || typeof value !== 'object' || Array.isArray(value)
      || !('payload' in value) || !('expectedRevision' in value) || !('submit' in value)
      || typeof value.expectedRevision !== 'number' || !Number.isInteger(value.expectedRevision)
      || value.expectedRevision < 0 || typeof value.submit !== 'boolean'
      || ('planningRevision' in value && typeof value.planningRevision !== 'string')) return null;
    const payload = parseTodayFriendPayload(value.payload);
    if (!payload || payload.kind !== mission.genre) return null;
    return {
      requestId: saved.draft.requestId, expectedRevision: value.expectedRevision, payload, submit: value.submit,
      expectedStudentNumber: 'expectedStudentNumber' in value && value.expectedStudentNumber === mission.studentNumber ? mission.studentNumber : null,
      ...('planningRevision' in value && typeof value.planningRevision === 'string' ? { planningRevision: value.planningRevision } : {}),
    };
  };

  const prepare = async (mission: TodayFriendStudentMission, payload: TodayFriendPayload, submit: boolean) => {
    await store.ready();
    const existing = load(mission);
    if (existing) return existing;
    const parsedPayload = parseTodayFriendPayload(payload);
    if (!parsedPayload || parsedPayload.kind !== mission.genre) return null;
    await store.saveDurable(scopeFor(mission), {
      payload: parsedPayload,
      submit,
      expectedStudentNumber: mission.studentNumber,
      expectedRevision: mission.submission?.storageRevision ?? 0,
      ...(mission.planningRevision === undefined ? {} : { planningRevision: mission.planningRevision }),
    });
    return load(mission);
  };

  return {
    load,
    prepare,
    ready: store.ready,
    list: async (actor: number) => {
      await store.ready();
      return store.list(actor).flatMap((draft) => {
        if (draft.scope.feature !== 'todayFriend') return [];
        try {
          const identity: unknown = JSON.parse(draft.scope.entityId);
          if (!Array.isArray(identity) || identity.length !== 4 || typeof identity[0] !== 'string' || typeof identity[1] !== 'number'
            || !['interview', 'commonality', 'compliment', 'emotion', 'recommendation'].includes(identity[2])
            || (identity[3] !== null && typeof identity[3] !== 'string')) return [];
          const mission: TodayFriendStudentMission = { dateKey: identity[0], studentNumber: actor, partnerNumber: identity[1], genre: identity[2], question: identity[3], submission: null };
          const pending = load(mission);
          return pending ? [{ draft, mission, pending }] : [];
        } catch { return []; }
      });
    },
    confirm: (mission: TodayFriendStudentMission, requestId: string) => store.confirmDurable(scopeFor(mission), requestId),
  };
};
