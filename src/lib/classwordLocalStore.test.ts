import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deleteLocalClasswordEntry,
  loadLocalClasswordBoard,
  loadLocalClasswordRounds,
  pruneLocalClasswordEntries,
  saveLocalClasswordEntry,
} from './classwordLocalStore';

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

test('한 학생은 같은 날짜에 한 칸만 새로 등록할 수 있다', () => {
  // Given
  const storage = new MemoryStorage();
  saveLocalClasswordEntry(storage, {
    dateKey: '2026-08-29', initial: 'ㄱ', word: '강아지', studentNumber: 3,
  });

  // When
  const duplicate = () => saveLocalClasswordEntry(storage, {
    dateKey: '2026-08-29', initial: 'ㄴ', word: '나비', studentNumber: 3,
  });

  // Then
  assert.throws(duplicate, /CLASSWORD_STUDENT_ALREADY_ENTERED/);
});

test('같은 날짜의 초성은 한 학생만 차지할 수 있다', () => {
  // Given
  const storage = new MemoryStorage();
  saveLocalClasswordEntry(storage, {
    dateKey: '2026-08-29', initial: 'ㄱ', word: '강아지', studentNumber: 3,
  });

  // When
  const occupied = () => saveLocalClasswordEntry(storage, {
    dateKey: '2026-08-29', initial: 'ㄱ', word: '기차', studentNumber: 4,
  });

  // Then
  assert.throws(occupied, /CLASSWORD_INITIAL_OCCUPIED/);
});

test('학생은 자신의 낱말만 수정하고 삭제할 수 있다', () => {
  // Given
  const storage = new MemoryStorage();
  const entry = saveLocalClasswordEntry(storage, {
    dateKey: '2026-08-29', initial: 'ㄱ', word: '강아지', studentNumber: 3,
  });

  // When
  const wrongStudentUpdate = () => saveLocalClasswordEntry(storage, {
    entryId: entry.id,
    dateKey: '2026-08-29',
    initial: 'ㄱ',
    word: '기차',
    studentNumber: 4,
  });
  const wrongStudentDelete = () => deleteLocalClasswordEntry(storage, entry.id, 4, false);

  // Then
  assert.throws(wrongStudentUpdate, /CLASSWORD_ENTRY_FORBIDDEN/);
  assert.throws(wrongStudentDelete, /CLASSWORD_ENTRY_FORBIDDEN/);
  assert.equal(loadLocalClasswordBoard(storage, '2026-08-29').entries.length, 1);

  const updated = saveLocalClasswordEntry(storage, {
    entryId: entry.id,
    dateKey: '2026-08-29',
    initial: 'ㄱ',
    word: '기차',
    studentNumber: 3,
  });
  assert.equal(updated.word, '기차');
  deleteLocalClasswordEntry(storage, entry.id, 3, false);
  assert.equal(loadLocalClasswordBoard(storage, '2026-08-29').entries.length, 0);
});

test('로컬 낱말 정리는 경계일을 남기고 더 오래된 낱말만 삭제한다', () => {
  // Given
  const storage = new MemoryStorage();
  saveLocalClasswordEntry(storage, {
    dateKey: '2026-08-15', initial: 'ㄱ', word: '강아지', studentNumber: 1,
  });
  saveLocalClasswordEntry(storage, {
    dateKey: '2026-08-16', initial: 'ㄴ', word: '나비', studentNumber: 2,
  });
  saveLocalClasswordEntry(storage, {
    dateKey: '2026-08-29', initial: 'ㄷ', word: '다람쥐', studentNumber: 3,
  });

  // When
  const removedCount = pruneLocalClasswordEntries(storage, '2026-08-16');

  // Then
  assert.equal(removedCount, 1);
  assert.equal(loadLocalClasswordBoard(storage, '2026-08-15').entries.length, 0);
  assert.equal(loadLocalClasswordBoard(storage, '2026-08-16').entries.length, 1);
  assert.equal(loadLocalClasswordBoard(storage, '2026-08-29').entries.length, 1);
  assert.equal(loadLocalClasswordRounds(storage).length, 3);
});
