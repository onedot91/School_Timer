import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createFullLibraryRoom, createLibraryPlayer, stepLibraryPlayer } from '../../../src/lib/canvasLibraryWorld.ts';

const PREVIEW_PORT = process.env.QA_PREVIEW_PORT ?? '3034';
const SHARED_PORT = process.env.QA_SHARED_PORT ?? '3036';
const ORIGIN = process.env.SHARED_ORIGIN ?? `http://127.0.0.1:${PREVIEW_PORT}`;
const HARNESS = process.env.SHARED_HARNESS ?? `http://127.0.0.1:${SHARED_PORT}`;
const EVIDENCE_DIR = new URL('./', import.meta.url).pathname;
const ROOM = createFullLibraryRoom();
const SOURCE_FILES = [
  'src/RootApp.tsx', 'src/pages/AuctionPage.tsx',
  'src/components/student/StudentLibraryPage.tsx',
  'src/components/student/library/CanvasLibraryGame.tsx',
  'src/lib/canvasLibraryClient.ts', 'src/lib/canvasLibraryPlacement.ts',
  'src/lib/canvasLibraryWorld.ts', 'src/lib/studentLife.ts', 'src/index.css',
];
const sourceHashes = async () => Object.fromEntries(await Promise.all(SOURCE_FILES.map(async (file) => [
  file, createHash('sha256').update(await readFile(new URL(`../../../${file}`, import.meta.url))).digest('hex'),
])));
const fullSourceHashes = async () => {
  const collect = async (directory) => {
    const rootUrl = new URL(`../../../${directory}`, import.meta.url);
    const rootPath = rootUrl.pathname.replace(/\/$/, '');
    const entries = await readdir(rootUrl, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => {
      const parent = entry.parentPath === rootPath ? '' : entry.parentPath.slice(rootPath.length + 1);
      return `${directory}/${parent ? `${parent}/` : ''}${entry.name}`;
    });
  };
  const files = [...await collect('src'), ...await collect('api')].sort();
  return Object.fromEntries(await Promise.all(files.map(async (file) => [
    file, createHash('sha256').update(await readFile(new URL(`../../../${file}`, import.meta.url))).digest('hex'),
  ])));
};
const receipt = {
  generatedAt: new Date().toISOString(),
  surface: 'production Vite preview + synthetic shared-settings harness',
  origin: ORIGIN,
  harness: HARNESS,
  viewport: [1280, 800],
  contexts: {}, screenshots: [], network: { receipts: [], allowedApi: ['device-session', 'shared-settings'], total: 0, blockedExternalCount: 0 }, blockedRequests: [], errors: [], checks: {}, cleanup: [],
};

const json = async (response) => ({ status: response.status, body: await response.json().catch(() => null) });
const harnessRequest = async (path, init = {}) => json(await fetch(`${HARNESS}${path}`, init));
const reset = () => harnessRequest('/qa/reset', { method: 'POST' });
const state = async () => (await harnessRequest('/qa/state')).body;

