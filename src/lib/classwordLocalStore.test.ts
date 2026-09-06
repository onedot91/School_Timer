import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import {
  deleteLocalClasswordEntry,
  loadLocalClasswordBoard,
  loadLocalClasswordRounds,
  pruneLocalClasswordEntries,
  saveLocalClasswordEntry,
  saveLocalClasswordTopic,
} from './classwordLocalStore';

const mockDate = (context: TestContext, dateKey = '2026-09-07'): void => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date(`${dateKey}T01:00:00.000Z`) });
};

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();
  #writeCount = 0;

  get writeCount(): number { return this.#writeCount; }

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#writeCount += 1;
    this.#values.set(key, value);
  }
}

test('한 학생은 같은 날짜에 한 칸만 새로 등록할 수 있다', (context) => {
  // Given
  mockDate(context);
  const storage = new MemoryStorage();
  saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-07', initial: 'ㄱ', word: '강아지', studentNumber: 3,
  });

  // When
  const duplicate = () => saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-07', initial: 'ㄴ', word: '나비', studentNumber: 3,
  });

  // Then
  assert.throws(duplicate, /CLASSWORD_STUDENT_ALREADY_ENTERED/);
});

test('같은 날짜의 초성은 한 학생만 차지할 수 있다', (context) => {
  // Given
  mockDate(context);
  const storage = new MemoryStorage();
  saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-07', initial: 'ㄱ', word: '강아지', studentNumber: 3,
  });

  // When
  const occupied = () => saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-07', initial: 'ㄱ', word: '기차', studentNumber: 4,
  });

  // Then
  assert.throws(occupied, /CLASSWORD_INITIAL_OCCUPIED/);
});

test('학생은 자신의 낱말만 수정하고 삭제할 수 있다', (context) => {
  // Given
  mockDate(context);
  const storage = new MemoryStorage();
  const entry = saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-07', initial: 'ㄱ', word: '강아지', studentNumber: 3,
  });

  // When
  const wrongStudentUpdate = () => saveLocalClasswordEntry(storage, {
    entryId: entry.id,
    dateKey: '2026-09-07',
    initial: 'ㄱ',
    word: '기차',
    studentNumber: 4,
  });
  const wrongStudentDelete = () => deleteLocalClasswordEntry(storage, entry.id, 4, false);

  // Then
  assert.throws(wrongStudentUpdate, /CLASSWORD_ENTRY_FORBIDDEN/);
  assert.throws(wrongStudentDelete, /CLASSWORD_ENTRY_FORBIDDEN/);
  assert.equal(loadLocalClasswordBoard(storage, '2026-09-07').entries.length, 1);

  const updated = saveLocalClasswordEntry(storage, {
    entryId: entry.id,
    dateKey: '2026-09-07',
    initial: 'ㄱ',
    word: '기차',
    studentNumber: 3,
  });
  assert.equal(updated.word, '기차');
  deleteLocalClasswordEntry(storage, entry.id, 3, false);
  assert.equal(loadLocalClasswordBoard(storage, '2026-09-07').entries.length, 0);
});

test('로컬 낱말 정리는 경계일을 남기고 더 오래된 낱말만 삭제한다', () => {
  // Given
  const storage = new MemoryStorage();
  const historicalEntries = [
    { dateKey: '2026-08-15', initial: 'ㄱ', word: '강아지', studentNumber: 1 },
    { dateKey: '2026-08-16', initial: 'ㄴ', word: '나비', studentNumber: 2 },
    { dateKey: '2026-08-29', initial: 'ㄷ', word: '다람쥐', studentNumber: 3 },
  ] as const;
  storage.setItem('school-timer-classword-v1', JSON.stringify({
    rounds: historicalEntries.map(({ dateKey }) => ({ dateKey, topic: '동물' })),
    entries: historicalEntries.map((entry) => ({
      ...entry, id: `historical-${entry.studentNumber}`,
      createdAt: `${entry.dateKey}T01:00:00.000Z`, updatedAt: `${entry.dateKey}T01:00:00.000Z`,
    })),
  }));

  // When
  const removedCount = pruneLocalClasswordEntries(storage, '2026-08-16');

  // Then
  assert.equal(removedCount, 1);
  assert.equal(loadLocalClasswordBoard(storage, '2026-08-15').entries.length, 0);
  assert.equal(loadLocalClasswordBoard(storage, '2026-08-16').entries.length, 1);
  assert.equal(loadLocalClasswordBoard(storage, '2026-08-29').entries.length, 1);
  assert.equal(loadLocalClasswordRounds(storage).length, 3);
});

