import type { LibraryBookDraft, LibraryRect, LibraryRoom, LibraryScene } from '../../../lib/canvasLibraryWorld';
import { getLibraryBearPose, getLibraryBookMotion, getLibraryBookTone } from '../../../lib/canvasLibraryPose';
import { CANVAS_LIBRARY_PALETTE as palette } from './CanvasLibraryPalette';

type Point = readonly [number, number];
type Context = CanvasRenderingContext2D;

// Scan each row on the logical pixel grid, including diagonal silhouette steps.
function shape(context: Context, points: readonly Point[], color: string) {
  context.fillStyle = color;
  const minY = Math.floor(Math.min(...points.map(point => point[1])));
  const maxY = Math.ceil(Math.max(...points.map(point => point[1])));
  for (let y = minY; y < maxY; y += 1) {
    const cuts: number[] = [];
    points.forEach((a, index) => {
      const b = points[(index + 1) % points.length];
      if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) {
        cuts.push(a[0] + (y + 0.5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    });
    cuts.sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      const left = Math.round(cuts[i]);
      context.fillRect(left, y, Math.round(cuts[i + 1]) - left, 1);
    }
  }
}

function rect(context: Context, x: number, y: number, w: number, h: number, color: string) {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), w, h);
}

function paw(context: Context, x: number, y: number, w = 5, h = 6, far = false) {
  shape(context, [[x+1,y],[x+w-1,y],[x+w,y+1],[x+w,y+h-1],[x+w-1,y+h],[x+1,y+h],[x,y+h-1],[x,y+1]], palette.bear[0]);
  rect(context,x+1,y+1,w-2,h-2,far ? palette.bear[1] : palette.bear[2]);
  if (!far) rect(context,x+1,y+1,Math.max(1,w-3),1,palette.bear[3]);
}

const FRONT_HEAD: readonly Point[] = [[8,5],[24,5],[28,8],[30,12],[30,19],[27,23],[23,25],[9,25],[5,23],[2,19],[2,12],[4,8]];
const FRONT_FILL: readonly Point[] = [[8,6],[23,6],[27,9],[29,13],[29,18],[26,22],[23,24],[9,24],[6,22],[3,18],[3,12],[5,9]];
const SIDE_HEAD: readonly Point[] = [[11,5],[22,5],[26,8],[27,12],[30,15],[30,19],[27,21],[25,24],[12,25],[7,22],[5,17],[6,11],[8,7]];
const SIDE_FILL: readonly Point[] = [[11,6],[22,6],[25,9],[26,13],[29,16],[29,18],[26,20],[24,23],[12,24],[8,21],[6,17],[7,11],[9,8]];

function ear(context: Context, x: number, y: number, back = false, mirroredLight = false) {
  shape(context,[[x+2,y],[x+6,y],[x+8,y+2],[x+8,y+6],[x+6,y+8],[x+2,y+8],[x,y+6],[x,y+2]],palette.bear[0]);
  shape(context,[[x+2,y+1],[x+5,y+1],[x+7,y+3],[x+7,y+6],[x+5,y+7],[x+2,y+6],[x+1,y+3]],palette.bear[2]);
  rect(context,x+(mirroredLight ? 4 : 2),y+2,3,3,back ? palette.bear[3] : '#edb078');
  if (!back) rect(context,x+3,y+4,2,2,palette.bear[1]);
}

function bag(context: Context, x: number, y: number, mirroredLight = false) {
  shape(context,[[x+3,y],[x+6,y],[x+6,y+3],[x+9,y+5],[x+10,y+8],[x+8,y+11],[x+2,y+11],[x,y+8],[x+1,y+5],[x+3,y+3]],palette.bear[0]);
  shape(context,[[x+4,y+1],[x+5,y+1],[x+5,y+4],[x+8,y+6],[x+9,y+8],[x+7,y+10],[x+2,y+10],[x+1,y+8],[x+2,y+6],[x+4,y+4]],palette.paper[3]);
  rect(context,x+4,y+5,1,4,palette.paper[0]);
  rect(context,x+7,y+7,1,2,palette.paper[1]);
  rect(context,x+(mirroredLight ? 7 : 2),y+7,1,2,'#ffffff');
}

