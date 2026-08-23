import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addStudentBook,
  createStudentLetter,
  getBookHeightCm,
  getBookSpineHeightPx,
  getBookStackLayout,
  getBookStackHeightCm,
  getStudentBooks,
  getStudentLetters,
  getStudentSentLetters,
  getTeacherLetters,
  getUnreadStudentLetterCount,
  markStudentLetterRead,
  normalizeStudentLifeState,
} from './studentLife.ts';

test('책 두께는 쪽당 0.005cm의 실제 높이를 따르면서 화면을 덮지 않는다', () => {
  const pageCounts = [15, 30, 37, 45];

  assert.equal(getBookHeightCm(280), 1.4);
  assert.equal(getBookHeightCm(204), 1.02);
  assert.equal(getBookHeightCm(152), 0.76);
  assert.equal(getBookHeightCm(40), 0.2);
  assert.equal(getBookSpineHeightPx(15, pageCounts), 27);
  assert.equal(getBookSpineHeightPx(30, pageCounts), 36);
  assert.equal(getBookSpineHeightPx(37, pageCounts), 40.2);
  assert.equal(getBookSpineHeightPx(45, pageCounts), 45);
  assert.ok(getBookSpineHeightPx(1, [1, 2, 3]) < getBookSpineHeightPx(2, [1, 2, 3]));
  assert.ok(getBookSpineHeightPx(2, [1, 2, 3]) < getBookSpineHeightPx(3, [1, 2, 3]));
  assert.equal(
    getBookSpineHeightPx(200, [100, 200, 300]) - getBookSpineHeightPx(100, [100, 200, 300]),
    getBookSpineHeightPx(300, [100, 200, 300]) - getBookSpineHeightPx(200, [100, 200, 300]),
  );
  assert.equal(getBookSpineHeightPx(5000, [15, 5000]), 45);
  assert.equal(getBookSpineHeightPx(320, [320]), 36);
  assert.equal(getBookStackHeightCm([
    { id: 'book-1', studentNumber: 1, title: '첫 책', author: '', pageCount: 100, createdAt: '2026-08-11T01:00:00.000Z' },
    { id: 'book-2', studentNumber: 1, title: '둘째 책', author: '', pageCount: 320, createdAt: '2026-08-11T02:00:00.000Z' },
  ]), 2.1);
});

test('책 배치는 같은 너비로 중심에서 왼쪽과 오른쪽을 번갈아 가면서 책장 안에 머문다', () => {
  const layouts = Array.from({ length: 12 }, (_, index) => getBookStackLayout(index));
  const totalOffset = layouts.reduce((sum, layout) => sum + layout.offsetPercent, 0);

  assert.equal(new Set(layouts.map((layout) => layout.widthPercent)).size, 1);
  assert.ok(layouts.every((layout) => layout.widthPercent === 88));
  assert.ok(layouts.every((layout, index) => (
    Math.abs(layout.offsetPercent) <= 2
    && (index % 2 === 0 ? layout.offsetPercent < 0 : layout.offsetPercent > 0)
  )));
  assert.ok(Math.abs(totalOffset) < 0.001);
  assert.deepEqual(getBookStackLayout(12), getBookStackLayout(0));
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

test('보낸 편지는 기존 발신자 번호로 구분하고 최신순으로 보여 준다', () => {
  const first = createStudentLetter(normalizeStudentLifeState(null), {
    id: 'sent-first',
    recipient: 2,
    senderLabel: '3번',
    senderStudentNumber: 3,
    title: '첫 편지',
    content: '먼저 보낸 편지예요.',
    createdAt: '2026-08-11T01:00:00.000Z',
  });
  const second = createStudentLetter(first, {
    id: 'sent-second',
    recipient: 0,
    senderLabel: '3번',
    senderStudentNumber: 3,
    title: '둘째 편지',
    content: '나중에 보낸 편지예요.',
    createdAt: '2026-08-11T02:00:00.000Z',
  });

  assert.deepEqual(getStudentSentLetters(second, 3).map((letter) => letter.id), ['sent-second', 'sent-first']);
  assert.equal(getStudentSentLetters(second, 2).length, 0);
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
    author: '생텍쥐페리',
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
  assert.equal(normalized.books[0]?.author, '');
});

test('새 책은 글쓴이를 정리해 저장한다', () => {
  const state = addStudentBook(normalizeStudentLifeState(null), {
    id: 'book-with-author',
    studentNumber: 1,
    title: '어린 왕자',
    author: '  생텍쥐페리  ',
    pageCount: 120,
    createdAt: '2026-08-22T01:00:00.000Z',
  });

  assert.equal(state.books[0]?.author, '생텍쥐페리');
});

test('학생 생활 상태는 유효한 실패 이야기와 익명 응원 도장을 복구한다', () => {
  // Given
  const saved = {
    failureStories: [{
      id: 'failure-1',
      studentNumber: 7,
      failure: '  발표할 말을 잊었어요.  ',
      lesson: '천천히 다시 시작하면 된다는 걸 알았어요.',
      stamps: [
        { studentNumber: 3, stampId: 'cheer' },
        { studentNumber: 3, stampId: 'me-too' },
      ],
      createdAt: '2026-08-23T01:00:00.000Z',
      updatedAt: '2026-08-23T01:00:00.000Z',
    }],
  };

  // When
  const state = normalizeStudentLifeState(saved);

  // Then
  assert.equal(state.failureStories.length, 1);
  assert.equal(state.failureStories[0]?.failure, '발표할 말을 잊었어요.');
  assert.equal(state.failureStories[0]?.stamps.length, 1);
});
