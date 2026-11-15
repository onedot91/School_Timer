export const NETWORK_ISSUE_REVEAL_DELAY_MS = 3_000;
export const NETWORK_PROBE_INTERVAL_MS = 12_000;
export const NETWORK_PROBE_RETRY_MS = 4_000;
export const NETWORK_PROBE_TIMEOUT_MS = 8_000;
export const NETWORK_FAILURES_BEFORE_ALERT = 2;
// 타이머가 이보다 더 늦게 끝났다면 기기가 잠들었거나 탭이 멈춘 것이므로 실패로 세지 않는다.
export const NETWORK_PROBE_STALL_GRACE_MS = 3_000;

export const getNetworkIssueRevealDelay = (issueStartedAt: number, now: number) => (
  Math.max(0, NETWORK_ISSUE_REVEAL_DELAY_MS - (now - issueStartedAt))
);

export type NetworkProbeOutcome = 'ok' | 'failed' | 'stalled';

export const classifyNetworkProbeFailure = (
  startedAt: number,
  finishedAt: number,
): NetworkProbeOutcome => (
  finishedAt - startedAt > NETWORK_PROBE_TIMEOUT_MS + NETWORK_PROBE_STALL_GRACE_MS
    ? 'stalled'
    : 'failed'
);

export const getNextNetworkFailureCount = (
  consecutiveFailures: number,
  outcome: NetworkProbeOutcome,
) => {
  if (outcome === 'ok') return 0;
  if (outcome === 'stalled') return consecutiveFailures;
  return consecutiveFailures + 1;
};

export const shouldShowNetworkIssue = (consecutiveFailures: number) => (
  consecutiveFailures >= NETWORK_FAILURES_BEFORE_ALERT
);
