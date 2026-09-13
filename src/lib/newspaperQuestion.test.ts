import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getKoreanIsoWeekKey } from './weeklyMission.js';
import { applyQuestionGlasses, detectQuestionGlasses, questionValidationCode, normalizeQuestionText, questionWeekLabel, weekMonday, buildQuestionTxt, questionTxtFilename, selectQuestionDownload, segmentQuestionGlasses, type NewspaperData } from './newspaperQuestion.js';
import { applyLocalNewspaperCommand, projectLocalNewspaper } from './newspaperLocalStore.js';

test('신문 미션은 내부 화면을 lazy load하며 차단된 외부 사이트를 호출하지 않는다', () => {
  const source = (path: string) => readFileSync(path, 'utf8');
  assert.match(source('src/pages/AuctionPage.tsx'), /const StudentNewspaperPage = lazy/);
  assert.match(source('src/pages/AuctionPage.tsx'), /onOpenNewspaper=\{\(\) => navigateStudentView\('newspaper'\)\}/);
  assert.match(source('src/pages/TimerPage.tsx'), /const TeacherNewspaperPanel = lazy/);
  for (const path of ['src/lib/weeklyMission.ts', 'src/lib/questionSubmissionStatus.ts', 'api/weekly-mission.ts', 'api/weekly-missions.ts', 'src/server/rewardAuditRepository.ts', 'vite.config.ts', 'netlify.toml', 'netlify/functions/api.mts']) {
    assert.doesNotMatch(source(path), /question-news\.vercel\.app/, path);
  }
});

test('신문 주차는 한국 월요일 자정과 ISO 연말 경계를 따른다', () => {
  assert.equal(getKoreanIsoWeekKey(new Date('2026-09-13T14:59:59Z')), '2026-37');
  assert.equal(getKoreanIsoWeekKey(new Date('2026-09-13T15:00:00Z')), '2026-38');
  assert.equal(getKoreanIsoWeekKey(new Date('2021-01-01T00:00:00Z')), '2020-53');
  assert.equal(getKoreanIsoWeekKey(new Date('2024-12-30T00:00:00Z')), '2025-01');
  assert.equal(questionWeekLabel('2026-37'), '9월 둘째주');
  assert.equal(weekMonday('2026-38').toISOString(), '2026-09-14T00:00:00.000Z');
  assert.throws(() => weekMonday('2025-53'));
  assert.throws(() => weekMonday('2026-00'));
});

test('질문 검증의 순서, Unicode, 특수문자, 물음표를 검사한다', () => {
  const checks = [
    ['', 'QUESTION_EMPTY'], ['  \n ', 'QUESTION_EMPTY'], ['왜?', 'QUESTION_SPACE_REQUIRED'],
    [`왜 ${'가'.repeat(58)}?`, 'QUESTION_TOO_LONG'], ['하늘은 왜 파란가요!', 'QUESTION_CHARACTER'],
    ['하늘은 왜 파란가요??', 'QUESTION_MARK_REQUIRED'], ['하늘은? 왜 파란가요?', 'QUESTION_MARK_REQUIRED'],
    ['하늘은 왜 파란가요', 'QUESTION_MARK_REQUIRED'], ['하늘은 왜 파란색일까요?', null],
    ['만약 달에 간다면 무엇을 볼 수 있을까요？', null], ['How are 물고기 2마리?', null],
    ['<script> 왜 안 돼요?', 'QUESTION_CHARACTER'], ['하늘은\n왜 파란가요?', null],
  ] as const;
  for (const [text, expected] of checks) assert.equal(questionValidationCode(text), expected, text);
  assert.equal(questionValidationCode('테스트금칙 가상친구 왜?', { blockedWords: ['테스트금칙'], privateWords: ['가상친구'] }), 'QUESTION_PRIVATE_WORD');
  assert.equal(questionValidationCode('테스트금칙 왜?', { blockedWords: ['테스트금칙'], privateWords: [] }), 'QUESTION_BLOCKED_WORD');
  assert.equal(normalizeQuestionText(' 하늘은\r\n 왜   파랄까요? '), '하늘은 왜 파랄까요?');
});

