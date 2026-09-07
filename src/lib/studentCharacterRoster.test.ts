import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { STUDENT_CHARACTERS, getStudentCharacterRoster } from './studentCharacters.js';

test('교사 캐릭터 명단은 1번부터 23번까지 빠짐없이 만든다', () => {
  const roster = getStudentCharacterRoster();

  assert.equal(roster.length, 33);
  assert.deepEqual([...new Set(roster.map(({ studentNumber }) => studentNumber))], Array.from({ length: 23 }, (_, index) => index + 1));
});

test('등록된 이동 캐릭터를 번호에 연결하고 미등록 번호는 공란으로 둔다', () => {
  const roster = getStudentCharacterRoster();

  assert.equal(roster[0]?.character, STUDENT_CHARACTERS.find(({ creatorName }) => creatorName === '1번'));
  for (const studentNumber of [6, 14, 19, 20]) {
    assert.equal(roster.find((slot) => slot.studentNumber === studentNumber)?.character, null);
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
  assert.match(source, /aria-label=\{character \? `\$\{studentNumber\}번 캐릭터, 멘트:/);
  assert.match(css, /\.teacher-shop-character-grid \{[^}]*grid-template-columns: repeat\(5,[^}]*grid-auto-rows: 8\.5rem;/);
  assert.match(css, /\.teacher-shop-character-grid > article \{[^}]*block-size: 100%;[^}]*grid-template-rows: auto 3rem minmax\(2\.65rem, auto\);/);
});

test('추가 캐릭터는 기존 캐릭터와 함께 번호에 연결된다', () => {
  const roster = getStudentCharacterRoster();
  for (const studentNumber of [2, 5, 8, 9, 10, 11, 15, 16, 21, 23]) {
    assert.equal(roster.filter((slot) => slot.studentNumber === studentNumber).length, 2);
  }
  assert.equal(roster.filter((slot) => slot.studentNumber === 17).length, 1);
  assert.equal(roster.find((slot) => slot.studentNumber === 17)?.character?.speech, '안뇽하슈아!');
  assert.equal(roster.filter(({ character }) => character !== null).length, STUDENT_CHARACTERS.length);
});
