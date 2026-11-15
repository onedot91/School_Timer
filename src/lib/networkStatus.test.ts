import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyNetworkProbeFailure,
  getNetworkIssueRevealDelay,
  getNextNetworkFailureCount,
  NETWORK_ISSUE_REVEAL_DELAY_MS,
  NETWORK_PROBE_STALL_GRACE_MS,
  NETWORK_PROBE_TIMEOUT_MS,
  shouldShowNetworkIssue,
} from './networkStatus';

test('network issue banner waits for a full three seconds', () => {
  assert.equal(NETWORK_ISSUE_REVEAL_DELAY_MS, 3_000);
  assert.equal(getNetworkIssueRevealDelay(10_000, 10_000), 3_000);
  assert.equal(getNetworkIssueRevealDelay(10_000, 12_999), 1);
  assert.equal(getNetworkIssueRevealDelay(10_000, 13_000), 0);
});

test('a previously elapsed issue never schedules a negative delay', () => {
  assert.equal(getNetworkIssueRevealDelay(10_000, 20_000), 0);
});

test('one failed check does not show the banner; two in a row do', () => {
  const first = getNextNetworkFailureCount(0, 'failed');
  assert.equal(shouldShowNetworkIssue(first), false);
  const second = getNextNetworkFailureCount(first, 'failed');
  assert.equal(shouldShowNetworkIssue(second), true);
});

test('a successful check clears earlier failures', () => {
  assert.equal(getNextNetworkFailureCount(1, 'ok'), 0);
  assert.equal(getNextNetworkFailureCount(5, 'ok'), 0);
});

test('a check stalled by sleep or a frozen tab is not counted', () => {
  assert.equal(getNextNetworkFailureCount(1, 'stalled'), 1);
  const limit = NETWORK_PROBE_TIMEOUT_MS + NETWORK_PROBE_STALL_GRACE_MS;
  assert.equal(classifyNetworkProbeFailure(0, limit), 'failed');
  assert.equal(classifyNetworkProbeFailure(0, limit + 1), 'stalled');
});
