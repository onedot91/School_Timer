import assert from 'node:assert/strict';
import test from 'node:test';
import { beginSaveProgress, getSaveProgress, subscribeSaveProgress } from './saveProgress.js';
import { withSaveFailureReporting } from './saveFailureClient.js';

test('중첩·동시 저장은 마지막 요청이 끝날 때까지 로딩을 유지한다', () => {
  const changes: boolean[] = [];
  const unsubscribe = subscribeSaveProgress(() => changes.push(getSaveProgress()));
  const finishFirst = beginSaveProgress();
  const finishSecond = beginSaveProgress();
  assert.equal(getSaveProgress(), true);
  finishFirst();
  finishFirst();
  assert.equal(getSaveProgress(), true);
  finishSecond();
  assert.equal(getSaveProgress(), false);
  assert.deepEqual(changes, [true, false]);
  unsubscribe();
});

test('공통 저장의 성공·실패 결과를 유지하고 로딩 상태를 해제한다', async () => {
  let resolveSave: (value: string) => void = () => {};
  const pending = new Promise<string>((resolve) => { resolveSave = resolve; });
  const result = withSaveFailureReporting('numberBaseball', () => pending);
  assert.equal(getSaveProgress(), true);
  resolveSave('saved');
  assert.equal(await result, 'saved');
  assert.equal(getSaveProgress(), false);

  const error = new Error('test save failure');
  await assert.rejects(withSaveFailureReporting('emotion', async () => {
    assert.equal(getSaveProgress(), true);
    throw error;
  }), (actual) => actual === error);
  assert.equal(getSaveProgress(), false);
});
