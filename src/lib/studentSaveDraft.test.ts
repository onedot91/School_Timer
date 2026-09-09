import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudentSaveDraftStore } from './studentSaveDraft.js';

const scope = { studentNumber: 17, feature: 'mail', entityId: 'compose' };
const storageFixture = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

test('동일 저장을 다시 시작하면 새로고침 뒤에도 요청 ID와 내용을 유지한다', () => {
  // Given
  const storage = storageFixture();
  const first = createStudentSaveDraftStore({ storage, createRequestId: () => 'request-1' });
  const saved = first.save(scope, { title: '초안', body: '내 내용' });
  assert.equal(saved.status, 'saved');
  // When
  const reloaded = createStudentSaveDraftStore({ storage, createRequestId: () => 'request-2' });
  const retry = reloaded.save(scope, { body: '내 내용', title: '초안' });
  // Then
  assert.equal(retry.status, 'existing');
  assert.equal(reloaded.load(scope)?.draft.requestId, 'request-1');
  assert.equal(reloaded.load(scope)?.durable, true);
});

test('학생·기능·대상별 초안은 섞이지 않고 실패나 조회로 삭제되지 않는다', () => {
  const store = createStudentSaveDraftStore({ storage: storageFixture() });
  store.save(scope, { body: '17번 초안' });
  for (const other of [
    { ...scope, studentNumber: 0 }, { ...scope, studentNumber: 2 },
    { ...scope, feature: 'quiz' }, { ...scope, entityId: 'another' },
  ]) assert.equal(store.load(other), null);
  assert.deepEqual(store.load(scope)?.draft.payload, { body: '17번 초안' });
  assert.equal(store.confirm(scope, 'different-request'), false);
  assert.notEqual(store.load(scope), null);
});

test('미확인 요청의 내용을 바꾸지 않고 명시적으로 버린 뒤 새 요청을 만든다', () => {
  const storage = storageFixture();
  let sequence = 0;
  const store = createStudentSaveDraftStore({ storage, createRequestId: () => `request-${++sequence}` });
  store.save(scope, { delta: 6 });
  assert.equal(store.save(scope, { delta: 7 }).status, 'payload_changed');
  assert.deepEqual(store.load(scope)?.draft.payload, { delta: 6 });
  assert.equal(store.remove(scope, 'request-1'), true);
  store.save(scope, { delta: 7 });
  assert.equal(store.confirm(scope, 'request-1'), false);
  assert.equal(store.confirm(scope, 'request-2'), true);
  assert.equal(store.load(scope), null);
});

test('깨진 JSON과 범위가 다른 저장값은 반환하지 않는다', () => {
  const storage = storageFixture();
  const store = createStudentSaveDraftStore({ storage });
  store.save(scope, { body: '내용' });
  const key = [...storage.values.keys()][0];
  assert.ok(key);
  storage.values.set(key, '{broken');
  assert.equal(createStudentSaveDraftStore({ storage }).load(scope), null);
  storage.values.set(key, JSON.stringify({ version: 1, scope: { ...scope, studentNumber: 2 }, requestId: 'id', createdAt: new Date().toISOString(), payload: {} }));
  assert.equal(createStudentSaveDraftStore({ storage }).load(scope), null);
  assert.equal(store.save({ ...scope, studentNumber: 24 }, {}).status, 'invalid');
  assert.equal(store.save(scope, { unsupported: undefined }).status, 'invalid');
});

test('기기 저장소 오류에도 현재 화면의 요청 ID와 초안을 보존한다', () => {
  const unavailable = () => { throw new Error('storage unavailable'); };
  const store = createStudentSaveDraftStore({
    storage: { getItem: unavailable, setItem: unavailable, removeItem: unavailable },
    createRequestId: () => 'request-offline',
  });
  const result = store.save(scope, { text: '내용' });
  assert.equal(result.status, 'saved');
  assert.equal(store.load(scope)?.durable, false);
  assert.equal(store.save(scope, { text: '내용' }).status, 'existing');
  assert.equal(store.load(scope)?.draft.requestId, 'request-offline');
  assert.equal(store.confirm(scope, 'request-offline'), false);
});

test('다른 탭에서 확인한 요청을 메모리에서 되살리지 않고 새 요청은 이전 응답으로 지우지 않는다', () => {
  const storage = storageFixture();
  const firstTab = createStudentSaveDraftStore({ storage, createRequestId: () => 'first' });
  const secondTab = createStudentSaveDraftStore({ storage, createRequestId: () => 'second' });
  firstTab.save(scope, { text: '첫 요청' });
  assert.equal(secondTab.confirm(scope, 'first'), true);
  assert.equal(firstTab.load(scope), null);
  secondTab.save(scope, { text: '새 요청' });
  assert.equal(firstTab.confirm(scope, 'first'), false);
  assert.equal(firstTab.load(scope)?.draft.requestId, 'second');
});

test('저장 후 일시적인 조회 오류가 생겨도 이미 만든 요청 ID를 재사용한다', () => {
  const storage = storageFixture();
  let blocked = false;
  const store = createStudentSaveDraftStore({ storage: {
    ...storage,
    getItem: (key) => {
      if (blocked) throw new Error('storage unavailable');
      return storage.getItem(key);
    },
  } });
  store.save(scope, { text: '내용' });
  const requestId = store.load(scope)?.draft.requestId;
  blocked = true;
  store.save(scope, { text: '내용' });
  assert.equal(store.load(scope)?.draft.requestId, requestId);
  assert.equal(store.load(scope)?.durable, false);
});

test('편집 초안 교체는 삭제하지 않고 실패한 최신 쓰기를 오래된 저장값보다 우선한다', () => {
  const storage = storageFixture();
  let writingFails = false;
  let removals = 0;
  let sequence = 0;
  const store = createStudentSaveDraftStore({
    storage: {
      ...storage,
      setItem(key, value) { if (writingFails) throw new Error('quota'); storage.setItem(key, value); },
      removeItem() { removals++; throw new Error('remove blocked'); },
    },
    createRequestId: () => `edit-${++sequence}`,
  });
  const first = store.replace(scope, { text: '첫 초안' });
  assert.notEqual(first.status, 'invalid');
  writingFails = true;
  const latest = store.replace(scope, { text: '새로운 입력' });
  assert.notEqual(latest.status, 'invalid');
  assert.equal(store.load(scope)?.durable, false);
  assert.deepEqual(store.load(scope)?.draft.payload, { text: '새로운 입력' });
  assert.equal(removals, 0);
  assert.equal(store.confirm(scope, 'edit-1'), false);
  assert.deepEqual(store.load(scope)?.draft.payload, { text: '새로운 입력' });
});

test('늦은 A 확인으로 B와 C 편집을 삭제하지 않는다', () => {
  let sequence = 0;
  const store = createStudentSaveDraftStore({ storage: storageFixture(), createRequestId: () => `version-${++sequence}` });
  const first = store.replace(scope, { body: 'A' });
  assert.notEqual(first.status, 'invalid');
  store.replace(scope, { body: 'B' });
  store.replace(scope, { body: 'C' });
  assert.equal(store.confirm(scope, 'version-1'), false);
  assert.equal(store.load(scope)?.draft.requestId, 'version-3');
  assert.deepEqual(store.load(scope)?.draft.payload, { body: 'C' });
});
