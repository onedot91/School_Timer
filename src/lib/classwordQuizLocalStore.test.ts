import assert from 'node:assert/strict';
import test from 'node:test';

import { getDailyClasswordQuiz } from './classwordQuiz';
import {
  loadLocalClasswordQuizStudentState,
  loadLocalClasswordQuizTeacherSummary,
  submitLocalClasswordQuizAnswer,
} from './classwordQuizLocalStore';

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();
  get length(): number { return this.#values.size; }
  clear(): void { this.#values.clear(); }
  getItem(key: string): string | null { return this.#values.get(key) ?? null; }
  key(index: number): string | null { return [...this.#values.keys()][index] ?? null; }
  removeItem(key: string): void { this.#values.delete(key); }
  setItem(key: string, value: string): void { this.#values.set(key, value); }
}

const ANSWERS: Readonly<Record<string, string>> = {
  'saving-resources': '절약',
  'caring-for-others': '배려',
  'finishing-your-duty': '책임',
  'working-together': '협동',
  'looking-carefully': '관찰',
  'putting-into-action': '실천',
  'showing-respect': '존중',
};

test('오답은 저장하지 않고 정답은 학생·날짜·문제별 한 번만 저장한다', () => {
  const storage = new MemoryStorage();
  const dateKey = '2026-08-30';
  const question = getDailyClasswordQuiz(dateKey);
  const answer = ANSWERS[question.id];
  assert.ok(answer);

  assert.equal(submitLocalClasswordQuizAnswer(storage, dateKey, 3, '오답').correct, false);
  assert.equal(loadLocalClasswordQuizStudentState(storage, dateKey, 3).completed, false);

  const firstCorrect = submitLocalClasswordQuizAnswer(storage, dateKey, 3, answer, () => 0);
  const repeatedCorrect = submitLocalClasswordQuizAnswer(storage, dateKey, 3, answer, () => .999999);
  assert.equal(firstCorrect.correct, true);
  assert.equal(firstCorrect.rewardAmount, 1);
  assert.equal(repeatedCorrect.correct, true);
  assert.equal(repeatedCorrect.rewardAmount, 1);
  const completedState = loadLocalClasswordQuizStudentState(storage, dateKey, 3);
  assert.equal(completedState.completed, true);
  assert.equal(completedState.rewardAmount, 1);
  assert.deepEqual(loadLocalClasswordQuizTeacherSummary(storage, dateKey).correctStudentNumbers, [3]);
});