test('질문 안경은 문장 시작만 교체하며 본문 단어는 보존한다', () => {
  assert.equal(applyQuestionGlasses('왜 하늘은 왜 파랄까요?', '만약'), '만약 하늘은 왜 파랄까요?');
  assert.equal(applyQuestionGlasses('왜가리는 왜 날까요?', '거꾸로'), '거꾸로 왜가리는 왜 날까요?');
  assert.equal(detectQuestionGlasses('거꾸로 생각하면 어떨까요?'), '거꾸로');
  assert.equal(detectQuestionGlasses('이유는 왜 그럴까요?'), null);
  assert.deepEqual(segmentQuestionGlasses('근데 왜 우리가 만약을 말할까? 거꾸로 생각할까?'), [
    { text: '근데 ', glasses: null }, { text: '왜', glasses: '왜' }, { text: ' 우리가 만약을 말할까? ', glasses: null },
    { text: '거꾸로', glasses: '거꾸로' }, { text: ' 생각할까?', glasses: null },
  ]);
});

test('로컬 질문은 주차별 upsert, 주제 선행 조건, 수정본 다운로드 정책을 따른다', () => {
  const now = new Date('2026-09-08T02:00:00Z');
  const weekKey = getKoreanIsoWeekKey(now);
  let data: NewspaperData = { weekKey, questions: [], topics: [], history: [] };
  const run = (actor: number, command: Record<string, unknown>, date = now) => { const result = applyLocalNewspaperCommand(data, actor, command, date); data = result.data; return result.result; };
  const submit = { action: 'submit', studentNumber: 3, questionType: 'personal', questionText: '하늘은 왜 파란가요?', weekKey, expectedUpdatedAt: null };
  assert.throws(() => run(3, { ...submit, questionType: 'topic' }), /QUESTION_TOPIC_REQUIRED/);
  run(0, { action: 'topic', weekKey, topicText: '자연', expectedUpdatedAt: null });
  assert.throws(() => run(3, { ...submit, questionType: 'topic' }), /QUESTION_PERSONAL_REQUIRED/);
  run(3, submit);
  run(3, { ...submit, questionType: 'topic', topicRevision: data.topics[0].updated_at });
  const created = data.questions[0];
  run(0, { action: 'download', weekKey, mode: 'personal', cumulative: true });
  assert.equal(selectQuestionDownload(data.questions, 'personal', true).length, 0);
  assert.equal(selectQuestionDownload(data.questions, 'all', false).length, 2);
  run(3, { ...submit, questionText: '바다는 왜 파란가요?', expectedUpdatedAt: created.updated_at }, new Date(now.getTime() + 1000));
  assert.equal(data.questions[0].id, created.id);
  assert.equal(data.questions[0].created_at, created.created_at);
  assert.equal(data.questions[0].downloaded_at, null);
  assert.equal(data.questions.length, 2);
  assert.throws(() => run(3, { action: 'reset', confirmation: '모든 기록 초기화' }), /QUESTION_FORBIDDEN/);
  const nextWeek = new Date(now.getTime() + 7 * 86400000);
  run(3, { ...submit, weekKey: getKoreanIsoWeekKey(nextWeek) }, nextWeek);
  assert.equal(data.questions.length, 3);
  assert.equal(projectLocalNewspaper(data, 3, getKoreanIsoWeekKey(nextWeek)).questions.length, 1);
  assert.equal(projectLocalNewspaper(data, 4, getKoreanIsoWeekKey(nextWeek)).history.length, 0);
  const txt = buildQuestionTxt(data.questions.filter(row => row.week_key === weekKey), 'all', '신문');
  assert.equal(txt, '신문\n\n[개인 질문]\n3. 바다는 왜 파란가요?\n[주제 질문]\n1. 하늘은 왜 파란가요?\n');
  assert.equal(questionTxtFilename(weekKey, 'topic', true), `주제질문-누적-${weekKey}.txt`);
});
