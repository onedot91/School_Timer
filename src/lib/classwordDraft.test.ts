import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_CLASSWORD_DRAFT, loadClasswordDraft, storeClasswordDraft } from './classwordDraft';

test('draft survives reopening but is isolated by student and date; explicit completion clears it', () => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(), key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); },
  };
  const draft = { initial: 'ㄱ', word: '강아지' } as const;
  assert.equal(storeClasswordDraft(storage, 2, '2026-09-08', draft), true);
  assert.deepEqual(loadClasswordDraft(storage, 2, '2026-09-08'), draft);
  assert.deepEqual(loadClasswordDraft(storage, 4, '2026-09-08'), EMPTY_CLASSWORD_DRAFT);
  assert.deepEqual(loadClasswordDraft(storage, 2, '2026-09-09'), EMPTY_CLASSWORD_DRAFT);
  storeClasswordDraft(storage, 2, '2026-09-08', EMPTY_CLASSWORD_DRAFT);
  assert.deepEqual(loadClasswordDraft(storage, 2, '2026-09-08'), EMPTY_CLASSWORD_DRAFT);
});
