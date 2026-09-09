import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync } from 'node:fs';
import { applyTeacherStorageCommand } from '../server/teacherStorageCommands.js';
import { TEACHER_MAIL_SENDERS, normalizeStudentLifeState, getTeacherStudentConversation } from './studentLife.js';
import StudentMailboxPage from '../components/student/StudentMailboxPage';

const context = { requestId: 'test-character', createdAt: '2026-09-09T04:00:00.000Z' };
const stamps = ['/mail-donation-baby-goma.png', '/mail-bank-dol-dol.png', '/(편지용) 고키리.png', '/daily-writing-letter-gahi.png'];
for (const [index, senderLabel] of TEACHER_MAIL_SENDERS.slice(1).entries()) {
  test(`${senderLabel}: teacher send preserves sender and content, appears in conversation with character stamp`, () => {
    const result = applyTeacherStorageCommand({}, 'teacher.mail.send', {
      recipients: [1, 2], senderLabel, title: '입금', content: '돝돝이가 응원해요.',
    }, context);
    assert.ok(result);
    const life = normalizeStudentLifeState(result.value.studentLife);
    assert.equal(life.letters.length, 2);
    const letters = getTeacherStudentConversation(life, 1);
    assert.equal(letters.length, 1);
    assert.equal(letters[0].senderLabel, senderLabel);
    assert.equal(letters[0].senderStudentNumber, null);
    assert.equal(letters[0].content, '돝돝이가 응원해요.');
    assert.equal(letters[0].title, '입금');
    const html = renderToStaticMarkup(createElement(StudentMailboxPage, {
      studentNumber: 1, profileAssignments: {}, letters, sentLetters: [], unreadCount: 1,
      isSaving: false, onRead: async () => {}, onSend: async () => true, onBack: () => {},
    }));
    assert.ok(html.includes(stamps[index]));
    assert.ok(html.includes(senderLabel));
    assert.ok(existsSync(`public${stamps[index]}`));
  });
}
test('teacher sender remains the default and unregistered senders are rejected', () => {
  const payload = { recipients: [1], title: '', content: '안녕' };
  const saved = applyTeacherStorageCommand({}, 'teacher.mail.send', payload, context);
  assert.ok(saved);
  assert.equal(normalizeStudentLifeState(saved.value.studentLife).letters[0].senderLabel, '선생님');
  assert.throws(() => applyTeacherStorageCommand({}, 'teacher.mail.send', { ...payload, senderLabel: '임의 캐릭터' }, context));
});
