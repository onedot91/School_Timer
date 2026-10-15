import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

import StudentMailboxPage, { changeStudentMailboxRecipient, getStudentMailboxRecipientOptions } from '../components/student/StudentMailboxPage';
import { FAILURE_PROFILE_IMAGES } from './failureExhibition';

test('학생이 받은 편지는 발신 학생 프로필을 우표로 표시한다', () => {
  const profileImage = FAILURE_PROFILE_IMAGES[0];
  const markup = renderToStaticMarkup(createElement(StudentMailboxPage, {
    studentNumber: 14,
    profileAssignments: { 3: profileImage },
    letters: [{
      id: 'today-friend-compliment-2026-09-01-3-r1',
      recipient: 14,
      senderLabel: '3번',
      senderStudentNumber: 3,
      replyToId: null,
      title: '[오늘의 친구] 칭찬 편지',
      content: '칭찬 편지',
      createdAt: '2026-09-01T01:00:00.000Z',
      readAt: null,
    }],
    sentLetters: [],
    unreadCount: 1,
    isSaving: false,
    onRead: async () => {},
    onSend: async () => true,
    onBack: () => {},
  }));

  assert.match(markup, /student-mail-envelope-stamp[^>]*data-profile="true"/);
  assert.match(markup, new RegExp(`src="${profileImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
});

test('편지 작성 시 선생님과 오늘의 친구를 받는 사람으로 선택할 수 있다', () => {
  assert.deepEqual(getStudentMailboxRecipientOptions(14), [
    { value: 0, label: '선생님' },
    { value: 14, label: '오늘의 친구(14번)' },
  ]);
  assert.deepEqual(getStudentMailboxRecipientOptions(null), [
    { value: 0, label: '선생님' },
  ]);
});

test('23번 학생이 답장 초안의 수신자를 오늘의 친구 4번으로 바꾸면 내용은 보존하고 답장 연결은 해제한다', () => {
  assert.deepEqual(getStudentMailboxRecipientOptions(4), [
    { value: 0, label: '선생님' },
    { value: 4, label: '오늘의 친구(4번)' },
  ]);
  const draft = { recipient: 0, title: '답장: 안부', content: '테스트 편지', replyToId: 'teacher-fixture' };
  assert.deepEqual(changeStudentMailboxRecipient(draft, 4), {
    recipient: 4, title: draft.title, content: draft.content,
  });
  assert.deepEqual(changeStudentMailboxRecipient(draft, 0), draft);
  const friendDraft = changeStudentMailboxRecipient(draft, 4);
  assert.equal(changeStudentMailboxRecipient(friendDraft, 0).replyToId, undefined);
});

test('수신자 선택은 답장 초안에서도 가능하고 저장 확인 중에만 잠근다', () => {
  const source = readFileSync(new URL('../components/student/StudentMailboxPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /disabled=\{hasPendingSave \|\| isSaving\}/);
  assert.doesNotMatch(source, /disabled=\{[^}]*replyToId/);
  assert.match(source, /setReplyToId\(nextDraft.replyToId\)/);
  assert.match(source, /onDraftChange\?\.\(nextDraft\)/);
});
