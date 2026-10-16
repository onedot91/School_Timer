import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StableLabel from '../components/StableLabel';
import StatusSlot from '../components/StatusSlot';

test('stable label keeps both labels mounted and exposes only the active one', () => {
  const idle = renderToStaticMarkup(createElement(StableLabel, { label: '보내기', busyLabel: '보내는 중', busy: false }));
  const busy = renderToStaticMarkup(createElement(StableLabel, { label: '보내기', busyLabel: '보내는 중', busy: true }));
  for (const markup of [idle, busy]) {
    assert.match(markup, /보내기/);
    assert.match(markup, /보내는 중/);
  }
  assert.match(idle, /data-active="true">보내기</);
  assert.match(idle, /data-active="false" aria-hidden="true">보내는 중</);
  assert.match(busy, /data-active="false" aria-hidden="true">보내기</);
  assert.match(busy, /data-active="true">보내는 중</);
});

test('status slot stays mounted as a live region when it has no message', () => {
  const empty = renderToStaticMarkup(createElement(StatusSlot, { className: 'notice' }));
  assert.equal(empty, '<p class="status-slot notice" role="status" aria-live="polite"></p>');
  assert.match(renderToStaticMarkup(createElement(StatusSlot, null, '저장 중')), />저장 중</);
});
