import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALL_STUDENTS_LETTER_RECIPIENT,
  addStudentBook,
  applyPendingStudentLetterReads,
  clearPracticeFailureStories,
  createStudentLetter,
  createStudentLetters,
  getBookHeightCm,
  getBookSpineHeightPx,
  getBookStackLayout,
  getBookStackHeightCm,
  getStudentBooks,
  getStudentLetters,
  getStudentSentLetters,
  getTeacherLetters,
  getTeacherLetterRecipients,
  getUnreadTeacherLetterCount,
  getUnreadStudentLetterCount,
  markTeacherLetterRead,
  markStudentLetterRead,
  normalizeStudentLifeState,
} from './studentLife.ts';

test('교사는 모든 학생을 선택하면 1번부터 23번까지 편지를 한 통씩 만든다', () => {
  const recipients = getTeacherLetterRecipients(ALL_STUDENTS_LETTER_RECIPIENT);
  const state = createStudentLetters(
    normalizeStudentLifeState(null),
    recipients.map((recipient) => ({
      id: `teacher-broadcast-${recipient}`,
      recipient,
      senderLabel: '선생님',
      title: '알림',
      content: '모두에게 보내는 편지입니다.',
      createdAt: '2026-09-01T01:00:00.000Z',
    })),
  );

  assert.deepEqual(recipients, Array.from({ length: 23 }, (_, index) => index + 1));
  assert.equal(state.letters.length, 23);
  assert.ok(recipients.every((recipient) => getStudentLetters(state, recipient).length === 1));
});

test('연습 모드 초기화는 실패 이야기만 비우고 다른 학생 생활 데이터를 보존한다', () => {
  const state = normalizeStudentLifeState({
    letters: [{
      id: 'letter-1',
      recipient: 1,
      senderLabel: '선생님',
      title: '편지',
      content: '내용',
      createdAt: '2026-08-29T01:00:00.000Z',
      readAt: null,
    }],
    books: [{
      id: 'book-1',
      studentNumber: 1,
      title: '책',
      author: '작가',
      pageCount: 100,
      createdAt: '2026-08-29T01:00:00.000Z',
      colorIndex: 0,
    }],
    failureStories: [{
      id: 'failure-1',
      studentNumber: 1,
      failure: '실패',
      lesson: '다음 시도',
      stamps: [],
      createdAt: '2026-08-29T01:00:00.000Z',
      updatedAt: '2026-08-29T01:00:00.000Z',
    }],
  });

  const cleared = clearPracticeFailureStories(state);

  assert.equal(cleared.failureStories.length, 0);
  assert.equal(cleared.letters, state.letters);
  assert.equal(cleared.books, state.books);
  assert.equal(cleared.failureProfileAssignments, state.failureProfileAssignments);
});

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
    { id: 'book-1', studentNumber: 1, title: '첫 책', author: '', pageCount: 100, createdAt: '2026-08-11T01:00:00.000Z', colorIndex: 1 },
    { id: 'book-2', studentNumber: 1, title: '둘째 책', author: '', pageCount: 320, createdAt: '2026-08-11T02:00:00.000Z', colorIndex: 0 },
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

