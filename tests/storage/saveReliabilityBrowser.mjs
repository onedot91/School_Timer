import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { tsImport } from 'tsx/esm/api';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export const requireBrowserFixture = async () => {
  const modulePath = process.env.STORAGE_TEST_BROWSER_MODULE;
  const executablePath = process.env.STORAGE_TEST_CHROMIUM_EXECUTABLE;
  if (!modulePath || !executablePath) throw new Error('RELEASE_BROWSER_REQUIRED: set STORAGE_TEST_BROWSER_MODULE and STORAGE_TEST_CHROMIUM_EXECUTABLE');
  let playwright;
  try { playwright = createRequire(import.meta.url)(modulePath); }
  catch { throw new Error('RELEASE_BROWSER_MODULE_UNAVAILABLE'); }
  if (typeof playwright.chromium?.launch !== 'function') throw new Error('RELEASE_BROWSER_MODULE_UNAVAILABLE');
  try { await access(executablePath); }
  catch { throw new Error('RELEASE_CHROMIUM_UNAVAILABLE'); }
  return { playwright, executablePath };
};

const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object' ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
  : JSON.stringify(value);

export const runSaveReliabilityBrowser = async () => {
  const { playwright, executablePath } = await requireBrowserFixture();
  const { splitStorageState } = await tsImport('../../src/lib/storageV2Codec.ts', import.meta.url);
  const { createSudokuPuzzle } = await tsImport('../../src/lib/sudoku.ts', import.meta.url);
  const { createNumberBaseballAnswer, getNumberBaseballGameId } = await tsImport('../../src/lib/numberBaseball.ts', import.meta.url);
  const { getKoreanIsoWeekKey } = await tsImport('../../src/lib/weeklyMission.ts', import.meta.url);
  const baseballGuess = (digits, actor = 1, week = getKoreanIsoWeekKey()) => digits.join('') === createNumberBaseballAnswer(actor, week).join('')
    ? [digits[0], digits[2], digits[1]] : digits;
  const directory = await mkdtemp(resolve(tmpdir(), 'school-save-browser-'));
  const fixtureRoot = fileURLToPath(new URL('./', import.meta.url));
  const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
  const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url));
  const output = resolve(directory, 'build');
  await build({ configFile: false, root: projectRoot, envDir: directory, publicDir: false, logLevel: 'warn', plugins: [react(), tailwindcss()],
    define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('isolated-browser-fixture') },
    build: { outDir: output, emptyOutDir: true, rollupOptions: { input: resolve(fixtureRoot, 'saveReliabilityBrowser.html') } } });

  const state = { mode: 'success', posts: [], receipts: new Map(), held: [], revision: 0, value: {} };
  const json = (response, status, body) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/api/shared-settings') {
        if (request.method === 'POST') {
          let text = '';
          for await (const chunk of request) text += chunk;
          const command = JSON.parse(text);
          state.posts.push(command);
          if (state.mode === 'unavailable') return json(response, 503, { error: 'STORAGE_UNAVAILABLE' });
          if (state.mode === 'baseball-conflict' && command.action.startsWith('student.baseball.')) {
            const [actor, week] = command.payload.key.split(':');
            state.value = { studentNumberBaseball: { [command.payload.key]: {
              gameId: getNumberBaseballGameId(Number(actor), week), attempts: [{ guess: baseballGuess([4, 5, 6], Number(actor), week) }], completedAt: null,
            } } };
            state.revision++;
            return json(response, 400, { error: 'GAME_PROGRESS_CONFLICT' });
          }
          if (state.mode === 'sudoku-conflict' && command.action === 'student.sudoku.save') {
            const [actor, week, difficulty] = command.payload.key.split(':');
            const puzzle = createSudokuPuzzle(Number(actor), week, difficulty);
            const cells = [...puzzle.puzzle];
            cells[cells.findIndex(cell => cell === 0)] = 1;
            state.value = { studentSudoku: { [command.payload.key]: { puzzleId: puzzle.id, cells, completedAt: null } } };
            state.revision++;
            return json(response, 409, { error: 'STUDENT_EDIT_CONFLICT' });
          }
          const existing = state.receipts.get(command.requestId);
          if (existing) return json(response, 200, existing.projection);
          const committedAt = new Date().toISOString();
          state.revision++;
          if (command.action === 'student.sudoku.save') {
            const [actor, week, difficulty] = command.payload.key.split(':');
            const puzzle = createSudokuPuzzle(Number(actor), week, difficulty);
            state.value = { studentSudoku: { [command.payload.key]: { puzzleId: puzzle.id, cells: command.payload.cells, completedAt: null } } };
          }
          if (command.action.startsWith('student.baseball.')) {
            const [actor, week] = command.payload.key.split(':');
            state.value = { studentNumberBaseball: { [command.payload.key]: { gameId: getNumberBaseballGameId(Number(actor), week), attempts: command.payload.attempts, completedAt: null } } };
          }
          const encoded = splitStorageState(state.value);
          const projection = { value: state.value, updatedAt: committedAt, result: { saved: true },
            storagePatch: { ...encoded, deletedKeys: [], historyStudents: [], complete: true,
              revisions: { ...Object.fromEntries(encoded.resources.map(row => [row.resource_key, state.revision])), 'scope:studentSudoku:1': state.revision } } };
          const receipt = { status: 'committed', action: command.action, payloadHash: createHash('sha256').update(canonical({ action: command.action, payload: command.payload })).digest('hex'), committedAt, result: projection.result, projection };
          state.receipts.set(command.requestId, receipt);
          if (state.mode === 'lost-response' || state.mode === 'confirmation-unavailable') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end('{'); return; }
          if (state.mode === 'hold') { state.held.push(() => json(response, 200, projection)); return; }
          return json(response, 200, projection);
        }
        if (!url.searchParams.has('requestId')) {
          const encoded = splitStorageState(state.value);
          return json(response, 200, { id: 'school-timer-main', value: state.value, updated_at: new Date().toISOString(), scope: 'student',
            storagePatch: { ...encoded, deletedKeys: [], historyStudents: [], complete: true,
              revisions: { ...Object.fromEntries(encoded.resources.map(row => [row.resource_key, state.revision])), 'scope:studentSudoku:1': state.revision } } });
        }
        const receipt = state.receipts.get(url.searchParams.get('requestId'));
        if (state.mode === 'confirmation-unavailable') return json(response, 503, { error: 'STORAGE_CONFIRMATION_UNAVAILABLE' });
        if (!receipt) return json(response, 200, { status: 'unknown' });
        if (url.searchParams.get('receiptOnly') === '1') {
          const { projection, ...confirmation } = receipt;
          return json(response, 200, confirmation);
        }
        if (state.mode === 'lost-response') return json(response, 503, { error: 'STORAGE_PROJECTION_UNAVAILABLE' });
        return json(response, 200, receipt.projection);
      }
      if (url.pathname.startsWith('/api/')) return json(response, 200, { ok: true, items: [] });
      const pathname = decodeURIComponent(url.pathname === '/' ? '/tests/storage/saveReliabilityBrowser.html' : url.pathname);
      const path = resolve(output, `.${pathname}`);
      if (!path.startsWith(`${output}${sep}`)) return json(response, 404, {});
      let body;
      try { body = await readFile(path); }
      catch {
        const asset = resolve(publicRoot, `.${pathname}`);
        if (!asset.startsWith(publicRoot)) return json(response, 404, {});
        try { body = await readFile(asset); } catch { return json(response, 404, {}); }
      }
      response.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(body);
    } catch { if (!response.headersSent) json(response, 500, { error: 'FIXTURE_REQUEST_FAILED' }); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  const address = server.address();
  assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  let browser;
  const results = [];
  const errors = [];
  const consoleErrors = [];
  const contexts = [];
  const scenario = async (name, work) => {
    console.log(`RUN ${name}`);
    const started = Date.now();
    try { await work(); results.push({ name, passed: true, milliseconds: Date.now() - started }); console.log(`PASS ${name}`); }
    catch (error) { results.push({ name, passed: false, milliseconds: Date.now() - started }); throw error; }
  };
  const newContext = async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 650 } });
    contexts.push(context);
    await context.addInitScript(() => localStorage.setItem('school-timer-entry-number-v1', '1'));
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin !== origin) { errors.push('NONLOCAL_REQUEST_BLOCKED'); return route.abort(); }
      return route.continue();
    });
    return context;
  };
  const delayDraftOpening = async context => context.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    const waiting = [];
    let released = false;
    window.releaseDraftOpen = () => { released = true; waiting.splice(0).forEach(release => release()); };
    IDBFactory.prototype.open = function (...args) {
      const request = open.apply(this, args);
      return new Proxy(request, {
        get(target, key) { const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value; },
        set(target, key, value) {
          if (key !== 'onsuccess') return Reflect.set(target, key, value, target);
          target.onsuccess = event => { const run = () => value.call(target, event); if (released) run(); else waiting.push(run); };
          return true;
        },
      });
    };
  });
  const open = async (context, query = '', waitForDrafts = true) => {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${origin}/${query}`);
    await page.getByRole('status', { name: query.includes('form=') ? '폼 검증 준비' : '저장 상태' }).filter({ hasText: '준비됨' }).waitFor();
    if (waitForDrafts) await page.evaluate(() => window.saveReliability.ready());
    return page;
  };
  try {
    browser = await playwright.chromium.launch({ executablePath, headless: true });
    await scenario('native IndexedDB legacy migration preserves request identity', async () => {
      const context = await newContext();
      await context.addInitScript(() => {
        if (localStorage.getItem('migration-fixture-seeded')) return;
        const scope = { studentNumber: 1, feature: 'browser-fixture.form', entityId: 'text' };
        localStorage.setItem(`school-timer-student-save-draft-v1:${encodeURIComponent(JSON.stringify([1, scope.feature, scope.entityId]))}`,
          JSON.stringify({ version: 1, scope, requestId: 'legacy-browser-request', createdAt: '2026-01-01T00:00:00.000Z', payload: { text: 'legacy content' } }));
        localStorage.setItem('migration-fixture-seeded', 'yes');
      });
      const page = await open(context);
      const loaded = await page.evaluate(() => window.saveReliability.load());
      assert.equal(loaded.durable, true);
      assert.equal(loaded.draft.requestId, 'legacy-browser-request');
      assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('school-timer-student-save-draft-v1:'))), false);
      await context.close();
    });
    await scenario('old confirmation cannot erase a later edit across reload', async () => {
      const context = await newContext();
      const page = await open(context);
      const a = await page.evaluate(() => window.saveReliability.edit('A'));
      const b = await page.evaluate(() => window.saveReliability.edit('B'));
      assert.equal(await page.evaluate(id => window.saveReliability.confirm(id), a.loaded.draft.requestId), false);
      await page.reload();
      await page.evaluate(() => window.saveReliability.ready());
      const loaded = await page.evaluate(() => window.saveReliability.load());
      assert.equal(loaded.draft.requestId, b.loaded.draft.requestId);
      assert.equal(loaded.draft.payload.text, 'B');
      await context.close();
    });
    await scenario('two native IndexedDB tabs serialize compare-and-set and conditional delete', async () => {
      const context = await newContext();
      const left = await open(context), right = await open(context);
      const entry = { key: 'fixture-cas', requestId: 'initial', value: 'A' };
      await left.evaluate(row => window.saveReliability.database.insert(row), entry);
      const winners = await Promise.all([
        left.evaluate(row => window.saveReliability.database.replace(row, 'initial'), { ...entry, requestId: 'left', value: 'B' }),
        right.evaluate(row => window.saveReliability.database.replace(row, 'initial'), { ...entry, requestId: 'right', value: 'C' }),
      ]);
      assert.equal(winners.filter(Boolean).length, 1);
      assert.equal(await left.evaluate(() => window.saveReliability.database.remove('fixture-cas', 'initial')), false);
      assert.equal((await right.evaluate(() => window.saveReliability.database.get('fixture-cas'))).requestId, winners[0] ? 'left' : 'right');
      await context.close();
    });
    await scenario('native IndexedDB write failure keeps latest text and blocks unsafe reload', async () => {
      const context = await newContext();
      const page = await open(context);
      await page.evaluate(() => window.saveReliability.edit('A'));
      await page.evaluate(() => window.saveReliability.quota(true));
      const failed = await page.evaluate(() => window.saveReliability.edit('B latest'));
      assert.equal(failed.loaded.draft.payload.text, 'B latest');
      assert.equal(failed.loaded.durable, false);
      assert.equal(await page.evaluate(() => window.saveReliability.reloadSafe()), false);
      assert.match(await page.evaluate(() => window.saveReliability.recoveryText()), /B latest/);
      await page.evaluate(() => window.saveReliability.quota(false));
      const restored = await page.evaluate(() => window.saveReliability.edit('B latest'));
      assert.equal(restored.loaded.durable, true);
      await page.reload();
      await page.evaluate(() => window.saveReliability.ready());
      assert.equal((await page.evaluate(() => window.saveReliability.load())).draft.payload.text, 'B latest');
      await context.close();
    });
    await scenario('committed receipt survives lost response and projection failure without resubmission', async () => {
      const context = await newContext();
      const page = await open(context);
      state.mode = 'lost-response';
      const before = state.posts.length;
      const result = await page.evaluate(() => window.saveReliability.send('response lost'));
      assert.equal(result.refreshPending, true);
      assert.equal(result.value, null);
      assert.equal(state.posts.length - before, 1);
      assert.equal(await page.evaluate(() => window.saveReliability.pending()), null);
      await context.close();
    });
    await scenario('pending command reload retries original ID and preserves newer form', async () => {
      const context = await newContext();
      const page = await open(context);
      state.mode = 'unavailable';
      const before = state.posts.length;
      await page.getByRole('textbox', { name: '편집 내용' }).fill('submitted A');
      await page.getByRole('button', { name: '제출', exact: true }).click();
      await page.getByRole('status', { name: '저장 상태' }).filter({ hasText: '저장 확인 필요' }).waitFor();
      const original = state.posts[before];
      assert(original?.requestId);
      await page.getByRole('textbox', { name: '편집 내용' }).fill('newer B');
      await page.waitForFunction(() => window.saveReliability.form().text === 'newer B');
      await page.reload();
      await page.evaluate(() => window.saveReliability.ready());
      assert.equal((await page.evaluate(() => window.saveReliability.pending())).requestId, original.requestId);
      state.mode = 'success';
      await page.evaluate(() => window.saveReliability.recover());
      assert.equal(await page.evaluate(() => window.saveReliability.pending()), null);
      assert.equal((await page.evaluate(() => window.saveReliability.form())).text, 'newer B');
      assert.equal(state.posts.at(-1).requestId, original.requestId);
      assert.deepEqual(state.posts.at(-1).payload, original.payload);
      await context.close();
    });
    await scenario('actual Sudoku hook preserves latest queued input when older response arrives', async () => {
      const context = await newContext();
      const page = await open(context);
      state.mode = 'hold';
      await page.getByRole('button', { name: '스도쿠 1 입력' }).click();
      await page.waitForTimeout(100);
      await page.getByRole('button', { name: '스도쿠 2 입력' }).click();
      await page.getByRole('status', { name: '스도쿠 입력' }).filter({ hasText: '2' }).waitFor();
      assert.equal(state.held.length, 1);
      state.mode = 'success';
      state.held.splice(0).forEach(release => release());
      try { await page.getByRole('status', { name: '저장 상태' }).filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 }); }
      catch (error) { console.error(JSON.stringify({ state: await page.locator('body').innerText(), requestActions: state.posts.map(post => post.action), consoleErrors })); throw error; }
      assert.equal(await page.getByRole('status', { name: '스도쿠 입력' }).textContent(), '2');
      await page.screenshot({ path: resolve(directory, 'sudoku-confirmed.png') });
      await context.close();
    });
    await scenario('actual Sudoku hook restores latest unsaved input after reload', async () => {
      const context = await newContext();
      const page = await open(context);
      state.mode = 'unavailable';
      await page.getByRole('button', { name: '스도쿠 2 입력' }).click();
      await page.getByRole('status', { name: '저장 상태' }).filter({ hasText: '저장 확인 필요' }).waitFor();
      await page.waitForFunction(() => window.saveReliability.reloadSafe());
      await page.reload();
      await page.evaluate(() => window.saveReliability.ready());
      await page.getByRole('status', { name: '스도쿠 입력' }).filter({ hasText: '2' }).waitFor();
      assert.equal(await page.getByRole('status', { name: '스도쿠 입력' }).textContent(), '2');
      await context.close();
    });
    await scenario('actual baseball page restores input and confirms same attempt after lost response', async () => {
      const context = await newContext();
      const page = await open(context, '?game=baseball');
      state.mode = 'confirmation-unavailable';
      await page.getByRole('button', { name: '1', exact: true }).click();
      await page.getByRole('button', { name: '2', exact: true }).click();
      await page.waitForFunction(() => window.saveReliability.reloadSafe());
      await page.reload();
      await page.evaluate(() => window.saveReliability.ready());
      await page.waitForFunction(() => document.querySelector('button[aria-label="1"]')?.getAttribute('aria-pressed') === 'true');
      assert.equal(await page.getByRole('button', { name: '2', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: '3', exact: true }).click();
      const before = state.posts.length;
      await page.getByRole('button', { name: '확인하기', exact: true }).click();
      await page.getByRole('button', { name: '저장 다시 확인', exact: true }).waitFor();
      assert.equal(state.posts[before].payload.attempts.length, 1);
      state.mode = 'success';
      await page.getByRole('button', { name: '저장 다시 확인', exact: true }).click();
      await page.getByRole('button', { name: '저장 다시 확인', exact: true }).waitFor({ state: 'hidden' });
      assert.equal(state.posts.length - before, 1);
      assert.equal(await page.getByRole('status', { name: '야구 시도 수' }).textContent(), '1');
      await page.screenshot({ path: resolve(directory, 'baseball-confirmed.png') });
      await context.close();
    });
    await scenario('actual mailbox restores late draft and retains newer edit after older success', async () => {
      const context = await newContext();
      const page = await open(context, '?form=mailbox');
      await page.getByRole('tab', { name: '편지 쓰기' }).click();
      await page.evaluate(() => window.saveReliabilityForms.hydrate('restored A'));
      await page.waitForFunction(() => document.querySelector('textarea')?.value === 'restored A content');
      assert.equal(await page.getByRole('textbox', { name: '제목', exact: true }).inputValue(), 'restored A title');
      await page.getByRole('button', { name: '보내기', exact: true }).click();
      await page.getByRole('textbox', { name: '내용', exact: true }).fill('newer C');
      await page.evaluate(() => window.saveReliabilityForms.hydrate('stale B'));
      await page.evaluate(() => window.saveReliabilityForms.complete());
      await page.waitForTimeout(50);
      assert.equal(await page.getByRole('textbox', { name: '내용', exact: true }).inputValue(), 'newer C');
      assert.equal(await page.getByRole('tab', { name: '편지 쓰기' }).getAttribute('aria-selected'), 'true');
      await context.close();
    });
    await scenario('actual emotion draft survives delayed hydration and older save success', async () => {
      const context = await newContext();
      const page = await open(context, '?form=emotion');
      await page.evaluate(() => window.saveReliabilityForms.hydrate('restored A'));
      await page.getByRole('radio', { name: '행복하다', exact: true }).first().click();
      const event = page.getByPlaceholder('있었던 일을 구체적으로 적어주세요.');
      await page.waitForFunction(() => document.querySelector('textarea')?.value === 'restored A event');
      assert.equal(await page.getByPlaceholder('오늘의 나에게 한마디를 적어 주세요').inputValue(), 'restored A self');
      await page.getByRole('button', { name: '기록하기', exact: true }).click();
      await event.fill('newer C');
      await page.evaluate(() => window.saveReliabilityForms.hydrate('stale B'));
      await page.evaluate(() => window.saveReliabilityForms.complete());
      await page.waitForTimeout(50);
      assert.equal(await event.inputValue(), 'newer C');
      assert.equal(await page.getByRole('button', { name: '기록하기', exact: true }).count(), 1);
      await context.close();
    });
    await scenario('actual failure composer preserves edit and reopened dialog after older success', async () => {
      const context = await newContext();
      const page = await open(context, '?form=failure');
      await page.getByRole('button', { name: '실패 이야기 전시하기', exact: true }).click();
      await page.evaluate(() => window.saveReliabilityForms.hydrate('restored A'));
      const failure = page.getByPlaceholder('실패했던 일을 편하게 적어 보세요.');
      await page.waitForFunction(() => document.querySelector('textarea')?.value === 'restored A failure');
      const submit = page.locator('form.student-failure-form button[type="submit"]');
      await submit.click();
      await failure.fill('newer C');
      await page.evaluate(() => window.saveReliabilityForms.hydrate('stale B'));
      await page.evaluate(() => window.saveReliabilityForms.complete());
      await page.waitForTimeout(50);
      assert.equal(await failure.inputValue(), 'newer C');
      await submit.click();
      await page.getByRole('button', { name: '작성 창 닫기', exact: true }).click();
      await page.getByRole('button', { name: '실패 이야기 전시하기', exact: true }).click();
      await failure.fill('reopened D');
      await page.evaluate(() => window.saveReliabilityForms.complete());
      await page.waitForTimeout(50);
      assert.equal(await failure.inputValue(), 'reopened D');
      assert.equal(await page.getByRole('dialog', { name: '실패 전시하기' }).count(), 1);
      await context.close();
    });
    await scenario('actual quiz locks during native IDB restoration and preserves answer on quota failure', async () => {
      const context = await newContext();
      await delayDraftOpening(context);
      const page = await open(context, '?form=quiz', false);
      const answer = page.getByRole('textbox', { name: '정답 입력', exact: true });
      assert.equal(await answer.isDisabled(), true);
      await page.evaluate(() => window.releaseDraftOpen());
      await page.waitForFunction(() => !document.getElementById('classword-quiz-answer')?.disabled);
      await answer.fill('보관한답');
      assert.equal(await page.evaluate(() => window.saveReliabilityForms.settleQuiz()), true);
      await page.reload();
      await answer.waitFor();
      assert.equal(await answer.isDisabled(), true);
      await page.evaluate(() => window.releaseDraftOpen());
      await page.waitForFunction(() => document.getElementById('classword-quiz-answer')?.value === '보관한답');
      assert.equal(await answer.isDisabled(), false);
      await page.evaluate(() => window.saveReliability.quota(true));
      await answer.fill('최신내용');
      assert.equal(await page.evaluate(() => window.saveReliabilityForms.settleQuiz()), false);
      await page.getByRole('status').filter({ hasText: '이 기기에 임시 보관하지 못했어요.' }).waitFor();
      assert.equal(await answer.inputValue(), '최신내용');
      assert.equal(await answer.isDisabled(), false);
      await context.close();
    });
    await scenario('actual Today Friend keeps pending payload and enables confirmation after hydration', async () => {
      const context = await newContext();
      await delayDraftOpening(context);
      const page = await open(context, '?form=today-friend', false);
      const confirm = page.getByRole('button', { name: '저장 확인 후 다시 제출', exact: true });
      assert.equal(await confirm.isDisabled(), true);
      assert.equal(await page.getByPlaceholder('친구가 말한 내용을 적어요.').inputValue(), '저장 확인 중인 친구 답');
      await page.evaluate(() => window.releaseDraftOpen());
      await page.waitForFunction(() => !document.querySelector('.today-friend-form-actions button')?.disabled);
      assert.equal(await page.getByPlaceholder('친구가 말한 내용을 적어요.').isDisabled(), true);
      await confirm.click();
      assert.deepEqual(await page.evaluate(() => window.saveReliabilityForms.lastSubmission()), [{ kind: 'interview', answer: '저장 확인 중인 친구 답' }, true]);
      await page.evaluate(() => window.saveReliabilityForms.complete());
      await page.getByRole('status').filter({ hasText: '제출했어요.' }).waitFor();
      await context.close();
    });
    await scenario('actual emotion conflict preserves new input and exposes safe revision-specific retry at Chromebook sizes', async () => {
      for (const height of [650, 600, 800]) {
        const context = await newContext();
        const page = await open(context, '?form=emotion-conflict&layout=1');
        await page.setViewportSize({ width: 1280, height });
        await page.evaluate(() => { window.saveReliabilityForms.hydrate('내 입력 C'); window.saveReliabilityForms.emotionConflict('ready', 3); });
        await page.getByRole('radio', { name: '행복하다', exact: true }).first().click();
        const event = page.getByPlaceholder('있었던 일을 구체적으로 적어주세요.');
        const retry = page.getByRole('button', { name: '이 내용으로 다시 저장', exact: true });
        assert.match(await page.getByRole('dialog').innerText(), /서버 기록 3/);
        assert.equal(await event.inputValue(), '내 입력 C event');
        const pageScroll = await page.evaluate(() => window.scrollY);
        await retry.scrollIntoViewIfNeeded();
        const bounds = await retry.boundingBox();
        assert(bounds && bounds.height >= 44 && bounds.y >= 0 && bounds.y + bounds.height <= height);
        assert.equal(await retry.evaluate(element => {
          const rect = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        }), true);
        assert.equal(await page.evaluate(() => window.scrollY), pageScroll);
        await page.screenshot({ path: resolve(directory, `emotion-conflict-${height}.png`) });
        await retry.click();
        const first = await page.evaluate(() => window.saveReliabilityForms.lastSubmission());
        assert.equal(first[0].expectedRevisions['scope:studentEmotionHistory:1'], 3);
        assert.equal(first[2], '내 입력 C event');
        await page.evaluate(() => { window.saveReliabilityForms.complete(false); window.saveReliabilityForms.emotionConflict('ready', 4); });
        await page.waitForFunction(() => document.getElementById('emotion-conflict-title')?.parentElement?.textContent?.includes('서버 기록 4'));
        assert.equal(await event.inputValue(), '내 입력 C event');
        await retry.click();
        assert.equal((await page.evaluate(() => window.saveReliabilityForms.lastSubmission()))[0].expectedRevisions['scope:studentEmotionHistory:1'], 4);
        await event.fill('응답 대기 중 새 입력 D');
        await page.evaluate(() => window.saveReliabilityForms.complete());
        await page.waitForTimeout(50);
        assert.equal(await event.inputValue(), '응답 대기 중 새 입력 D');
        await page.evaluate(() => window.saveReliabilityForms.emotionConflict('unavailable'));
        assert.equal(await retry.count(), 0);
        await page.getByRole('button', { name: '현재 기록 다시 확인', exact: true }).click();
        assert.equal(await page.evaluate(() => window.saveReliabilityForms.reloadCount()), 1);
        await page.evaluate(() => window.saveReliabilityForms.emotionConflict('checking'));
        assert.equal(await page.getByRole('button', { name: '현재 기록 확인 중', exact: true }).isDisabled(), true);
        await page.evaluate(() => window.saveReliabilityForms.emotionConflict('expired'));
        assert.equal(await page.getByRole('button', { name: '이전 날짜 입력 보관됨', exact: true }).isDisabled(), true);
        assert.equal(await event.inputValue(), '응답 대기 중 새 입력 D');
        await context.close();
      }
    });
    await scenario('actual Sudoku conflict adopts reviewed remote state without posting and archives local input', async () => {
      const context = await newContext();
      const page = await open(context, '?game=sudoku&layout=1');
      state.mode = 'sudoku-conflict';
      const editable = await page.evaluate(() => window.saveReliability.sudokuEditableIndex());
      await page.getByRole('gridcell').nth(editable).click();
      await page.locator('.student-sudoku-keypad').getByRole('button', { name: '2', exact: true }).click();
      const adopt = page.getByRole('button', { name: '최신 기록으로 계속', exact: true });
      await adopt.waitFor();
      await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === '최신 기록으로 계속' && !button.disabled));
      const localText = await page.getByRole('textbox', { name: '보관한 내 입력', exact: true }).inputValue();
      const remoteText = await page.getByRole('textbox', { name: '최신 게임 기록', exact: true }).inputValue();
      assert.notEqual(localText, remoteText);
      assert.equal(await page.getByRole('status', { name: '스도쿠 입력' }).textContent(), '2');
      for (const height of [650, 600]) {
        await page.setViewportSize({ width: 1280, height });
        await adopt.scrollIntoViewIfNeeded();
        const bounds = await adopt.boundingBox();
        assert(bounds && bounds.height >= 44 && bounds.y >= 0 && bounds.y + bounds.height <= height);
        await page.screenshot({ path: resolve(directory, `sudoku-conflict-${height}.png`) });
      }
      const beforeAdopt = state.posts.length;
      const revision = state.revision;
      state.mode = 'success';
      await adopt.click();
      await adopt.waitFor({ state: 'hidden' });
      assert.equal(state.posts.length, beforeAdopt);
      await page.waitForFunction(() => document.querySelector('[aria-label="스도쿠 입력"]')?.textContent === '1');
      assert.equal(await page.getByRole('status', { name: '스도쿠 입력' }).textContent(), '1');
      await page.getByRole('gridcell').nth(editable).click();
      await page.locator('.student-sudoku-keypad').getByRole('button', { name: '3', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[aria-label="스도쿠 입력"]')?.textContent === '3');
      await page.waitForFunction(() => window.saveReliability.reloadSafe());
      await page.waitForTimeout(200);
      assert.equal(state.posts.at(-1).payload.expectedRevisions['scope:studentSudoku:1'], revision);
      assert.equal(state.posts.at(-1).payload.cells[editable], 3);
      await page.reload();
      await page.evaluate(() => window.saveReliability.ready());
      await page.getByText('이전 입력 보기', { exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: '보관한 내 입력', exact: true }).inputValue(), localText);
      await context.close();
    });
    await scenario('actual baseball prefix conflict reviews and adopts remote attempts without replaying stale guess', async () => {
      const context = await newContext();
      const page = await open(context, '?game=baseball&layout=1');
      state.mode = 'baseball-conflict';
      const localGuess = baseballGuess([1, 2, 3]);
      const remoteGuess = baseballGuess([4, 5, 6]);
      const nextGuess = baseballGuess([7, 8, 9]);
      for (const digit of localGuess) await page.getByRole('button', { name: String(digit), exact: true }).click();
      await page.getByRole('button', { name: '확인하기', exact: true }).click();
      const adopt = page.getByRole('button', { name: '최신 기록으로 계속', exact: true });
      await adopt.waitFor();
      await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === '최신 기록으로 계속' && !button.disabled));
      assert.equal(await page.getByRole('textbox', { name: '보관한 내 입력', exact: true }).inputValue(), `1회: ${localGuess.join('')}`);
      assert.equal(await page.getByRole('textbox', { name: '최신 게임 기록', exact: true }).inputValue(), `1회: ${remoteGuess.join('')}`);
      for (const height of [650, 600, 800]) {
        await page.setViewportSize({ width: 1280, height });
        await adopt.scrollIntoViewIfNeeded();
        const bounds = await adopt.boundingBox();
        assert(bounds && bounds.height >= 44 && bounds.y >= 0 && bounds.y + bounds.height <= height);
        await page.screenshot({ path: resolve(directory, `baseball-conflict-${height}.png`) });
      }
      const beforeAdopt = state.posts.length;
      state.mode = 'success';
      await adopt.click();
      await adopt.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: '확인하기', exact: true }).waitFor();
      assert.equal(state.posts.length, beforeAdopt);
      for (const digit of nextGuess) await page.getByRole('button', { name: String(digit), exact: true }).click();
      await page.getByRole('button', { name: '확인하기', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[aria-label="야구 시도 수"]')?.textContent === '2');
      await page.getByRole('button', { name: '확인하기', exact: true }).waitFor();
      assert.equal(state.posts.length, beforeAdopt + 1);
      assert.deepEqual(state.posts.at(-1).payload.attempts.map(attempt => attempt.guess), [remoteGuess, nextGuess]);
      await page.reload();
      await page.evaluate(() => window.saveReliability.ready());
      await page.getByText('이전 입력 보기', { exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: '보관한 내 입력', exact: true }).inputValue(), `1회: ${localGuess.join('')}`);
      await context.close();
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, scenarios: results.length, evidence: directory }));
  } finally {
    state.held.splice(0).forEach(release => release());
    await Promise.all(contexts.map(context => context.close().catch(() => undefined)));
    await browser?.close();
    server.closeAllConnections();
    await new Promise(accept => server.close(accept));
    await writeFile(resolve(directory, 'manifest.json'), JSON.stringify({ passed: results.length > 0 && results.every(result => result.passed) && errors.length === 0, results, pageErrors: errors, consoleErrors }, null, 2), { mode: 0o600 });
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const work = process.argv.includes('--verify-env') ? requireBrowserFixture : runSaveReliabilityBrowser;
  await work().catch(error => { console.error(error instanceof Error ? error.stack : 'BROWSER_RELIABILITY_FAILED'); process.exitCode = 1; });
}
