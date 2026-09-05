import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
try {
  const page = await context.newPage();
  await page.route('**/local-store-qa', route => route.fulfill({ contentType: 'text/html', body: '<title>Local storage QA</title><h1>Isolated native localStorage verification</h1>' }));
  await page.goto('http://127.0.0.1:3044/local-store-qa');
  const initial = await page.evaluate(async () => {
    const { createLibraryCompetitionLocalStore } = await import('/src/lib/libraryCompetitionLocalStore.ts');
    const book = { id: 'qa-native-book', studentNumber: 23, title: 'QA', author: 'QA', pageCount: 10, createdAt: '2026-09-01T00:00:00.000Z', colorIndex: 0, librarySlot: 0 };
    localStorage.setItem('school-timer-student-pets-v1', JSON.stringify({ studentLife: { books: [book] }, currencyBalances: { '23': 750 } }));
    const store = createLibraryCompetitionLocalStore({ storage: localStorage, now: () => '2026-09-05T00:00:00.000Z', createSeed: () => 'browser-qa' });
    return store.read('open');
  });
  assert.equal(initial.competition.standings.find(row => row.isOurSchool).count, 1);
  await page.reload();
  const final = await page.evaluate(async () => {
    const { createLibraryCompetitionLocalStore } = await import('/src/lib/libraryCompetitionLocalStore.ts');
    const store = createLibraryCompetitionLocalStore({ storage: localStorage, now: () => '2027-01-02T00:00:00.000Z', createSeed: () => 'browser-next' });
    const first = store.read('enter');
    const second = store.read('enter');
    return { first, second, history: store.history('2026-09'), viewport: { width: innerWidth, height: innerHeight } };
  });
  assert.equal(final.first.rolledOver, true);
  assert.equal(final.second.rolledOver, false);
  assert.equal(final.first.competition.state.seasonId, '2027-01');
  assert.equal(final.first.competition.state.revision, 1);
  assert.equal(final.first.competition.standings.find(row => row.isOurSchool).count, 0);
  assert.equal(final.history.months.length, 1);
  assert.equal(final.history.archive.books[0].id, 'qa-native-book');
  assert.deepEqual(final.first.value.currencyBalances, { '23': 750 });
  assert.deepEqual(final.viewport, { width: 1280, height: 800 });
  const report = { verdict: 'PASS', channel: 'Chrome native localStorage, isolated context', scenarios: [
    'first open counts confirmed book', 'reload retains native storage', 'missed months archive once',
    'new month starts zero', 'archive retains original book', 'currency remains unchanged', 'revision increases across season'], cleanup: 'Isolated context and browser closed in finally; root-owned 3044 server untouched' };
  await writeFile(new URL('./local-store-qa.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await context.close();
  await browser.close();
}
