import assert from 'node:assert/strict';
import test from 'node:test';
import { saveLocalClasswordTopic } from './classwordLocalStore';

import {
  CLASSWORD_LOCAL_CHANGE_EVENT,
  ClasswordClientError,
  saveClasswordEntry,
  submitClasswordQuizAnswer,
} from './classwordClient';
import { getDailyClasswordQuiz, getDailyClasswordQuizDefinition } from './classwordQuiz';
import { loadSaveFailureAlerts } from './saveFailureClient';
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

test('연습 모드 낱말 제출은 당일 5고마를 한 번만 지급한다', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-04T01:00:00Z') });
  // Given
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new MemoryStorage();
  saveLocalClasswordTopic(storage, '2026-09-04', '동물');
  const fakeWindow = new EventTarget() as EventTarget & { readonly localStorage: Storage };
  Object.defineProperty(fakeWindow, 'localStorage', { value: storage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });

  try {
    // When
    const first = await saveClasswordEntry({
      dateKey: '2026-09-04',
      initial: 'ㄱ',
      word: '강아지',
      studentNumber: 10,
    }, '동물');
    const repeated = await saveClasswordEntry({
      entryId: first.entry.id,
      dateKey: '2026-09-04',
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
      (entry) => entry.id === 'weekly-mission-classword_word_entry-10-2026-09-04',
    ).length ?? 0, 1);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('연습 모드 보너스 정답 보상은 1~10고마 범위에서 한 번만 지급한다', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-04T01:00:00Z') });
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalRandom = Math.random;
  const storage = new MemoryStorage();
  saveLocalClasswordTopic(storage, '2026-09-04', '동물');
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
  const answer = answerByQuestion[getDailyClasswordQuiz('2026-09-04').id];
  assert.ok(answer);
  let savedAnswerWhenRefreshStarted = '';
  fakeWindow.addEventListener(CLASSWORD_LOCAL_CHANGE_EVENT, () => {
    savedAnswerWhenRefreshStarted = loadSavedClasswordQuizAnswer(storage, {
      dateKey: '2026-09-04',
      studentNumber: 10,
      questionId: getDailyClasswordQuiz('2026-09-04').id,
    });
  });

  try {
    const first = await submitClasswordQuizAnswer({
      dateKey: '2026-09-04',
      studentNumber: 10,
      answer,
    });
    const repeated = await submitClasswordQuizAnswer({
      dateKey: '2026-09-04',
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


test('연습 퀴즈 잔액 저장 실패는 재시도 가능한 오류와 공통 저장 알림을 남긴다', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-04T01:00:00Z') });
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  class FailingStorage extends MemoryStorage {
    failWallet = true;
    override setItem(key: string, value: string): void {
      if (this.failWallet && key === 'school-timer-student-pets-v1') throw new Error('quota');
      super.setItem(key, value);
    }
  }
  const storage = new FailingStorage();
  const fakeWindow = new EventTarget();
  Object.defineProperty(fakeWindow, 'localStorage', { value: storage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  const input = { dateKey: '2026-09-04', studentNumber: 10,
    answer: getDailyClasswordQuizDefinition('2026-09-04').answer };
  try {
    await assert.rejects(submitClasswordQuizAnswer(input), (error: unknown) => (
      error instanceof ClasswordClientError && error.code === 'CLASSWORD_REWARD_SAVE_FAILED'
    ));
    const { alerts } = await loadSaveFailureAlerts();
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].feature, 'classword');
    assert.equal(alerts[0].code, 'storage');
    assert.equal(alerts[0].studentNumber, 10);
    assert.equal(JSON.stringify(alerts).includes(input.answer), false);
    storage.failWallet = false;
    const recovered = await submitClasswordQuizAnswer(input);
    assert.equal(recovered.state.completed, true);
    assert.equal(recovered.awarded, true);
    const repeated = await submitClasswordQuizAnswer(input);
    assert.equal(repeated.awarded, false);
    assert.equal(repeated.balance, recovered.balance);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
