import assert from 'node:assert/strict';
import test from 'node:test';

import { saveClasswordEntry } from './classwordClient';
import { loadStoredStudentPetSnapshot } from './studentPet';

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

test('연습 모드에서도 ㄱㄴㄷ 게임을 완료하면 일일 5고마를 한 번 반영한다', async () => {
  // Given
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new MemoryStorage();
  const fakeWindow = new EventTarget() as EventTarget & { readonly localStorage: Storage };
  Object.defineProperty(fakeWindow, 'localStorage', { value: storage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });

  try {
    // When
    const first = await saveClasswordEntry({
      dateKey: '2026-08-30',
      initial: 'ㄱ',
      word: '강아지',
      studentNumber: 10,
    }, '동물');
    const repeated = await saveClasswordEntry({
      entryId: first.entry.id,
      dateKey: '2026-08-30',
      initial: 'ㄱ',
      word: '기린',
      studentNumber: 10,
    }, '동물');

    // Then
    assert.equal(first.awarded, true);
    assert.equal(first.balance, 105);
    assert.equal(repeated.awarded, false);
    assert.equal(repeated.balance, 105);
    assert.equal(loadStoredStudentPetSnapshot().currencyBalances['10'], 105);
    assert.equal(loadStoredStudentPetSnapshot().currencyHistory['10']?.filter(
      (entry) => entry.id === 'weekly-mission-classword_word_entry-10-2026-08-30',
    ).length, 1);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
