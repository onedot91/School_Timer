import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQuestionSubmissionStatuses } from './questionSubmissionStatus';
import type { NewspaperQuestion } from './newspaperQuestion';

test('번호별 제출 현황은 개인·주제 질문을 구분하고 다른 학생의 질문을 섞지 않는다', () => {
  const stamp = '2026-10-01T00:00:00Z';
  const question = (number: number, type: NewspaperQuestion['question_type'], text: string): NewspaperQuestion => ({
    id: `fixture-${number}-${type}`,
    student_number: number,
    question_type: type,
    question_text: text,
    week_key: '2026-40',
    created_at: stamp,
    updated_at: stamp,
    downloaded_at: null,
  });
  const statuses = buildQuestionSubmissionStatuses([
    question(2, 'topic', '바닷물은 왜 짤까요?'),
    question(1, 'personal', '하늘은 왜 파란가요?'),
    question(2, 'personal', '달은 왜 모양이 달라질까요?'),
  ]);

  assert.equal(statuses.length, 23);
  assert.deepEqual(statuses[0], {
    number: 1, personalSubmitted: true, topicSubmitted: false,
    personalQuestion: '하늘은 왜 파란가요?', topicQuestion: undefined,
  });
  assert.deepEqual(statuses[1], {
    number: 2, personalSubmitted: true, topicSubmitted: true,
    personalQuestion: '달은 왜 모양이 달라질까요?', topicQuestion: '바닷물은 왜 짤까요?',
  });
  assert.deepEqual(statuses[2], {
    number: 3, personalSubmitted: false, topicSubmitted: false,
    personalQuestion: undefined, topicQuestion: undefined,
  });
});
