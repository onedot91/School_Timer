import { createLibraryRenderer } from '../../../src/components/student/library/CanvasLibraryRenderer';
import { createFullLibraryRoom, createLibraryPlayer, type LibraryScene } from '../../../src/lib/canvasLibraryWorld';
const canvas = document.querySelector('canvas');
if (!canvas) throw new Error('Missing QA canvas');
const room = createFullLibraryRoom();
const renderer = createLibraryRenderer(canvas, room);
const context = canvas.getContext('2d');
if (!context) throw new Error('Missing QA context');
const base: LibraryScene = {player:createLibraryPlayer(room,23),placedBooks:[],carriedDraft:null,nearbyTarget:null,selectedSlotId:null,timeMs:0,reducedMotion:false};
renderer.draw({...base,player:{...base.player,position:{x:-1000,y:-1000}}});
const background = context.getImageData(116,244,48,56).data;
const results = [];
for (const facing of ['down','up','left','right'] as const) {
  for (const timeMs of [0,140]) {
    const scene = {...base,timeMs,player:{...base.player,position:{x:140,y:290},facing,isWalking:true}};
    renderer.draw(scene);
    const actual = context.getImageData(116,244,48,56).data;
    const rows = Array.from({length:56},(_,y)=>Array.from({length:48},(_,x)=>{
      const i=(y*48+x)*4;
      return actual[i]!==background[i]||actual[i+1]!==background[i+1]||actual[i+2]!==background[i+2];
    }).some(Boolean));
    const first=rows.indexOf(true), last=rows.lastIndexOf(true);
    results.push({facing,timeMs,firstY:first+244,lastY:last+244,emptyRows:rows.slice(first,last+1).filter(value=>!value).length});
  }
}
renderer.draw({...base,player:{...base.player,position:{x:140,y:290},facing:'down'}});
document.body.dataset.grounding=JSON.stringify(results);
window.addEventListener('pagehide',()=>renderer.dispose(),{once:true});
