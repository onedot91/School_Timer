import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createFullLibraryRoom, createLibraryPlayer, stepLibraryPlayer } from '../../../src/lib/canvasLibraryWorld.ts';
import { createLibraryCompetition, getLibraryCompetitionMonth } from '../../../src/lib/libraryCompetition.ts';
const room = createFullLibraryRoom();
const navigationRoom = { ...room, obstacles: room.obstacles.map(rect => ({x:rect.x-4,y:rect.y-4,width:rect.width+8,height:rect.height+8})) };
const directory = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const port = '3044';
const files = ['src/lib/canvasLibraryWorld.ts','src/lib/canvasLibraryClient.ts','src/lib/canvasLibraryPlacement.ts','src/lib/studentLife.ts','src/lib/studentPet.ts','src/pages/AuctionPage.tsx','src/components/student/StudentLibraryPage.tsx','src/components/student/library/CanvasLibraryGame.tsx','src/components/student/library/CanvasLibraryRenderer.ts','src/index.css','src/components/student/library/CanvasLibraryPalette.ts','src/components/student/StudentFailureExhibitionPage.tsx','src/components/student/StudentFailureMessage.tsx'];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async path => [path,createHash('sha256').update(await readFile(root + path)).digest('hex')])));
files.push('src/pages/TimerPage.tsx','src/components/student/library/LibraryCompetitionPanel.tsx','src/components/student/library/LibraryCompetitionTable.tsx','src/components/teacher/TeacherLibraryCompetitionPanel.tsx');
files.push(...(await readdir(root+'src/lib')).filter(name=>name.startsWith('libraryCompetition')&&name.endsWith('.ts')&&!name.endsWith('.test.ts')).map(name=>'src/lib/'+name));
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
      const next=stepLibraryPlayer(navigationRoom,node.player,{x,y},40);
      if(Math.hypot(next.position.x-node.player.position.x,next.position.y-node.player.position.y)<3.99) continue;
      const id=keyOf(next.position);if(seen.has(id))continue;
      seen.add(id);queue.push({player:next,parent:index,key});
    }
  }
  throw new Error('No safe walking path');
}
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  let context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
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
  let page=await context.newPage();await page.clock.setSystemTime(new Date('2026-09-07T00:00:00.000Z'));page.on('pageerror',error=>receipt.errors.push(error.message));
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
  const boardPoint=room.competitionBoard.interactionPoint;
  const ranking=()=>page.getByRole('dialog',{name:'전국 책방 챌린지',exact:true});
  const openWith=async key=>{await travel(boardPoint);await page.keyboard.press(key);await ranking().waitFor();await page.locator('.library-competition-table tbody tr').last().waitFor();};
  const assertRows=async()=>{
    assert.equal(await page.locator('.library-competition-table tbody tr').count(),17);
    const sizes=await page.locator('.library-competition-table-scroll').evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight}));
    assert.ok(sizes.scroll<=sizes.client+1,JSON.stringify(sizes));
    assert.equal(await page.locator('[aria-modal="true"]').count(),1);
  };
  await openWith('e');await assertRows();await capture('ranking-initial');
  assert.equal((await saved()).libraryCompetition.placements.length,1);
  await page.keyboard.press('Tab');await capture('ranking-focused');
  await page.getByRole('button',{name:'지난 기록',exact:true}).click();await page.getByText('아직 지난 기록이 없어요.',{exact:true}).waitFor();await capture('history-empty');
  await page.keyboard.press('Escape');assert.equal(await canvas.evaluate(e=>document.activeElement===e),true);
  await canvas.dispatchEvent('keydown',{key:'ㄷ',code:'KeyE'});await ranking().waitFor();await page.locator('.library-competition-table').waitFor();await capture('ranking-korean-key');
  await page.keyboard.press('Escape');await openWith('Enter');await capture('ranking-enter');
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');await capture('ranking-text-200');
  const zoomScroll=await page.locator('.library-competition-table-scroll').evaluate(e=>{e.scrollTop=e.scrollHeight;return e.scrollHeight>e.clientHeight;});assert.ok(zoomScroll);await capture('ranking-text-200-bottom');
  await page.evaluate(()=>document.documentElement.style.fontSize='');await page.keyboard.press('Escape');
  const boardRect=room.competitionBoard.visualRect;const bounds=await canvas.boundingBox();assert.ok(bounds);
  await page.mouse.click(bounds.x+(boardRect.x+boardRect.width/2)*bounds.width/624,bounds.y+(boardRect.y+boardRect.height/2)*bounds.height/376);
  await ranking().waitFor();await page.locator('.library-competition-table').waitFor();await capture('ranking-click');await page.keyboard.press('Escape');
  await travel(room.desk.interactionPoint);await page.keyboard.press('e');
  await page.getByRole('textbox',{name:'책 제목',exact:true}).fill('챌린지 검증 책');
  await page.getByRole('textbox',{name:'글쓴이',exact:true}).fill('합성 작가');
  await page.getByRole('textbox',{name:'쪽수',exact:true}).fill('120');await capture('registration');
  await page.getByRole('button',{name:'책 받기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await capture('carry-start',0);await capture('carry-mid',100);await page.waitForFunction(()=>!document.querySelector('canvas')?.dataset.action);await capture('carry-settled',0);
  assert.equal((await saved()).libraryCompetition.placements.length,1);
  await travel(room.shelves[1].interactionPoint);await page.keyboard.press('e');
  await page.getByRole('dialog').waitFor();await capture('slot-picker');
  const slotButton=page.getByRole('button',{name:/빈자리/}).first();
  await slotButton.click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('school-timer-student-pets-v1')).libraryCompetition.placements.length===2);
  await page.getByRole('dialog').waitFor({state:'hidden'});await capture('placed');
  await openWith('e');assert.equal(await page.locator('tr[data-school-id="school-03"] td:last-child strong').innerText(),'2');await capture('ranking-placed');await page.keyboard.press('Escape');
  await travel(room.failureBoard.interactionPoint);await page.keyboard.press('e');await page.getByRole('dialog',{name:'실패 자랑소 게시판',exact:true}).waitFor();await capture('failure-board-regression');await page.keyboard.press('Escape');
  await page.clock.setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
  await openWith('e');await capture('month-check');
  assert.equal((await saved()).libraryCompetition.placements.length,0);assert.equal((await saved()).studentLife.books.length,1);
  assert.equal((await saved()).libraryCompetitionArchives.length,1);await capture('ranking-rolled-over');
  await page.getByRole('button',{name:'지난 기록',exact:true}).click();await page.getByLabel('지난 기록 월').waitFor();
  await page.locator('.library-competition-table tbody tr').last().waitFor();await capture('history-ranking');
  await page.getByText('보관된 책 2권',{exact:true}).click();await page.getByText('챌린지 검증 책',{exact:true}).waitFor();await capture('history-books');
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');await capture('history-text-200');await page.evaluate(()=>document.documentElement.style.fontSize='');
  await page.keyboard.press('Escape');
  await page.reload();await canvas.waitFor();assert.equal((await saved()).studentLife.books.length,1);assert.equal((await saved()).libraryCompetitionArchives.length,1);
  await capture('new-month-reentry');
  const teacherSnapshot=await saved();const teacherAt=new Date().toISOString();
  teacherSnapshot.libraryCompetition=createLibraryCompetition({seasonId:getLibraryCompetitionMonth(teacherAt),seed:'teacher-ui-qa',startedAt:teacherAt,bookIds:[]});
  teacherSnapshot.libraryCompetitionArchives=[];
  await context.close();receipt.cleanup.push('student clock-isolated context closed');
  context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  await context.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'&&url.port===port&&!url.pathname.startsWith('/api/')?route.continue():route.abort();});
  await context.addInitScript(snapshot=>{localStorage.setItem('school-timer-entry-number-v1','0');localStorage.setItem('school-timer-student-pets-v1',JSON.stringify(snapshot));},teacherSnapshot);
  page=await context.newPage();page.on('pageerror',e=>receipt.errors.push(e.message));
  await page.goto('http://127.0.0.1:3044/');await page.getByRole('button',{name:'설정',exact:true}).click();
  await page.getByRole('button',{name:'책방 챌린지',exact:true}).click();await page.getByLabel('서울공덕초등학교 모은 책').waitFor();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('[aria-labelledby="timer-settings-title"]')).opacity==='1');
  await capture('teacher-settings');assert.equal(await page.locator('.teacher-library-competition-counts input').count(),16);
  assert.equal((await page.getByLabel('우리 학교 실제 모은 책').innerText()).replace(/\s/g,''),'0권·자동집계');
  const field=page.getByLabel('서울공덕초등학교 모은 책');await field.fill('101');assert.equal(await page.getByRole('button',{name:'변경 사항 확인',exact:true}).isEnabled(),false);await capture('teacher-invalid');
  await field.fill('100');await page.getByLabel('성장 속도').selectOption('0.5');await page.getByLabel('상대 성장 일시정지').check();
  await page.getByRole('button',{name:'변경 사항 확인',exact:true}).click();await capture('teacher-confirm');await page.getByRole('button',{name:'확인하고 적용',exact:true}).click();
  await page.getByText('책방 챌린지 설정을 저장했습니다.',{exact:true}).waitFor();await capture('teacher-saved');
  await page.locator('.teacher-library-competition-history summary').click();await capture('teacher-history');
  await field.fill('3');
  await page.evaluate(async()=>{const lib=await import('/src/lib/libraryCompetitionLocalStore.ts');const s=lib.readLocalLibraryCompetition('enter');lib.settingsLocalLibraryCompetition({expectedRevision:s.competition.state.revision,speed:1,paused:true,counts:[]});});
  await page.getByRole('button',{name:'변경 사항 확인',exact:true}).click();await page.getByRole('button',{name:'확인하고 적용',exact:true}).click();
  await page.getByText(/다른 선생님이 설정을 바꿨어요/).waitFor();await capture('teacher-conflict');assert.equal(await field.isEnabled(),false);
  await page.getByRole('button',{name:'최신값 확인',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.teacher-library-competition-counts input')?.disabled);await capture('teacher-reloaded');
  await page.getByLabel('상대 성장 일시정지').uncheck();await page.getByRole('button',{name:'변경 사항 확인',exact:true}).click();await page.getByRole('button',{name:'확인하고 적용',exact:true}).click();await page.getByText('책방 챌린지 설정을 저장했습니다.',{exact:true}).waitFor();await capture('teacher-resumed');
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');await capture('teacher-text-200');await page.evaluate(()=>document.documentElement.style.fontSize='');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(receipt.errors.length,0,JSON.stringify(receipt.errors));
  receipt.checks={...receipt.checks,ranking17:true,inputs:true,carryNotCounted:true,confirmedPlacement:true,archiveOnce:true,teacherConflict:true,zoom200:true};
  await context.close();receipt.cleanup.push('isolated context closed');
} catch(error) {
  const last=browser.contexts()[0]?.pages().at(-1);
  if(last){await last.screenshot({path:directory+'failed-ui.png'});await writeFile(directory+'failed-ui.txt',await last.locator('body').innerText());}
  throw error;
} finally {await browser.close();receipt.cleanup.push('isolated Chrome closed; root3044 server retained');receipt.sourceEnd=await hashes();receipt.sourceStart=sourceStart;await writeFile(directory+'ui-qa.json',JSON.stringify(receipt,null,2));}
console.log(JSON.stringify({screenshots:receipt.screenshots.length,checks:receipt.checks,errors:receipt.errors,cleanup:receipt.cleanup}));
