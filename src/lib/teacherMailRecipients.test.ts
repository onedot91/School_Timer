import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TeacherMailRecipientPicker from '../components/teacher/TeacherMailRecipientPicker.tsx';

test('편지 수신자 선택은 체크박스와 선택 인원을 표시한다', () => {
  const markup = renderToStaticMarkup(createElement(TeacherMailRecipientPicker, {
    recipients: [2, 7], isSending: false, onChange: () => undefined,
  }));
  assert.match(markup, /받는 학생 · 2명/);
  assert.equal((markup.match(/type="checkbox"/g) ?? []).length, 24);
  assert.equal((markup.match(/checked=""/g) ?? []).length, 2);
  assert.match(markup, /전체 학생/);
  assert.match(markup, /선택 해제/);
});

test('발송 중 수신자 변경을 막고 빈 선택은 해제 버튼을 비활성화한다', () => {
  const pending = renderToStaticMarkup(createElement(TeacherMailRecipientPicker, {
    recipients: [1, 2], isSending: true, onChange: () => undefined,
  }));
  assert.match(pending, /<fieldset[^>]*disabled=""/);
  const empty = renderToStaticMarkup(createElement(TeacherMailRecipientPicker, {
    recipients: [], isSending: false, onChange: () => undefined,
  }));
  assert.match(empty, /받는 학생 · 0명/);
  assert.match(empty, /<button[^>]*disabled=""[^>]*>선택 해제/);
});
