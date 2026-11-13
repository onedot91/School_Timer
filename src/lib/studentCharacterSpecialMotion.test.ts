import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { SpecialMotionSchedule } from '../components/teacher/studentCharacterSpecialMotion.js';
import { STUDENT_CHARACTERS } from './studentCharacters.js';
import motions from '../components/teacher/studentCharacterSpecialMotions.json' with { type: 'json' };

test('특별 모션은 5~8번째 등장 중 선택하고 재생되면 다시 센다', () => {
  for (let target = 5; target <= 8; target += 1) {
    const schedule = new SpecialMotionSchedule(() => (target - 5) / 4);
    for (let count = 1; count < target; count += 1) assert.equal(schedule.recordAppearance(), false);
    assert.equal(schedule.recordAppearance(), true);
    assert.equal(schedule.recordAppearance(), true, '재생하지 못하면 다음 등장에도 대기한다');
    assert.equal(schedule.generation, 0);
    schedule.complete();
    assert.equal(schedule.generation, 1);
    assert.equal(schedule.recordAppearance(), false);
  }
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
