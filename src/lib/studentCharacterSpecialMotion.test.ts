import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { shouldSelectSpecialMotion } from '../components/teacher/studentCharacterSpecialMotion.js';
import { STUDENT_CHARACTERS } from './studentCharacters.js';
import motions from '../components/teacher/studentCharacterSpecialMotions.json' with { type: 'json' };

test('특별 모션은 각 등장에 대해 5%만 선택한다', () => {
  assert.equal(shouldSelectSpecialMotion(0), true);
  assert.equal(shouldSelectSpecialMotion(0.049999), true);
  assert.equal(shouldSelectSpecialMotion(0.05), false);
  assert.equal(shouldSelectSpecialMotion(0.99), false);
});

test('교실 캐릭터마다 사용할 수 있는 모션 파일이 있다', () => {
  for (const character of STUDENT_CHARACTERS) {
    const name = character.imageSrc.split('/').pop() ?? '';
    const motion = (motions as Record<string, { src: string }>)[name];
    assert.ok(motion, name);
    assert.ok(existsSync(new URL(`../../public${motion.src}`, import.meta.url)), name);
  }
});

test('특별 모션은 동작 줄이기 설정으로 선택이나 재생을 막지 않는다', () => {
  const stage = readFileSync(new URL('../components/teacher/StudentCharacterStage.tsx', import.meta.url), 'utf8');
  const start = stage.indexOf('nodes.forEach(node => {\n        if (!specialChoices.has(node))');
  const end = stage.indexOf('positions.forEach', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(stage.slice(start, end), /reduceMotion|prefers-reduced-motion|teacherMotion/);
});
