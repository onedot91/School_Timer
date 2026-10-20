import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLockedStudentCharacterWalker, type StudentCharacterWalkLock } from './studentCharacterWalkLock.js';

type Walker = { readonly character: { readonly id: string } };
const walker = (id: string): Walker => ({ character: { id } });

test('섞는 순서가 바뀌어도 걷는 중인 캐릭터는 걸음이 끝날 때까지 그대로 둔다', () => {
  const locks = new Map<number, StudentCharacterWalkLock<Walker>>();
  const visible = new Set(['a', 'b', 'c']);
  const first = resolveLockedStudentCharacterWalker(locks, 0, 0, visible, () => walker('a'));
  const reshuffled = resolveLockedStudentCharacterWalker(locks, 0, 0, visible, () => walker('b'));
  assert.equal(reshuffled, first);
  const next = resolveLockedStudentCharacterWalker(locks, 0, 1, visible, () => walker('b'));
  assert.equal(next?.character.id, 'b');
});

test('걷던 캐릭터가 사라지면 새 캐릭터를 고른다', () => {
  const locks = new Map<number, StudentCharacterWalkLock<Walker>>();
  resolveLockedStudentCharacterWalker(locks, 1, 0, new Set(['a', 'b']), () => walker('a'));
  const replaced = resolveLockedStudentCharacterWalker(locks, 1, 0, new Set(['b']), () => walker('b'));
  assert.equal(replaced?.character.id, 'b');
  assert.equal(resolveLockedStudentCharacterWalker(locks, 1, 0, new Set(['b']), () => null)?.character.id, 'b');
});
