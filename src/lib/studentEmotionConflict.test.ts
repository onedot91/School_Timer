import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudentEmotionConflictSnapshot } from './studentEmotionConflict.js';
import { createStudentEmotionEntry, getKoreanLocalDateKey } from './studentEmotion.js';
import { executeStudentStorageCommand, loadStudentStorageFormDraft, rebaseStudentStorageFormDraft, saveStudentStorageFormDraft } from './studentStorageCommand.js';
import { isStorageRecord } from './storageV2Codec.js';

test('충돌 화면의 학생·날짜·revision은 이후 최신 캐시 변경과 분리한다', () => {
  const date = new Date('2026-09-09T01:00:00Z');
  const entry = createStudentEmotionEntry(7, 'happy', '현재 기록', date, null, '잘했어');
  const other = createStudentEmotionEntry(8, 'calm', '다른 학생', date, null, '괜찮아');
  const revisions = { 'scope:studentEmotionHistory:7': 3, 'scope:studentEmotionHistory:8': 20 };
  const snapshot = createStudentEmotionConflictSnapshot(7, entry.dateKey, { 7: [entry], 8: [other] }, revisions);
  assert.ok(snapshot);
  entry.comment = '다음 변경';
  revisions['scope:studentEmotionHistory:7'] = 4;
  assert.equal(snapshot.latestEntry?.comment, '현재 기록');
  assert.deepEqual(snapshot.expectedRevisions, { 'scope:studentEmotionHistory:7': 3 });
  assert.equal(createStudentEmotionConflictSnapshot(7, '2026-09-10', { 7: [entry] }, revisions)?.latestEntry, null);
  assert.equal(createStudentEmotionConflictSnapshot(7, entry.dateKey, { 7: [entry] }, {}), null);
});

test('감정409 뒤 명시적으로 확인한 revision만 재전송하며 재충돌과 새 입력을 보존한다', async () => {
  const previousFetch = globalThis.fetch;
  const student = 20, action = 'student.emotion.save', dateKey = getKoreanLocalDateKey();
  const key = 'scope:studentEmotionHistory:20';
  const inputA = { emotionId: 'happy', comment: '처음 입력', selfMessage: '잘했어', dateKey };
  const inputC = { ...inputA, comment: '내 최신 입력' };
  const inputD = { ...inputA, comment: '응답 기다리며 새 입력' };
  const bodies: Record<string, unknown>[] = [];
  let serverRevision = 3;
  let release: (() => void) | undefined, started: (() => void) | undefined;
  const responseGate = new Promise<void>(resolve => { release = resolve; });
  const requestStarted = new Promise<void>(resolve => { started = resolve; });
  globalThis.fetch = async (_url, init) => {
    if (init?.method !== 'POST') return Response.json({ status: 'unknown' });
    const body: unknown = JSON.parse(String(init.body));
    assert.ok(isStorageRecord(body) && isStorageRecord(body.payload));
    bodies.push(body);
    const revisions = body.payload.expectedRevisions;
    if (!isStorageRecord(revisions) || revisions[key] !== serverRevision) {
      return Response.json({ error: 'STUDENT_EDIT_CONFLICT' }, { status: 409 });
    }
    started?.();
    await responseGate;
    return Response.json({ value: { studentEmotionHistory: {} }, updatedAt: new Date().toISOString(), result: { applied: true } });
  };
  try {
    saveStudentStorageFormDraft(student, action, { ...inputA, expectedRevisions: { [key]: 0 } }, dateKey);
    await assert.rejects(executeStudentStorageCommand(student, action, inputA, dateKey), /STUDENT_EDIT_CONFLICT/);
    saveStudentStorageFormDraft(student, action, inputC, dateKey);
    assert.deepEqual(loadStudentStorageFormDraft(student, action, dateKey).expectedRevisions, { [key]: 0 });
    const displayed = createStudentEmotionConflictSnapshot(student, dateKey, {}, { [key]: serverRevision });
    assert.ok(displayed);
    serverRevision = 4;
    rebaseStudentStorageFormDraft(student, action, inputC, { ...displayed.expectedRevisions }, dateKey);
    await assert.rejects(executeStudentStorageCommand(student, action, inputC, dateKey), /STUDENT_EDIT_CONFLICT/);
    assert.equal(loadStudentStorageFormDraft(student, action, dateKey).comment, inputC.comment);
    assert.ok(isStorageRecord(bodies[1].payload));
    assert.deepEqual(bodies[1].payload.expectedRevisions, { [key]: 3 });
    const displayedAgain = createStudentEmotionConflictSnapshot(student, dateKey, {}, { [key]: serverRevision });
    assert.ok(displayedAgain);
    rebaseStudentStorageFormDraft(student, action, inputC, { ...displayedAgain.expectedRevisions }, dateKey);
    const saving = executeStudentStorageCommand(student, action, inputC, dateKey);
    await requestStarted;
    saveStudentStorageFormDraft(student, action, inputD, dateKey);
    release?.();
    await saving;
    assert.equal(loadStudentStorageFormDraft(student, action, dateKey).comment, inputD.comment);
    assert.equal(new Set(bodies.map(body => body.requestId)).size, 3);
  } finally { release?.(); globalThis.fetch = previousFetch; }
});
