import { readFileSync } from 'node:fs';

const auctionPage = readFileSync('src/pages/AuctionPage.tsx', 'utf8');
const auctionRoom = readFileSync('src/components/AuctionRoom.tsx', 'utf8');

const assertIncludes = (source, expected, description) => {
  if (!source.includes(expected)) {
    throw new Error(`Missing ${description}: ${expected}`);
  }
};

const assertMatches = (source, pattern, description) => {
  if (!pattern.test(source)) {
    throw new Error(`Missing ${description}: ${pattern}`);
  }
};

assertIncludes(auctionPage, 'const [auctionMissions, setAuctionMissions]', 'student mission state value');
assertIncludes(auctionPage, 'setAuctionMissions(getStoredAuctionMissions())', 'localStorage fallback mission load');
assertIncludes(auctionPage, 'setAuctionMissions(normalizeAuctionMissions(value.auctionMissions))', 'Supabase mission normalization');
assertMatches(
  auctionPage,
  /<AuctionRoom[\s\S]*auctionMissions=\{auctionMissions\}/,
  'AuctionRoom mission prop wiring',
);

assertIncludes(auctionRoom, 'type AuctionMission', 'AuctionMission type import');
assertMatches(auctionRoom, /auctionMissions:\s*AuctionMission\[\]/, 'AuctionRoom mission prop type');
assertMatches(auctionRoom, /auctionMissions,\n[\s\S]*}: AuctionRoomProps/, 'AuctionRoom mission prop destructuring');
assertIncludes(auctionRoom, '오늘의 미션', 'mission section heading');
assertMatches(
  auctionRoom,
  /auctionMissions\.length\s*>\s*0[\s\S]*오늘의 미션[\s\S]*auctionDayGroups\.map/,
  'mission section placed before weekday auction grid and hidden when empty',
);
assertMatches(
  auctionRoom,
  /auctionMissions\.map\(\(mission\)[\s\S]*mission\.content[\s\S]*formatCurrency\(mission\.rewardAmount\)/,
  'mission content and formatted reward rendering',
);
assertMatches(
  auctionRoom,
  /<h2[^>]*>\s*오늘의 미션\s*<\/h2>[\s\S]*?(?=<div className=\{`grid)/,
  'mission block before auction grid',
);

console.log('todo3 display proof passed');
