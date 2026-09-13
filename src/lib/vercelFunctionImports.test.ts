import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { dirname, extname, resolve } from 'node:path';
import ts from 'typescript';

test('all transitive API imports resolve as deployed Node ESM', async () => {
  const visited = new Set<string>();
  const visit = async (file: string): Promise<void> => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = await readFile(file, 'utf8');
    const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    for (const match of emitted.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g)) {
      const specifier = match[1];
      assert.equal(extname(specifier), '.js', `${file}: ${specifier}`);
      await visit(resolve(dirname(file), specifier).replace(/\.js$/, '.ts'));
    }
  };
  for (const file of (await readdir('api')).filter(file => file.endsWith('.ts'))) await visit(resolve('api', file));
});

const SERVER_MODULES = [
  'src/server/storageClientContract.ts',
  'src/server/storageCommandScope.ts',
  'src/server/storageCommandHandler.ts',
  'src/server/storageScope.ts',
  'src/server/storageProjection.ts',
  'src/server/storageV2Repository.ts',
  'src/server/economyStorageScope.ts',
  'src/server/rewardAuditRepository.ts',
  'src/server/newspaperRepository.ts',
  'src/lib/newspaperQuestion.ts',
  'src/server/rewardAuditActivities.ts',
  'api/announcement-notes.ts',
  'api/class-donation.ts',
  'api/classword.ts',
  'api/device-session.ts',
  'api/newspaper.ts',
  'api/shared-settings.ts',
  'api/save-alerts.ts',
  'api/student-economy.ts',
  'api/today-friend.ts',
  'api/weekly-mission.ts',
  'api/weekly-missions.ts',
  'src/lib/bankMailbox.ts',
  'src/lib/studentHouseReward.ts',
  'src/lib/currency.ts',
  'src/lib/classword.ts',
  'src/lib/classwordQuiz.ts',
  'src/lib/classwordSchedule.ts',
  'src/lib/classwordTopics.ts',
  'src/lib/classwordVocabulary.ts',
  'src/lib/classwordVocabularyGrade34.ts',
  'src/lib/classwordCatalog/vocabularyGrade34.ts',
  'src/lib/classwordCatalog/types.ts',
  'src/lib/classwordCatalog/vocabularyLearning.ts',
  'src/lib/classwordCatalog/vocabularyNature.ts',
  'src/lib/classwordCatalog/vocabularySociety.ts',
  'src/lib/classwordCatalog/vocabularyLife.ts',
  'src/lib/classwordCatalog/topicsSchool.ts',
  'src/lib/classwordCatalog/topicsNature.ts',
  'src/lib/classwordCatalog/topicsLife.ts',
  'src/lib/failureExhibition.ts',
  'src/lib/studentEconomy.ts',
  'src/lib/studentEconomySettings.ts',
  'src/lib/studentEmotion.ts',
  'src/lib/studentSettingsUpdate.ts',
  'src/lib/saveFailure.ts',
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

test('serverless ESM dependencies use explicit JavaScript extensions', async () => {
  const modules = await Promise.all(SERVER_MODULES.map((path) => readFile(path, 'utf8')));
  const extensionlessRelativeImport = /from\s+['"]\.\.?\/[^'"]+(?<!\.js)['"]/;

  for (const [index, source] of modules.entries()) {
    assert.doesNotMatch(source, extensionlessRelativeImport, SERVER_MODULES[index]);
  }
});

test('API directory exposes handlers compatible with the Netlify adapter', async () => {
  const functionFiles = (await readdir('api')).filter((fileName) => fileName.endsWith('.ts'));

  for (const fileName of functionFiles) {
    const source = await readFile(`api/${fileName}`, 'utf8');
    assert.match(source, /export default (?:async )?function handler/, `${fileName} is not a serverless handler`);
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

  const start = source.indexOf('const syncWeeklyMission = async');
  assert.ok(start >= 0);
  const effect = source.slice(source.lastIndexOf('useEffect(() => {', start), source.indexOf('}, [studentNumber]);', start));
  assert.match(effect, /void syncWeeklyMission\(\);/);
  assert.equal(effect.includes('activeStudentView'), false);
});
