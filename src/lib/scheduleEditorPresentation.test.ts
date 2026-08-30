import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const loadTimerPageSource = () => readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

test('시간표 일정 사이에는 해당 위치에 삽입하는 추가 버튼이 있다', async () => {
  const source = await loadTimerPageSource();
  const panelStart = source.indexOf('const scheduleSettingsPanel =');
  const panelEnd = source.indexOf('const subjectSettingsPanel =', panelStart);
  const panel = source.slice(panelStart, panelEnd);

  assert.match(panel, /className="slot-insert-rail"/);
  assert.match(panel, /onClick=\{\(\) => addSlot\(editingDay, index\)\}/);
  assert.match(panel, /aria-label=\{`\$\{slot\.name\} 다음에 일정 추가`\}/);
});

test('쉬는 시간과 점심시간 유형은 일정 이름을 같은 문구로 고정한다', async () => {
  const source = await loadTimerPageSource();

  assert.match(source, /if \(type === 'break'\) return '쉬는 시간';/);
  assert.match(source, /if \(type === 'lunch'\) return '점심시간';/);
  assert.match(source, /nextSlot\.name = fixedScheduleName;/);
});
