import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base = new URL('./', import.meta.url);
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const context = await browser.newContext({viewport:{width:1280,height:800}});
  const blocked = [];
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname !== '127.0.0.1' || u.port !== '3033' || u.pathname.startsWith('/api/')) { blocked.push(u.pathname); return route.abort(); }
    return route.continue();
  });
  await context.addInitScript(() => { localStorage.setItem('school-timer-entry-number-v1','23'); });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3033/#student-library-bookshelf');
  await page.getByRole('heading',{name:'책장',exact:true}).waitFor();
  assert.equal(await page.getByRole('application').count(),0);
  assert.equal(await page.getByRole('button',{name:'책 쌓기',exact:true}).isVisible(),true);
  assert.deepEqual(await page.evaluate(() => [innerWidth,innerHeight]),[1280,800]);
  await page.screenshot({path:new URL('task-6-route-baseline.png',base).pathname});
  const source = await readFile(new URL('../../../src/components/student/StudentLibraryPage.tsx',import.meta.url));
  const receipt = {passed:true,meaning:'PIN old form visible; RED integrated Canvas absent',viewport:[1280,800],student:23,sourceSha:createHash('sha256').update(source).digest('hex'),blocked,cleanup:'Isolated Chrome closes in finally; root-owned3033 server remains until task6 QA ends.'};
  await writeFile(new URL('task-6-route-baseline.json',base),JSON.stringify(receipt,null,2));
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); }
