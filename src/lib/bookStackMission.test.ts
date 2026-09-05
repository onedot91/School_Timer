import assert from 'node:assert/strict';
import test from 'node:test';
import { createBookStackMissionEntry } from './bookStackMission.js';

test('책장에 책을 등록하면 같은 주에 10고마를 한 번만 지급한다', () => {
  const initial = {
    currencyBalances: { 4: 80 },
    currencyHistory: { 4: [] },
    studentLife: {},
  };
  const first = createBookStackMissionEntry(initial, {
    id: 'book-1',
    studentNumber: 4,
    title: '마당을 나온 암탉',
    author: '황선미',
    pageCount: 200,
    createdAt: '2026-07-13T03:00:00.000Z',
    librarySlot: 0,
  });
  const second = createBookStackMissionEntry(first.value, {
    id: 'book-2',
    studentNumber: 4,
    title: '몽실 언니',
    author: '권정생',
    pageCount: 160,
    createdAt: '2026-07-14T03:00:00.000Z',
    librarySlot: 1,
  });

  assert.equal(first.applied, true);
  assert.equal(first.awarded, true);
  assert.equal(first.balance, 90);
  assert.equal(first.studentLife.books.length, 1);
  assert.equal(second.applied, true);
  assert.equal(second.awarded, false);
  assert.equal(second.balance, 90);
  assert.equal(second.studentLife.books.length, 2);
});

test('책장에 배치되지 않은 기록과 무효 슬롯에는 보상을 지급하지 않는다', () => {
  for (const librarySlot of [undefined, -1, 100, 0.5, 8]) {
    const initial = {
      currencyBalances: { 4: 80 },
      currencyHistory: { 4: [] },
      studentLife: { books: [{
        id: 'occupied', studentNumber: 2, title: '기존 책', author: '작가', pageCount: 100,
        createdAt: '2026-07-12T03:00:00.000Z', librarySlot: 8,
      }] },
    };
    const result = createBookStackMissionEntry(initial, {
      id: 'unplaced', studentNumber: 4, title: '새 책', author: '작가', pageCount: 100,
      createdAt: '2026-07-13T03:00:00.000Z', librarySlot,
    });
    assert.equal(result.applied, true);
    assert.equal(result.awarded, false);
    assert.equal(result.balance, 80);
    assert.equal(result.studentLife.books.find((book) => book.id === 'unplaced')?.librarySlot, undefined);
    assert.deepEqual(result.value.currencyHistory, initial.currencyHistory);
  }
});

test('저장되지 않은 책에는 고마를 지급하지 않는다', () => {
  const result = createBookStackMissionEntry({
    currencyBalances: { 4: 80 },
    currencyHistory: { 4: [] },
    studentLife: {},
  }, {
    id: 'book-empty',
    studentNumber: 4,
    title: '   ',
    author: '작가',
    pageCount: 100,
    createdAt: '2026-07-13T03:00:00.000Z',
  });

  assert.equal(result.applied, false);
  assert.equal(result.awarded, false);
  assert.equal(result.balance, 80);
  assert.equal(result.studentLife.books.length, 0);
});
