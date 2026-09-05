import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createFullLibraryRoom, createLibraryPlayer, stepLibraryPlayer } from '../../../src/lib/canvasLibraryWorld.ts';
const room = createFullLibraryRoom();
const directory = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const port = '3033';
const files = ['src/lib/canvasLibraryWorld.ts','src/lib/canvasLibraryClient.ts','src/lib/canvasLibraryPlacement.ts','src/lib/studentLife.ts','src/lib/studentPet.ts','src/pages/AuctionPage.tsx','src/components/student/StudentLibraryPage.tsx','src/components/student/library/CanvasLibraryGame.tsx','src/components/student/library/CanvasLibraryRenderer.ts','src/index.css'];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async path => [path,createHash('sha256').update(await readFile(root + path)).digest('hex')])));
const sourceStart = await hashes();
const receipt = {generatedAt:new Date().toISOString(),screenshots:[],checks:{},errors:[],blockedRequests:[],cleanup:[]};
function routeFrom(start,target) {
  const queue = [{player:{...createLibraryPlayer(room,23),position:start},parent:-1,key:null}];
  const keyOf = p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  const seen = new Set([keyOf(start)]);
  for(let index=0;index<queue.length && index<30000;index++) {
    const node=queue[index];
    if(Math.hypot(node.player.position.x-target.x,node.player.position.y-target.y)<=3.2) {
      const result=[];
      for(let cursor=index;queue[cursor].parent>=0;cursor=queue[cursor].parent) result.unshift(queue[cursor]);
      return result;
    }
    for(const [key,x,y] of [['d',1,0],['a',-1,0],['s',0,1],['w',0,-1]]) {
      const next=stepLibraryPlayer(room,node.player,{x,y},40);
      if(Math.hypot(next.position.x-node.player.position.x,next.position.y-node.player.position.y)<3.99) continue;
      const id=keyOf(next.position);if(seen.has(id))continue;
      seen.add(id);queue.push({player:next,parent:index,key});
    }
  }
  throw new Error('No safe walking path');
}
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1'||url.port!==port||url.pathname.startsWith('/api/')) {receipt.blockedRequests.push({path:url.pathname,method:route.request().method()});return route.abort();}
    return route.continue();
  });
  await context.addInitScript(()=>{
    if(localStorage.getItem('root-library-qa-seeded'))return;
    localStorage.setItem('school-timer-entry-number-v1','23');
    localStorage.setItem('school-timer-practice-failure-stories-reset-v1','1');
    localStorage.setItem('school-timer-student-pets-v1',JSON.stringify({currencyBalances:{23:30},currencyHistory:{23:[]},studentLife:{letters:[],failureStories:[],failureProfileAssignments:{},books:[
      {id:'root-own-legacy',studentNumber:23,title:'예전에 읽은 합성 책',author:'연습 작가',pageCount:92,createdAt:'2025-01-01T00:00:00.000Z',colorIndex:0},
      {id:'root-other-placed',studentNumber:2,title:'친구의 합성 책',author:'공유 작가',pageCount:115,createdAt:'2025-01-02T00:00:00.000Z',colorIndex:1,librarySlot:0}
    ]}}));
    localStorage.setItem('root-library-qa-seeded','1');
  });
  const page=await context.newPage();page.on('pageerror',error=>receipt.errors.push(error.message));
  const canvas=page.getByRole('application');
  const position=()=>canvas.evaluate(e=>({x:Number(e.dataset.playerX),y:Number(e.dataset.playerY)}));
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('school-timer-student-pets-v1')));
  const capture=async name=>{
    if(name==='route-picker') {
      const background=await page.locator('.student-canvas-library-slot-dialog').evaluate(element=>({color:getComputedStyle(element).backgroundColor,image:getComputedStyle(element).backgroundImage,timber:getComputedStyle(element).getPropertyValue('--library-timber').trim()}));
      assert.notEqual(background.image,'none','Enlarged bookcase must retain timber material instead of generic white dialog');
      receipt.checks.bookcaseMaterial=background;
    }
    const path=`${directory}task-6-root-${name}.png`;await page.screenshot({path});
    const png=await readFile(path);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1280,800]);
    assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]),[0,0]);
    receipt.screenshots.push(path);
  };
  const travel=async target=>{
    await canvas.focus();
    for(let attempt=0;attempt<50;attempt++) {
      const current=await position();if(Math.hypot(current.x-target.x,current.y-target.y)<4)return;
      const path=routeFrom(current,target);assert.ok(path.length);
      const direction=path[0].key;let endpoint=path[0].player.position;
      for(const node of path){if(node.key!==direction)break;endpoint=node.player.position;}
      const axis=direction==='a'||direction==='d'?'x':'y';
      for(let tick=0;tick<80;tick++) {
        const before=await position();const delta=endpoint[axis]-before[axis];if(Math.abs(delta)<2.8)break;
        const key=axis==='x'?(delta>0?'d':'a'):(delta>0?'s':'w');await page.keyboard.down(key);
        await page.waitForTimeout(Math.min(100,Math.max(20,Math.abs(delta)*8)));await page.keyboard.up(key);
        if(Math.abs((await position())[axis]-before[axis])<0.1)throw new Error(`Movement stalled ${key}`);
      }
    }throw new Error('Walking target not reached');
  };
  await page.goto(`http://127.0.0.1:${port}/#student-library-bookshelf`);await canvas.waitFor();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.playerX);
  assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[1280,800]);
  for(const name of ['위로 이동','왼쪽으로 이동','아래로 이동','오른쪽으로 이동']) assert.equal(await page.getByRole('button',{name,exact:true}).count(),0,'Visible directional pad removed per user request');
  await capture('route-entered');
  assert.equal((await saved()).studentLife.books.length,2);
  await travel(room.desk.interactionPoint);await page.keyboard.press('e');
  await page.getByRole('textbox',{name:'책 제목',exact:true}).fill('달빛 도서관의 새 책');
  await page.getByRole('textbox',{name:'글쓴이',exact:true}).fill('합성 작가');
  await page.getByRole('textbox',{name:'쪽수',exact:true}).fill('180');
  await capture('route-registration');await page.getByRole('button',{name:'책 받기',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});await capture('route-carry');
  assert.equal((await saved()).studentLife.books.length,2,'carry must not save');assert.equal((await saved()).currencyBalances['23'],30);
  await travel(room.shelves.at(-1).interactionPoint);await page.keyboard.press('e');
  await page.getByRole('button',{name:'빈자리 100',exact:true}).waitFor();await capture('route-picker');
  await page.getByRole('button',{name:'빈자리 100',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await capture('route-placed');
  const after=await saved();assert.equal(after.studentLife.books.length,3);assert.equal(after.currencyBalances['23'],40);
  assert.equal(after.studentLife.books.find(b=>b.title==='달빛 도서관의 새 책').librarySlot,99);
  assert.equal(after.studentLife.books.find(b=>b.id==='root-other-placed').librarySlot,0);
  receipt.checks.newPlacementPersisted=true;
  await page.reload();await canvas.waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.playerX);
  await capture('route-reloaded');assert.deepEqual(await saved(),after);
  await travel(room.shelves.at(-1).interactionPoint);await page.keyboard.press('e');
  const placed=page.getByRole('button',{name:'달빛 도서관의 새 책',exact:true});if(await placed.count())await placed.click();
  await page.getByRole('heading',{name:'달빛 도서관의 새 책',exact:true}).waitFor();await capture('route-reloaded-details');
  receipt.checks.reloadedBookInspected=true;
  await page.keyboard.press('Escape');
  if(await page.getByRole('dialog').count())await page.keyboard.press('Escape');
  await travel(room.desk.interactionPoint);await page.keyboard.press('e');
  await page.getByRole('button',{name:/예전에 읽은 합성 책/}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await capture('route-legacy-carry');
  await travel(room.shelves.at(-1).interactionPoint);await page.keyboard.press('e');
  await page.getByRole('button',{name:'빈자리 99',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  const afterLegacy=await saved();assert.equal(afterLegacy.studentLife.books.length,3);
  assert.equal(afterLegacy.currencyBalances['23'],40);
  assert.equal(afterLegacy.studentLife.books.find(b=>b.id==='root-own-legacy').librarySlot,98);
  receipt.checks.legacyNoDuplicateOrReward=true;await capture('route-legacy-placed');
  await travel(room.desk.interactionPoint);await page.keyboard.press('e');
  const modalPosition=await position();
  await page.getByRole('textbox',{name:'책 제목',exact:true}).fill('저장 재시도 합성 책');
  await page.getByRole('textbox',{name:'글쓴이',exact:true}).fill('<b>합성</b>');
  await page.getByRole('textbox',{name:'쪽수',exact:true}).fill('0');
  await page.getByRole('button',{name:'책 받기',exact:true}).click();
  await page.getByRole('alert').waitFor();assert.deepEqual(await position(),modalPosition);
  await capture('route-invalid-input');
  await page.getByRole('textbox',{name:'쪽수',exact:true}).fill('120');
  await page.getByRole('button',{name:'책 받기',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await travel(room.shelves.at(-1).interactionPoint);await page.keyboard.press('e');
  await page.evaluate(()=>{
    window.rootQaOriginalSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key==='school-timer-student-pets-v1')throw new DOMException('Synthetic quota','QuotaExceededError');return window.rootQaOriginalSetItem.call(this,key,value);};
  });
  await page.getByRole('button',{name:'빈자리 98',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'저장하지 못했어요'}).waitFor();
  assert.deepEqual(await saved(),afterLegacy);await capture('route-save-failed');
  assert.equal(await page.getByRole('dialog').evaluate(element=>element.contains(document.activeElement)),true,'Failed save must retain keyboard focus inside bookcase');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await capture('route-failed-carry-retained');
  await page.evaluate(()=>{Storage.prototype.setItem=window.rootQaOriginalSetItem;delete window.rootQaOriginalSetItem;});
  await page.keyboard.press('e');await page.getByRole('button',{name:'빈자리 98',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  const retried=await saved();assert.equal(retried.studentLife.books.length,4);
  assert.equal(retried.studentLife.books.filter(b=>b.title==='저장 재시도 합성 책').length,1);
  assert.equal(retried.studentLife.books.find(b=>b.title==='저장 재시도 합성 책').author,'<b>합성</b>');
  receipt.checks.localFailureRetainsAndRetries=true;await capture('route-save-retried');
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  const otherPage=await context.newPage();const otherCdp=await context.newCDPSession(otherPage);
  await otherCdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  await page.bringToFront();await canvas.focus();await page.keyboard.down('d');await page.waitForTimeout(80);
  await otherPage.bringToFront();
  await page.waitForTimeout(150);const stopped=await position();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.hasFocus()),false);
  assert.deepEqual(await position(),stopped);await page.bringToFront();await page.waitForTimeout(200);
  assert.deepEqual(await position(),stopped);await page.keyboard.up('d');await otherPage.close();
  receipt.checks.realBlurStopsAndDoesNotResume=true;
  await capture('route-blur-return');
  await page.emulateMedia({reducedMotion:'reduce'});await canvas.focus();const reducedStart=await position();
  await page.keyboard.down('a');await page.waitForTimeout(100);await page.keyboard.up('a');
  assert.ok((await position()).x<reducedStart.x);await capture('route-reduced-motion');
  receipt.checks.reducedMotionStillPlayable=true;
  await travel(room.desk.interactionPoint);await page.keyboard.press('e');
  await page.addStyleTag({content:'html { font-size: 200% !important; }'});
  await capture('route-text-200');
  await page.getByRole('button',{name:'취소',exact:true}).scrollIntoViewIfNeeded();
  await capture('route-text-200-actions');
  await page.getByRole('button',{name:'취소',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  receipt.checks.text200CloseReachable=true;
  await page.addStyleTag({content:'html { font-size: 100% !important; }'});
  await page.evaluate(()=>{
    const snapshot=JSON.parse(localStorage.getItem('school-timer-student-pets-v1'));
    const occupied=new Set(snapshot.studentLife.books.map(b=>b.librarySlot));
    for(let slot=0;slot<100;slot++)if(!occupied.has(slot))snapshot.studentLife.books.push({id:`root-full-${slot}`,studentNumber:slot%23+1,title:`서가의 합성 책 ${slot+1}`,author:'합성 작가',pageCount:100+slot,createdAt:'2025-01-01T00:00:00.000Z',colorIndex:slot%6,librarySlot:slot});
    localStorage.setItem('school-timer-student-pets-v1',JSON.stringify(snapshot));
  });
  await page.reload();await canvas.waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.playerX);
  assert.equal((await saved()).studentLife.books.length,100);await capture('route-full-100');
  await travel(room.desk.interactionPoint);await page.keyboard.press('e');
  assert.equal(await page.getByRole('textbox',{name:'책 제목',exact:true}).count(),0);
  await capture('route-full-desk');await page.keyboard.press('Escape');
  for(const shelf of room.shelves){
    await travel(shelf.interactionPoint);await page.keyboard.press('e');
    await capture(`route-full-${shelf.id}`);
    assert.equal(await page.locator('.student-canvas-library-slot-grid button').count(),20);
    const spineColors=await page.locator('.student-canvas-library-slot-spine[data-state="book"]').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor));
    assert.equal(new Set(spineColors).size,3,'Occupied books must render three distinct shared palette colors');
    assert.ok(spineColors.every(color=>color!=='rgba(0, 0, 0, 0)'&&color!=='transparent'),'Books must not disappear into shelf background');
    await page.keyboard.press('Escape');
  }
  for(const mode of ['empty','mixed']) {
    await page.evaluate((mode)=>{
      const snapshot=JSON.parse(localStorage.getItem('school-timer-student-pets-v1'));
      snapshot.studentLife.books=mode==='empty'?[]:[0,3,20,23,40,43,60,63,80,83].map((slot,index)=>({id:`root-mixed-${slot}`,studentNumber:index%23+1,title:`서가의 혼합 책 ${slot+1}`,author:'합성 작가',pageCount:100+index*75,createdAt:'2025-01-01T00:00:00.000Z',colorIndex:slot%6,librarySlot:slot}));
      localStorage.setItem('school-timer-student-pets-v1',JSON.stringify(snapshot));
    },mode);
    await page.reload();await canvas.waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.playerX);
    for(const shelf of room.shelves) {
      await travel(shelf.interactionPoint);await page.keyboard.press('e');
      await page.getByRole('heading',{name:'책을 둘 자리',exact:true}).waitFor();
      await capture(`route-${mode}-${shelf.id}`);
      const targetBounds=await page.locator('.student-canvas-library-slot-grid button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return[r.width,r.height];}));
      assert.equal(targetBounds.length,20);assert.ok(targetBounds.every(([w,h])=>w>=44&&h>=44),'All shelf positions must retain44px targets');
      await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
    }
  }
  receipt.checks.full100CapacityAndAllFivePickers=true;assert.deepEqual(receipt.errors,[]);
  assert.equal(receipt.blockedRequests.some(r=>r.path==='/api/shared-settings'),false,'mock library must not use backend');
  receipt.sourceSha256=await hashes();assert.deepEqual(receipt.sourceSha256,sourceStart);receipt.passed=true;
} catch(error) {receipt.passed=false;receipt.failure=String(error);receipt.stack=error.stack;process.exitCode=1;}
finally {await browser.close();receipt.cleanup.push('Isolated Chrome closed; root3033Vite managed separately.');await writeFile(`${directory}task-6-root-route-qa.json`,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));}
