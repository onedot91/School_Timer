import assert from 'node:assert/strict';
import test from 'node:test';
import { completeFailureStoryReadScope, storageCommandScope } from '../../src/server/storageCommandScope.js';

const student = { role: 'student' as const, studentNumber: 6, expiresAt: 0 };

test('negative teacher adjustments allow only target economy and mail writes', () => {
  const teacher = { role: 'teacher' as const, expiresAt: 0 };
  const scope = storageCommandScope('teacher.currency.adjust', { studentNumbers: [6, 15], amount: -10 }, teacher);
  assert.deepEqual(scope.writeWallets, [6, 15]);
  assert.deepEqual(scope.writeResources, [
    { path: '/studentEconomy/6' }, { path: '/studentLife/letters', mail: { actor: 6, direction: 'recipient' } },
    { path: '/studentEconomy/15' }, { path: '/studentLife/letters', mail: { actor: 15, direction: 'recipient' } },
  ]);
  for (const [action, amount] of [['teacher.currency.adjust', 10], ['teacher.currency.set', 10], ['teacher.currency.reset', 0]] as const) {
    assert.deepEqual(storageCommandScope(action, { studentNumbers: [6], amount }, teacher).writeResources, []);
  }
});

test('bid validation reads the wallet revision without loading currency history', () => {
  const scope = storageCommandScope('student.auction.bid', { itemId: 'item-a' }, student);
  assert.deepEqual(scope.wallets, [6]);
  assert.deepEqual(scope.history, []);
  assert.deepEqual(scope.writeWallets, []);
  assert.ok(scope.revisionKeys?.includes('wallet:6'));
  assert.ok(scope.revisionKeys?.includes('scope:auctionBids:all'));
});

test('failure creation completes only discovered stories and keeps owner write limits', () => {
  const scope = storageCommandScope('student.failure.create', {}, student);
  assert.ok(!scope.resources.some(selection => selection.path === '/studentLife/failureStories' && !selection.students));
  const keys = ['/studentLife/failureStories/@own/failure', '/studentLife/failureStories/@foreign/stamps/#encoded', '/studentEconomy/6'];
  const complete = completeFailureStoryReadScope(scope, keys);
  assert.deepEqual(complete.writeResources, scope.writeResources);
  assert.deepEqual(complete.resources.slice(scope.resources.length), [
    { path: '/studentLife/failureStories/@own' }, { path: '/studentLife/failureStories/@foreign' },
  ]);
  assert.equal(completeFailureStoryReadScope(complete, keys), complete);
  assert.notEqual(completeFailureStoryReadScope(complete, [...keys, '/studentLife/failureStories/@new/stamps/#encoded']), complete);
});

test('very large related story sets fall back to a full read within the selector limit', () => {
  const scope = storageCommandScope('student.failure.create', {}, student);
  const complete = completeFailureStoryReadScope(scope, Array.from({ length: 130 }, (_, index) => `/studentLife/failureStories/@${index}/failure`));
  assert.ok(complete.resources.length <= 128);
  assert.deepEqual(complete.writeResources, scope.writeResources);
  assert.equal(completeFailureStoryReadScope(complete, ['/studentLife/failureStories/@more/failure']), complete);
});
