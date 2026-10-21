import { isSupabaseSettingsEnabled } from './supabaseConfig.js';
import { parseRewardAuditFailureBody, parseRewardAuditReport, RewardAuditRequestError, type RewardAuditReport } from './rewardAudit.js';

export const loadRewardAuditReport = async (signal: AbortSignal, request: typeof fetch = fetch): Promise<RewardAuditReport> => {
  if (!isSupabaseSettingsEnabled) return { checkedAt: new Date().toISOString(), checkedRewards: 0, issues: [], walletMismatches: [], unavailableSources: ['연습 모드에서는 운영 보상 기록을 조회하지 않습니다.'] };
  const response = await request('/api/save-alerts?audit=rewards', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) })
    .catch((error: unknown) => {
      if (signal.aborted) throw error;
      throw new RewardAuditRequestError({ httpStatus: null, code: error instanceof Error && error.name === 'TimeoutError' ? 'REWARD_AUDIT_CLIENT_TIMEOUT' : 'REWARD_AUDIT_NETWORK', stage: 'request' });
    });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new RewardAuditRequestError(parseRewardAuditFailureBody(response.status, body));
  try { return parseRewardAuditReport(body); } catch {
    throw new RewardAuditRequestError({ httpStatus: response.status, code: 'REWARD_AUDIT_INVALID_RESPONSE', stage: 'response' });
  }
};
