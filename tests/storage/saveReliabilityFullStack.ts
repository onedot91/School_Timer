import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { requireBrowserFixture } from './saveReliabilityBrowser.mjs';
import { startHttpHarness } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';

export const runSaveReliabilityFullStack = async () => {
  const { playwright, executablePath } = await requireBrowserFixture();
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directory = await mkdtemp(resolve(tmpdir(), 'school-save-full-stack-'));
  const output = resolve(directory, 'build');
  const results: { name: string; passed: boolean; milliseconds: number }[] = [];
  const pageErrors: string[] = [], blockedExternal: string[] = [];
  const apiResponses: { path: string; status: number; editRevisions?: string }[] = [];
  const posts: string[] = [], receipts: string[] = [];
  const confirmedReceipts: string[] = [];
  const weeklyPosts: { time: number; actor: number }[] = [];
  const weeklyFailures: number[] = [];
  const databaseChecks: Record<string, unknown> = {};
  let harness: Awaited<ReturnType<typeof startHttpHarness>> | undefined;
  let studentContext, teacherContext;
  let holdReceipts = false, lostId: string | null = null;
  const previousRevisionRequirement = process.env.STORAGE_REQUIRE_EDIT_REVISIONS;
  process.env.STORAGE_REQUIRE_EDIT_REVISIONS = '1';
  const title = '격리 우체통 저장 검증';
  const content = '이 편지는 합성 학급의 브라우저와 데이터베이스 저장 검증용입니다.';
  const scenario = async (name: string, work: () => Promise<void>) => {
    const started = Date.now();
    console.log(`RUN ${name}`);
    try { await work(); results.push({ name, passed: true, milliseconds: Date.now() - started }); console.log(`PASS ${name}`); }
    catch (error) { results.push({ name, passed: false, milliseconds: Date.now() - started }); throw error; }
  };
  const poll = async (predicate: () => Promise<boolean>, label: string, milliseconds = 30_000) => {
    const deadline = Date.now() + milliseconds;
    while (!await predicate()) {
      if (Date.now() > deadline) throw new Error(`FULL_STACK_TIMEOUT: ${label}`);
      await new Promise(resolveWait => setTimeout(resolveWait, 100));
    }
  };
  try {
    await scenario('production RootApp build without project environment files', async () => {
      await build({ root, configFile: resolve(root, 'vite.config.ts'), envDir: directory, envPrefix: 'ISOLATED_FULLSTACK_UNUSED_',
        mode: 'production', publicDir: false, logLevel: 'warn', define: {
          'import.meta.env.VITE_DATA_MODE': JSON.stringify('production'),
          'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1'),
          'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('isolated-full-stack-anon'),
        }, build: { outDir: output, emptyOutDir: true } });
    });
    harness = await startHttpHarness({ name: `storage_http_test_browser_${process.pid}_${Date.now()}`, port: 0,
      staticDirectory: output, publicDirectory: resolve(root, 'public') });
    const service = harness;
    const origin = service.baseUrl;
    const student2Before = (await service.query("select value from storage_resources where resource_key='/studentLife/letters/@private-letter-2'")).rows;
    assert.equal(student2Before.length, 1);
    const launch = async (actor: number) => {
      const context = await playwright.chromium.launchPersistentContext(resolve(directory, actor === 0 ? 'teacher-profile' : 'student-profile'),
        { executablePath, headless: true, viewport: { width: 1280, height: 650 }, serviceWorkers: 'block' });
      await context.addInitScript((number: number) => localStorage.setItem('school-timer-entry-number-v1', String(number)), actor);
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin) { blockedExternal.push(`${url.origin}${url.pathname}`); await route.abort(); return; }
        if (url.pathname === '/api/weekly-missions' && request.method() === 'POST') {
          weeklyPosts.push({ time: Date.now(), actor });
          await new Promise(resolveWait => setTimeout(resolveWait, 250));
        }
        if (url.pathname === '/api/shared-settings') {
          if (request.method() === 'POST') {
            const body: unknown = request.postDataJSON();
            if (isStorageRecord(body) && body.action === 'student.letter.send') {
              assert.equal(typeof body.requestId, 'string');
              const requestId = String(body.requestId);
              posts.push(requestId);
              if (lostId === null) {
                lostId = requestId;
                holdReceipts = true;
                const committedResponse = await route.fetch({ maxRetries: 0 });
                assert.equal(committedResponse.status(), 200);
                await route.abort('failed');
                return;
              }
            }
          }
          if (url.searchParams.has('requestId')) {
            receipts.push(url.searchParams.get('requestId') ?? '');
            if (holdReceipts) { await route.abort(); return; }
          }
        }
        await route.continue();
      });
      for (const page of context.pages()) await page.close();
      const page = await context.newPage();
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('response', async response => {
        const url = new URL(response.url());
        if (url.pathname.startsWith('/api/')) apiResponses.push({ path: url.pathname, status: response.status(),
          ...(url.pathname === '/api/shared-settings' ? { editRevisions: response.headers()['x-storage-edit-revisions'] } : {}) });
        if (url.pathname === '/api/weekly-missions' && response.status() === 503) weeklyFailures.push(Date.now());
        if (url.pathname === '/api/shared-settings' && url.searchParams.get('receiptOnly') === '1' && response.status() === 200) {
          try {
            const value: unknown = await response.json();
            if (isStorageRecord(value) && value.status === 'committed') confirmedReceipts.push(url.searchParams.get('requestId') ?? '');
          } catch { if (!page.isClosed()) pageErrors.push('FIXTURE_RECEIPT_PARSE_FAILED'); }
        }
      });
      page.on('dialog', dialog => dialog.accept());
      page.setDefaultTimeout(30_000);
      await page.goto(`${origin}/__fixture/session?student=${actor}`);
      await page.goto(`${origin}/${actor === 0 ? '' : '#student-mailbox'}`);
      return { context, page };
    };
    let studentPage;
    await scenario('real cookie session and editable mailbox draft survive browser relaunch', async () => {
      ({ context: studentContext, page: studentPage } = await launch(1));
      await studentPage.getByRole('tab', { name: '편지 쓰기', exact: true }).click();
      await studentPage.getByLabel('제목', { exact: true }).fill(title);
      await studentPage.getByPlaceholder('전하고 싶은 마음을 적어 주세요').fill(content);
      await poll(async () => studentPage.evaluate(async (expected: { title: string; content: string }) => {
        const databases = await indexedDB.databases();
        for (const info of databases) {
          if (!info.name?.includes('draft')) continue;
          const values: unknown[] = await new Promise((resolveValues, reject) => {
            const request = indexedDB.open(info.name!);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const database = request.result;
              if (!database.objectStoreNames.contains('drafts')) { database.close(); resolveValues([]); return; }
              const transaction = database.transaction('drafts', 'readonly'), read = transaction.objectStore('drafts').getAll();
              read.onsuccess = () => { resolveValues(read.result); database.close(); };
              read.onerror = () => { reject(read.error); database.close(); };
            };
          });
          const serialized = JSON.stringify(values);
          if (serialized.includes(expected.title) && serialized.includes(expected.content)) return true;
        }
        return false;
      }, { title, content }), 'native draft commit');
      await studentContext.close();
      ({ context: studentContext, page: studentPage } = await launch(1));
      await studentPage.getByRole('tab', { name: '편지 쓰기', exact: true }).click();
      assert.equal(await studentPage.getByLabel('제목', { exact: true }).inputValue(), title);
      assert.equal(await studentPage.getByPlaceholder('전하고 싶은 마음을 적어 주세요').inputValue(), content);
      assert.equal(await studentPage.getByText('연습 모드', { exact: true }).count(), 0);
      assert.ok(apiResponses.some(response => response.path === '/api/device-session' && response.status === 200));
      assert.ok(apiResponses.some(response => response.path === '/api/shared-settings' && response.status === 200));
      assert.ok(apiResponses.some(response => response.path === '/api/shared-settings' && response.editRevisions === 'required'));
      await studentPage.screenshot({ path: resolve(directory, 'student-draft-restored.png') });
    });
    await scenario('Root foreground event bursts share one weekly mission request and failure cooldown', async () => {
      await poll(async () => weeklyFailures.length > 0, 'expected unconfigured weekly endpoint');
      await new Promise(resolveWait => setTimeout(resolveWait, 5_200));
      const before = weeklyPosts.length, failedBefore = weeklyFailures.length;
      const burst = async () => studentPage.evaluate(() => {
        for (let index = 0; index < 6; index++) {
          window.dispatchEvent(new Event('focus'));
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('online'));
        }
      });
      await burst();
      await poll(async () => weeklyFailures.length > failedBefore, 'weekly 503 after foreground burst');
      assert.equal(weeklyPosts.length - before, 1);
      await burst();
      await new Promise(resolveWait => setTimeout(resolveWait, 750));
      assert.equal(weeklyPosts.length - before, 1);
    });
    await scenario('real API commits once despite lost response and pending browser restart', async () => {
      await studentPage.getByRole('button', { name: '보내기', exact: true }).click();
      await poll(async () => {
        if (!lostId) return false;
        return (await service.query('select count(*)::integer total from storage_receipts where actor_key=$1 and request_id=$2', ['student:1', lostId])).rows[0]?.total === 1;
      }, 'PostgreSQL receipt');
      assert.ok(lostId);
      await poll(async () => receipts.includes(lostId ?? ''), 'confirmation attempted');
      assert.equal(await studentPage.getByPlaceholder('전하고 싶은 마음을 적어 주세요').inputValue(), content);
      await studentPage.screenshot({ path: resolve(directory, 'student-unconfirmed.png') });
      await studentContext.close();
      holdReceipts = false;
      ({ context: studentContext, page: studentPage } = await launch(1));
      await studentPage.getByRole('tab', { name: '보낸 편지', exact: true }).click();
      await studentPage.getByText(title, { exact: true }).first().waitFor();
      await poll(async () => confirmedReceipts.includes(lostId ?? ''), 'committed receipt restored on relaunch');
      await poll(async () => studentPage.evaluate(async (requestId: string) => new Promise<boolean>((resolveConfirmed, reject) => {
        const opening = indexedDB.open('school-timer-student-drafts');
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const database = opening.result;
          const reading = database.transaction('drafts', 'readonly').objectStore('drafts').getAll();
          reading.onerror = () => { reject(reading.error); database.close(); };
          reading.onsuccess = () => {
            const rows: unknown[] = reading.result;
            resolveConfirmed(!rows.some(row => typeof row === 'object' && row !== null && 'requestId' in row && row.requestId === requestId));
            database.close();
          };
        };
      }), lostId), 'confirmed immutable request removed from native queue');
      assert.equal(posts.length, 1);
      const rows = (await service.query('select value from storage_resources where resource_key=$1 and not deleted', [`/studentLife/letters/@${lostId}`])).rows;
      assert.equal(rows.length, 1);
      assert.ok(JSON.stringify(rows).includes(content));
      const receiptCount = (await service.query('select count(*)::integer total from storage_receipts where actor_key=$1 and request_id=$2', ['student:1', lostId])).rows[0]?.total;
      assert.equal(receiptCount, 1);
      Object.assign(databaseChecks, { letterCount: rows.length, receiptCount, confirmedNativeQueueCleared: true });
      await studentPage.screenshot({ path: resolve(directory, 'student-saved-once.png') });
    });
    await scenario('real teacher screen reads the committed student letter and preserves other students', async () => {
      const teacher = await launch(0); teacherContext = teacher.context;
      await teacher.page.getByRole('button', { name: '설정', exact: true }).click();
      await teacher.page.getByRole('navigation', { name: '설정 기능' }).getByRole('button', { name: /^편지/ }).click();
      await teacher.page.getByRole('button', { name: /^1번과의 대화/ }).click();
      await teacher.page.getByRole('log', { name: '1번 학생과 주고받은 편지' }).getByText(content, { exact: true }).waitFor();
      await teacher.page.screenshot({ path: resolve(directory, 'teacher-shared-letter.png') });
      assert.deepEqual((await service.query("select value from storage_resources where resource_key='/studentLife/letters/@private-letter-2'")).rows, student2Before);
      const unchangedWallets = (await service.query('select count(*)::integer total from wallet_accounts where balance=100')).rows[0]?.total;
      const reconciliation = (await service.query('select storage_reconcile_wallets() result')).rows[0]?.result;
      assert.equal(unchangedWallets, 23);
      assert.deepEqual(reconciliation, []);
      Object.assign(databaseChecks, { otherStudentLetterUnchanged: true, unchangedWallets, reconciliation });
      assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
    });
    return { directory, database: service.name, passed: true, scenarios: results.length };
  } finally {
    if (results.some(result => !result.passed)) {
      for (const [label, context] of [['student', studentContext], ['teacher', teacherContext]]) {
        const page = context?.pages().find(candidate => !candidate.isClosed());
        if (!page) continue;
        await page.screenshot({ path: resolve(directory, `${label}-failure.png`) }).catch(() => undefined);
        await writeFile(resolve(directory, `${label}-failure.txt`), await page.locator('body').innerText()).catch(() => undefined);
      }
    }
    await studentContext?.close();
    await teacherContext?.close();
    await writeFile(resolve(directory, 'manifest.json'), JSON.stringify({ directory, database: harness?.name, results,
      pageErrors, blockedExternal, apiResponses, letterPosts: posts, receiptQueries: receipts, confirmedReceipts, weeklyPosts, weeklyExpected503: weeklyFailures.length,
      editRevisionsRequired: true, databaseChecks,
      scope: 'Actual index.html/RootApp/AuctionPage/TimerPage production Vite build, device cookie auth, shared-settings handlers, storage repositories and PostgreSQL SQL/RPC. Same-origin local PostgREST adapter and synthetic classroom; no live services or credentials.',
      limitations: 'This is local Chromium and PostgreSQL, not a deployed Vercel/Supabase network test. Unrelated API features are not configured by this harness.',
    }, null, 2));
    await harness?.stop();
    if (previousRevisionRequirement === undefined) delete process.env.STORAGE_REQUIRE_EDIT_REVISIONS;
    else process.env.STORAGE_REQUIRE_EDIT_REVISIONS = previousRevisionRequirement;
    console.log(JSON.stringify({ evidence: resolve(directory, 'manifest.json') }));
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSaveReliabilityFullStack().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
}
