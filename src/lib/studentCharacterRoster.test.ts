import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { STUDENT_CHARACTERS, getStudentCharacterRoster } from './studentCharacters.js';

test('교사 캐릭터 명단은 1번부터 23번까지 빠짐없이 만든다', () => {
  const roster = getStudentCharacterRoster();

  assert.equal(roster.length, 23);
  assert.deepEqual([...new Set(roster.map(({ studentNumber }) => studentNumber))], Array.from({ length: 23 }, (_, index) => index + 1));
});

test('등록된 이동 캐릭터를 번호에 연결하고 미등록 번호는 공란으로 둔다', () => {
  const roster = getStudentCharacterRoster();

  assert.equal(roster[0]?.characters[0], STUDENT_CHARACTERS.find(({ creatorName }) => creatorName === '1번'));
  for (const studentNumber of [20]) {
    assert.equal(roster.find((slot) => slot.studentNumber === studentNumber)?.characters.length, 0);
  }
});

test('등록된 교실 캐릭터는 멘트와 고유 ID를 가진다', () => {
  assert.equal(STUDENT_CHARACTERS.every(({ speech }) => typeof speech === 'string' && speech.trim().length > 0), true);
  assert.equal(new Set(STUDENT_CHARACTERS.map(({ id }) => id)).size, STUDENT_CHARACTERS.length);
});

test('교사 캐릭터 카드에는 자캐 이름을 표시하지 않는다', async () => {
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /\{character \? <span>\{character\.name\}<\/span> : null\}/);
  assert.match(source, /className="teacher-shop-character-message"/);
  assert.match(source, /<q>\{speech\}<\/q>/);
  assert.match(source, /캐릭터 대기/);
  assert.match(source, /멘트 대기/);
  assert.match(css, /\.teacher-shop-character-grid \{[^}]*grid-template-columns: repeat\(5,[^}]*grid-auto-rows: auto;/);
});

test('추가 캐릭터는 기존 캐릭터와 함께 번호에 연결된다', () => {
  const roster = getStudentCharacterRoster();
  for (const studentNumber of [1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16, 18, 21, 22, 23]) {
    assert.equal(roster.find((slot) => slot.studentNumber === studentNumber)?.characters.length, 2);
  }
  assert.equal(roster.find((slot) => slot.studentNumber === 17)?.characters.length, 1);
  assert.deepEqual(roster.find((slot) => slot.studentNumber === 10)?.characters.map(({ id }) => id), ['student-10-additional']);
  assert.equal(roster.find((slot) => slot.studentNumber === 17)?.characters[0]?.speech, '안뇽하슈아!');
  assert.equal(roster.flatMap(({ characters }) => characters).length, STUDENT_CHARACTERS.length);
});

test('12번 추가 캐릭터는 좌우 멘트를 따로 표시하고 방향을 유지한다', () => {
  const character = STUDENT_CHARACTERS.find(({ id }) => id === 'student-12-additional');
  assert.deepEqual(character?.speechBubbles?.map(({ text }) => text), ['흥!', '에베베베']);
  assert.deepEqual(character?.walkTransform, { right: 'none', left: 'none' });
  for (const studentNumber of [6, 14, 19]) assert.equal(getStudentCharacterRoster().find((slot) => slot.studentNumber === studentNumber)?.characters.length, 1);
});
