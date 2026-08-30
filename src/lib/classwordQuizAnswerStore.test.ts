import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadSavedClasswordQuizAnswer,
  saveClasswordQuizAnswer,
} from './classwordQuizAnswerStore';

class MemoryStorage implements Storage {
  readonly #data = new Map<string, string>();

  get length(): number { return this.#data.size; }
  clear(): void { this.#data.clear(); }
  getItem(key: string): string | null { return this.#data.get(key) ?? null; }
  key(index: number): string | null { return [...this.#data.keys()][index] ?? null; }
  removeItem(key: string): void { this.#data.delete(key); }
  setItem(key: string, value: string): void { this.#data.set(key, value); }
}

const identity = {
  dateKey: '2026-08-30',
  studentNumber: 22,
  questionId: 'working-together',
};

test('맞힌 낱말은 학생·날짜·문제별로 브라우저 저장소에 유지한다', () => {
  const storage = new MemoryStorage();

  saveClasswordQuizAnswer(storage, identity, '협동');

  assert.equal(loadSavedClasswordQuizAnswer(storage, identity), '협동');
  assert.equal(loadSavedClasswordQuizAnswer(storage, { ...identity, studentNumber: 21 }), '');
  assert.equal(loadSavedClasswordQuizAnswer(storage, { ...identity, dateKey: '2026-08-31' }), '');
});

test('저장된 값이 손상되었거나 입력 제한을 넘으면 노출하지 않는다', () => {
  const storage = new MemoryStorage();
  storage.setItem('school-timer:classword-quiz-answers:v1', '{broken');
  assert.equal(loadSavedClasswordQuizAnswer(storage, identity), '');

  saveClasswordQuizAnswer(storage, identity, '가'.repeat(21));
  assert.equal(loadSavedClasswordQuizAnswer(storage, identity), '');
});
