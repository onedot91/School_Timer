import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addStudentBook,
  createStudentLetter,
  getBookHeightCm,
  getBookStackHeightCm,
  getStudentBooks,
  getStudentLetters,
  getTeacherLetters,
  getUnreadStudentLetterCount,
  markStudentLetterRead,
  normalizeStudentLifeState,
} from './studentLife.ts';

test('책 높이는 쪽수에 비례하고 스택 높이는 각 책 높이의 합이다', () => {
  assert.equal(getBookHeightCm(100), 0.5);
  assert.equal(getBookHeightCm(320), 1.6);
  assert.equal(getBookStackHeightCm([
    { id: 'book-1', studentNumber: 1, title: '첫 책', pageCount: 100, createdAt: '2026-08-11T01:00:00.000Z' },
    { id: 'book-2', studentNumber: 1, title: '둘째 책', pageCount: 320, createdAt: '2026-08-11T02:00:00.000Z' },
  ]), 2.1);
});

test('학생은 선생님에게 편지를 보내고 답장 연결 정보를 보존한다', () => {
  const state = createStudentLetter(normalizeStudentLifeState(null), {
    id: 'teacher-letter-1',
    recipient: 0,
    senderLabel: '7번',
    senderStudentNumber: 7,
    replyToId: 'teacher-letter-0',
    title: '선생님께',
    content: '질문이 있어요.',
    createdAt: '2026-08-12T01:00:00.000Z',
  });

  assert.equal(getTeacherLetters(state).length, 1);
  assert.equal(getStudentLetters(state, 7).length, 0);
  assert.equal(getTeacherLetters(state)[0]?.senderStudentNumber, 7);
  assert.equal(getTeacherLetters(state)[0]?.replyToId, 'teacher-letter-0');
});

test('기존 편지는 답장 정보 없이도 그대로 정규화된다', () => {
  const state = normalizeStudentLifeState({
    letters: [{ id: 'legacy', recipient: 2, senderLabel: '선생님', title: '', content: '안녕', createdAt: '2026-08-12T01:00:00.000Z', readAt: null }],
  });

  assert.equal(state.letters[0]?.senderStudentNumber, null);
  assert.equal(state.letters[0]?.replyToId, null);
});

test('편지는 수신 학생에게만 보이고 읽은 뒤 알림 수가 줄어든다', () => {
  const initial = createStudentLetter(normalizeStudentLifeState(null), {
    id: 'letter-1',
    recipient: 3,
    senderLabel: '선생님',
    title: '알림',
    content: '오늘도 힘내자.',
    createdAt: '2026-08-11T01:00:00.000Z',
  });

  assert.equal(getStudentLetters(initial, 2).length, 0);
  assert.equal(getUnreadStudentLetterCount(initial, 3), 1);

  const read = markStudentLetterRead(initial, 3, 'letter-1', '2026-08-11T02:00:00.000Z');
  assert.equal(getUnreadStudentLetterCount(read, 3), 0);
  assert.equal(getStudentLetters(read, 3)[0]?.readAt, '2026-08-11T02:00:00.000Z');
});

test('같은 요청 ID의 편지와 책은 한 번만 저장된다', () => {
  const letterInput = {
    id: 'same-letter',
    recipient: 4,
    senderLabel: '1번',
    title: '',
    content: '안녕!',
    createdAt: '2026-08-11T01:00:00.000Z',
  };
  const withLetter = createStudentLetter(createStudentLetter(normalizeStudentLifeState(null), letterInput), letterInput);

  const bookInput = {
    id: 'same-book',
    studentNumber: 4,
    title: '어린 왕자',
    pageCount: 120,
    createdAt: '2026-08-11T01:00:00.000Z',
  };
  const withBook = addStudentBook(addStudentBook(withLetter, bookInput), bookInput);

  assert.equal(getStudentLetters(withBook, 4).length, 1);
  assert.equal(getStudentBooks(withBook, 4).length, 1);
});

test('잘못된 학생 번호와 빈 기록은 정규화에서 제외된다', () => {
  const normalized = normalizeStudentLifeState({
    letters: [
      { id: 'ok', recipient: 1, senderLabel: '선생님', title: '', content: '확인', createdAt: '2026-08-11T01:00:00.000Z', readAt: null },
      { id: 'bad', recipient: 99, senderLabel: '선생님', title: '', content: '제외', createdAt: '2026-08-11T01:00:00.000Z', readAt: null },
    ],
    books: [
      { id: 'ok-book', studentNumber: 1, title: '책', pageCount: 10, createdAt: '2026-08-11T01:00:00.000Z' },
      { id: 'bad-book', studentNumber: 1, title: '', pageCount: 10, createdAt: '2026-08-11T01:00:00.000Z' },
    ],
  });

  assert.equal(normalized.letters.length, 1);
  assert.equal(normalized.books.length, 1);
});
