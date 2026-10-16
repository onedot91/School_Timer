import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const TYPE_ROLES = ['display', 'title', 'heading', 'body', 'body-sm', 'label', 'caption'];
const SETTINGS_SELECTOR = /settings|teacher-(mail|writing|loan|stock|shop|library-competition|today-friend|newspaper|question|investment|reward|classword-panel|save-failure|return-guide|bookstore)|emotion-status|currency-history|auction-settings/;
// Compact badges and character bubbles sized against fixed artwork.
const ALLOWED_RAW_SIZES = new Set(['.62rem', '.65rem', 'var(--teacher-investment-label-size)']);

test('글자 크기 토큰은 7단계 역할로 정의한다', async () => {
  const styles = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  for (const role of TYPE_ROLES) assert.match(styles, new RegExp(`--type-${role}: [0-9.]+rem;`));
});

test('교사 설정 화면 규칙은 글자 크기 토큰만 사용한다', async () => {
  const styles = (await readFile(new URL('../index.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rawSizes: string[] = [];

  for (const [, selector, body] of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!SETTINGS_SELECTOR.test(selector) || /\.student-/.test(selector)) continue;
    for (const [, value] of body.matchAll(/font-size:\s*([^;!}]+?)\s*(?:!important)?\s*(?=[;}])/g)) {
      if (!value.startsWith('var(--type-') && !ALLOWED_RAW_SIZES.has(value)) rawSizes.push(`${selector.trim()} → ${value}`);
    }
  }

  assert.deepEqual(rawSizes, []);
});

test('교사 설정 패널 코드는 Tailwind 기본 글자 크기 대신 토큰을 쓴다', async () => {
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('const scheduleSettingsPanel = (');
  const end = source.lastIndexOf('\n  return (');
  const panels = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(panels, /(?<![\w[-])text-(xs|sm|base|lg|xl|2xl|\[[0-9.]+rem\])(?=[\s"`'])/);
});

// Initial glyphs drawn inside fixed artwork: the lime `+` medallion and the quiz hint plate.
const CLASSWORD_ARTWORK_SELECTOR = /\.classword-(empty-mark|quiz-initial)$/;
const CLASSWORD_SOURCES = [
  '../components/student/ClasswordBoard.tsx',
  '../components/student/ClasswordQuiz.tsx',
  '../components/student/StudentClasswordPage.tsx',
  '../components/teacher/TeacherClasswordPanel.tsx',
  '../components/teacher/ClasswordCalendar.tsx',
];

test('낱말판 규칙은 글자 크기 토큰만 사용한다', async () => {
  const tokens = (await readFile(new URL('../index.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const styles = (await readFile(new URL('../classword.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const aliases = new Map<string, string>();
  for (const [, name, value] of tokens.matchAll(/(--classword-[\w-]+-size):\s*([^;}]+?)\s*(?=[;}])/g)) aliases.set(name, value);
  // Initials' tense-alias subscripts scale with their tokenized parent glyph.
  const isTypeToken = (value: string): boolean => value.startsWith('var(--type-')
    || /^[0-9.]+em$/.test(value)
    || Boolean(aliases.get(value.match(/^var\((--classword-[\w-]+)\)$/)?.[1] ?? '')?.startsWith('var(--type-'));
  const rawSizes: string[] = [];

  for (const [, selector, body] of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (CLASSWORD_ARTWORK_SELECTOR.test(selector.trim())) continue;
    for (const [, value] of body.matchAll(/font-size:\s*([^;!}]+?)\s*(?:!important)?\s*(?=[;}])/g)) {
      if (!isTypeToken(value)) rawSizes.push(`${selector.trim()} → ${value}`);
    }
  }

  assert.deepEqual(rawSizes, []);
});

test('낱말판 화면 코드는 Tailwind 기본 글자 크기 대신 토큰을 쓴다', async () => {
  for (const path of CLASSWORD_SOURCES) {
    const code = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /(?<![\w[-])text-(xs|sm|base|lg|xl|[2-9]xl|\[(clamp\(|[0-9.]+(rem|px)\]))/, path);
  }
});
