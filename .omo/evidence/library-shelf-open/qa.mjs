import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const phase=process.argv[2]??'after';const dir=new URL('./',import.meta.url).pathname;
const hash=async()=>createHash('sha256').update(await readFile('src/components/student/library/CanvasLibraryGame.tsx')).digest('hex');
const result={phase,sourceStart:await hash(),screenshots:[],checks:[],errors:[],cleanup:[]};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 await context.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'&&u.port==='3046'?r.continue():r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>result.errors.push(e.message));
 const shot=async name=>{const p=dir+phase+'-'+name+'.png';await page.screenshot({path:p});result.screenshots.push(p);};
 for(let shelf=0;shelf<4;shelf++){
  await page.goto('http://127.0.0.1:3046/.omo/evidence/library-shelf-open/index.html?shelf='+shelf);
  const canvas=page.locator('canvas');await canvas.waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.nearbyTarget?.startsWith('placed-book:'));
  assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[1280,800]);await shot('shelf-'+shelf+'-cue');
  const label=await page.locator('.student-canvas-library-world-cue').getAttribute('aria-label');
  await canvas.focus();await page.keyboard.press('e');await page.getByRole('dialog').waitFor();await shot('shelf-'+shelf+'-opened');
  const opened=await page.getByRole('button',{name:'책장 닫기',exact:true}).count();result.checks.push({shelf,label,openedShelf:opened===1});
  if(phase==='after'){
   assert.equal(label,'가까운 곳 살펴보기: 책장 열기');assert.equal(opened,1);
   await page.getByRole('button',{name:/책장 검증 책/}).click();await page.getByRole('button',{name:'책 정보 닫기',exact:true}).waitFor();await shot('shelf-'+shelf+'-selected-book');
   await page.keyboard.press('Escape');await canvas.focus();
   for(const input of ['Enter','korean','click']){
    if(input==='korean')await canvas.dispatchEvent('keydown',{key:'ㄷ',code:'KeyE'});else if(input==='click')await page.locator('.student-canvas-library-world-cue').click();else await page.keyboard.press(input);
    await page.getByRole('button',{name:'책장 닫기',exact:true}).waitFor();await shot('shelf-'+shelf+'-'+input);await page.keyboard.press('Escape');
    assert.equal(await canvas.evaluate(e=>document.activeElement===e),true);
   }
  }
 }
 assert.deepEqual(result.errors,[]);await context.close();
}finally{await browser.close();result.cleanup.push('isolated Chrome closed');result.sourceEnd=await hash();await writeFile(dir+phase+'.json',JSON.stringify(result,null,2));}
console.log(JSON.stringify(result.checks));
