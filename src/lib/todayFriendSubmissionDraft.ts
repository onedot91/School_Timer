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

export const createTodayFriendSubmissionDraftStore = (
  store = createStudentSaveDraftStore(),
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
      ...('planningRevision' in value && typeof value.planningRevision === 'string' ? { planningRevision: value.planningRevision } : {}),
    };
  };

  const prepare = (mission: TodayFriendStudentMission, payload: TodayFriendPayload, submit: boolean) => {
    const existing = load(mission);
    if (existing) return existing;
    const parsedPayload = parseTodayFriendPayload(payload);
    if (!parsedPayload || parsedPayload.kind !== mission.genre) return null;
    store.save(scopeFor(mission), {
      payload: parsedPayload,
      submit,
      expectedRevision: mission.submission?.storageRevision ?? 0,
      ...(mission.planningRevision === undefined ? {} : { planningRevision: mission.planningRevision }),
    });
    return load(mission);
  };

  return {
    load,
    prepare,
    confirm: (mission: TodayFriendStudentMission, requestId: string) => store.confirm(scopeFor(mission), requestId),
  };
};
