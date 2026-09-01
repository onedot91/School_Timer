import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSWORD_LOCAL_CHANGE_EVENT,
  saveClasswordEntry,
  submitClasswordQuizAnswer,
} from './classwordClient';
import { getDailyClasswordQuiz } from './classwordQuiz';
import { loadSavedClasswordQuizAnswer } from './classwordQuizAnswerStore';
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

test('연습 모드 낱말 제출은 당일 보상을 지급하지 않고 마감 대기 상태로 남긴다', async () => {
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
    assert.equal(first.awarded, false);
    assert.equal(first.balance, null);
    assert.equal(repeated.awarded, false);
    assert.equal(repeated.balance, null);
    assert.equal(loadStoredStudentPetSnapshot().currencyBalances['10'], 100);
    assert.equal(loadStoredStudentPetSnapshot().currencyHistory['10']?.filter(
      (entry) => entry.id === 'weekly-mission-classword_word_entry-10-2026-08-30',
    ).length ?? 0, 0);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('연습 모드 보너스 정답 보상은 1~10고마 범위에서 한 번만 지급한다', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalRandom = Math.random;
  const storage = new MemoryStorage();
  const fakeWindow = new EventTarget() as EventTarget & { readonly localStorage: Storage };
  Object.defineProperty(fakeWindow, 'localStorage', { value: storage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  Math.random = () => .999999;
  const answerByQuestion: Readonly<Record<string, string>> = {
    'saving-resources': '절약',
    'caring-for-others': '배려',
    'finishing-your-duty': '책임',
    'working-together': '협동',
    'looking-carefully': '관찰',
    'putting-into-action': '실천',
    'showing-respect': '존중',
  };
  const answer = answerByQuestion[getDailyClasswordQuiz('2026-08-30').id];
  assert.ok(answer);
  let savedAnswerWhenRefreshStarted = '';
  fakeWindow.addEventListener(CLASSWORD_LOCAL_CHANGE_EVENT, () => {
    savedAnswerWhenRefreshStarted = loadSavedClasswordQuizAnswer(storage, {
      dateKey: '2026-08-30',
      studentNumber: 10,
      questionId: getDailyClasswordQuiz('2026-08-30').id,
    });
  });

  try {
    const first = await submitClasswordQuizAnswer({
      dateKey: '2026-08-30',
      studentNumber: 10,
      answer,
    });
    const repeated = await submitClasswordQuizAnswer({
      dateKey: '2026-08-30',
      studentNumber: 10,
      answer,
    });

    assert.equal(first.correct, true);
    assert.equal(first.awarded, true);
    assert.equal(first.rewardAmount, 10);
    assert.equal(first.balance, 110);
    assert.equal(repeated.awarded, false);
    assert.equal(repeated.rewardAmount, 10);
    assert.equal(repeated.balance, 110);
    assert.equal(savedAnswerWhenRefreshStarted, answer);
  } finally {
    Math.random = originalRandom;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
