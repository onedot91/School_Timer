import { isSupabaseSettingsEnabled } from './supabaseConfig.js';
import { parseRewardAuditReport, RewardAuditError, type RewardAuditReport } from './rewardAudit.js';

export const loadRewardAuditReport = async (signal: AbortSignal): Promise<RewardAuditReport> => {
  if (!isSupabaseSettingsEnabled) return { checkedAt: new Date().toISOString(), checkedRewards: 0, issues: [], walletMismatches: [], unavailableSources: ['연습 모드에서는 운영 보상 기록을 조회하지 않습니다.'] };
  const response = await fetch('/api/save-alerts?audit=rewards', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) });
  if (!response.ok) throw new RewardAuditError('REWARD_AUDIT_UNAVAILABLE');
  return parseRewardAuditReport(await response.json());
};
