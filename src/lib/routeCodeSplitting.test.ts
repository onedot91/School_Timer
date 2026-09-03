import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootAppSource = readFileSync(new URL('../RootApp.tsx', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
const timerPageSource = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const auctionPageSource = readFileSync(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
const indexHtmlSource = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const stylesheetSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('초기 번호 선택 화면은 교사와 학생 앱 번들을 필요할 때만 불러온다', () => {
  assert.match(rootAppSource, /lazy\(\(\) => import\('\.\/pages\/TimerPage'\)\)/);
  assert.match(rootAppSource, /lazy\(\(\) => import\('\.\/pages\/AuctionPage'\)\)/);
  assert.doesNotMatch(rootAppSource, /import TimerPage from '\.\/pages\/TimerPage'/);
  assert.doesNotMatch(rootAppSource, /import AuctionPage from '\.\/pages\/AuctionPage'/);
  assert.match(rootAppSource, /from '\.\/lib\/supabaseConfig'/);
  assert.doesNotMatch(rootAppSource, /from '\.\/lib\/supabaseSettings'/);
  assert.match(rootAppSource, /<Suspense fallback=\{<PageLoadFallback \/>\}>/);
});

test('낱말판 전용 스타일은 번호 선택 화면에서 미리 내려받지 않는다', () => {
  assert.doesNotMatch(mainSource, /import '\.\/classword\.css'/);
  assert.match(timerPageSource, /import '\.\.\/classword\.css'/);
  assert.match(auctionPageSource, /import '\.\.\/classword\.css'/);
});

test('웹 폰트 연결은 앱 스타일 파싱 전에 시작한다', () => {
  assert.match(indexHtmlSource, /rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/);
  assert.match(indexHtmlSource, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
  assert.match(indexHtmlSource, /rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2/);
  assert.doesNotMatch(stylesheetSource, /@import url\("https:\/\/fonts\.googleapis\.com/);
});
