import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'&&u.port==='3044'&&!u.pathname.startsWith('/api/')?r.continue():r.abort();});
  await context.addInitScript(()=>localStorage.setItem('school-timer-entry-number-v1','23'));
  const page=await context.newPage();
  for (const route of ['student-library','student-library-bookstore','student-library-bookshelf']) {
    await page.goto('http://127.0.0.1:3044/#'+route);
    await page.reload();
    await page.getByRole('application').waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({path:new URL(`./${process.env.ROUTE_CAPTURE_PREFIX??'route'}-${route}.png`,import.meta.url).pathname});
    assert.equal(await page.locator('[aria-modal="true"]').count(),0,route+' must enter the room without a board modal');
    assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[1280,800]);
    console.log(route+' PASS: room first');
    if (process.env.HANGUL_TEST) {
      assert.equal(await page.locator('.student-canvas-library-world-cue kbd').innerText(),'E','Visible key hint must only show E');
      const canvas=page.getByRole('application');await canvas.focus();
      await canvas.dispatchEvent('keydown',{key:'ㄷ',code:'KeyE',bubbles:true});
      await page.waitForTimeout(50);
      assert.equal(await page.getByRole('dialog').count(),1,'Korean ㄷ must open the nearby registration desk');
      await page.keyboard.press('Escape');
      await canvas.dispatchEvent('keydown',{key:'Process',code:'KeyE',isComposing:true,bubbles:true});
      await page.waitForTimeout(50);
      assert.equal(await page.getByRole('dialog').count(),1,'Physical KeyE must work during IME composition');
      await page.getByRole('textbox',{name:'책 제목',exact:true}).fill('ㄷ을 입력하는 책');
      assert.equal(await page.getByRole('textbox',{name:'책 제목',exact:true}).inputValue(),'ㄷ을 입력하는 책');
      await page.keyboard.press('Escape');console.log(route+' PASS: Korean ㄷ / physical KeyE / normal form typing');
    }
  }
} finally {await browser.close();}
