import assert from 'node:assert/strict';
import test from 'node:test';

import { detectEntryResetPlatform, isEntryResetShortcut } from './entryResetShortcut';

const keyEvent = (overrides: Partial<Parameters<typeof isEntryResetShortcut>[0]> = {}) => ({
  key: 'Enter',
  code: 'Enter',
  altKey: true,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

test('macOS resets with Option+Command+Enter only', () => {
  assert.equal(isEntryResetShortcut(keyEvent({ metaKey: true }), 'mac'), true);
  assert.equal(isEntryResetShortcut(keyEvent({ ctrlKey: true }), 'mac'), false);
});

test('Windows resets with Ctrl+Alt+Enter and not the Windows key', () => {
  assert.equal(isEntryResetShortcut(keyEvent({ ctrlKey: true }), 'windows'), true);
  assert.equal(isEntryResetShortcut(keyEvent({ metaKey: true }), 'windows'), false);
});

test('ChromeOS and unknown platforms use Ctrl+Alt+Enter', () => {
  assert.equal(isEntryResetShortcut(keyEvent({ ctrlKey: true }), 'chromeos'), true);
  assert.equal(isEntryResetShortcut(keyEvent({ ctrlKey: true }), 'other'), true);
});

test('platform detection keeps Windows separate from macOS', () => {
  assert.equal(detectEntryResetPlatform('Mozilla/5.0 Windows NT 10.0 Win64'), 'windows');
  assert.equal(detectEntryResetPlatform('Mozilla/5.0 Macintosh MacIntel'), 'mac');
  assert.equal(detectEntryResetPlatform('Mozilla/5.0 X11 CrOS x86_64'), 'chromeos');
});
