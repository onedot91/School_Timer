import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../../src/pages/TimerPage.tsx', import.meta.url), 'utf8');

const requiredSnippets = [
  'const addAuctionMission',
  'const updateAuctionMissionContent',
  'const updateAuctionMissionRewardAmount',
  'const removeAuctionMission',
  '<h3 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">미션</h3>',
  '미션 추가',
  '미션 내용',
  '보상',
];

const missingSnippets = requiredSnippets.filter((snippet) => !source.includes(snippet));

const settingsPanelType = source.match(/type SettingsPanel = ([^;]+);/)?.[1] ?? '';
const expectedPanels = ["'schedule'", "'subjects'", "'draw'", "'auction'"];
const panelFailures = expectedPanels.filter((panel) => !settingsPanelType.includes(panel));
const hasUnexpectedMissionPanel = settingsPanelType.includes('mission') || settingsPanelType.includes('missions');

const resetFunctionNames = ['resetAuctionItems', 'resetAuctionBids', 'resetCurrencyBalances'];
const resetFailures = resetFunctionNames.filter((functionName) => {
  const match = source.match(new RegExp(`const ${functionName} = \\(\\) => \\{([\\s\\S]*?)\\n  \\};`));
  return !match || match[1].includes('setAuctionMissions');
});

const auctionItemsSectionIndex = source.indexOf('물품 설정 및 현황');
const missionSectionIndex = source.indexOf('>미션</h3>');
const managementSectionIndex = source.indexOf('>경매 관리</h3>');
const sectionOrderIsValid =
  auctionItemsSectionIndex >= 0 &&
  missionSectionIndex > auctionItemsSectionIndex &&
  managementSectionIndex > missionSectionIndex;

const failures = [
  ...missingSnippets.map((snippet) => `missing snippet: ${snippet}`),
  ...panelFailures.map((panel) => `missing settings panel: ${panel}`),
  ...(hasUnexpectedMissionPanel ? ['unexpected mission settings panel variant'] : []),
  ...resetFailures.map((functionName) => `${functionName} clears auctionMissions or is missing`),
  ...(sectionOrderIsValid ? [] : ['mission section is not between item settings and auction management']),
];

if (failures.length > 0) {
  console.error('todo2 mission UI proof failed');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('todo2 mission UI proof passed');
