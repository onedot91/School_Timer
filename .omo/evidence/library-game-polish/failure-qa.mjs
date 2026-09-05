import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createFullLibraryRoom, createLibraryPlayer, stepLibraryPlayer } from '../../../src/lib/canvasLibraryWorld.ts';
const room=createFullLibraryRoom();const directory=new URL('./',import.meta.url).pathname;
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
const receipt={passed:false,screenshots:[],errors:[]};
try {
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'&&u.port==='3044'&&!u.pathname.startsWith('/api/')?r.continue():r.abort();});
  await context.addInitScript(()=>{window.AudioContext=class {constructor(){throw new Error('QA audio unavailable');}};});
  const page=await context.newPage();page.on('pageerror',error=>receipt.errors.push(error.message));
  const canvas=page.getByRole('application');
  const position=()=>canvas.evaluate(e=>({x:Number(e.dataset.playerX),y:Number(e.dataset.playerY)}));
  const capture=async name=>{const path=directory+name+'.png';await page.screenshot({path});receipt.screenshots.push(path);};
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

  await page.goto('http://127.0.0.1:3044/.omo/evidence/library-game-polish/failure-fixture.html');await canvas.waitFor();
  await page.getByRole('button',{name:'효과음 켜기',exact:true}).click();
  await page.getByRole('button',{name:'효과음 켜기',exact:true}).waitFor();
  await canvas.focus();await page.keyboard.press('e');
  await page.getByRole('textbox',{name:'책 제목',exact:true}).fill('저장 실패 후 다시 꽂기');
  await page.getByRole('textbox',{name:'글쓴이',exact:true}).fill('테스트 작가');
  await page.getByRole('textbox',{name:'쪽수',exact:true}).fill('120');
  await page.getByRole('button',{name:'책 받기',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.action==='receive');
  await travel(room.shelves[0].interactionPoint);await page.keyboard.press('e');
  const slot=page.getByRole('button',{name:'빈자리 1',exact:true});await slot.click();
  await page.locator('[aria-busy="true"]').waitFor();
  assert.equal(await slot.isDisabled(),true);await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),1);await capture('placement-pending-locked');
  await page.getByText('책을 꽂지 못했습니다. 다시 선택해 주세요.',{exact:true}).waitFor();
  assert.equal(await canvas.getAttribute('data-action'),'');
  assert.ok(await page.getByText('운반 중 · 저장 실패 후 다시 꽂기',{exact:true}).isVisible());
  assert.equal(await page.locator('body').getAttribute('data-attempts'),'1');await capture('placement-failed-carry-retained');
  await slot.click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.waitForFunction(()=>!document.querySelector('canvas')?.dataset.action);
  assert.equal(await page.locator('body').getAttribute('data-attempts'),'2');
  assert.equal(await page.getByText('운반 중 · 저장 실패 후 다시 꽂기',{exact:true}).count(),0);
  await capture('placement-retry-confirmed');
  assert.deepEqual(receipt.errors,[]);receipt.passed=true;
} catch(error){receipt.failure=String(error.stack??error);throw error;}
finally {await browser.close();receipt.cleanup='isolated Chrome closed';await writeFile(directory+'failure-qa.json',JSON.stringify(receipt,null,2));}
