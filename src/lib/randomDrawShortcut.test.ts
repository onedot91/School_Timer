import assert from 'node:assert/strict';
import test from 'node:test';

import { isStudentDrawShortcutKey } from './randomDraw';

test('오른쪽 방향키와 Enter는 학생 추첨 단축키로 동작한다', () => {
  assert.equal(isStudentDrawShortcutKey({ key: 'ArrowRight', code: 'ArrowRight' }), true);
  assert.equal(isStudentDrawShortcutKey({ key: 'Enter', code: 'Enter' }), true);
  assert.equal(isStudentDrawShortcutKey({ key: 'Enter', code: 'NumpadEnter' }), true);
});

test('다른 키는 학생 추첨 단축키로 처리하지 않는다', () => {
  assert.equal(isStudentDrawShortcutKey({ key: 'ArrowLeft', code: 'ArrowLeft' }), false);
  assert.equal(isStudentDrawShortcutKey({ key: ' ', code: 'Space' }), false);
});
