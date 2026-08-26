import assert from 'node:assert/strict';
import test from 'node:test';
import {
  claimNumberBaseballRewardInSettings,
  hasNumberBaseballReward,
  normalizeCurrencyBalances,
} from './currency';
import { mergeConcurrentCurrencyUpdatesIntoSettings } from './weeklyMission';
import {
  appendNumberBaseballAttempt,
  createNumberBaseballAnswer,
  createNumberBaseballProgressEntry,
  evaluateNumberBaseballGuess,
  getNumberBaseballGameId,
  getLatestResumableNumberBaseballGame,
  getNumberBaseballOutDigits,
  getNumberBaseballResultDisplays,
  getNumberBaseballReward,
  getNumberBaseballStatus,
  normalizeStudentNumberBaseballProgress,
} from './numberBaseball';

test('학생과 한국 날짜가 같으면 서로 다른 1부터 9까지의 세 숫자를 동일하게 배정한다', () => {
  // Given
  const dateKey = '2026-08-20';

  // When
  const answers = Array.from({ length: 23 }, (_, index) => createNumberBaseballAnswer(index + 1, dateKey));

  // Then
  answers.forEach((answer) => {
    assert.equal(answer.length, 3);
    assert.equal(new Set(answer).size, 3);
    assert.ok(answer.every((digit) => digit >= 1 && digit <= 9));
  });
  assert.deepEqual(createNumberBaseballAnswer(7, dateKey), createNumberBaseballAnswer(7, dateKey));
  assert.ok(new Set(answers.map((answer) => answer.join(''))).size > 1);
});

test('정답과 위치가 맞으면 스트라이크, 숫자만 맞으면 볼, 없으면 아웃으로 센다', () => {
  // Given
  const answer = [1, 2, 3] as const;

  // When
  const mixed = evaluateNumberBaseballGuess(answer, [1, 3, 4]);
  const allOut = evaluateNumberBaseballGuess(answer, [4, 5, 6]);

  // Then
  assert.deepEqual(mixed, { strikes: 1, balls: 1, outs: 1 });
  assert.deepEqual(allOut, { strikes: 0, balls: 0, outs: 3 });
});

test('화면에는 스트라이크와 볼만 표시하고 세 숫자가 모두 틀릴 때만 숫자 없이 OUT을 표시한다', () => {
  // Given
  const mixed = { strikes: 1, balls: 1, outs: 1 };
  const allOut = { strikes: 0, balls: 0, outs: 3 };

  // When
  const mixedDisplays = getNumberBaseballResultDisplays(mixed);
  const allOutDisplays = getNumberBaseballResultDisplays(allOut);

  // Then
  assert.deepEqual(mixedDisplays, [
    { kind: 'strike', value: '1S' },
    { kind: 'ball', value: '1B' },
  ]);
  assert.deepEqual(allOutDisplays, [{ kind: 'out', value: 'OUT' }]);
});

test('완전히 아웃된 시도의 숫자만 중복 없이 모은다', () => {
  // Given
  const answer = [1, 2, 3] as const;
  const attempts = [
    { guess: [4, 5, 6] as const, createdAt: '2026-08-20T01:00:00.000Z' },
    { guess: [1, 4, 7] as const, createdAt: '2026-08-20T01:01:00.000Z' },
    { guess: [4, 6, 9] as const, createdAt: '2026-08-20T01:02:00.000Z' },
  ];

  // When
  const outDigits = getNumberBaseballOutDigits(answer, attempts);

  // Then
  assert.deepEqual(outDigits, [4, 5, 6, 9]);
});

test('정답 시도 횟수에 따라 20, 10, 5고마를 지급하고 열 번째 시도는 허용하지 않는다', () => {
  // Given
  const boundaries = [0, 1, 5, 6, 7, 8, 9, 10] as const;

  // When
  const rewards = boundaries.map(getNumberBaseballReward);

  // Then
  assert.deepEqual(rewards, [null, 20, 20, 10, 10, 5, 5, null]);
});

test('아홉 번 안에서 정답을 맞히거나 기회를 모두 쓰면 더 입력할 수 없다', () => {
  // Given
  const answer = [1, 2, 3] as const;
  const gameId = getNumberBaseballGameId(7, '2026-08-20');
  let solved = createNumberBaseballProgressEntry(gameId);
  let exhausted = createNumberBaseballProgressEntry(gameId);

  // When
  solved = appendNumberBaseballAttempt(solved, answer, [1, 2, 3], '2026-08-20T01:00:00.000Z') ?? solved;
  for (let index = 0; index < 9; index += 1) {
    exhausted = appendNumberBaseballAttempt(exhausted, answer, [4, 5, 6], `2026-08-20T01:00:0${index}.000Z`) ?? exhausted;
  }

  // Then
  assert.equal(getNumberBaseballStatus(solved, answer), 'completed');
  assert.equal(getNumberBaseballStatus(exhausted, answer), 'exhausted');
  assert.equal(appendNumberBaseballAttempt(solved, answer, [4, 5, 6]), null);
  assert.equal(appendNumberBaseballAttempt(exhausted, answer, [4, 5, 6]), null);
});

