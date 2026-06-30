import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { normalizeAuctionMissions } from '../../../src/lib/currency';
import type { AuctionMission } from '../../../src/lib/currency';

const evidenceDir = path.resolve('.omo/evidence/mission-feature');
const artifactPath = path.join(evidenceDir, 'f2-blockers-proof.json');
const timerPagePath = path.resolve('src/pages/TimerPage.tsx');
const auctionPagePath = path.resolve('src/pages/AuctionPage.tsx');

const readSource = (filePath: string) => fs.readFileSync(filePath, 'utf8');

const compactWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const extractConstFunctionSource = (source: string, name: string) => {
  const declarationStart = source.indexOf(`const ${name}`);
  assert.notEqual(declarationStart, -1, `${name} declaration not found`);

  const arrowStart = source.indexOf('=>', declarationStart);
  assert.notEqual(arrowStart, -1, `${name} arrow not found`);

  const expressionStart = source.indexOf('(', arrowStart);
  const bodyStart = source.indexOf('{', arrowStart);
  if (expressionStart !== -1 && (bodyStart === -1 || expressionStart < bodyStart)) {
    const expressionEnd = source.indexOf(');\n', expressionStart);
    assert.notEqual(expressionEnd, -1, `${name} expression end not found`);
    return source.slice(declarationStart, expressionEnd + 2);
  }

  assert.notEqual(bodyStart, -1, `${name} body start not found`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) return source.slice(declarationStart, index + 1);
  }

  throw new Error(`${name} body end not found`);
};

const timerSource = readSource(timerPagePath);
const auctionSource = readSource(auctionPagePath);

const updateContentSource = extractConstFunctionSource(timerSource, 'updateAuctionMissionContent');
const updateRewardSource = extractConstFunctionSource(timerSource, 'updateAuctionMissionRewardAmount');
const addMissionSource = extractConstFunctionSource(timerSource, 'addAuctionMission');
const getPersistableMissionsSource = extractConstFunctionSource(timerSource, 'getPersistableAuctionMissions');
const buildSnapshotSource = extractConstFunctionSource(timerSource, 'buildSharedSettingsSnapshot');
const applySnapshotSource = extractConstFunctionSource(timerSource, 'applySharedSettingsSnapshot');
const getInitialMissionsSource = extractConstFunctionSource(auctionSource, 'getInitialAuctionMissions');
const refreshAuctionStateSource = extractConstFunctionSource(auctionSource, 'refreshAuctionState');

assert.equal(
  updateContentSource.includes('normalizeAuctionMissions('),
  false,
  'teacher content editing must not normalize away blank draft rows',
);
assert.equal(
  updateRewardSource.includes('normalizeAuctionMissions('),
  false,
  'teacher reward editing must not normalize away blank draft rows',
);
assert.equal(
  addMissionSource.includes('normalizeAuctionMissions('),
  false,
  'teacher mission creation must not normalize draft rows immediately',
);
assert.ok(
  compactWhitespace(getPersistableMissionsSource).includes(
    'hasBlankAuctionMissionDraft(auctionMissions) ? lastPersistedAuctionMissionsRef.current : normalizeAuctionMissions(auctionMissions)',
  ),
  'shared snapshot mission source must keep last persisted missions while a blank draft is active',
);
assert.ok(
  compactWhitespace(buildSnapshotSource).includes('auctionMissions: getPersistableAuctionMissions()'),
  'shared snapshot must use the blank-draft-safe mission persistence source',
);
assert.equal(
  compactWhitespace(buildSnapshotSource).includes('auctionMissions: normalizeAuctionMissions(auctionMissions)'),
  false,
  'shared snapshot must not directly persist a normalized empty list while a blank draft is active',
);
assert.ok(
  compactWhitespace(timerSource).includes(
    'if (hasBlankDraft) return; const normalizedMissions = normalizeAuctionMissions(auctionMissions); lastPersistedAuctionMissionsRef.current = normalizedMissions;',
  ),
  'local persistence must skip writes while blank drafts are active and update the persisted ref only for valid persist cycles',
);
assert.ok(
  compactWhitespace(applySnapshotSource).includes(
    'if (!isEditingAuctionMissionRef.current && !hasBlankAuctionMissionDraftRef.current) { const remoteAuctionMissions = normalizeAuctionMissions(remoteSettings.auctionMissions); lastPersistedAuctionMissionsRef.current = remoteAuctionMissions; setAuctionMissions(remoteAuctionMissions); }',
  ),
  'remote refresh must not overwrite an active mission edit or blank teacher draft row',
);
assert.ok(
  compactWhitespace(timerSource).includes('if (isEditingAuctionMissionRef.current) return;'),
  'shared settings autosave must pause while a mission input is actively edited',
);

