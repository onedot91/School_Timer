import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('교사 설정 패널 틀은 카드가 아닌 배치용 영역으로 남긴다', async () => {
  const styles = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const start = styles.indexOf('.teacher-settings-theme .settings-dialog section.settings-frame {');
  const rule = styles.slice(start, styles.indexOf('}', start));

  assert.ok(start >= 0);
  assert.match(rule, /background: transparent !important/);
  assert.match(rule, /border: 0 !important/);
  assert.match(rule, /box-shadow: none !important/);
});

test('교사 설정 제목은 옛 초록 대신 교사 글자색을 쓴다', async () => {
  const styles = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  assert.match(styles, /\.teacher-settings-theme \.settings-dialog \.section-title \{\s*color: var\(--teacher-text\) !important;/);
  assert.match(styles, /\.teacher-settings-theme \.settings-dialog \{\s*--card-surface: var\(--teacher-surface\);\s*--card-radius: var\(--apple-radius-card\);/);
});