test('교사가 새 편지를 읽으면 교사 미읽음 수가 줄고 읽은 시각을 보존한다', () => {
  const initial = createStudentLetters(normalizeStudentLifeState(null), [
    {
      id: 'teacher-unread-1',
      recipient: 0,
      senderLabel: '7번',
      senderStudentNumber: 7,
      title: '첫 편지',
      content: '첫 번째 편지입니다.',
      createdAt: '2026-09-02T01:00:00.000Z',
    },
    {
      id: 'teacher-unread-2',
      recipient: 0,
      senderLabel: '8번',
      senderStudentNumber: 8,
      title: '둘째 편지',
      content: '두 번째 편지입니다.',
      createdAt: '2026-09-02T02:00:00.000Z',
    },
  ]);

  assert.equal(getUnreadTeacherLetterCount(initial), 2);

  const read = markTeacherLetterRead(initial, 'teacher-unread-2', '2026-09-02T03:00:00.000Z');

  assert.equal(getUnreadTeacherLetterCount(read), 1);
  assert.equal(getTeacherLetters(read)[0]?.readAt, '2026-09-02T03:00:00.000Z');
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

test('서로 다른 새 편지를 연달아 읽어도 모든 읽음 시각이 보존된다', () => {
  const initial = createStudentLetters(normalizeStudentLifeState(null), [
    {
      id: 'letter-fast-1',
      recipient: 3,
      senderLabel: '선생님',
      title: '첫 편지',
      content: '첫 번째 편지입니다.',
      createdAt: '2026-08-11T01:00:00.000Z',
    },
    {
      id: 'letter-fast-2',
      recipient: 3,
      senderLabel: '은행원 돝돝',
      title: '둘째 편지',
      content: '두 번째 편지입니다.',
      createdAt: '2026-08-11T02:00:00.000Z',
    },
  ]);

  const firstRead = markStudentLetterRead(initial, 3, 'letter-fast-1', '2026-08-11T03:00:00.000Z');
  const allRead = markStudentLetterRead(firstRead, 3, 'letter-fast-2', '2026-08-11T03:00:01.000Z');

  assert.equal(getUnreadStudentLetterCount(allRead, 3), 0);
  assert.ok(getStudentLetters(allRead, 3).every((letter) => letter.readAt !== null));
});

test('먼저 끝난 읽음 저장이 늦게 누른 편지의 New 상태를 되살리지 않는다', () => {
  const initial = createStudentLetters(normalizeStudentLifeState(null), [
    {
      id: 'letter-pending-1', recipient: 3, senderLabel: '선생님', title: '첫 편지',
      content: '첫 번째 편지입니다.', createdAt: '2026-09-03T01:00:00.000Z',
    },
    {
      id: 'letter-pending-2', recipient: 3, senderLabel: '선생님', title: '둘째 편지',
      content: '두 번째 편지입니다.', createdAt: '2026-09-03T01:01:00.000Z',
    },
  ]);
  const firstReadAt = '2026-09-03T02:00:00.000Z';
  const secondReadAt = '2026-09-03T02:00:01.000Z';
  const firstSaveResult = markStudentLetterRead(initial, 3, 'letter-pending-1', firstReadAt);

  const visible = applyPendingStudentLetterReads(firstSaveResult, 3, new Map([
    ['letter-pending-1', firstReadAt],
    ['letter-pending-2', secondReadAt],
  ]));

  assert.equal(getUnreadStudentLetterCount(visible, 3), 0);
  assert.equal(getStudentLetters(visible, 3).find((letter) => letter.id === 'letter-pending-2')?.readAt, secondReadAt);
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

test('추천 편지는 긴 이유도 잘리지 않고 같은 미션 요청은 중복 저장되지 않는다', () => {
  const content = `추천할 것\n긴긴밤\n\n추천하는 이유\n${'따뜻한 이야기라서 추천해요. '.repeat(20)}`;
  const letter = {
    id: 'today-friend-recommendation-2026-09-01-3-r1',
    recipient: 14,
    senderLabel: '3번',
    senderStudentNumber: 3,
    title: '[오늘의 친구] 책 추천',
    content,
    createdAt: '2026-09-01T01:00:00.000Z',
  };

  const first = createStudentLetter(normalizeStudentLifeState(null), letter);
  const retried = createStudentLetter(first, letter);

  assert.equal(getStudentLetters(retried, 14).length, 1);
  assert.equal(getStudentLetters(retried, 14)[0]?.content, content.trim());
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

test('기존 은행원 편지는 새 제목 형식과 자연스러운 자기 지칭으로 복구한다', () => {
  // Given / When
  const normalized = normalizeStudentLifeState({
    letters: [{
      id: 'bank-legacy-deposit',
      recipient: 1,
      senderLabel: '은행원 돝돝',
      title: '예금 접수 · 고마를 맡겼어요',
      content: '예금한 20 고마를 돝돝이가 잘 보관하고 있어요.',
      createdAt: '2026-08-24T01:00:00.000Z',
      readAt: null,
    }],
  });

  // Then
  assert.equal(normalized.letters[0]?.title.includes('·'), false);
  assert.equal(normalized.letters[0]?.title.endsWith('꿀!'), true);
  assert.equal(normalized.letters[0]?.content.includes('돝돝이가'), false);
  assert.equal(normalized.letters[0]?.content.includes('제가'), true);
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

test('새 책을 쌓아도 기존 책의 색상은 바뀌지 않는다', () => {
  const legacyState = normalizeStudentLifeState({
    books: [
      { id: 'oldest', studentNumber: 1, title: '첫 책', pageCount: 30, createdAt: '2026-08-20T01:00:00.000Z' },
      { id: 'other-student', studentNumber: 2, title: '다른 책', pageCount: 40, createdAt: '2026-08-20T02:00:00.000Z' },
      { id: 'latest', studentNumber: 1, title: '둘째 책', pageCount: 50, createdAt: '2026-08-21T01:00:00.000Z' },
    ],
  });
  const before = getStudentBooks(legacyState, 1).map((book) => ({ id: book.id, colorIndex: book.colorIndex }));

  const updated = addStudentBook(legacyState, {
    id: 'newest',
    studentNumber: 1,
    title: '새 책',
    author: '글쓴이',
    pageCount: 60,
    createdAt: '2026-08-22T01:00:00.000Z',
  });

  assert.deepEqual(before, [
    { id: 'latest', colorIndex: 0 },
    { id: 'oldest', colorIndex: 1 },
  ]);
  assert.deepEqual(getStudentBooks(updated, 1).map((book) => ({ id: book.id, colorIndex: book.colorIndex })), [
    { id: 'newest', colorIndex: 5 },
    ...before,
  ]);
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
