import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getNetworkIssueRevealDelay,
  NETWORK_ISSUE_REVEAL_DELAY_MS,
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
