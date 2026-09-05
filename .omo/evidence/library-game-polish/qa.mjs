import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createFullLibraryRoom, createLibraryPlayer, stepLibraryPlayer } from '../../../src/lib/canvasLibraryWorld.ts';
const room = createFullLibraryRoom();
const directory = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const port = '3044';
const files = ['src/lib/canvasLibraryWorld.ts','src/lib/canvasLibraryClient.ts','src/lib/canvasLibraryPlacement.ts','src/lib/studentLife.ts','src/lib/studentPet.ts','src/pages/AuctionPage.tsx','src/components/student/StudentLibraryPage.tsx','src/components/student/library/CanvasLibraryGame.tsx','src/components/student/library/CanvasLibraryRenderer.ts','src/index.css','src/components/student/library/CanvasLibraryPalette.ts','src/components/student/StudentFailureExhibitionPage.tsx','src/components/student/StudentFailureMessage.tsx'];
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
    localStorage.setItem('school-timer-student-pets-v1',JSON.stringify({currencyBalances:{23:30},currencyHistory:{23:[]},studentLife:{letters:[],failureStories:Array.from({length:6},(_,i)=>({id:'feedback-story-'+i,studentNumber:i+1,failure:['그림을 끝까지 완성하지 못했어요.','달리기에서 넘어졌어요.','수학 문제를 틀렸어요.','친구와 마음이 엇갈렸어요.','발표할 때 말이 막혔어요.','새로운 연주가 어려웠어요.'][i],lesson:'다음에는 천천히 다시 도전해 볼래요.',createdAt:new Date().toISOString(),stamps:[]})),failureProfileAssignments:{},books:[
      {id:'root-own-legacy',studentNumber:23,title:'예전에 읽은 합성 책',author:'연습 작가',pageCount:92,createdAt:'2025-01-01T00:00:00.000Z',colorIndex:0},
      {id:'root-other-placed',studentNumber:2,title:'친구의 합성 책',author:'공유 작가',pageCount:115,createdAt:'2025-01-02T00:00:00.000Z',colorIndex:1,librarySlot:0}
    ]}}));
    localStorage.setItem('root-library-qa-seeded','1');
  });
  const page=await context.newPage();page.on('pageerror',error=>receipt.errors.push(error.message));
  const canvas=page.getByRole('application');
  const position=()=>canvas.evaluate(e=>({x:Number(e.dataset.playerX),y:Number(e.dataset.playerY)}));
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('school-timer-student-pets-v1')));
  const capture=async (name,settle=250)=>{
    if(name==='route-picker') {
      const background=await page.locator('.student-canvas-library-slot-dialog').evaluate(element=>({color:getComputedStyle(element).backgroundColor,image:getComputedStyle(element).backgroundImage,timber:getComputedStyle(element).getPropertyValue('--library-timber').trim()}));
      assert.notEqual(background.image,'none','Enlarged bookcase must retain timber material instead of generic white dialog');
      receipt.checks.bookcaseMaterial=background;
    }
    await page.waitForTimeout(settle);
    const path=`${directory}${name}.png`;await page.screenshot({path});
    const png=await readFile(path);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1280,800]);
    assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]),[0,0]);
    receipt.screenshots.push(path);
  };
  const travel=async target=>{
    await page.waitForFunction(()=>!document.querySelector('canvas')?.dataset.action);
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

  await capture('entered');
  const cue=page.locator('.student-canvas-library-world-cue');
  assert.ok(await cue.isVisible());
  const font=await cue.evaluate(e=>({size:getComputedStyle(e).fontSize,font:getComputedStyle(e).fontFamily,tag:e.tagName}));
  assert.equal(font.tag,'BUTTON');assert.ok(parseFloat(font.size)>=16);receipt.readableFont=font;
  await page.getByRole('button',{name:'효과음 켜기',exact:true}).click();
  await page.getByRole('button',{name:'효과음 끄기',exact:true}).waitFor();
  assert.equal((await saved()).studentLife.failureStories.length,6);
  assert.ok(Math.hypot(room.spawn.x-room.desk.interactionPoint.x,room.spawn.y-room.desk.interactionPoint.y)<=28);
  assert.equal(room.shelves.length,4);
  assert.equal(room.shelves.flatMap(s=>s.slots).length,100);
  await canvas.focus();await page.keyboard.press('e');
  await page.getByRole('textbox',{name:'책 제목',exact:true}).fill('입구에서 받은 책');
  await page.getByRole('textbox',{name:'글쓴이',exact:true}).fill('연습 작가');
  await page.getByRole('textbox',{name:'쪽수',exact:true}).fill('180');
  await capture('entrance-registration');
  await page.getByRole('button',{name:'책 받기',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await capture('receive-start',0);
  assert.equal(await canvas.getAttribute('data-action'),'receive');
  await capture('receive-mid',100);
  await page.waitForFunction(()=>!document.querySelector('canvas')?.dataset.action);
  await capture('receive-settled',0);
  await travel(room.failureBoard.interactionPoint);await page.keyboard.press('e');
  const board=page.getByRole('dialog',{name:'실패 자랑소 게시판',exact:true});
  await board.waitFor();assert.equal(await page.locator('[aria-modal="true"]').count(),1);
  const boardPosition=await position();await page.keyboard.press('ArrowRight');assert.deepEqual(await position(),boardPosition);
  await capture('board-stories');
  await page.getByRole('button',{name:'응원 도장 선택',exact:true}).first().click();
  await page.getByRole('group',{name:'응원 도장 선택'}).waitFor();await capture('board-stamp-menu');
  await page.getByRole('button',{name:'나도 그런 적 있어',exact:true}).click();
  await page.getByRole('button',{name:/응원 바꾸기/}).waitFor();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('school-timer-student-pets-v1')).studentLife.failureStories.reduce((n,s)=>n+s.stamps.length,0)===1);
  assert.equal((await saved()).studentLife.failureStories.reduce((n,s)=>n+s.stamps.length,0),1);
  await capture('board-stamped');
  await page.getByRole('button',{name:/응원 바꾸기/}).click();
  await page.getByRole('group',{name:'응원 도장 선택'}).getByRole('button').first().focus();
  await page.keyboard.press('Escape');await board.waitFor();assert.equal(await page.getByRole('group',{name:'응원 도장 선택'}).count(),0);
  await page.getByRole('button',{name:'실패 이야기 전시하기',exact:true}).click();
  const compose=page.getByRole('dialog',{name:'실패 전시하기',exact:true});
  await compose.waitFor();assert.equal(await page.locator('[aria-modal="true"]').count(),1);
  assert.equal(await page.getByRole('button',{name:'자랑하기',exact:true}).isEnabled(),false);
  await page.getByPlaceholder('실패했던 일을 편하게 적어 보세요.').fill('새로운 도전을 멈췄어요.');
  await page.getByPlaceholder('다시 한다면 어떤 방법으로 해볼까요?').fill('작은 단계부터 다시 해볼래요.');
  await capture('board-compose');
  assert.deepEqual(await position(),boardPosition);
  await page.keyboard.press('Escape');await board.waitFor();await capture('board-compose-cancelled');
  await page.getByRole('button',{name:'실패 이야기 전시하기',exact:true}).click();
  await page.getByPlaceholder('실패했던 일을 편하게 적어 보세요.').fill('새로운 도전을 멈췄어요.');
  await page.getByPlaceholder('다시 한다면 어떤 방법으로 해볼까요?').fill('작은 단계부터 다시 해볼래요.');
  await page.getByRole('button',{name:'자랑하기',exact:true}).click();
  await compose.waitFor({state:'hidden'});await board.waitFor();
  assert.equal((await saved()).studentLife.failureStories.length,7);
  assert.equal((await saved()).studentLife.books.length,2);
  await capture('board-created');
  await page.keyboard.press('Escape');await board.waitFor({state:'hidden'});
  assert.equal(await canvas.evaluate(e=>document.activeElement===e),true);
  assert.ok(await page.getByText('운반 중 · 입구에서 받은 책',{exact:true}).isVisible());
  await capture('board-closed-carry-retained');
  await travel(room.shelves.at(-1).interactionPoint);await page.keyboard.press('e');
  await page.getByRole('button',{name:'빈자리 100',exact:true}).scrollIntoViewIfNeeded();
  await capture('dense-empty-picker');
  await page.getByRole('button',{name:'빈자리 100',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal((await saved()).studentLife.books.find(b=>b.title==='입구에서 받은 책').librarySlot,99);
  assert.equal((await saved()).studentLife.books.find(b=>b.id==='root-other-placed').librarySlot,0);
  await capture('place-start',0);
  await capture('place-mid',100);
  await page.waitForFunction(()=>!document.querySelector('canvas')?.dataset.action);
  await capture('placed');
  await page.reload();await canvas.waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.playerX);
  await travel(room.shelves.at(-1).interactionPoint);await page.keyboard.press('e');
  await page.getByRole('button',{name:'입구에서 받은 책',exact:true}).click();
  await page.getByRole('heading',{name:'입구에서 받은 책',exact:true}).waitFor();await capture('reloaded-book');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{const k='school-timer-student-pets-v1';const s=JSON.parse(localStorage.getItem(k));s.studentLife.books=Array.from({length:100},(_,i)=>({id:'full-'+i,studentNumber:i%23+1,title:'소장 도서 '+(i+1),author:'연습 작가',pageCount:100+i*3,createdAt:'2025-01-01T00:00:00.000Z',colorIndex:i%6,librarySlot:i}));localStorage.setItem(k,JSON.stringify(s));});
  await page.reload();await canvas.waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.playerX);
  await capture('full-100');
  for(const shelf of room.shelves) {
    await travel(shelf.interactionPoint);await page.keyboard.press('e');
    await page.getByRole('heading',{name:'책을 둘 자리',exact:true}).waitFor();
    const targets=await page.locator('.student-canvas-library-slot-grid button').evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
    assert.equal(targets.length,shelf.slots.length);assert.ok(targets.every(t=>t.width>=44&&t.height>=44));
    await capture('full-picker-'+shelf.id);
    await page.locator('.student-canvas-library-slot-grid button').last().scrollIntoViewIfNeeded();await capture('full-picker-bottom-'+shelf.id);
    await page.keyboard.press('Escape');
  }
  await travel({x:room.readingArea.rug.x+15,y:room.readingArea.rug.y+room.readingArea.rug.height-12});
  await capture('reading-nook-route');
  await travel(room.readingArea.interactionPoint);
  const seatPosition=await position();
  await page.keyboard.press('e');
  await page.getByRole('dialog',{name:'잠깐, 책 한 권'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.seated==='true');
  assert.equal(await canvas.getAttribute('data-seated'),'true');
  await capture('reading-seated');
  await page.keyboard.press('ArrowRight');assert.deepEqual(await position(),seatPosition);
  const bookHeading=page.locator('.student-canvas-library-reading-page h2');
  const firstTitle=await bookHeading.textContent();
  await page.getByRole('button',{name:'다른 책 펼치기',exact:true}).click();
  assert.notEqual(await bookHeading.textContent(),firstTitle);
  await capture('reading-next-book');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.seated==='false');
  assert.equal(await canvas.evaluate(e=>document.activeElement===e),true);
  assert.deepEqual(await position(),seatPosition);
  await capture('reading-standing');
  await travel({x:100,y:290});
  for(const [key,direction] of [['w','up'],['d','right'],['s','down'],['a','left']]) {
    await canvas.focus();await page.keyboard.down(key);
    await capture('walk-'+direction+'-start',30);
    await capture('walk-'+direction+'-mid',120);
    await page.keyboard.up(key);await capture('walk-'+direction+'-settled',100);
    assert.equal(await canvas.getAttribute('data-facing'),direction);
  }
  await travel({x:250,y:225});await capture('behind-shelf');
  await travel({x:250,y:275});await capture('in-front-of-shelf');
  await page.goto('http://127.0.0.1:'+port+'/#student-library');await page.reload();
  await canvas.waitFor();assert.equal(await page.locator('[aria-modal="true"]').count(),0);
  await capture('library-route-room');
  await travel(room.failureBoard.interactionPoint);await page.keyboard.press('e');await board.waitFor();
  assert.equal(await page.getByRole('button',{name:'책장으로 가기',exact:true}).count(),0);
  await capture('legacy-route-board');
  await page.addStyleTag({content:'html {font-size:200% !important}'});await capture('board-text-200');
  assert.equal(await page.locator('.student-failure-feed-row').first().evaluate(e=>getComputedStyle(e).display),'block');
  const cards=await page.locator('.student-failure-message').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom})));
  for(let i=1;i<cards.length;i++) assert.ok(cards[i].top>=cards[i-1].bottom,'Enlarged cards must not overlap');
  const firstCard=page.locator('.student-failure-message').first();
  await firstCard.scrollIntoViewIfNeeded();await capture('board-text-200-card');
  const close=page.getByRole('button',{name:'실패 자랑소 닫기',exact:true});
  const header=page.locator('.student-canvas-library-failure-board-header');
  const headerBefore=await header.boundingBox();
  await page.locator('.student-failure-message').nth(3).scrollIntoViewIfNeeded();
  await capture('board-text-200-lower-card');
  const scrollState=await page.evaluate(()=>({windowY:scrollY,rootY:document.documentElement.scrollTop,bodyY:document.body.scrollTop,innerY:document.querySelector('.student-canvas-library-failure-board-content').scrollTop}));
  assert.equal(scrollState.windowY,0);assert.equal(scrollState.rootY,0);assert.equal(scrollState.bodyY,0);assert.ok(scrollState.innerY>0);
  assert.deepEqual(await header.boundingBox(),headerBefore);
  const closeRect=await close.boundingBox();assert.ok(closeRect&&closeRect.y>=0&&closeRect.y+closeRect.height<=800);
  receipt.zoomScroll={...scrollState,headerBefore,headerAfter:await header.boundingBox(),closeRect};
  assert.ok(await close.isVisible());await close.click();
  await page.evaluate(()=>{const k='school-timer-student-pets-v1';const s=JSON.parse(localStorage.getItem(k));s.studentLife.books=[];s.studentLife.failureStories=[];localStorage.setItem(k,JSON.stringify(s));});
  await page.goto('http://127.0.0.1:'+port+'/#student-library-bookshelf');await page.reload();await canvas.waitFor();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.playerX);
  await capture('empty-room');
  await travel(room.failureBoard.interactionPoint);await page.keyboard.press('e');await board.waitFor();await capture('empty-board');
  await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});
  await travel(room.desk.interactionPoint);await page.keyboard.press('e');
  await page.getByRole('textbox',{name:'책 제목',exact:true}).fill('움직임 줄인 책');
  await page.getByRole('textbox',{name:'글쓴이',exact:true}).fill('연습 작가');
  await page.getByRole('textbox',{name:'쪽수',exact:true}).fill('80');
  await page.getByRole('button',{name:'책 받기',exact:true}).click();
  await page.waitForTimeout(50);assert.equal(await canvas.getAttribute('data-action'),'');
  await travel(room.shelves[0].interactionPoint);await page.keyboard.press('e');
  await page.getByRole('button',{name:'빈자리 1',exact:true}).click();
  await page.waitForTimeout(50);assert.equal(await canvas.getAttribute('data-action'),'');
  assert.equal((await saved()).studentLife.books.length,1);await capture('reduced-motion-placed');
  await page.getByRole('button',{name:'효과음 켜기',exact:true}).click();
  await page.getByRole('button',{name:'효과음 끄기',exact:true}).click();
  await page.getByRole('button',{name:'효과음 켜기',exact:true}).waitFor();
  assert.deepEqual(receipt.errors,[]);
  receipt.checks={directionalWalking:true,receivePlaceAnimation:true,seatedReading:true,readableDomCue:true,reducedMotion:true,mute:true,roomFirstRoute:true,entranceRegistration:true,boardCreateStampCancel:true,oneModalOwner:true,carryRetained:true,bookIDsPreserved:true,fourVariedShelves100Slots:true,min44Targets:true,legacyRouteEmbedded:true,text200:true};
  receipt.sourceSha256=await hashes();assert.deepEqual(receipt.sourceSha256,sourceStart,'Source changed during QA');
  receipt.passed=true;
} catch(error) {receipt.passed=false;receipt.failure=String(error.stack??error);throw error;}
finally {await browser.close();receipt.cleanup.push('isolated Chrome closed; root owns3044');await writeFile(directory+'qa.json',JSON.stringify(receipt,null,2));}