test('오늘 기록이 없으면 가장 최근의 끝나지 않은 지난 숫자야구를 이어 할 수 있다', () => {
  // Given
  const studentNumber = 7;
  const olderDateKey = '2026-08-18';
  const latestDateKey = '2026-08-19';
  const completedDateKey = '2026-08-17';
  const completedAnswer = createNumberBaseballAnswer(studentNumber, completedDateKey);
  const completedEntry = appendNumberBaseballAttempt(
    createNumberBaseballProgressEntry(getNumberBaseballGameId(studentNumber, completedDateKey)),
    completedAnswer,
    completedAnswer,
    '2026-08-17T01:00:00.000Z',
  );
  const progress = {
    [`${studentNumber}:${olderDateKey}`]: createNumberBaseballProgressEntry(getNumberBaseballGameId(studentNumber, olderDateKey)),
    [`${studentNumber}:${latestDateKey}`]: createNumberBaseballProgressEntry(getNumberBaseballGameId(studentNumber, latestDateKey)),
    [`${studentNumber}:${completedDateKey}`]: completedEntry ?? createNumberBaseballProgressEntry(getNumberBaseballGameId(studentNumber, completedDateKey)),
  };

  // When
  const resumable = getLatestResumableNumberBaseballGame(progress, studentNumber, '2026-08-20');

  // Then
  assert.equal(resumable?.dateKey, latestDateKey);
  assert.equal(resumable?.entry.gameId, getNumberBaseballGameId(studentNumber, latestDateKey));
});

test('오늘 숫자야구가 이미 시작됐으면 지난 게임을 이어 하라고 제안하지 않는다', () => {
  // Given
  const studentNumber = 7;
  const todayDateKey = '2026-08-20';
  const progress = {
    [`${studentNumber}:2026-08-19`]: createNumberBaseballProgressEntry(getNumberBaseballGameId(studentNumber, '2026-08-19')),
    [`${studentNumber}:${todayDateKey}`]: createNumberBaseballProgressEntry(getNumberBaseballGameId(studentNumber, todayDateKey)),
  };

  // When
  const resumable = getLatestResumableNumberBaseballGame(progress, studentNumber, todayDateKey);

  // Then
  assert.equal(resumable, null);
});

test('주간 숫자야구 기록은 다음 주 키에서 초기 상태로 시작한다', () => {
  // Given
  const studentNumber = 7;
  const currentWeekKey = '2026-35';
  const nextWeekKey = '2026-36';
  const currentKey = `${studentNumber}:${currentWeekKey}`;
  const nextKey = `${studentNumber}:${nextWeekKey}`;

  // When
  const normalized = normalizeStudentNumberBaseballProgress({
    [currentKey]: createNumberBaseballProgressEntry(getNumberBaseballGameId(studentNumber, currentWeekKey)),
  });

  // Then
  assert.equal(normalized[currentKey]?.gameId, getNumberBaseballGameId(studentNumber, currentWeekKey));
  assert.equal(normalized[nextKey], undefined);
  assert.notEqual(
    getNumberBaseballGameId(studentNumber, currentWeekKey),
    getNumberBaseballGameId(studentNumber, nextWeekKey),
  );
});

test('저장 경계는 중복·0·열 번째 입력을 버리고 정답 이후 기록을 복구하지 않는다', () => {
  // Given
  const key = '7:2026-08-20';
  const gameId = getNumberBaseballGameId(7, '2026-08-20');
  const answer = createNumberBaseballAnswer(7, '2026-08-20');

  // When
  const normalized = normalizeStudentNumberBaseballProgress({
    [key]: {
      gameId,
      attempts: [
        { guess: [1, 1, 2], createdAt: 'bad-duplicate' },
        { guess: [0, 2, 3], createdAt: 'bad-zero' },
        { guess: answer, createdAt: '2026-08-20T01:00:00.000Z' },
        { guess: [4, 5, 6], createdAt: 'after-solved' },
      ],
      completedAt: '2026-08-20T01:00:00.000Z',
    },
  });

  // Then
  assert.equal(normalized[key]?.attempts.length, 1);
  assert.deepEqual(normalized[key]?.attempts[0]?.guess, answer);
  assert.equal(normalized[key]?.completedAt, '2026-08-20T01:00:00.000Z');
});

test('숫자야구 보상은 게임별로 정확히 한 번만 지급된다', () => {
  // Given
  const initial = { currencyBalances: { 7: 100 }, currencyHistory: { 7: [] } };
  const gameId = getNumberBaseballGameId(7, '2026-08-20');

  // When
  const first = claimNumberBaseballRewardInSettings(initial, 7, gameId, 20, '2026-08-20T01:00:00.000Z');
  const second = claimNumberBaseballRewardInSettings(first.value, 7, gameId, 20, '2026-08-20T01:00:01.000Z');

  // Then
  assert.equal(first.awarded, true);
  assert.equal(second.awarded, false);
  assert.equal(second.balance, 120);
  assert.equal(hasNumberBaseballReward(second.value.currencyHistory, 7, gameId), true);
  assert.equal(second.history['7'].filter((entry) => entry.reason === 'number_baseball_mission').length, 1);
});

test('교사 자동 저장은 동시에 완료된 숫자야구 보상과 진행을 보존한다', () => {
  // Given
  const key = '7:2026-08-20';
  const gameId = getNumberBaseballGameId(7, '2026-08-20');
  const remote = claimNumberBaseballRewardInSettings({
    currencyBalances: { 7: 100 },
    currencyHistory: { 7: [] },
    studentNumberBaseball: {
      [key]: { gameId, attempts: [{ guess: [1, 2, 3], createdAt: '2026-08-20T01:00:00.000Z' }], completedAt: '2026-08-20T01:00:00.000Z' },
    },
  }, 7, gameId, 20, '2026-08-20T01:00:00.000Z').value;

  // When
  const merged = mergeConcurrentCurrencyUpdatesIntoSettings(remote, {
    currencyBalances: { 7: 100 }, currencyHistory: { 7: [] }, studentNumberBaseball: {},
  });

  // Then
  assert.equal(normalizeStudentNumberBaseballProgress(merged.studentNumberBaseball)[key]?.gameId, gameId);
  assert.equal(hasNumberBaseballReward(merged.currencyHistory, 7, gameId), true);
  assert.equal(normalizeCurrencyBalances(merged.currencyBalances)['7'], 120);
});
