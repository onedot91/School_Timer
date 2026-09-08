import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStorageMutation, storagePayloadHash, parseStorageSnapshot, StorageRepositoryError } from './storageV2Repository.js';
import { splitStorageState } from '../lib/storageV2Codec.js';
test('unrelated letter inserts do not compare a shared collection revision', () => {
    const value = { studentLife: { letters: [{ id: 'a', content: 'existing' }] } };
    const encoded = splitStorageState(value);
    const mutation = buildStorageMutation({ snapshot: { value, updated_at: '2026-09-08T00:00:00Z', revisions: {}, resources: encoded.resources }, value: { studentLife: { letters: [{ id: 'b', content: 'new' }, ...value.studentLife.letters] } }, actorKey: 'student:1', requestId: 'r', action: 'student.send', payload: { content: 'new' }, result: { saved: true } });
    assert.deepEqual(mutation.p_expected, { '/studentLife/letters/@b': 0, '/studentLife/letters': 0, '/studentLife': 0, '': 0 });
    assert.equal(Array.isArray(mutation.p_resources) && mutation.p_resources.length, 1);
});
test('wallet changes include only new history and predicate revisions', () => {
    const old = { id: 'old', studentNumber: 1, delta: 2, before: 0, after: 2, reason: 'weekly_mission', createdAt: '2026-01-01T00:00:00Z' };
    const value = { currencyBalances: { '1': 10 }, currencyHistory: { '1': [old] } };
    const next = { currencyBalances: { '1': 16 }, currencyHistory: { '1': [{ id: 'new', studentNumber: 1, delta: 6, before: 10, after: 16, reason: 'weekly_mission', createdAt: '2026-09-08T00:00:00Z' }, old] } };
    const payload = buildStorageMutation({ snapshot: { value, updated_at: 'x', revisions: { 'wallet:1': 2, 'scope:auctionBids:all': 8 } }, value: next, actorKey: 'student:1', requestId: 'r', action: 'reward', payload: {}, result: {}, readKeys: ['scope:auctionBids:all'] });
    assert.deepEqual(payload.p_expected, { 'scope:auctionBids:all': 8, 'wallet:1': 2 });
    assert.equal(Array.isArray(payload.p_ledger) && payload.p_ledger.length, 1);
});
test('snapshot parser rejects untyped or missing protocol records', () => {
    assert.throws(() => parseStorageSnapshot({}), StorageRepositoryError);
    const encoded = splitStorageState({ currencyBalances: { '1': 5 }, currencyHistory: { '1': [] } });
    assert.deepEqual(parseStorageSnapshot({ ...encoded, revisions: {}, updated_at: '2026-09-08T00:00:00Z' }).value, { currencyBalances: { '1': 5 }, currencyHistory: { '1': [] } });
    assert.equal(storagePayloadHash('send', { a: 1, b: 2 }), storagePayloadHash('send', { b: 2, a: 1 }));
    assert.notEqual(storagePayloadHash('send', { a: 1 }), storagePayloadHash('delete', { a: 1 }));
});