const hasBlankAuctionMissionDraftForProof = (missions: AuctionMission[]) =>
  missions.some((mission) => mission.content.trim().length === 0);

const getPersistableAuctionMissionsForProof = (
  missions: AuctionMission[],
  lastPersistedMissions: AuctionMission[],
) =>
  hasBlankAuctionMissionDraftForProof(missions)
    ? lastPersistedMissions
    : normalizeAuctionMissions(missions);

const lastPersistedMissions: AuctionMission[] = [{ id: 'mission-persisted', content: '책상 정리하기', rewardAmount: 25 }];
const draftAfterClear: AuctionMission[] = [{ id: 'mission-proof', content: '', rewardAmount: 25 }];
const explicitDeleteMissions: AuctionMission[] = [];
assert.equal(draftAfterClear.length, 1);
assert.equal(draftAfterClear[0]?.content, '');
assert.deepEqual(
  normalizeAuctionMissions(draftAfterClear),
  [],
  'blank mission drafts must be removed only at persisted/shared boundary',
);
assert.deepEqual(
  getPersistableAuctionMissionsForProof(draftAfterClear, lastPersistedMissions),
  lastPersistedMissions,
  'blank mission drafts must not overwrite the last persisted nonblank mission list with []',
);
assert.deepEqual(
  getPersistableAuctionMissionsForProof(explicitDeleteMissions, lastPersistedMissions),
  [],
  'explicit deletion without a blank draft must still persist an empty mission list',
);

assert.ok(
  compactWhitespace(getInitialMissionsSource).includes('isSupabaseSettingsEnabled ? [] : getStoredAuctionMissions()'),
  'student Supabase mode must not initialize missions from localStorage',
);
assert.ok(
  compactWhitespace(refreshAuctionStateSource).includes('setAuctionMissions(getStoredAuctionMissions()); setIsLoading(false); return;'),
  'student local-only mode must keep localStorage fallback',
);
assert.ok(
  refreshAuctionStateSource.includes('setAuctionMissions([]);'),
  'student Supabase load failure must fail closed to empty missions',
);

const artifact = {
  generatedAt: new Date().toISOString(),
  command: 'npx tsx .omo/evidence/mission-feature/f2-blockers-proof.ts',
  scenarios: [
    {
      name: 'teacher blank mission draft does not erase persisted missions',
      invocation: 'static source assertion plus runtime persistence-boundary check',
      observable:
        'update/add handlers do not call normalizeAuctionMissions; shared snapshot uses getPersistableAuctionMissions; blank draft returns last persisted nonblank mission list instead of []',
    },
    {
      name: 'teacher explicit mission delete can persist empty',
      invocation: 'runtime persistence-boundary check',
      observable:
        'empty mission list with no blank draft returns [] so the delete button path can persist deletion',
    },
    {
      name: 'student Supabase mode does not render stale local missions',
      invocation: 'static source assertion on AuctionPage initialization and load-failure branch',
      observable:
        'initial missions are [] when isSupabaseSettingsEnabled; remote failure calls setAuctionMissions([]); local-only branch still reads localStorage',
    },
  ],
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

console.log(`F2 blocker proof passed: ${artifactPath}`);
