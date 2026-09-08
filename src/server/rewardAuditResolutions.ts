import type { RewardAuditIssue } from '../lib/rewardAudit.js';

export const historicalRewardResolution = {
  decidedOn: '2026-09-08',
  decision: '교사 판단: 오래된 7월 보상 6건은 추가 정산 없이 종결했습니다. 지급 완료를 뜻하지 않습니다.',
  items: [
    { studentNumber: 21, id: 'weekly-mission-21-2026-29' },
    { studentNumber: 12, id: 'weekly-mission-12-2026-29' },
    { studentNumber: 12, id: 'weekly-mission-classword_quiz_correct-12-2026-29' },
    { studentNumber: 16, id: 'weekly-mission-16-2026-29' },
    { studentNumber: 18, id: 'weekly-mission-18-2026-29' },
    { studentNumber: 13, id: 'weekly-mission-classword_word_entry-13-2026-30' },
  ],
} as const;

export const isResolvedHistoricalReward = (issue: RewardAuditIssue): boolean => issue.kind === 'missing'
  && issue.expectedAmount === 5 && issue.paidAmount === 0
  && historicalRewardResolution.items.some(item => item.studentNumber === issue.studentNumber && item.id === issue.id);
