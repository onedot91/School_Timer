import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleStorageState, splitStorageState, reconcileStorageResourceOrder, canonicalStorageJson } from './storageV2Codec.js';
test('storage projection preserves unknown fields, nulls, array order and raw historical entries', () => {
    const source = { version: 1, unknown: { empty: [], other: null }, currencyBalances: { '1': 335, '23': 0, metadata: 'preserved' }, currencyHistory: { '1': [{ id: 'legacy/1', studentNumber: 1, delta: 6, before: 0, after: 6, reason: 'weekly_mission', createdAt: '2026-01-01T00:00:00Z', extra: null }] }, studentLife: { letters: [{ id: 'b', createdAt: '2020', content: 'later position' }, { id: 'a', createdAt: '2026', content: 'earlier timestamp' }], unknown: [] }, studentEconomy: { '1': { owned: ['x'], opaque: null } }, auctionBids: { first: { bidder: 1, amount: 20 } } };
    const encoded = splitStorageState(source);
    assert.deepEqual(assembleStorageState(encoded), source);
    assert.equal(encoded.history.length, 1);
    assert.equal(encoded.wallets.length, 2);
    assert.equal(encoded.resources.find(r => r.resource_key === '/auctionBids/first')?.value.kind, 'value');
    assert.equal(encoded.resources.find(r => r.resource_key === '/studentEconomy/1')?.owner_number, 1);
});
test('letter insertion changes only the new record with fractional order', () => {
    const old = splitStorageState({ studentLife: { letters: [{ id: 'a' }, { id: 'b' }] } }).resources;
    const next = splitStorageState({ studentLife: { letters: [{ id: 'new' }, { id: 'a' }, { id: 'b' }] } }).resources;
    const reconciled = reconcileStorageResourceOrder(old, next);
    for (const row of old)
        assert.deepEqual(reconciled.find(r => r.resource_key === row.resource_key), row);
    assert.deepEqual(assembleStorageState({ resources: reconciled, wallets: [], history: [] }), { studentLife: { letters: [{ id: 'new' }, { id: 'a' }, { id: 'b' }] } });
});
test('storage projection preserves duplicate historical IDs and primitive arrays', () => {
    const raw = { currencyHistory: { '1': [{ id: 'same', delta: 1 }, { id: 'same', delta: 2 }, { id: 'same~duplicate:1', delta: 3 }] }, arr: [null, 'x', 'x', 1], empty: {} };
    assert.deepEqual(assembleStorageState(splitStorageState(raw)), raw);
});
test('canonical hashes distinguish array order and ignore object key order', () => {
    assert.equal(canonicalStorageJson({ z: 1, a: { b: 2, a: 3 } }), canonicalStorageJson({ a: { a: 3, b: 2 }, z: 1 }));
    assert.notEqual(canonicalStorageJson([1, 2]), canonicalStorageJson([2, 1]));
    assert.throws(() => canonicalStorageJson(undefined), /STORAGE_INVALID_JSON/);
});
