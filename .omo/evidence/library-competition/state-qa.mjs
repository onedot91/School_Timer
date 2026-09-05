import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const evidenceDir = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const origin = 'http://127.0.0.1:3044';
const sourceFiles = [
  'src/components/student/library/LibraryCompetitionPanel.tsx',
  'src/components/student/library/LibraryCompetitionTable.tsx',
  'src/components/teacher/TeacherLibraryCompetitionPanel.tsx',
  'src/lib/libraryCompetitionClient.ts',
  'src/lib/libraryCompetitionTransport.ts',
  'src/index.css',
];
const sha256 = async path => createHash('sha256').update(await readFile(root + path)).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, await sha256(path)])));
const receipt = {
  generatedAt: new Date().toISOString(),
  invocation: 'node --import tsx .omo/evidence/library-competition/state-qa.mjs',
  fixture: 'INJECTED FIXTURE: actual LibraryCompetitionPanel and TeacherLibraryCompetitionPanel; singleton client methods replaced in page realm only; no production/API requests',
  viewport: [1280, 800], screenshots: [], checks: {}, blockedRequests: [], errors: [], cleanup: [],
};
receipt.sourceStart = await hashes();

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.port !== '3044' || url.pathname.startsWith('/api/')) {
      receipt.blockedRequests.push({ path: url.pathname, method: route.request().method() });
      return route.abort();
    }
    return route.continue();
  });

  const capture = async (page, id) => {
    await page.waitForTimeout(180);
    const path = `${evidenceDir}${id}.png`;
    await page.screenshot({ path });
    const png = await readFile(path);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${id} PNG signature`);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1280, 800], `${id} dimensions`);
    assert.deepEqual(await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]), [0, 0], `${id} document overflow`);
    receipt.screenshots.push(path);
    return path;
  };

  const visit = async (surface, state) => {
    const page = await context.newPage();
    page.on('pageerror', error => receipt.errors.push(`${surface}-${state}: ${error.message}`));
    const id = `state-qa-${surface}-${state}`;
    let alreadyCaptured = false;
    await page.goto(`${origin}/.omo/evidence/library-competition/state-qa-fixture.html?surface=${surface}&state=${state}`);
    await page.locator('.state-qa-label').waitFor();
    assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), [1280, 800]);
    if (surface === 'student') {
      const dialog = page.getByRole('dialog', { name: '전국 책방 챌린지', exact: true });
      await dialog.waitFor();
      if (state === 'loading') {
        await page.locator('[role="status"]').filter({ hasText: '기록을 불러오는 중…' }).waitFor();
        assert.equal(await dialog.getAttribute('aria-busy'), 'true');
        assert.equal(await page.getByRole('button', { name: '순위 새로고침', exact: true }).isDisabled(), true);
        receipt.checks.studentLoading = { readCalls: await page.evaluate(() => window.__stateQa?.readCalls.join(',') ?? ''), ariaBusy: true };
      } else if (state === 'unavailable') {
        await page.locator('[role="status"]').filter({ hasText: '책방 챌린지를 준비 중이에요. 기존 책방은 그대로 이용할 수 있어요.' }).waitFor();
        assert.equal(await dialog.getAttribute('aria-busy'), 'false');
        receipt.checks.studentUnavailable = { message: true, readCalls: await page.evaluate(() => window.__stateQa?.readCalls.join(',') ?? '') };
      } else {
        await page.getByText('아직 챌린지를 열 수 없어요. 책방은 그대로 이용할 수 있어요.', { exact: true }).waitFor();
        assert.equal(await dialog.getAttribute('aria-busy'), 'false');
        assert.equal(await page.locator('.library-competition-table').count(), 0);
        assert.equal(await page.locator('[data-qa-write-calls]').innerText(), '');
        await capture(page, id);
        alreadyCaptured = true;
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '책방으로 돌아가기');
        assert.equal(await page.locator('canvas[aria-label="책방으로 돌아가기"]').evaluate(element => document.activeElement === element), true);
        receipt.checks.studentInactiveReadonly = { inactive: true, readCalls: await page.evaluate(() => window.__stateQa?.readCalls.join(',') ?? ''), writeCalls: '', escapeFocusRestored: true };
      }
    } else {
      const panel = page.locator('.teacher-library-competition-panel');
      await panel.waitFor();
      if (state === 'loading') {
        await page.locator('[role="status"]').filter({ hasText: '챌린지를 불러오는 중…' }).waitFor();
        assert.equal(await panel.getAttribute('aria-busy'), 'true');
        assert.equal(await page.getByRole('button', { name: '최신값 확인', exact: true }).isDisabled(), true);
        receipt.checks.teacherLoading = { readCalls: await page.evaluate(() => window.__stateQa?.readCalls.join(',') ?? ''), ariaBusy: true };
      } else if (state === 'unavailable') {
        await page.locator('[role="status"]').filter({ hasText: '책방 챌린지를 준비 중이에요. 기존 책방은 그대로 이용할 수 있어요.' }).waitFor();
        assert.equal(await panel.getAttribute('aria-busy'), 'false');
        receipt.checks.teacherUnavailable = { message: true, readCalls: await page.evaluate(() => window.__stateQa?.readCalls.join(',') ?? '') };
      } else {
        await page.getByText('학생 책방의 순위판을 처음 열면 이번 달 챌린지가 시작됩니다.', { exact: true }).waitFor();
        assert.equal(await panel.getAttribute('aria-busy'), 'false');
        assert.equal(await page.locator('.teacher-library-competition-counts input').count(), 0);
        assert.equal(await page.locator('[data-qa-write-calls]').innerText(), '');
        receipt.checks.teacherInactive = { inactive: true, readCalls: await page.evaluate(() => window.__stateQa?.readCalls.join(',') ?? ''), writeCalls: '' };
      }
    }
    if (!alreadyCaptured) await capture(page, id);
    await page.close();
  };

  await visit('student', 'loading');
  await visit('student', 'unavailable');
  await visit('student', 'inactive-readonly');
  await visit('teacher', 'loading');
  await visit('teacher', 'unavailable');
  await visit('teacher', 'inactive');
  assert.deepEqual(receipt.errors, []);
  assert.equal(receipt.blockedRequests.some(request => request.path.startsWith('/api/')), false);
  assert.deepEqual(receipt.checks.studentInactiveReadonly.writeCalls, '');
  assert.deepEqual(receipt.checks.teacherInactive.writeCalls, '');
  await context.close();
  receipt.cleanup.push('isolated Chrome context closed');
} finally {
  await browser.close();
  receipt.cleanup.push('isolated Chrome closed; root-owned 127.0.0.1:3044 retained');
  receipt.sourceEnd = await hashes();
  receipt.sourceHashesEqual = JSON.stringify(receipt.sourceStart) === JSON.stringify(receipt.sourceEnd);
  await writeFile(`${evidenceDir}state-qa.json`, JSON.stringify(receipt, null, 2));
}
console.log(JSON.stringify({ screenshots: receipt.screenshots.length, checks: receipt.checks, errors: receipt.errors, sourceHashesEqual: receipt.sourceHashesEqual, cleanup: receipt.cleanup }));