function routeFrom(start, target, studentNumber) {
  const queue = [{ player: { ...createLibraryPlayer(ROOM, studentNumber), position: start }, parent: -1, key: null }];
  const keyOf = (point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  const seen = new Set([keyOf(start)]);
  for (let index = 0; index < queue.length && index < 30000; index += 1) {
    const node = queue[index];
    if (Math.hypot(node.player.position.x - target.x, node.player.position.y - target.y) <= 3.2) {
      const result = [];
      for (let cursor = index; queue[cursor].parent >= 0; cursor = queue[cursor].parent) result.unshift(queue[cursor]);
      return result;
    }
    for (const [key, x, y] of [['d', 1, 0], ['a', -1, 0], ['s', 0, 1], ['w', 0, -1]]) {
      const next = stepLibraryPlayer(ROOM, node.player, { x, y }, 40);
      if (Math.hypot(next.position.x - node.player.position.x, next.position.y - node.player.position.y) < 3.99) continue;
      const id = keyOf(next.position);
      if (seen.has(id)) continue;
      seen.add(id); queue.push({ player: next, parent: index, key });
    }
  }
  throw new Error(`No safe walking path to ${JSON.stringify(target)}`);
}

async function main() {
  const sourceStart = await sourceHashes();
  const fullSourceStart = await fullSourceHashes();
  const buildManifestPath = process.env.QA_BUILD_MANIFEST;
  if (buildManifestPath) {
    const buildManifest = JSON.parse(await readFile(buildManifestPath, 'utf8'));
    assert.deepEqual(buildManifest, fullSourceStart, 'build-time full source SHA-256 manifest');
    receipt.buildManifest = { path: buildManifestPath, sha256Entries: Object.keys(buildManifest).length, matched: true };
  } else {
    receipt.buildManifest = { matched: false, reason: 'QA_BUILD_MANIFEST not supplied (provisional run only)' };
  }
  const resetResult = await reset();
  assert.equal(resetResult.status, 200, 'synthetic backend reset');
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const contexts = new Map();
  let droppedCommit = false;
  let failPrecommit = false;
  try {
    const makeContext = async (studentNumber) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      let registered = false;
      const requests = [];
      const contextReceipt = { studentNumber, requests, screenshots: [], actions: [], errors: [], holdSharedReads: false };
      contexts.set(studentNumber, { context, receipt: contextReceipt });
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== ORIGIN) {
          receipt.blockedRequests.push({ studentNumber, url: url.href, method: request.method() });
          await route.abort();
          return;
        }
        if (url.pathname === '/api/device-session') {
          requests.push({ api: 'device-session', method: request.method() });
          if (request.method() === 'GET') {
            await route.fulfill({ status: registered ? 200 : 401, contentType: 'application/json', body: registered ? JSON.stringify({ role: 'student', studentNumber }) : JSON.stringify({ error: 'DEVICE_REGISTRATION_REQUIRED' }) });
            return;
          }
          if (request.method() === 'POST') {
            const body = JSON.parse(request.postData() ?? '{}');
            assert.equal(body.entryNumber, studentNumber, 'registration entry number');
            registered = true;
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'student', studentNumber }) });
            return;
          }
          registered = false;
          await route.fulfill({ status: 204, body: '' });
          return;
        }
        if (url.pathname === '/api/shared-settings') {
          const method = request.method();
          const requestBody = request.postData() ?? undefined;
          requests.push({ api: 'shared-settings', method, query: url.search, body: requestBody ? JSON.parse(requestBody) : undefined });
          if (method === 'GET' && contextReceipt.holdSharedReads) {
            contextReceipt.actions.push('held-shared-read');
            await route.abort('failed');
            return;
          }
          const target = `${HARNESS}/qa/request/${studentNumber}${url.search}`;
          if (method === 'PUT' && failPrecommit) {
            failPrecommit = false;
            contextReceipt.actions.push('precommit-network-failure');
            await route.abort('failed');
            return;
          }
          const response = await fetch(target, { method, headers: { 'Content-Type': 'application/json' }, body: requestBody });
          const body = await response.text();
          const contentType = response.headers.get('content-type') ?? 'application/json';
          if (method === 'PUT' && droppedCommit && response.status === 200) {
            droppedCommit = false;
            contextReceipt.actions.push('postcommit-response-dropped');
            await route.abort('failed');
            return;
          }
          await route.fulfill({ status: response.status, headers: { 'content-type': contentType }, body });
          return;
        }
        if (url.pathname.startsWith('/api/')) {
          receipt.network.receipts.push({ studentNumber, api: url.pathname, method: request.method(), action: 'synthetic-unrelated-fulfill' });
          const body = url.pathname === '/api/question-submission-status' ? '[]' : '{"missions":[]}';
          await route.fulfill({ status: 200, contentType: 'application/json', body });
          return;
        }
        await route.continue();
      });
      await context.addInitScript((number) => {
        localStorage.clear();
        localStorage.setItem('school-timer-entry-number-v1', String(number));
        localStorage.setItem('school-timer-practice-failure-stories-reset-v1', '1');
      }, studentNumber);
      const page = await context.newPage();
      page.on('pageerror', (error) => contextReceipt.errors.push(error.message));
      return page;
    };

    const student1 = await makeContext(1);
    const student23 = await makeContext(23);
    const canvas = (page) => page.getByRole('application', { name: /우리 반 도서관/ });
    const position = (page) => canvas(page).evaluate((node) => ({ x: Number(node.dataset.playerX), y: Number(node.dataset.playerY), target: node.dataset.nearbyTarget }));
    const snapshot = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('school-timer-student-pets-v1') ?? '{}'));
    const capture = async (page, studentNumber, name) => {
      const path = `${EVIDENCE_DIR}task-6-shared-${studentNumber}-${name}.png`;
      await page.screenshot({ path });
      const png = await readFile(path);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${name} PNG signature`);
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1280, 800], `${name} dimensions`);
      assert.deepEqual(await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]), [0, 0], `${name} overflow`);
      contexts.get(studentNumber).receipt.screenshots.push(path); receipt.screenshots.push(path);
      return path;
    };
    const travel = async (page, studentNumber, target) => {
      const scene = canvas(page); await scene.focus();
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const current = await position(page);
        if (Math.hypot(current.x - target.x, current.y - target.y) < 4) return current;
        const path = routeFrom({ x: current.x, y: current.y }, target, studentNumber);
        const direction = path[0]?.key; assert.ok(direction);
        let endpoint = path[0].player.position;
        for (const node of path) { if (node.key !== direction) break; endpoint = node.player.position; }
        const axis = direction === 'a' || direction === 'd' ? 'x' : 'y';
        for (let tick = 0; tick < 80; tick += 1) {
          const before = await position(page); const delta = endpoint[axis] - before[axis];
          if (Math.abs(delta) < 2.8) break;
          const key = axis === 'x' ? (delta > 0 ? 'd' : 'a') : (delta > 0 ? 's' : 'w');
          await page.keyboard.down(key); await page.waitForTimeout(Math.min(100, Math.max(20, Math.abs(delta) * 8))); await page.keyboard.up(key);
          const after = await position(page); if (Math.abs(after[axis] - before[axis]) < 0.1) throw new Error(`Movement stalled (${key})`);
        }
      }
      throw new Error(`Walking target not reached: ${JSON.stringify(target)}`);
    };
    const register = async (page, studentNumber, title, author, pages) => {
      await page.getByRole('textbox', { name: '책 제목', exact: true }).fill(title);
      await page.getByRole('textbox', { name: '글쓴이', exact: true }).fill(author);
      await page.getByRole('textbox', { name: '쪽수', exact: true }).fill(String(pages));
      await page.getByRole('button', { name: '책 받기', exact: true }).click();
      await page.getByText(`운반 중 · ${title}`, { exact: true }).waitFor();
    };
    const openDesk = async (page, studentNumber) => { await travel(page, studentNumber, ROOM.desk.interactionPoint); await page.keyboard.press('e'); await page.getByRole('dialog').waitFor(); };
    const openShelf = async (page, studentNumber) => { await travel(page, studentNumber, ROOM.shelves[0].interactionPoint); await page.keyboard.press('e'); await page.getByRole('heading', { name: '책을 둘 자리', exact: true }).waitFor(); };

    // Real registration through RootApp and first-screen geometry.
    await student1.goto(`${ORIGIN}/#student-library-bookshelf`);
    await student1.getByRole('heading', { name: '번호 선택', exact: true }).waitFor();
    await student1.getByRole('button', { name: '1번 경매장 선택', exact: true }).click();
    await student1.waitForTimeout(200); await student1.goto(`${ORIGIN}/#student-library-bookshelf`);
    await canvas(student1).waitFor(); await student1.waitForFunction(() => document.querySelector('canvas')?.dataset.playerX);
    await capture(student1, 1, 'registered');
    await student23.goto(`${ORIGIN}/#student-library-bookshelf`);
    await student23.getByRole('heading', { name: '번호 선택', exact: true }).waitFor();
    await student23.getByRole('button', { name: '23번 경매장 선택', exact: true }).click();
    await student23.waitForTimeout(200); await student23.goto(`${ORIGIN}/#student-library-bookshelf`);
    await canvas(student23).waitFor(); await student23.waitForFunction(() => document.querySelector('canvas')?.dataset.playerX);
    await capture(student23, 23, 'registered');
    receipt.checks.registration = true;
    assert.equal((await student1.evaluate(() => document.querySelectorAll('.student-header').length)), 0);
    assert.deepEqual(await student1.evaluate(() => [innerWidth, innerHeight]), [1280, 800]);

    // Student 23 creates and places the shared book in slot 0.
    contexts.get(1).receipt.holdSharedReads = true;
    await openDesk(student23, 23); await register(student23, 23, '공유 검증 책', '합성 작가', 120); await capture(student23, 23, 'carrying-shared');
    await openShelf(student23, 23); await student23.getByRole('button', { name: '빈자리 1', exact: true }).click(); await student23.getByRole('dialog').waitFor({ state: 'hidden' });
    await student23.waitForTimeout(200); await capture(student23, 23, 'placed-shared');
    const after23 = await state();
    const sharedBook = after23.value.studentLife.books.find((book) => book.title === '공유 검증 책');
    assert.ok(sharedBook?.id?.startsWith('library:23:')); assert.equal(sharedBook.librarySlot, 0);
    receipt.checks.student23Placement = { id: sharedBook.id, slot: sharedBook.librarySlot };

    // Student 1's already-open, stale picker races with Student 23's placement.
    await openDesk(student1, 1); await register(student1, 1, '충돌 보류 책', '학생 1', 88); await student1.getByRole('dialog').waitFor({ state: 'hidden' });
    await openShelf(student1, 1); // this picker was rendered before the opponent's placement
    contexts.get(1).receipt.holdSharedReads = false;
    await student1.getByRole('button', { name: '빈자리 1', exact: true }).click();
    await student1.getByRole('alert').waitFor();
    assert.match(await student1.getByRole('alert').innerText(), /다른 책이 먼저/);
    assert.equal(await student1.getByText('운반 중 · 충돌 보류 책', { exact: true }).count(), 1);
    receipt.checks.conflictingPlacementDraftRetained = true; await capture(student1, 1, 'conflict-draft-retained');

    // Retryable pre-commit failure: one browser attempt fails, exactly one retry succeeds with same request id.
    failPrecommit = true; await student1.getByRole('button', { name: '빈자리 2', exact: true }).click(); await student1.getByRole('alert').waitFor();
    assert.match(await student1.getByRole('alert').innerText(), /연결이 불안정/); assert.equal(await student1.getByText('운반 중 · 충돌 보류 책', { exact: true }).count(), 1);
    const precommitAttempts = contexts.get(1).receipt.requests.filter((r) => r.api === 'shared-settings' && r.method === 'PUT');
    const precommitId = precommitAttempts.at(-1)?.body?.requestId; assert.ok(precommitId);
    await student1.getByRole('button', { name: '빈자리 2', exact: true }).click(); await student1.getByRole('dialog').waitFor({ state: 'hidden' });
    const precommitRetry = contexts.get(1).receipt.requests.filter((r) => r.api === 'shared-settings' && r.method === 'PUT').slice(-2);
    assert.deepEqual(precommitRetry.map((r) => r.body.requestId), [precommitId, precommitId]);
    receipt.checks.precommitFailureRetryExactlyOnce = { requestId: precommitId, attempts: 2 }; await capture(student1, 1, 'precommit-retried');

    // Student 1 refreshes and reads the other student's authoritative book.
    await student1.reload(); await canvas(student1).waitFor(); await student1.waitForFunction(() => document.querySelector('canvas')?.dataset.playerX);
    await openShelf(student1, 1); await student1.getByRole('button', { name: '공유 검증 책', exact: true }).click();
    await student1.getByRole('heading', { name: '공유 검증 책', exact: true }).waitFor();
    await capture(student1, 1, 'other-student-details');
    assert.equal(await student1.getByText('23번', { exact: true }).count(), 1);
    receipt.checks.otherStudentRefreshRead = true;
    await student1.keyboard.press('Escape');

    // Cancellation and malformed page count do not create or move a book.
    await openDesk(student1, 1); await student1.getByRole('textbox', { name: '책 제목', exact: true }).fill('취소할 책'); await student1.getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(await student1.getByText('운반 중 · 취소할 책', { exact: true }).count(), 0);
    await openDesk(student1, 1); await student1.getByRole('textbox', { name: '책 제목', exact: true }).fill('잘못된 쪽수'); await student1.getByRole('textbox', { name: '글쓴이', exact: true }).fill('합성'); await student1.getByRole('textbox', { name: '쪽수', exact: true }).fill('0'); await student1.getByRole('button', { name: '책 받기', exact: true }).click();
    await student1.getByRole('alert').waitFor(); assert.equal(await student1.getByText('운반 중 · 잘못된 쪽수', { exact: true }).count(), 0); receipt.checks.cancelAndMalformedInput = true; await student1.getByRole('button', { name: '책 등록 닫기', exact: true }).click();

    // Unsafe-looking metadata must render as text, not markup.
    await openDesk(student1, 1); await register(student1, 1, '<b>합성</b>', '<script>합성</script>', 77); await openShelf(student1, 1); await student1.getByRole('button', { name: '빈자리 3', exact: true }).click(); await student1.getByRole('dialog').waitFor({ state: 'hidden' });
    const unsafeBook = (await state()).value.studentLife.books.find((book) => book.title === '<b>합성</b>'); assert.ok(unsafeBook);
    await openShelf(student1, 1); await student1.getByRole('button', { name: '<b>합성</b>', exact: true }).click();
    await student1.getByRole('heading', { name: '<b>합성</b>', exact: true }).waitFor();
    assert.equal(await student1.getByText('<script>합성</script>', { exact: true }).count(), 1);
    assert.equal(await student1.locator('[role="dialog"] b').count(), 0);
    receipt.checks.untrustedMetadataLiteral = { id: unsafeBook.id, escaped: true }; await capture(student1, 1, 'untrusted-metadata-details'); await student1.keyboard.press('Escape');

    // Response drop after a real commit: retry must replay, preserve id, and not duplicate/reward.
    await openDesk(student1, 1); await register(student1, 1, '드롭 후 재시도 책', '네트워크 합성', 66); await openShelf(student1, 1); droppedCommit = true;
    await student1.getByRole('button', { name: '빈자리 4', exact: true }).click(); await student1.getByRole('alert').waitFor(); assert.match(await student1.getByRole('alert').innerText(), /연결이 불안정/);
    const droppedAttempts = contexts.get(1).receipt.requests.filter((r) => r.api === 'shared-settings' && r.method === 'PUT').slice(-1); const droppedId = droppedAttempts[0]?.body?.requestId; assert.ok(droppedId);
    await student1.getByRole('button', { name: '빈자리 4', exact: true }).click(); await student1.getByRole('dialog').waitFor({ state: 'hidden' });
    const droppedRetry = contexts.get(1).receipt.requests.filter((r) => r.api === 'shared-settings' && r.method === 'PUT').slice(-2); assert.deepEqual(droppedRetry.map((r) => r.body.requestId), [droppedId, droppedId]);
    const afterAll = await state(); const droppedBooks = afterAll.value.studentLife.books.filter((book) => book.id === `library:1:${droppedId}`); assert.equal(droppedBooks.length, 1); receipt.checks.postcommitDropReplay = { requestId: droppedId, attempts: 2, duplicateCount: droppedBooks.length };
    await capture(student1, 1, 'shared-final');

    // A third isolated student can refresh and inspect Student 1's authoritative book.
    const student2 = await makeContext(2);
    await student2.goto(`${ORIGIN}/#student-library-bookshelf`);
    await student2.getByRole('heading', { name: '번호 선택', exact: true }).waitFor();
    await student2.getByRole('button', { name: '2번 경매장 선택', exact: true }).click();
    await student2.waitForTimeout(200); await student2.goto(`${ORIGIN}/#student-library-bookshelf`);
    await canvas(student2).waitFor(); await student2.waitForFunction(() => document.querySelector('canvas')?.dataset.playerX);
    await openShelf(student2, 2); await student2.getByRole('button', { name: '충돌 보류 책', exact: true }).click();
    await student2.getByRole('heading', { name: '충돌 보류 책', exact: true }).waitFor();
    assert.equal(await student2.getByText('1번', { exact: true }).count(), 1);
    receipt.checks.student2RefreshReadStudent1 = true; await capture(student2, 2, 'student1-details'); await student2.keyboard.press('Escape');

    const finalBooks = afterAll.value.studentLife.books;
    const history1 = afterAll.value.currencyHistory['1'] ?? []; const history23 = afterAll.value.currencyHistory['23'] ?? [];
    assert.equal(finalBooks.filter((book) => book.studentNumber === 1).length, 3);
    assert.equal(finalBooks.filter((book) => book.studentNumber === 23).length, 1);
    assert.equal(history1.filter((entry) => entry.reason === 'weekly_mission').length, 1);
    assert.equal(history23.filter((entry) => entry.reason === 'weekly_mission').length, 1);
    receipt.checks.syntheticDatabase = { bookCount: finalBooks.length, ids: finalBooks.map((book) => book.id), slots: finalBooks.map((book) => book.librarySlot), balances: afterAll.value.currencyBalances, weeklyMissionEntries: { '1': history1.filter((entry) => entry.reason === 'weekly_mission').length, '23': history23.filter((entry) => entry.reason === 'weekly_mission').length } };
    receipt.network.total = [...contexts.values()].reduce((sum, entry) => sum + entry.receipt.requests.length, 0);
    assert.equal(receipt.blockedRequests.some((request) => request.reason === 'unexpected-api'), false);
    receipt.network.blockedExternalCount = receipt.blockedRequests.filter((request) => request.url && !request.url.startsWith(ORIGIN)).length;
    assert.deepEqual([...contexts.values()].flatMap((entry) => entry.receipt.errors), []);
    receipt.sourceHashesBefore = sourceStart; receipt.sourceHashesAfter = await sourceHashes(); assert.deepEqual(receipt.sourceHashesAfter, sourceStart);
    receipt.fullSourceHashesBefore = fullSourceStart; receipt.fullSourceHashesAfter = await fullSourceHashes(); assert.deepEqual(receipt.fullSourceHashesAfter, fullSourceStart);
    receipt.passed = true;
  } catch (error) {
    receipt.passed = false; receipt.failure = String(error); receipt.stack = error?.stack;
    process.exitCode = 1;
  } finally {
    for (const { context } of contexts.values()) { await context.close(); }
    await browser.close(); receipt.cleanup.push('Own Playwright contexts and browser closed; harness/preview processes are external and not touched.');
    for (const [studentNumber, entry] of contexts) receipt.contexts[studentNumber] = entry.receipt;
    await writeFile(`${EVIDENCE_DIR}task-6-shared-browser.json`, JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt, null, 2));
  }
}

await main();