test('처음 여는 평일에는 저장된 주제 없이 자동 주제로 낱말을 등록한다', (context) => {
  // Given
  mockDate(context);
  const storage = new MemoryStorage();
  assert.equal(loadLocalClasswordRounds(storage).length, 0);

  // When
  const entry = saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-07', initial: 'ㄱ', word: '강아지', studentNumber: 3,
  });

  // Then
  const board = loadLocalClasswordBoard(storage, '2026-09-07');
  assert.equal(board.source, 'automatic');
  assert.ok(board.topic.length > 0);
  assert.deepEqual(board.entries, [entry]);
});

test('교사의 수동 주제는 자동 주제를 대체하고 빈 값으로 다시 되돌린다', () => {
  // Given
  const storage = new MemoryStorage();
  const automatic = loadLocalClasswordBoard(storage, '2026-09-07');

  // When
  const manual = saveLocalClasswordTopic(storage, '2026-09-07', '  동물  ');
  const restored = saveLocalClasswordTopic(storage, '2026-09-07', '  ');

  // Then
  assert.equal(manual.source, 'teacher');
  assert.equal(manual.topic, '동물');
  assert.equal(restored.source, 'automatic');
  assert.equal(restored.topic, automatic.topic);
});

test('주말 학생의 신규 등록과 금요일 낱말 수정·삭제는 저장하지 않는다', (context) => {
  // Given
  mockDate(context, '2026-09-11');
  const storage = new MemoryStorage();
  const entry = saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-11', initial: 'ㄱ', word: '강아지', studentNumber: 3,
  });
  const writes = storage.writeCount;
  context.mock.timers.setTime(new Date('2026-09-12T01:00:00.000Z').getTime());

  // When / Then
  for (const dateKey of ['2026-09-11', '2026-09-12']) {
    assert.throws(() => saveLocalClasswordEntry(storage, {
      dateKey, initial: 'ㄴ', word: '나비', studentNumber: 4,
    }), /CLASSWORD_WEEKEND_CLOSED/);
    assert.throws(() => saveLocalClasswordEntry(storage, {
      entryId: entry.id, dateKey, initial: 'ㄱ', word: '기차', studentNumber: 3,
    }), /CLASSWORD_WEEKEND_CLOSED/);
  }
  assert.throws(() => deleteLocalClasswordEntry(storage, entry.id, 3, false), /CLASSWORD_WEEKEND_CLOSED/);
  assert.equal(storage.writeCount, writes);
});

test('현재 날짜를 붙여도 지난 날짜의 항목 ID로 수정할 수 없다', (context) => {
  // Given
  mockDate(context, '2026-09-11');
  const storage = new MemoryStorage();
  const entry = saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-11', initial: 'ㄱ', word: '강아지', studentNumber: 3,
  });
  const writes = storage.writeCount;
  context.mock.timers.setTime(new Date('2026-09-14T01:00:00.000Z').getTime());

  // When / Then
  for (const dateKey of ['2026-09-11', '2026-09-14']) {
    assert.throws(() => saveLocalClasswordEntry(storage, {
      entryId: entry.id, dateKey, initial: 'ㄱ', word: '기차', studentNumber: 3,
    }), /TODAY_ONLY/);
  }
  assert.throws(() => deleteLocalClasswordEntry(storage, entry.id, 3, false), /TODAY_ONLY/);
  assert.equal(storage.writeCount, writes);
  assert.deepEqual(loadLocalClasswordBoard(storage, '2026-09-11').entries, [entry]);
});

test('교사는 주말에도 지난 낱말을 삭제할 수 있다', (context) => {
  // Given
  mockDate(context, '2026-09-11');
  const storage = new MemoryStorage();
  const entry = saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-11', initial: 'ㄱ', word: '강아지', studentNumber: 3,
  });
  context.mock.timers.setTime(new Date('2026-09-12T01:00:00.000Z').getTime());

  // When
  deleteLocalClasswordEntry(storage, entry.id, 0, true);

  // Then
  assert.equal(loadLocalClasswordBoard(storage, '2026-09-11').entries.length, 0);
});

test('수동 주제와 같은 낱말이나 틀린 초성은 저장하지 않는다', (context) => {
  // Given
  mockDate(context, '2026-09-04');
  const storage = new MemoryStorage();
  saveLocalClasswordTopic(storage, '2026-09-04', '기차');
  const writes = storage.writeCount;

  // When / Then
  assert.throws(() => saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-04', initial: 'ㄱ', word: '기차', studentNumber: 3,
  }), /same_topic/);
  assert.throws(() => saveLocalClasswordEntry(storage, {
    dateKey: '2026-09-04', initial: 'ㄴ', word: '강아지', studentNumber: 3,
  }), /wrong_initial/);
  assert.equal(storage.writeCount, writes);
});
