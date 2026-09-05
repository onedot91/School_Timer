import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createFullLibraryRoom, createLibraryPlayer, stepLibraryPlayer } from '../../../src/lib/canvasLibraryWorld.ts';
const room = createFullLibraryRoom();
const directory = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const port = '3038';
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
    const path=`${directory}task-6-bookcase-modal-${name}.png`;await page.screenshot({path});
    const png=await readFile(path);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1280,800]);
    assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]),[0,0]);
    receipt.screenshots.push(path);
    if(name==='route-picker')receipt.pickerComputed=await page.locator('.student-canvas-library-slot-dialog').evaluate(element=>{const style=getComputedStyle(element);return {background:style.background,backgroundColor:style.backgroundColor,backgroundImage:style.backgroundImage,classes:element.className};});
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
  assert.equal(await page.getByRole('group',{name:'이동 방향'}).count(),0,'direction pad is removed');
  for(const label of ['위로 이동','왼쪽으로 이동','아래로 이동','오른쪽으로 이동'])assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),0,`${label} button is removed`);
  await canvas.focus();const arrowStart=await position();await page.keyboard.down('ArrowRight');await page.waitForTimeout(80);await page.keyboard.up('ArrowRight');assert.ok((await position()).x>arrowStart.x,'ArrowRight still moves the player');receipt.checks.keyboardMovementAndNoDirectionalPad=true;
  assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[1280,800]);
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
  assert.equal(await page.evaluate(()=>Boolean(document.activeElement?.closest('.student-canvas-library-slot-dialog'))),true,'failed-save focus remains in the slot dialog');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>Boolean(document.activeElement?.closest('.student-canvas-library-slot-dialog'))),true,'failed-save Tab remains trapped in the slot dialog');
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
    await page.keyboard.press('Escape');
  }
  receipt.checks.full100CapacityAndAllFivePickers=true;assert.deepEqual(receipt.errors,[]);
  const fullLibrarySnapshot=await saved();
  const spineColors=new Map();
  const captureEveryShelf=async state=>{
    for(const shelf of room.shelves){
      await travel(shelf.interactionPoint);await page.keyboard.press('e');
      assert.equal(await page.locator('.student-canvas-library-slot-grid button').count(),20);
      const geometry=await page.locator('.student-canvas-library-slot-dialog').evaluate(element=>{
        const rect=element.getBoundingClientRect();const grid=element.querySelector('.student-canvas-library-slot-grid').getBoundingClientRect();
        return {dialog:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom},grid:{left:grid.left,top:grid.top,right:grid.right,bottom:grid.bottom}};
      });
      assert.ok(geometry.dialog.left>=0&&geometry.dialog.top>=0&&geometry.dialog.right<=1280&&geometry.dialog.bottom<=800,`${state} dialog geometry ${shelf.id}`);
      assert.ok(geometry.grid.left>=geometry.dialog.left&&geometry.grid.right<=geometry.dialog.right&&geometry.grid.bottom<=geometry.dialog.bottom,`${state} grid geometry ${shelf.id}`);
      if(state==='mixed'){
        const spineEvidence=await page.locator('.student-canvas-library-slot-spine[data-state="book"]').evaluateAll(spines=>spines.map(spine=>{
          const number=spine.querySelector('.student-canvas-library-slot-number');const spineRect=spine.getBoundingClientRect();const numberRect=number.getBoundingClientRect();const after=getComputedStyle(spine,'::after');const rootFont=parseFloat(getComputedStyle(document.documentElement).fontSize);const bandBottom=Math.max(spineRect.height*.38,rootFont*1.375);const bandTop=spineRect.height-bandBottom-parseFloat(after.height);return {tone:spine.dataset.tone,background:getComputedStyle(spine).backgroundColor,opaque:!getComputedStyle(spine).backgroundColor.includes('rgba(0, 0, 0, 0)'),bandTop,bandBottom,numberTop:numberRect.top-spineRect.top};
        }));
        for(const spine of spineEvidence){assert.equal(spine.opaque,true,`opaque spine ${spine.tone}`);assert.ok(spine.bandTop<spine.numberTop,`binding clears slot number ${spine.tone}`);spineColors.set(spine.tone,spine.background);}
      }
      await capture(`bookcase-${state}-${shelf.id}`);await page.keyboard.press('Escape');
    }
  };
  await page.evaluate(()=>{
    const snapshot=JSON.parse(localStorage.getItem('school-timer-student-pets-v1'));snapshot.studentLife.books=[];
    localStorage.setItem('school-timer-student-pets-v1',JSON.stringify(snapshot));
  });
  await page.reload();await canvas.waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.playerX);
  await captureEveryShelf('empty');receipt.checks.emptyAllFiveBookcases=true;
  await page.evaluate(()=>{
    const snapshot=JSON.parse(localStorage.getItem('school-timer-student-pets-v1'));
    for(let first=0;first<100;first+=20)for(const slot of [first,first+19])snapshot.studentLife.books.push({id:`root-mixed-${slot}`,studentNumber:23,title:`혼합 진열 책 ${slot+1}`,author:'합성 작가',pageCount:100+slot*10,createdAt:'2025-01-01T00:00:00.000Z',colorIndex:slot%6,librarySlot:slot});
    localStorage.setItem('school-timer-student-pets-v1',JSON.stringify(snapshot));
  });
  await page.reload();await canvas.waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.playerX);
  await captureEveryShelf('mixed');receipt.bookSpineColors=Object.fromEntries(spineColors);assert.deepEqual(Object.keys(receipt.bookSpineColors).sort(),['0','1','2']);assert.equal(new Set(Object.values(receipt.bookSpineColors)).size,3,'coral, blue, and sage spines are distinct');receipt.checks.bookSpinePaletteDistinct=true;receipt.checks.mixedAllFiveBookcases=true;
  await travel(room.shelves[0].interactionPoint);await page.keyboard.press('e');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  await page.getByRole('alert').filter({hasText:'먼저 등록대에서 책을 받아 주세요.'}).waitFor();await capture('bookcase-keyboard-empty-error');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.keyboard.press('e');await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  receipt.checks.keyboardSelectionAndEScape=true;
  await page.keyboard.press('e');await page.getByRole('dialog').waitFor();await page.addStyleTag({content:'html { font-size: 200% !important; }'});
  const zoomGeometry=await page.locator('.student-canvas-library-slot-dialog').evaluate(element=>{
    const dialog=element.getBoundingClientRect();const closeElement=element.querySelector('.student-canvas-library-dialog-close');const close=closeElement.getBoundingClientRect();const grid=element.querySelector('.student-canvas-library-slot-grid').getBoundingClientRect();const badge=document.querySelector('.data-mode-banner');const badgeRect=badge?.getBoundingClientRect();const overlaps=Boolean(badgeRect&&badgeRect.left<close.right&&badgeRect.right>close.left&&badgeRect.top<close.bottom&&badgeRect.bottom>close.top);const topmost=document.elementFromPoint(close.left+close.width/2,close.top+close.height/2);
    return {dialog:{left:dialog.left,top:dialog.top,right:dialog.right,bottom:dialog.bottom},close:{left:close.left,top:close.top,right:close.right,bottom:close.bottom},grid:{left:grid.left,top:grid.top,right:grid.right,bottom:grid.bottom},badgeOverlapsClose:overlaps,closeTopmost:Boolean(topmost?.closest('.student-canvas-library-dialog-close')),badgeZIndex:badge?getComputedStyle(badge).zIndex:null,scrollHeight:element.querySelector('.student-canvas-library-slot-grid').scrollHeight,clientHeight:element.querySelector('.student-canvas-library-slot-grid').clientHeight};
  });
  assert.ok(zoomGeometry.dialog.left>=0&&zoomGeometry.dialog.top>=0&&zoomGeometry.dialog.right<=1280&&zoomGeometry.dialog.bottom<=800,'200% slot dialog geometry');
  assert.ok(zoomGeometry.close.left>=0&&zoomGeometry.close.top>=0&&zoomGeometry.close.right<=1280&&zoomGeometry.close.bottom<=800,'200% close geometry');
  assert.ok(zoomGeometry.grid.left>=zoomGeometry.dialog.left&&zoomGeometry.grid.right<=zoomGeometry.dialog.right&&zoomGeometry.grid.bottom<=zoomGeometry.dialog.bottom,'200% grid geometry');
  assert.equal(zoomGeometry.badgeOverlapsClose,true,'200% mode badge rectangle overlaps close geometry');assert.equal(zoomGeometry.closeTopmost,true,'200% close remains topmost over mode badge');assert.equal(zoomGeometry.badgeZIndex,'79','open library modal lowers mode badge below the modal');
  await capture('bookcase-text-200-picker');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});receipt.checks.text200PickerCloseReachable=true;
  await page.evaluate(()=>document.querySelector('style:last-of-type')?.remove());
  await page.evaluate(snapshot=>localStorage.setItem('school-timer-student-pets-v1',JSON.stringify(snapshot)),fullLibrarySnapshot);
  await page.reload();await canvas.waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.playerX);
  await captureEveryShelf('full');receipt.checks.fullAllFiveBookcases=true;
  assert.equal(receipt.blockedRequests.some(r=>r.path==='/api/shared-settings'),false,'mock library must not use backend');
  receipt.sourceSha256=await hashes();assert.deepEqual(receipt.sourceSha256,sourceStart);receipt.passed=true;
} catch(error) {receipt.passed=false;receipt.failure=String(error);receipt.stack=error.stack;process.exitCode=1;}
finally {await browser.close();receipt.cleanup.push('Isolated Chrome closed; own Vite 3038 managed by this QA run.');await writeFile(`${directory}task-6-bookcase-modal-qa.json`,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));}