export function drawLibraryBookSpine(context: Context, box: LibraryRect, book?: LibraryBookDraft) {
  const colors = palette.bookSpines[book ? getLibraryBookTone(book) : 1];
  const { x, y, width, height } = box;
  rect(context,x+1,y+1,width,height,palette.ink[0]);
  rect(context,x,y,width,height,colors[0]);
  rect(context,x,y,width,1,colors[1]);
  rect(context,x,y+height-1,width,1,colors[1]);
  rect(context,x+width-1,y+1,1,Math.max(1,height-2),palette.paper[2]);
  if (width > 2) rect(context,x+1,y+Math.floor(height/2),width-2,1,palette.paper[3]);
}

export function drawLibraryCarryBook(context: Context, center: {x:number;y:number}, turn = 0, book?: LibraryBookDraft, size?: {width:number;height:number}) {
  const width = size?.width ?? 10;
  const height = size?.height ?? 8;
  const x = Math.round(center.x - width / 2);
  const y = Math.round(center.y - height / 2);
  drawLibraryBookSpine(context,{ x, y, width, height },book);
  const coverEdge = Math.round((1 - Math.max(0,Math.min(1,turn))) * 2);
  if (coverEdge > 0) {
    rect(context,x,y+1,1,height-2,palette.ink[0]);
    rect(context,x+width-coverEdge-1,y+2,coverEdge,height-4,palette.paper[3]);
  }
}

export function drawLibraryInteractionHand(context: Context, pose: ReturnType<typeof getLibraryBearPose>) {
  for (const outline of [true, false]) {
    for (const [from, to] of [[pose.shoulder, pose.elbow], [pose.elbow, pose.hand]]) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
      for (let step = 0; step <= steps; step += 1) {
        const x = from.x + dx * step / steps;
        const y = from.y + dy * step / steps;
        rect(context, x - (outline ? 2 : 1), y - (outline ? 1 : 0), outline ? 4 : 2, outline ? 4 : 2, outline ? palette.bear[0] : palette.bear[2]);
      }
    }
  }
  paw(context,pose.hand.x-2,pose.hand.y,5,5);
}

