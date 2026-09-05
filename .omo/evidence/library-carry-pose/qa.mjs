import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const phase = process.argv[2] ?? 'final';
const directory = new URL('./', import.meta.url).pathname;
const source = 'src/components/student/library/CanvasLibraryRenderer.ts';
const hash = () => readFile(source).then(value => createHash('sha256').update(value).digest('hex'));
const receipt = {phase, sourceStart:await hash(), frames:[], errors:[], checks:{}, cleanup:[]};
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const context = await browser.newContext({viewport:{width:1280,height:800}});
  await context.route('**/*', route => { const u=new URL(route.request().url()); return u.hostname==='127.0.0.1'&&u.port==='3045'&&!u.pathname.startsWith('/api/')?route.continue():route.abort(); });
  const page=await context.newPage(); page.on('pageerror',e=>receipt.errors.push(e.message));
  await page.goto('http://127.0.0.1:3045/');
  await page.evaluate(async()=>{
    const {createLibraryRenderer}=await import('/src/components/student/library/CanvasLibraryRenderer.ts');
    const {createFullLibraryRoom,createLibraryPlayer}=await import('/src/lib/canvasLibraryWorld.ts');
    const room=createFullLibraryRoom();const canvas=document.createElement('canvas');
    document.body.replaceChildren(canvas);document.body.style.cssText='margin:0;background:#253044;display:grid;place-items:center;height:100vh;overflow:hidden';
    canvas.style.cssText='width:1248px;height:752px;image-rendering:pixelated';
    const renderer=createLibraryRenderer(canvas,room);
    window.drawPose=(facing,carried,timeMs,walking,reducedMotion=false)=>{
      renderer.draw({player:{...createLibraryPlayer(room,23),position:{x:365,y:180},facing,isWalking:walking},placedBooks:[],carriedDraft:carried?{title:'운반 검증',author:'합성',pageCount:100}:null,nearbyTarget:null,selectedSlotId:null,timeMs,reducedMotion});
      const c=canvas.getContext('2d');const data=c.getImageData(343,140,44,42).data;
      let blue=0;for(let i=0;i<data.length;i+=4)if((data[i]===115&&data[i+1]===173&&data[i+2]===213)||(data[i]===184&&data[i+1]===224&&data[i+2]===244))blue++;
      const tail={left:0,right:0};
      for(let row=22;row<30;row++)for(let col=4;col<40;col++){const i=(row*44+col)*4;if(data[i]===114&&data[i+1]===185&&data[i+2]===76){if(col<9)tail.left++;if(col>34)tail.right++;}}
      return {blue,tail,pixels:Array.from(data),upper:Array.from(c.getImageData(343,162,44,7).data)};
    };
  });
  for(const facing of ['down','left','right','up']) {
    for(const [name,carried,time,walking,reduced] of [['empty',false,0,false,false],['carry-idle',true,0,false,false],['carry-step-a',true,0,true,false],['carry-step-b',true,140,true,false],['carry-reduced',true,140,true,true]]) {
      const pixels=await page.evaluate(args=>window.drawPose(...args),[facing,carried,time,walking,reduced]);
      const path=directory+phase+'-'+facing+'-'+name+'.png';await page.screenshot({path});
      const png=await readFile(path);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1280,800]);
      receipt.frames.push({facing,name,path,...pixels});
    }
  }
  const back=receipt.frames.find(f=>f.facing==='up'&&f.name==='carry-idle');
  receipt.checks.backBookOccluded=back.blue===0;
  if(phase==='final') {
    assert.equal(receipt.checks.backBookOccluded,true,'Book carried in front must not be painted over the back');
    const before=JSON.parse(await readFile(directory+'before.json','utf8'));
    for(const facing of ['down','left','right','up']) {
      const frames=receipt.frames.filter(f=>f.facing===facing);
      const empty=frames.find(f=>f.name==='empty');
      if(facing==='left')assert.ok(empty.tail.right>empty.tail.left,'Left-facing scarf trails to the right');
      if(facing==='right')assert.ok(empty.tail.left>empty.tail.right,'Right-facing scarf trails to the left');
      const withoutScarf=pixels=>pixels.filter((_,i)=>{const p=Math.floor(i/4),x=p%44,y=Math.floor(p/44);return !(y>=22&&y<30&&((x>=4&&x<14)||(x>=32&&x<42)));});
      assert.deepEqual(withoutScarf(empty.pixels),withoutScarf(before.frames.find(f=>f.facing===facing&&f.name==='empty').pixels),'Unladen character preserved outside requested scarf tip change');
      assert.deepEqual(frames.find(f=>f.name==='carry-idle').upper,frames.find(f=>f.name==='carry-step-a').upper,'Holding arms do not swing independently');
      assert.deepEqual(frames.find(f=>f.name==='carry-idle').upper,frames.find(f=>f.name==='carry-step-b').upper,'Holding pose stable across walking phases');
      if(facing!=='up')assert.ok(frames.find(f=>f.name==='carry-idle').blue>0,'Book remains visible in front/side view');
    }
    receipt.checks.unladenPreserved=true;receipt.checks.holdingArmsStable=true;receipt.checks.scarfTrailsBehind=true;
  }
  assert.deepEqual(receipt.errors,[]);
  await context.close();receipt.cleanup.push('isolated context closed');
} finally {
  await browser.close();receipt.cleanup.push('isolated Chrome closed; root3045 retained');receipt.sourceEnd=await hash();
  await writeFile(directory+phase+'.json',JSON.stringify(receipt,null,2));
}
console.log(JSON.stringify({phase,frames:receipt.frames.length,checks:receipt.checks,errors:receipt.errors}));
