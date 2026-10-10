import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_RANDOM_DRAW_STATE, normalizeSavedRandomDrawState } from './randomDraw.js';

test('빈 추첨 결과는 반복 정규화 후에도 빈 값이며 교사 설정 변경을 만들지 않는다', () => {
  for (const input of [undefined, null, DEFAULT_RANDOM_DRAW_STATE]) {
    const once = normalizeSavedRandomDrawState(input);
    const twice = normalizeSavedRandomDrawState(once);
    assert.ok(once.cases.every(entry => entry.currentResult === null));
    assert.deepEqual(twice, once);
  }
});

test('저장된 실제 추첨 결과는 반복 정규화에서도 유지한다', () => {
  const saved = { ...DEFAULT_RANDOM_DRAW_STATE,
    cases: DEFAULT_RANDOM_DRAW_STATE.cases.map((entry, index) => ({ ...entry, currentResult: index ? null : 7 })) };
  const normalized = normalizeSavedRandomDrawState(saved);
  assert.equal(normalized.cases[0].currentResult, 7);
  assert.equal(normalized.cases[1].currentResult, null);
  assert.deepEqual(normalizeSavedRandomDrawState(normalized), normalized);
});
