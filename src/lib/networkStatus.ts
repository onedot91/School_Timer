export const NETWORK_ISSUE_REVEAL_DELAY_MS = 3_000;
export const NETWORK_PROBE_INTERVAL_MS = 12_000;
export const NETWORK_PROBE_TIMEOUT_MS = 5_000;

export const getNetworkIssueRevealDelay = (issueStartedAt: number, now: number) => (
  Math.max(0, NETWORK_ISSUE_REVEAL_DELAY_MS - (now - issueStartedAt))
);