export function drawLibraryCharacter(context: Context, scene: LibraryScene, room?: LibraryRoom) {
  const pose = getLibraryBearPose(scene, room);
  const {facing, stride, carrying, benchSeated, ambientProgress} = pose;
  const clerkReceiving = Boolean(room?.desk.clerk && scene.action?.kind === 'receive' && pose.progress !== null);
  const interacting = ambientProgress !== null && scene.ambientAction?.kind !== 'sit';
  const side = facing === 'left' || facing === 'right';
  const back = facing === 'up';
  const mirrored = facing === 'left';
  const x = Math.round(pose.feet.x - 16);
  const y = Math.round(pose.feet.y - 38);
  context.save();
  context.translate(x, y);
  if (mirrored) { context.translate(32,0); context.scale(-1,1); }

  if (scene.seated || benchSeated) {
    rect(context, 9, 29, 5, 7, palette.bear[0]);
    rect(context, 19, 29, 5, 7, palette.bear[0]);
    rect(context, 10, 30, 3, 5, palette.bear[2]);
    rect(context, 20, 30, 3, 5, palette.bear[2]);
  } else if (side) paw(context,15-stride,31-Math.max(0,stride),7,7,true);
  else { paw(context,8,31-Math.max(0,stride),7,7); paw(context,18,31-Math.max(0,-stride),7,7); }
  if (side && !mirrored) bag(context,5,25);
  shape(context,side ? [[12,21],[22,22],[25,27],[24,34],[11,34],[9,29]] : [[9,21],[23,21],[26,26],[25,33],[21,35],[11,35],[7,32],[6,27]],palette.bear[0]);
  shape(context,side ? [[13,22],[21,23],[24,27],[23,33],[12,33],[10,29]] : [[10,22],[22,22],[25,27],[24,32],[20,34],[12,34],[8,31],[7,27]],palette.bear[2]);
  rect(context,side ? (mirrored ? 21 : 11) : 9,26,side ? 2 : 5,5,palette.bear[3]);
  if (back) {
    shape(context,[[15,28],[18,29],[19,31],[17,32],[14,31],[13,30]],palette.bear[1]);
    rect(context,14,29,3,1,palette.bear[3]);
  }
  if (side) paw(context,10+stride,32-Math.max(0,-stride),8,6);

  if (!carrying && !scene.seated && !benchSeated && !interacting) {
    if (side) paw(context,16,25+stride,6,8);
    else { paw(context,5,25+stride,5,7); paw(context,23,25-stride,5,7,back); }
  }

  if (back) { ear(context,4,1,true); ear(context,21,1,true); }
  else if (side) { ear(context,20,2,true,mirrored); ear(context,7,1,false,mirrored); }
  else { ear(context,4,1); ear(context,21,1); }
  shape(context,side ? SIDE_HEAD : FRONT_HEAD,palette.bear[0]);
  shape(context,side ? SIDE_FILL : FRONT_FILL,palette.bear[2]);
  rect(context,side ? 10 : 8,7,side ? 10 : 13,1,palette.bear[3]);
  if (mirrored) {
    rect(context,25,12,1,2,palette.bear[3]);
    rect(context,28,16,1,2,palette.bear[3]);
  } else rect(context,side ? 7 : 4,12,1,5,palette.bear[3]);
  if (!back) {
    if (side) rect(context,23,14,2,2,palette.bear[0]);
    else { rect(context,10,15,2,2,palette.bear[0]); rect(context,21,15,2,2,palette.bear[0]); }
  }
  const scarfEndX = side ? 5 : back ? 3 : 26;
  shape(context,[[scarfEndX,23],[scarfEndX+5,22],[scarfEndX+6,25],[scarfEndX+3,28+Math.abs(stride)],[scarfEndX-1,27]],palette.bear[0]);
  shape(context,[[scarfEndX+1,24],[scarfEndX+4,23],[scarfEndX+5,25],[scarfEndX+2,27],[scarfEndX,26]],palette.scarf[1]);
  shape(context,side ? [[10,23],[25,23],[25,27],[12,28],[9,26]] : [[5,23],[27,23],[28,26],[24,28],[8,28],[4,26]],palette.bear[0]);
  rect(context,side ? 11 : 6,24,side ? 13 : 20,2,palette.scarf[0]);
  rect(context,side ? 12 : 7,24,side ? 10 : 17,1,palette.scarf[1]);
  if (!side) {
    const bx = back ? 3 : 24;
    shape(context,back ? [[23,27],[24,28],[10,34],[9,32]] : [[9,27],[10,27],[25,32],[24,33]],palette.bear[0]);
    shape(context,back ? [[22,27],[23,28],[10,33],[10,32]] : [[10,27],[11,27],[25,31],[24,32]],palette.paper[1]);
    bag(context,bx,26);
  } else if (mirrored) {
    shape(context,[[22,27],[23,28],[12,33],[11,31]],palette.bear[0]);
    shape(context,[[21,27],[22,28],[12,32],[12,31]],palette.paper[1]);
    bag(context,5,26,true);
  }
  if (scene.seated || benchSeated) {
    paw(context,7,33,8,5); paw(context,18,33,8,5);
    rect(context,9,35,4,1,palette.bear[1]); rect(context,20,35,4,1,palette.bear[1]);
    if (benchSeated) { paw(context,6,28,5,5); paw(context,22,28,5,5); }
  }
  context.restore();

  if (interacting) drawLibraryInteractionHand(context, pose);
  const book = room ? getLibraryBookMotion(scene, room) : null;
  const hasBookInHands = book?.inHands && book.visible;
  if ((carrying || scene.seated) && (!back || clerkReceiving)) {
    const hx = Math.round(pose.hand.x);
    const hy = Math.round(pose.hand.y);
    if (side) paw(context,hx-3,hy-2,5,6,true);
    if (hasBookInHands && book && !clerkReceiving) drawLibraryCarryBook(context,book.center,book.turn,scene.carriedDraft ?? scene.placedBooks.find(item => item.slotId === scene.action?.slotId),book);
    if (scene.seated && !carrying) {
      rect(context,hx-6,hy-2,13,7,palette.bear[0]);
      rect(context,hx-5,hy-2,5,5,palette.paper[3]); rect(context,hx+1,hy-2,5,5,palette.paper[3]);
      rect(context,hx,hy-2,1,6,palette.paper[0]);
      if (!scene.reducedMotion && Math.floor(scene.timeMs/2200)%2 === 1) rect(context,hx+1,hy-1,2,4,palette.paper[1]);
    }
    if (side) {
      const near = facing === 'right' ? -5 : 1;
      paw(context,hx+near,hy+1,5,5);
    } else {
      paw(context,hx-7,hy,4,5); paw(context,hx+4,hy,4,5);
    }
  }
}
