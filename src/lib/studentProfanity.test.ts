import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  findStudentForbiddenTerm,
  isStudentFreeTextInputType,
  shouldBlockStudentTextWhileTyping,
} from './studentProfanity';

test('학생 금칙어는 한글 욕설과 띄어쓰기 우회를 차단한다', () => {
  // Given
  const inputs = ['정말 씨발 싫어', '개 새 끼라고 부르지 마'];

  // When
  const matches = inputs.map(findStudentForbiddenTerm);

  // Then
  assert.deepEqual(matches.map((match) => match !== null), [true, true]);
});

test('학생 금칙어는 유니코드 폭 변형 영문을 차단한다', () => {
  // Given
  const input = 'ＦＵＣＫ';

  // When
  const match = findStudentForbiddenTerm(input);

  // Then
  assert.notEqual(match, null);
});

test('두 글자 금칙어는 정상 단어 안의 부분 문자열이면 허용한다', () => {
  // Given
  const input = '시발점에서 다시 출발했어요';

  // When
  const match = findStudentForbiddenTerm(input);

  // Then
  assert.equal(match, null);
});

test('한 글자 자료 항목은 정상 문장을 막지 않는다', () => {
  // Given
  const input = '2026년 목표를 적었어요';

  // When
  const match = findStudentForbiddenTerm(input);

  // Then
  assert.equal(match, null);
});

test('자료에 섞인 기관명과 역할명은 정상 문장에서 허용한다', () => {
  // Given
  const inputs = [
    '개발자가 되고 싶어요',
    '관리자 선생님께 물어봐요',
    '고객센터와 공정거래위원회를 조사했어요',
  ];

  // When
  const matches = inputs.map(findStudentForbiddenTerm);

  // Then
  assert.deepEqual(matches, [null, null, null]);
});

test('입력 중인 두 글자 금칙어는 제출 전까지 조합을 방해하지 않는다', () => {
  // Given
  const input = '씨발';

  // When
  const blockedWhileTyping = shouldBlockStudentTextWhileTyping(input);
  const blockedOnCommit = findStudentForbiddenTerm(input) !== null;

  // Then
  assert.equal(blockedWhileTyping, false);
  assert.equal(blockedOnCommit, true);
});

test('학생 금칙어 정책은 자유 입력만 검사하고 숫자·선택 입력은 제외한다', () => {
  // Given
  const inputTypes = ['text', 'search', 'number', 'date', 'checkbox'];

  // When
  const guarded = inputTypes.map(isStudentFreeTextInputType);

  // Then
  assert.deepEqual(guarded, [true, true, false, false, false]);
});
