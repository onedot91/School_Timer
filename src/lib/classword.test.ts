import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSWORD_INITIALS,
  acceptsClasswordInitial,
  getClasswordEntryRetentionCutoff,
  getClasswordInitialFromWord,
  getClasswordInitialLabel,
  getKoreanDateKey,
  parseClasswordBoard,
  sanitizeClasswordInput,
  validateClasswordWord,
} from './classword';

test('초성 판별은 기본 초성과 지정된 된소리를 같은 칸으로 처리한다', () => {
  // Given
  const words = ['기차', '까치', '도마', '딸기', '바다', '뿌리', '사과', '쌀'] as const;

  // When
  const initials = words.map(getClasswordInitialFromWord);

  // Then
  assert.deepEqual(initials, ['ㄱ', 'ㄲ', 'ㄷ', 'ㄸ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ']);
  assert.equal(acceptsClasswordInitial('ㄱ', 'ㄲ'), true);
  assert.equal(acceptsClasswordInitial('ㄷ', 'ㄸ'), true);
  assert.equal(acceptsClasswordInitial('ㅂ', 'ㅃ'), true);
  assert.equal(acceptsClasswordInitial('ㅅ', 'ㅆ'), true);
  assert.equal(acceptsClasswordInitial('ㅈ', 'ㅉ'), true);
  assert.equal(acceptsClasswordInitial('ㄴ', 'ㄹ'), false);
  assert.equal(getClasswordInitialLabel('ㄱ'), 'ㄱ(ㄲ)');
  assert.equal(CLASSWORD_INITIALS.length, 14);
});

test('낱말 검증은 주제와 같거나 잘못된 형태인 입력을 거부한다', () => {
  // Given
  const cases = [
    ['', 'empty'],
    ['동물', 'same_topic'],
    ['1234', 'number_only'],
    ['강아지!', 'special_character'],
    ['가나다라마바사아자', 'too_long'],
    ['ㄱㄱ', 'jamo_only'],
    ['ㅋㅋㅋ', 'jamo_only'],
    ['가가가', 'repeated_character'],
    ['가가가나', 'repeated_character'],
    ['바보', 'blocked_word'],
    ['apple', 'non_korean_start'],
    ['사과', 'wrong_initial'],
  ] as const;

  // When
  const results = cases.map(([word]) => validateClasswordWord(word, 'ㄱ', '동물'));

  // Then
  results.forEach((result, index) => {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, cases[index]?.[1]);
  });
});

test('낱말 검증은 공백을 정리하고 올바른 한글 낱말을 반환한다', () => {
  // Given
  const word = '  까치  ';

  // When
  const result = validateClasswordWord(word, 'ㄱ', '동물');

  // Then
  assert.deepEqual(result, { ok: true, word: '까치' });
});

test('낱말 입력은 정리된 글자가 8자를 넘으면 초과분을 받지 않는다', () => {
  assert.equal(sanitizeClasswordInput('가나다라마바사아자'), '가나다라마바사아');
  assert.equal(sanitizeClasswordInput('가나다라-마바사아자'), '가나다라마바사아');
});

test('한국 날짜 키는 자정 경계에서 서울 날짜를 사용한다', () => {
  // Given
  const beforeMidnight = new Date('2026-08-29T14:59:59.000Z');
  const afterMidnight = new Date('2026-08-29T15:00:00.000Z');

  // When
  const beforeKey = getKoreanDateKey(beforeMidnight);
  const afterKey = getKoreanDateKey(afterMidnight);

  // Then
  assert.equal(beforeKey, '2026-08-29');
  assert.equal(afterKey, '2026-08-30');
});

test('날짜별 낱말은 오늘을 포함한 최근 14일만 보존한다', () => {
  // Given
  const augustDateKey = '2026-08-29';
  const januaryDateKey = '2026-01-05';

  // When
  const augustCutoff = getClasswordEntryRetentionCutoff(augustDateKey);
  const januaryCutoff = getClasswordEntryRetentionCutoff(januaryDateKey);

  // Then
  assert.equal(augustCutoff, '2026-08-16');
  assert.equal(januaryCutoff, '2025-12-23');
});

test('낱말판 응답 파서는 초성·학생 번호·날짜가 유효한 항목만 허용한다', () => {
  // Given
  const input = {
    dateKey: '2026-08-29',
    topic: '동물',
    entries: [{
      id: 'entry-1',
      dateKey: '2026-08-29',
      initial: 'ㄱ',
      word: '강아지',
      studentNumber: 3,
      createdAt: '2026-08-29T01:00:00.000Z',
      updatedAt: '2026-08-29T01:00:00.000Z',
    }],
  };

  // When
  const parsed = parseClasswordBoard(input);

  // Then
  assert.deepEqual(parsed, input);
  assert.throws(() => parseClasswordBoard({
    ...input,
    entries: [{ ...input.entries[0], studentNumber: 24 }],
  }), /CLASSWORD_BOARD_INVALID_RESPONSE/);
});
