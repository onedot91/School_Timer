import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EntrySelectPage from '../pages/EntrySelectPage';

const renderEntrySelect = (teacherEntryVisible: boolean) => renderToStaticMarkup(createElement(EntrySelectPage, {
  onSelectNumber: async () => undefined,
  requiresRegistration: false,
  deviceSession: null,
  teacherEntryVisible,
}));

test('교사 입장 이력이 있으면 번호 선택 화면에 0번을 바로 표시한다', () => {
  // Given
  const teacherEntryVisible = true;

  // When
  const markup = renderEntrySelect(teacherEntryVisible);

  // Then
  assert.match(markup, /aria-label="0번 학급 시계 선택"/);
  assert.doesNotMatch(markup, /aria-label="0번 표시 잠금 해제"/);
});

test('교사 입장 이력이 없으면 0번 숨김 해제 버튼을 유지한다', () => {
  // Given
  const teacherEntryVisible = false;

  // When
  const markup = renderEntrySelect(teacherEntryVisible);

  // Then
  assert.doesNotMatch(markup, /aria-label="0번 학급 시계 선택"/);
  assert.match(markup, /aria-label="0번 표시 잠금 해제"/);
});
