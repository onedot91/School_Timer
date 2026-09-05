import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.goto('http://127.0.0.1:3044/.omo/evidence/library-bear-grounding/grounding.html');
  await page.waitForFunction(()=>document.body.dataset.grounding);
  assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[1280,800]);
  const results=JSON.parse(await page.locator('body').getAttribute('data-grounding'));
  const prefix=process.env.GROUNDING_PREFIX??'grounding';
  await page.screenshot({path:new URL('./'+prefix+'.png',import.meta.url).pathname});
  await writeFile(new URL('./'+prefix+'.json',import.meta.url),JSON.stringify(results,null,2));
  console.log(results);
  for(const result of results)assert.equal(result.emptyRows,0,`${result.facing}/${result.timeMs}: feet must touch shadow with no empty horizontal floor row`);
} finally {await browser.close();}
