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

test('failed local draft replacement keeps the latest words and blocks unsafe reload', async () => {
  const { canReloadWithDrafts } = await import('./draftReloadSafety');
  const values = new Map<string, string>();
  let rejectWrite = false;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (rejectWrite) throw new Error('quota'); values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  storeClasswordDraft(storage, 19, '2026-09-09', { initial: 'ㄱ', word: '가방' });
  rejectWrite = true;
  assert.equal(storeClasswordDraft(storage, 19, '2026-09-09', { initial: 'ㄱ', word: '강아지' }), false);
  assert.equal(loadClasswordDraft(storage, 19, '2026-09-09').word, '강아지');
  assert.equal(canReloadWithDrafts(19), false);
  rejectWrite = false;
  storeClasswordDraft(storage, 19, '2026-09-09', { initial: 'ㄱ', word: '강아지' });
});

test('a confirmed older submission does not clear a newer classword draft', async () => {
  const { classwordDraftVersion, confirmClasswordDraft } = await import('./classwordDraft');
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  storeClasswordDraft(storage, 20, '2026-09-09', { initial: 'ㄱ', word: '가방' });
  const sent = classwordDraftVersion(storage, 20, '2026-09-09');
  assert.ok(sent);
  storeClasswordDraft(storage, 20, '2026-09-09', { initial: 'ㄱ', word: '강아지' });
  assert.equal(await confirmClasswordDraft(storage, 20, '2026-09-09', sent), false);
  assert.equal(loadClasswordDraft(storage, 20, '2026-09-09').word, '강아지');
});
