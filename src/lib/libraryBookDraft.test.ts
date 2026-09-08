import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadLibraryBookDraft, saveLibraryBookDraft } from './libraryBookDraft.js';
import { canReloadWithDrafts } from './draftReloadSafety.js';

test('library draft keeps carried book and form by student and blocks unsafe reload on storage failure', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  let blocked = false;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (blocked) throw new Error('quota'); values.set(key, value); },
    removeItem: (key: string) => values.delete(key),
  } } });
  const carried = { studentNumber: 3, title: '보관 책', author: '작가', pageCount: 0, reflection: '감상' };
  const input = { title: carried.title, author: carried.author, reflection: carried.reflection, carried };
  try {
    assert.equal(saveLibraryBookDraft(3, input), true);
    assert.deepEqual(loadLibraryBookDraft(3), input);
    assert.equal(loadLibraryBookDraft(4), null);
    assert.equal(canReloadWithDrafts(3), true);
    blocked = true;
    assert.equal(saveLibraryBookDraft(3, { ...input, reflection: '아직 보관되지 않은 변경' }), false);
    assert.equal(canReloadWithDrafts(3), false);
    assert.equal(loadLibraryBookDraft(3)?.reflection, '아직 보관되지 않은 변경');
    blocked = false;
    assert.equal(saveLibraryBookDraft(3, { title: '', author: '', reflection: '', carried: null }), true);
    assert.equal(loadLibraryBookDraft(3), null);
    assert.equal(canReloadWithDrafts(3), true);
  } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); }
});

test('opening the registration desk preserves the restored form until placement is confirmed', async () => {
  const source = await readFile(new URL('../components/student/library/CanvasLibraryGame.tsx', import.meta.url), 'utf8');
  const start = source.indexOf("} else if (target.kind === 'registration-desk') {");
  const end = source.indexOf("} else if (target.kind === 'shelf'", start);
  assert.ok(start >= 0 && end > start);
  const registration = source.slice(start, end);
  assert.match(registration, /openModal\(\{ kind: 'registration' \}\)/);
  assert.doesNotMatch(registration, /setTitle\(|setAuthor\(|setReflection\(/);
  assert.match(source, /saveLibraryBookDraft\(studentNumber, \{ title: '', author: '', reflection: '', carried: null \}\)/);
});
