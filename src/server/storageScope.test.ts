import assert from 'node:assert/strict';
import test from 'node:test';
import { splitStorageState } from '../lib/storageV2Codec.js';
import { parseStorageScope, storageScopeRevisionKeys, StorageScopeError, type StorageScope } from './storageScope.js';
import { buildScopedStorageMutation, parseScopedStorageSnapshot, type ScopedStorageSnapshot, type StorageSnapshot } from './storageV2Repository.js';

type RequireFalse<T extends false> = T;
type ScopedCannotBeUsedAsFull = RequireFalse<ScopedStorageSnapshot extends StorageSnapshot ? true : false>;
const typeBoundary: ScopedCannotBeUsedAsFull = false;
assert.equal(typeBoundary, false);

const petScope: StorageScope = { resources: [{ path: '/studentPets', students: [17] }], wallets: [17], history: [17], writeResources: [{ path: '/studentPets', students: [17] }], writeWallets: [17] };
const snapshot = (value: Record<string, unknown>, scope = petScope): ScopedStorageSnapshot => {
  const encoded = splitStorageState(value);
  return parseScopedStorageSnapshot({ ...encoded, kind: 'scoped', scope, deletedKeys: [], orderingBounds: {}, updated_at: '2026-09-08T02:00:00Z', revisions: Object.fromEntries(encoded.resources.map(resource => [resource.resource_key, 1])) });
};
const mutation = (before: ScopedStorageSnapshot, value: Record<string, unknown>) => buildScopedStorageMutation({ snapshot: before, value, actorKey: 'student:17', requestId: 'test-request-17', action: 'student.pet.name', payload: { name: 'fixture' }, result: null });

test('scope parser bounds selectors and keeps writes inside explicitly read scope', () => {
  assert.deepEqual(parseStorageScope(petScope), petScope);
  assert.throws(() => parseStorageScope({ ...petScope, writeWallets: [4] }), StorageScopeError);
  assert.throws(() => parseStorageScope({ ...petScope, writeResources: [{ path: '/studentPets', students: [4] }] }), StorageScopeError);
  assert.throws(() => parseStorageScope({ ...petScope, resources: [{ path: '/' }] }), StorageScopeError);
  assert.throws(() => parseStorageScope({ ...petScope, resources: [{ path: '/studentPets', mail: { actor: 17, direction: 'participant' } }] }), StorageScopeError);
  assert.ok(!storageScopeRevisionKeys(petScope).includes('scope:studentPets:all'));
});

test('partial normalizer defaults cannot create another student wallet or resource', () => {
  const value = { studentPets: { '17': { name: 'old' } }, currencyBalances: { '17': 100 }, currencyHistory: { '17': [] } };
  const before = snapshot(value);
  const result = mutation(before, { ...value, studentPets: { '17': { name: 'fixture' }, '4': { name: '' } }, currencyBalances: { '17': 100, '4': 0 }, studentLife: { letters: [], books: [] } });
  assert.deepEqual(result.p_wallets, []);
  const resources = result.p_resources;
  assert.ok(Array.isArray(resources));
  assert.deepEqual(resources.map(row => row.resource_key), ['/studentPets/17']);
  assert.equal(JSON.stringify(result).includes('/studentPets/4'), false);
});

test('known readonly rows cannot be modified or deleted by a scoped mutation', () => {
  const scope: StorageScope = { ...petScope, resources: [{ path: '/studentPets', students: [17, 4] }] };
  const value = { studentPets: { '17': { name: 'own' }, '4': { name: 'private fixture' } }, currencyBalances: { '17': 100 }, currencyHistory: { '17': [] } };
  const before = snapshot(value, scope);
  assert.throws(() => mutation(before, { ...value, studentPets: { '17': { name: 'own' }, '4': { name: 'changed' } } }), StorageScopeError);
  assert.throws(() => mutation(before, { ...value, studentPets: { '17': { name: 'own' } } }), StorageScopeError);
});

test('scoped response parser rejects another student data beyond coverage', () => {
  assert.throws(() => snapshot({ studentPets: { '17': {}, '4': { name: 'not allowed' } } }), /STORAGE_INVALID_RESPONSE/);
});

