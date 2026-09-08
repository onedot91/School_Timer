import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import { getDailyClasswordQuiz } from './classwordQuiz';
import {
  loadLocalClasswordQuizStudentState,
  loadLocalClasswordQuizTeacherSummary,
  deleteLocalTeacherClasswordQuiz,
  saveLocalTeacherClasswordQuiz,
  submitLocalClasswordQuizAnswer,
} from './classwordQuizLocalStore';

const mockDate = (context: TestContext, dateKey = '2026-09-04'): void => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date(`${dateKey}T01:00:00.000Z`) });
};

test('연습 모드에서는 교사 출제 문제가 자동 문제를 대체하고 다시 되돌릴 수 있다', (context) => {
  mockDate(context);
  const storage = new MemoryStorage();
  const dateKey = '2026-09-04';
  const automatic = loadLocalClasswordQuizTeacherSummary(storage, dateKey);
  saveLocalTeacherClasswordQuiz(storage, {
    dateKey, initialHint: 'ㄷㅈ', meaning: '서로 힘을 합쳐 돕는 일', answer: '도움',
    writtenExample: '친구와 도움을 주고받았다.', spokenExample: '내가 먼저 도움을 줄게.',
  });

  const teacher = loadLocalClasswordQuizTeacherSummary(storage, dateKey);
  const student = loadLocalClasswordQuizStudentState(storage, dateKey, 3);
  assert.equal(teacher.source, 'teacher');
  assert.equal(teacher.answer, '도움');
  assert.equal(Object.hasOwn(student.question, 'answer'), false);
  assert.equal(submitLocalClasswordQuizAnswer(storage, dateKey, 3, '도움', () => 0).correct, true);

  deleteLocalTeacherClasswordQuiz(storage, dateKey);
  const restored = loadLocalClasswordQuizTeacherSummary(storage, dateKey);
  assert.equal(restored.source, 'automatic');
  assert.equal(restored.question.id, automatic.question.id);
  assert.equal(loadLocalClasswordQuizStudentState(storage, dateKey, 3).completed, false);
});

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();
  #writeCount = 0;
  get writeCount(): number { return this.#writeCount; }
  get length(): number { return this.#values.size; }
  clear(): void { this.#values.clear(); }
  getItem(key: string): string | null { return this.#values.get(key) ?? null; }
  key(index: number): string | null { return [...this.#values.keys()][index] ?? null; }
  removeItem(key: string): void { this.#values.delete(key); }
  setItem(key: string, value: string): void {
    this.#writeCount += 1;
    this.#values.set(key, value);
  }
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

test('오답은 저장하지 않고 정답은 학생·날짜·문제별 한 번만 저장한다', (context) => {
  mockDate(context);
  const storage = new MemoryStorage();
  const dateKey = '2026-09-04';
  const question = getDailyClasswordQuiz(dateKey);
  const answer = ANSWERS[question.id];
  assert.ok(answer);

  const firstRandom = context.mock.fn(() => 0);
  const repeatedRandom = context.mock.fn(() => .999999);
  const wrong = submitLocalClasswordQuizAnswer(storage, dateKey, 3, '오답', firstRandom);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.rewardAmount, 0);
  assert.equal(storage.writeCount, 0);
  assert.equal(firstRandom.mock.callCount(), 0);
  assert.equal(loadLocalClasswordQuizStudentState(storage, dateKey, 3).completed, false);

  const firstCorrect = submitLocalClasswordQuizAnswer(storage, dateKey, 3, answer, firstRandom);
  const repeatedCorrect = submitLocalClasswordQuizAnswer(storage, dateKey, 3, answer, repeatedRandom);
  assert.equal(firstCorrect.correct, true);
  assert.equal(firstCorrect.rewardAmount, 1);
  assert.equal(repeatedCorrect.correct, true);
  assert.equal(repeatedCorrect.rewardAmount, 1);
  assert.equal(firstRandom.mock.callCount(), 1);
  assert.equal(repeatedRandom.mock.callCount(), 0);
  assert.equal(storage.writeCount, 2);
  const completedState = loadLocalClasswordQuizStudentState(storage, dateKey, 3);
  assert.equal(completedState.completed, true);
  assert.equal(completedState.rewardAmount, 1);
  assert.deepEqual(loadLocalClasswordQuizTeacherSummary(storage, dateKey).correctStudentNumbers, [3]);
});

for (const weekend of ['2026-09-12', '2026-09-13']) {
  test(`${weekend}에는 금요일 문제를 읽고 제출은 날짜를 바꿔도 저장하지 않는다`, (context) => {
    // Given
    mockDate(context, '2026-09-11');
    const storage = new MemoryStorage();
    const friday = '2026-09-11';
    const summary = loadLocalClasswordQuizTeacherSummary(storage, friday);
    const completed = submitLocalClasswordQuizAnswer(storage, friday, 3, summary.answer, () => 0);
    const writes = storage.writeCount;
    context.mock.timers.setTime(new Date(`${weekend}T01:00:00.000Z`).getTime());

    // When
    const weekendState = loadLocalClasswordQuizStudentState(storage, weekend, 3);
    const otherStudent = loadLocalClasswordQuizStudentState(storage, weekend, 4);

    // Then
    assert.deepEqual(weekendState, completed.state);
    assert.equal(weekendState.dateKey, friday);
    assert.equal(otherStudent.question.id, completed.state.question.id);
    assert.equal(otherStudent.completed, false);
    for (const dateKey of [friday, weekend]) {
      assert.throws(() => submitLocalClasswordQuizAnswer(storage, dateKey, 3, summary.answer),
        /CLASSWORD_WEEKEND_CLOSED/);
      assert.throws(() => submitLocalClasswordQuizAnswer(storage, dateKey, 4, summary.answer),
        /CLASSWORD_WEEKEND_CLOSED/);
    }
    assert.equal(storage.writeCount, writes);
    assert.deepEqual(loadLocalClasswordQuizTeacherSummary(storage, friday).correctStudentNumbers, [3]);
  });
}

test('평일에도 과거 퀴즈 날짜로 제출하면 완료나 보상을 저장하지 않는다', (context) => {
  // Given
  mockDate(context, '2026-09-14');
  const storage = new MemoryStorage();
  const summary = loadLocalClasswordQuizTeacherSummary(storage, '2026-09-11');
  const random = context.mock.fn(() => .999999);

  // When
  const submit = () => submitLocalClasswordQuizAnswer(storage, '2026-09-11', 3, summary.answer, random);

  // Then
  assert.throws(submit, /TODAY_ONLY/);
  assert.equal(storage.writeCount, 0);
  assert.equal(random.mock.callCount(), 0);
});

test('잔액 저장 실패는 완료로 표시하지 않고 같은 금액으로 한 번만 재시도한다', (context) => {
  mockDate(context);
  const walletKey = 'school-timer-student-pets-v1';
  class FailingStorage extends MemoryStorage {
    failWallet = true;
    override setItem(key: string, value: string): void {
      if (this.failWallet && key === walletKey) throw new Error('quota');
      super.setItem(key, value);
    }
  }
  const storage = new FailingStorage();
  const dateKey = '2026-09-04';
  const summary = loadLocalClasswordQuizTeacherSummary(storage, dateKey);
  assert.throws(() => submitLocalClasswordQuizAnswer(storage, dateKey, 3, summary.answer, () => .5),
    /CLASSWORD_REWARD_SAVE_FAILED/);
  assert.equal(loadLocalClasswordQuizStudentState(storage, dateKey, 3).completed, false);
  assert.deepEqual(loadLocalClasswordQuizTeacherSummary(storage, dateKey).correctStudentNumbers, []);
  storage.failWallet = false;
  const retryRandom = context.mock.fn(() => .9);
  const recovered = submitLocalClasswordQuizAnswer(storage, dateKey, 3, summary.answer, retryRandom);
  assert.equal(recovered.state.completed, true);
  assert.equal(recovered.rewardAmount, 6);
  assert.equal(recovered.balance, 106);
  assert.equal(retryRandom.mock.callCount(), 0);
  const repeated = submitLocalClasswordQuizAnswer(storage, dateKey, 3, summary.answer, retryRandom);
  assert.equal(repeated.awarded, false);
  assert.equal(repeated.balance, 106);
});

test('보유 한도에서는 지급 대기를 유지하고 여유가 생기면 원래 금액만 지급한다', (context) => {
  mockDate(context);
  const storage = new MemoryStorage();
  const walletKey = 'school-timer-student-pets-v1';
  storage.setItem(walletKey, JSON.stringify({ currencyBalances: { 3: 999999 } }));
  const dateKey = '2026-09-04';
  const summary = loadLocalClasswordQuizTeacherSummary(storage, dateKey);
  assert.throws(() => submitLocalClasswordQuizAnswer(storage, dateKey, 3, summary.answer, () => .5),
    /CLASSWORD_REWARD_PENDING/);
  const pending = loadLocalClasswordQuizStudentState(storage, dateKey, 3);
  assert.equal(pending.completed, false);
  assert.equal(pending.rewardAmount, null);
  storage.setItem(walletKey, JSON.stringify({ currencyBalances: { 3: 999990 } }));
  const result = submitLocalClasswordQuizAnswer(storage, dateKey, 3, summary.answer, () => .9);
  assert.equal(result.state.completed, true);
  assert.equal(result.rewardAmount, 6);
  assert.equal(result.balance, 999996);
});

test('지급 대기 기록 저장 실패는 잔액을 변경하지 않는다', (context) => {
  mockDate(context);
  class FailingStorage extends MemoryStorage {
    override setItem(): void { throw new Error('quota'); }
  }
  const storage = new FailingStorage();
  const dateKey = '2026-09-04';
  const summary = loadLocalClasswordQuizTeacherSummary(storage, dateKey);
  assert.throws(() => submitLocalClasswordQuizAnswer(storage, dateKey, 3, summary.answer), /CLASSWORD_REWARD_SAVE_FAILED/);
  assert.equal(loadLocalClasswordQuizStudentState(storage, dateKey, 3).completed, false);
  assert.equal(storage.getItem('school-timer-student-pets-v1'), null);
});

test('날짜별 기존 지급이 있으면 교사 문제 변경 뒤에도 금액을 유지하고 중복 지급하지 않는다', (context) => {
  mockDate(context);
  const storage = new MemoryStorage();
  const dateKey = '2026-09-04';
  const summary = loadLocalClasswordQuizTeacherSummary(storage, dateKey);
  const original = submitLocalClasswordQuizAnswer(storage, dateKey, 3, summary.answer, () => .5);
  saveLocalTeacherClasswordQuiz(storage, {
    dateKey, initialHint: 'ㄷㅈ', meaning: '서로 힘을 합쳐 돕는 일', answer: '도움',
    writtenExample: '친구와 도움을 주고받았다.', spokenExample: '내가 먼저 도움을 줄게.',
  });
  const random = context.mock.fn(() => .9);
  const changed = submitLocalClasswordQuizAnswer(storage, dateKey, 3, '도움', random);
  assert.equal(changed.awarded, false);
  assert.equal(changed.state.completed, true);
  assert.equal(changed.rewardAmount, original.rewardAmount);
  assert.equal(changed.balance, original.balance);
  assert.equal(random.mock.callCount(), 0);
});
