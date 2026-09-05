import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'&&u.port==='3042'&&!u.pathname.startsWith('/api/')?r.continue():r.abort();});
  await context.addInitScript(()=>localStorage.setItem('school-timer-entry-number-v1','23'));
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:3042/#student-library-bookshelf');
  await page.getByRole('application').waitFor();
  assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[1280,800]);
  await page.screenshot({path:new URL('./'+(process.env.LIBRARY_CAPTURE??'before.png'),import.meta.url).pathname});
  console.log('Baseline1280x800 captured; isolated Chrome closed in finally');
} finally {await browser.close();}