test('mail append uses global order boundary without rewriting visible siblings', () => {
  const scope: StorageScope = { resources: [{ path: '/studentLife/letters', mail: { actor: 17, direction: 'participant' } }], wallets: [], history: [], writeResources: [{ path: '/studentLife/letters', mail: { actor: 17, direction: 'participant' } }], writeWallets: [] };
  const oldLetter = { id: 'existing', recipient: 17, senderStudentNumber: 4, content: 'fixture' };
  const raw = splitStorageState({ studentLife: { letters: [oldLetter] } });
  const resources = raw.resources.map(resource => resource.resource_key.endsWith('/@existing') ? { ...resource, value: { ...resource.value, order: 5 } } : resource);
  const before = parseScopedStorageSnapshot({ ...raw, resources, kind: 'scoped', scope, deletedKeys: [], orderingBounds: { '/studentLife/letters': { minimum: 0, maximum: 20 } }, updated_at: '2026-09-08T02:00:00Z', revisions: Object.fromEntries(resources.map(resource => [resource.resource_key, 1])) });
  const result = mutation(before, { studentLife: { letters: [oldLetter, { id: 'new', recipient: 4, senderStudentNumber: 17, content: 'new fixture' }] } });
  assert.ok(Array.isArray(result.p_resources));
  assert.equal(result.p_resources.length, 1);
  assert.equal(result.p_resources[0].value.order, 21);
  assert.ok(typeof result.p_expected === 'object' && result.p_expected !== null);
  assert.ok(!Object.hasOwn(result.p_expected, 'scope:studentLife:all'));
});

test('readonly empty containers cannot be explicitly removed', () => {
  const scope: StorageScope = { resources: [{ path: '/studentLife/books' }], wallets: [], history: [], writeResources: [], writeWallets: [] };
  const before = snapshot({ studentLife: { books: [] } }, scope);
  assert.throws(() => mutation(before, {}), StorageScopeError);
});

test('historical entries are never rewritten or reordered by scoped display normalization', () => {
  const history = [{ id: 'first', studentNumber: 17, delta: 6 }, { id: 'second', studentNumber: 17, delta: 2 }];
  const before = snapshot({ studentPets: { '17': {} }, currencyBalances: { '17': 100 }, currencyHistory: { '17': history } });
  const result = mutation(before, { ...before.value, currencyHistory: { '17': [{ ...history[1], delta: 900 }, history[0]] } });
  assert.deepEqual(result.p_ledger, []);
  assert.deepEqual(result.p_wallets, []);
});

test('scoped response keeps the containers of a cancelled stamp on a classmate story', () => {
  const scope: StorageScope = { resources: [{ path: '/studentLife/failureStories', students: [20] }], wallets: [20], history: [20],
    writeResources: [{ path: '/studentLife/failureStories', students: [20] }], writeWallets: [20] };
  const story = '/studentLife/failureStories/@synthetic-story-16';
  const containers = [
    { resource_key: '', category: 'root', owner_number: null, value: { kind: 'object', parentKey: null, member: '' } },
    { resource_key: '/studentLife', category: 'studentLife', owner_number: null, value: { kind: 'object', parentKey: '', member: 'studentLife' } },
    { resource_key: '/studentLife/failureStories', category: 'studentLife', owner_number: null, value: { kind: 'array', parentKey: '/studentLife', member: 'failureStories' } },
    { resource_key: story, category: 'studentLife', owner_number: 16, value: { kind: 'object', parentKey: '/studentLife/failureStories', member: '@synthetic-story-16', order: 0 } },
    { resource_key: `${story}/stamps`, category: 'studentLife', owner_number: 16, value: { kind: 'array', parentKey: story, member: 'stamps' } },
  ];
  const response = (deletedKeys: string[]) => ({ kind: 'scoped', scope, resources: containers, wallets: [], history: [], deletedKeys, orderingBounds: {},
    updated_at: '2026-11-19T04:00:00Z', revisions: {} });
  const parsed = parseScopedStorageSnapshot(response([`${story}/stamps/#{"stampId":"me-too","studentNumber":20}`]));
  assert.deepEqual(parsed.resources.map(resource => resource.resource_key), containers.map(resource => resource.resource_key));
  assert.throws(() => parseScopedStorageSnapshot(response([])), /STORAGE_INVALID_RESPONSE/);
  assert.throws(() => parseScopedStorageSnapshot(response(['/studentPets/@synthetic/elsewhere'])), /STORAGE_INVALID_RESPONSE/);
});
