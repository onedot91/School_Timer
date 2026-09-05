import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const SERVER_MODULES = [
  'api/announcement-notes.ts',
  'api/class-donation.ts',
  'api/classword.ts',
  'api/device-session.ts',
  'api/shared-settings.ts',
  'api/student-economy.ts',
  'api/today-friend.ts',
  'api/weekly-mission.ts',
  'api/weekly-missions.ts',
  'src/lib/bankMailbox.ts',
  'src/lib/currency.ts',
  'src/lib/classword.ts',
  'src/lib/classwordQuiz.ts',
  'src/lib/failureExhibition.ts',
  'src/lib/studentEconomy.ts',
  'src/lib/studentEconomySettings.ts',
  'src/lib/studentEmotion.ts',
  'src/lib/studentLife.ts',
  'src/lib/canvasLibraryPlacement.ts',
  'src/lib/libraryCompetition.ts',
  'src/lib/libraryCompetitionTypes.ts',
  'src/lib/libraryCompetitionCodec.ts',
  'src/lib/libraryCompetitionTime.ts',
  'src/lib/libraryCompetitionEvents.ts',
  'src/lib/libraryCompetitionProjection.ts',
  'src/lib/libraryCompetitionProfiles.ts',
  'src/server/libraryCompetitionRepository.ts',
  'src/server/libraryCompetitionService.ts',
  'src/lib/todayFriend.ts',
  'src/lib/todayFriendCodec.ts',
  'src/lib/todayFriendState.ts',
  'src/lib/weeklyMission.ts',
  'src/server/deviceSession.ts',
  'src/server/classwordMissionSettlement.ts',
  'src/server/classwordRepository.ts',
  'src/server/requestRateLimit.ts',
  'src/server/todayFriendRepository.ts',
  'src/server/todayFriendRequest.ts',
  'src/server/todayFriendRows.ts',
] as const;

test('Vercel ESM server dependencies use explicit JavaScript extensions', async () => {
  const modules = await Promise.all(SERVER_MODULES.map((path) => readFile(path, 'utf8')));
  const extensionlessRelativeImport = /from\s+['"]\.\.?\/[^'"]+(?<!\.js)['"]/;

  for (const [index, source] of modules.entries()) {
    assert.doesNotMatch(source, extensionlessRelativeImport, SERVER_MODULES[index]);
  }
});

test('Vercel api directory contains at most twelve deployable handlers', async () => {
  const functionFiles = (await readdir('api')).filter((fileName) => fileName.endsWith('.ts'));

  assert.ok(
    functionFiles.length <= 12,
    `Vercel Hobby allows at most 12 direct functions, but api/ contains ${functionFiles.length}`,
  );
  for (const fileName of functionFiles) {
    const source = await readFile(`api/${fileName}`, 'utf8');
    assert.match(source, /export default (?:async )?function handler/, `${fileName} is not a deployable handler`);
  }
});

test('active student and weekly mission paths do not call the legacy Classword host', async () => {
  const sources = await Promise.all([
    'api/classword.ts',
    'api/weekly-missions.ts',
    'src/lib/weeklyMission.ts',
    'src/components/student/StudentMissionsPage.tsx',
  ].map((path) => readFile(path, 'utf8')));
  const legacyHost = ['classword', 'vercel', 'app'].join('.');

  for (const source of sources) assert.equal(source.includes(legacyHost), false);
});

test('학생 화면에 접속하면 미션 탭을 열지 않아도 과거 보상 정산을 시작한다', async () => {
  const source = await readFile('src/pages/AuctionPage.tsx', 'utf8');

  assert.match(source, /useEffect\(\(\) => \{\s+let isActive = true;\s+const syncWeeklyMission/);
});
