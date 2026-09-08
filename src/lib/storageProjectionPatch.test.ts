import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStorageProjectionPatch, type StorageProjectionPatch } from './storageProjectionPatch.js';
import { StorageResponseOrder } from './storageResponseOrder.js';
import { splitStorageState } from './storageV2Codec.js';

const at = (seconds: number) => `2026-09-08T02:00:${String(seconds).padStart(2, '0')}.000001Z`;
const patch = (value: Record<string, unknown>, revision: number, complete = false): StorageProjectionPatch => {
  const encoded = splitStorageState(value);
  return parseStorageProjectionPatch({ ...encoded, complete, deletedKeys: [], historyStudents: encoded.wallets.map(row => row.student_number),
    revisions: Object.fromEntries([...encoded.resources.map(row => [row.resource_key, revision]), ...encoded.wallets.map(row => [`wallet:${row.student_number}`, revision])]) });
};
const accept = (order: StorageResponseOrder, value: StorageProjectionPatch, seconds: number, actor = '17') => order.accept(order.capture(actor), {
  value: { deliberatelyNotAFullSnapshot: true }, updatedAt: at(seconds), storagePatch: value, scope: 'student',
}, actor).value;

test('다른 기능의 늦은 partial도 revision으로 병합하고 부분 value로 기존 화면 상태를 지우지 않는다', () => {
  const order = new StorageResponseOrder();
  accept(order, patch({ studentLife: { letters: [{ id: 'a', studentNumber: 17 }], books: [{ id: 'b' }] }, profile: 'old' }, 1, true), 1);
  accept(order, patch({ profile: 'new' }, 3), 3);
  const result = accept(order, patch({ studentLife: { letters: [{ id: 'a', studentNumber: 17, content: 'edited' }] } }, 2), 2);
  assert.deepEqual(result, { profile: 'new', studentLife: { letters: [{ id: 'a', studentNumber: 17, content: 'edited' }], books: [{ id: 'b' }] } });
  assert.equal(order.read(order.capture('17'), '17')?.updatedAt, at(3));
});

test('resource와 wallet revision이 낮은 응답은 더 늦게 도착해도 되돌리지 않는다', () => {
  const order = new StorageResponseOrder();
  const state = (balance: number, id: string) => ({ currencyBalances: { 17: balance }, currencyHistory: { 17: [{ id, studentNumber: 17 }] }, profile: id });
  accept(order, patch(state(334, 'paid'), 4, true), 4);
  assert.deepEqual(accept(order, patch(state(328, 'old'), 3), 3), state(334, 'paid'));
  const empty = { currencyBalances: { 17: 334 }, currencyHistory: { 17: [] } };
  assert.deepEqual(accept(order, patch(empty, 5), 5), { ...empty, profile: 'paid' });
});

test('늦은 full은 새로운 partial을 보존하면서 다른 기능을 채우고 이후 삭제는 과거 응답으로 부활하지 않는다', () => {
  const order = new StorageResponseOrder();
  accept(order, patch({ fresh: 'new', old: 'remove' }, 2), 20);
  assert.deepEqual(accept(order, patch({ fresh: 'old', another: 'loaded' }, 1, true), 10), { fresh: 'new', old: 'remove', another: 'loaded' });
  assert.deepEqual(accept(order, patch({ fresh: 'new' }, 3, true), 30), { fresh: 'new' });
  assert.deepEqual(accept(order, patch({ old: 'remove', unseenBefore: 'also gone' }, 2), 20), { fresh: 'new' });
});

test('tombstone 삭제 및 배열 fractional order를 그대로 보존한다', () => {
  const order = new StorageResponseOrder();
  const first = patch({ list: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, 1, true);
  accept(order, first, 1);
  const updated = patch({ list: [{ id: 'b' }, { id: 'c' }] }, 2);
  const resources = updated.resources.map(row => row.value.member === '@b' ? { ...row, value: { ...row.value, order: -0.5 } }
    : row.value.member === '@c' ? { ...row, value: { ...row.value, order: 2.25 } } : row);
  const deleted = parseStorageProjectionPatch({ ...updated, resources, deletedKeys: ['/list/@a'], revisions: { ...updated.revisions, '/list/@a': 2 } });
  assert.deepEqual(accept(order, deleted, 2), { list: [{ id: 'b' }, { id: 'c' }] });
  assert.deepEqual(accept(order, first, 1), { list: [{ id: 'b' }, { id: 'c' }] });
});

test('legacy full 응답과 혼용해도 현재 actor만 병합하며 이전 actor 데이터는 폐기한다', () => {
  const order = new StorageResponseOrder();
  const context = order.capture('17');
  order.accept(context, { value: { savedLegacy: 'retain' }, updatedAt: at(2) }, '17');
  assert.deepEqual(accept(order, patch({ newer: 'yes' }, 4), 4), { savedLegacy: 'retain', newer: 'yes' });
  assert.deepEqual(order.accept(context, { value: { oldLegacy: 'no' }, updatedAt: at(1) }, '17').value, { savedLegacy: 'retain', newer: 'yes' });
  assert.deepEqual(accept(order, patch({ own: 'student4' }, 1), 1, '4'), { own: 'student4' });
  assert.throws(() => order.accept(context, { value: {}, updatedAt: at(5), storagePatch: patch({ secret: true }, 5) }, '4'), /SESSION_CHANGED/);
});

test('손상 patch는 누락 부모·revision·history 소유자·중복 행을 기본값으로 바꾸지 않고 거절한다', () => {
  const valid = patch({ currencyBalances: { 17: 334 }, currencyHistory: { 17: [{ id: 'paid' }] }, nested: { value: true } }, 1);
  const invalid: unknown[] = [null, { ...valid, revisions: {} }, { ...valid, resources: valid.resources.filter(row => row.resource_key !== '/nested') },
    { ...valid, wallets: [] }, { ...valid, historyStudents: [] }, { ...valid, resources: [...valid.resources, valid.resources[0]] },
    { ...valid, deletedKeys: ['/nested'], revisions: { ...valid.revisions, '/nested': 2 } }, { ...valid, history: [{ ...valid.history[0], sort_order: NaN }] },
    { ...valid, historyStudents: [17, 17] }, { ...valid, complete: 'true' }, { ...valid, history: [], historyStudents: [], complete: true }];
  for (const value of invalid) assert.throws(() => parseStorageProjectionPatch(value), /STORAGE_INVALID_RESPONSE/);
});
