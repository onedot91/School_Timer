import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStudentEmotionEntry,
  getTodayStudentEmotionEntry,
  getStudentEmotionsByZone,
  mergeStudentEmotionHistories,
  normalizeStudentEmotionHistory,
  STUDENT_EMOTION_ZONES,
  upsertStudentEmotionEntry,
} from './studentEmotion';

test('emotion catalog follows the supplied four-zone 3x3 order', () => {
  assert.deepEqual(
    STUDENT_EMOTION_ZONES.map((zone) => getStudentEmotionsByZone(zone.id).map((emotion) => emotion.label)),
    [
      ['분노하다', '신경질을 내다', '스트레스 받다', '화나다', '겁나다', '불안하다', '밉다', '짜증 나다', '걱정하다'],
      ['들뜨다', '신나다', '벅차오르다', '용감하다', '재미있다', '감격스럽다', '자랑스럽다', '기쁘다', '행복하다'],
      ['서운하다', '부럽다', '지루하다', '외롭다', '슬프다', '지치다', '절망하다', '우울하다', '기운 빠지다'],
      ['안도하다', '감사하다', '사랑하다', '차분하다', '만족하다', '흐뭇하다', '여유롭다', '편안하다', '평화롭다'],
    ],
  );
});

test('legacy 미안하다 emotion records migrate to 여유롭다', () => {
  const history = normalizeStudentEmotionHistory({
    4: [{
      id: 'student-emotion-4-2026-08-10',
      studentNumber: 4,
      dateKey: '2026-08-10',
      emotionId: 'sorry',
      comment: '친구에게 미안한 마음이 들었다',
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    }],
  });

  assert.equal(history['4'][0].emotionId, 'relaxed');
});

test('emotion history keeps one updated entry per student and date', () => {
  const first = createStudentEmotionEntry(
    7,
    'happy',
    '친구와 재미있게 놀았다',
    new Date('2026-08-09T01:00:00.000Z'),
  );
  const updated = createStudentEmotionEntry(
    7,
    'calm',
    '수업을 마치고 마음이 편해졌다',
    new Date('2026-08-09T05:00:00.000Z'),
    first,
  );
  const history = upsertStudentEmotionEntry(upsertStudentEmotionEntry({}, first), updated);

  assert.equal(history['7'].length, 1);
  assert.equal(history['7'][0].id, first.id);
  assert.equal(history['7'][0].emotionId, 'calm');
  assert.equal(history['7'][0].comment, '수업을 마치고 마음이 편해졌다');
});

test('normalizer rejects blank or oversized emotion comments', () => {
  const base = {
    id: 'student-emotion-3-2026-08-09',
    studentNumber: 3,
    dateKey: '2026-08-09',
    emotionId: 'glad',
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  };
  assert.deepEqual(normalizeStudentEmotionHistory({ 3: [{ ...base, comment: '   ' }] }), {});
  assert.deepEqual(normalizeStudentEmotionHistory({ 3: [{ ...base, comment: '가'.repeat(81) }] }), {});
});

test('concurrent teacher saves preserve the newest student emotion record', () => {
  const remote = createStudentEmotionEntry(
    11,
    'worried',
    '발표를 앞두고 걱정된다',
    new Date('2026-08-09T02:00:00.000Z'),
  );
  const stale = createStudentEmotionEntry(
    11,
    'calm',
    '아침에는 차분했다',
    new Date('2026-08-09T00:00:00.000Z'),
    remote,
  );
  const merged = mergeStudentEmotionHistories({ 11: [remote] }, { 11: [stale] });

  assert.equal(merged['11'][0].emotionId, 'worried');
  assert.equal(merged['11'][0].comment, '발표를 앞두고 걱정된다');
  assert.equal(
    getTodayStudentEmotionEntry(merged, 11, new Date('2026-08-09T12:00:00+09:00'))?.id,
    remote.id,
  );
});
