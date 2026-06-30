import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const timerPagePath = path.resolve('src/pages/TimerPage.tsx');
const source = fs.readFileSync(timerPagePath, 'utf8');
const compactSource = source.replace(/\s+/g, ' ');

assert.ok(
  source.includes('isEditingAuctionMissionRef'),
  'mission content editing must have an editing ref to protect active text input',
);
assert.ok(
  compactSource.includes('if (isEditingAuctionMissionRef.current) return;'),
  'shared settings autosave must not run while a mission text input is actively edited',
);
assert.ok(
  source.includes('beginAuctionMissionEdit') && source.includes('endAuctionMissionEdit'),
  'mission text inputs must mark edit start and end explicitly',
);
assert.ok(
  source.includes('onFocus={beginAuctionMissionEdit}') && source.includes('onBlur={endAuctionMissionEdit}'),
  'mission content inputs must wire focus and blur edit guards',
);
assert.ok(
  compactSource.includes('!isEditingAuctionMissionRef.current && !hasBlankAuctionMissionDraftRef.current'),
  'remote shared settings apply must not overwrite mission input while editing',
);

const artifact = {
  generatedAt: new Date().toISOString(),
  command: 'npx tsx .omo/evidence/mission-feature/mission-input-ux-proof.ts',
  assertions: [
    'mission edit ref exists',
    'shared autosave skips active mission edit',
    'mission input has focus/blur edit guards',
    'remote apply skips active mission edit',
  ],
};

fs.writeFileSync(
  path.resolve('.omo/evidence/mission-feature/mission-input-ux-proof.json'),
  `${JSON.stringify(artifact, null, 2)}\n`,
);

console.log('mission input UX proof passed');
