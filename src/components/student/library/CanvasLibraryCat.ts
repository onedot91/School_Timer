import type { LibraryCatState } from '../../../lib/canvasLibraryCat';
import { CANVAS_LIBRARY_PALETTE as p } from './CanvasLibraryPalette';

type Context = CanvasRenderingContext2D;
const rect = (ctx: Context, x: number, y: number, width: number, height: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
};

function head(ctx: Context, x: number, y: number, back: boolean, closed: boolean, profile = false) {
  rect(ctx, x + 1, y, 3, 5, p.cat[0]);
  rect(ctx, x + 8, y, 3, 5, p.cat[0]);
  rect(ctx, x, y + 4, 12, 6, p.cat[0]);
  rect(ctx, x + 1, y + 3, 10, 8, p.cat[1]);
  rect(ctx, x + 2, y + 3, 8, 1, p.cat[2]);
  if (back) return;
  rect(ctx, x + 2, y + 1, 1, 2, p.bookCoral[0]);
  rect(ctx, x + 9, y + 1, 1, 2, p.bookCoral[0]);
  if (!profile) rect(ctx, x + 3, y + 6, closed ? 2 : 1, closed ? 1 : 2, p.catEyes);
  rect(ctx, x + 8, y + 6, closed ? 2 : 1, closed ? 1 : 2, p.catEyes);
  if (profile) rect(ctx, x + 11, y + 7, 2, 3, p.cat[1]);
  rect(ctx, x + (profile ? 12 : 6), y + 8, 1, 1, p.bookCoral[0]);
}

function paw(ctx: Context, x: number, y: number, width = 3) {
  rect(ctx, x, y, width, 3, p.cat[0]);
  rect(ctx, x, y + 2, width, 1, p.cat[2]);
}

export function drawLibraryCat(ctx: Context, cat: LibraryCatState, reducedMotion: boolean) {
  const time = reducedMotion ? 0 : cat.elapsedMs;
  const pet = cat.behavior === 'pet';
  const sleeping = cat.behavior === 'sleep' || (pet && cat.reaction === 'sleepy');
  const stretching = cat.behavior === 'stretch' || (pet && cat.reaction === 'stretch');
  const grooming = cat.behavior === 'groom';
  const walking = !reducedMotion && (cat.behavior === 'walk' || cat.behavior === 'yield');
  const seated = cat.behavior === 'sit' || grooming || (pet && cat.reaction === 'head-up');
  const stride = walking ? [0, 1, 0, -1][Math.floor(time / 160) % 4] : 0;
  const tail = reducedMotion ? 0 : Math.round(Math.sin(time / (sleeping ? 650 : 400)));
  ctx.save();
  ctx.translate(Math.round(cat.position.x), Math.round(cat.position.y));
  ctx.globalAlpha = 0.18;
  rect(ctx, sleeping ? -10 : -9, -2, sleeping ? 20 : 18, 3, p.timber[0]);
  ctx.globalAlpha = 1;

  if (sleeping) {
    rect(ctx, -9, -8, 17, 7, p.cat[0]);
    rect(ctx, -7, -10, 13, 8, p.cat[1]);
    rect(ctx, -5, -9, 7, 1, p.cat[2]);
    head(ctx, -10, -11, false, true);
    rect(ctx, 5, -5, 5, 4, p.cat[0]);
    rect(ctx, 2, -2 + tail, 8, 2, p.cat[2]);
    paw(ctx, -7, -3, 4);
  } else if (stretching) {
    if (cat.facing === 'right') ctx.scale(-1, 1);
    rect(ctx, -5, -10, 14, 6, p.cat[0]);
    rect(ctx, 2, -13, 8, 9, p.cat[1]);
    rect(ctx, 3, -13, 5, 1, p.cat[2]);
    rect(ctx, 8, -16 + tail, 3, 6, p.cat[0]);
    rect(ctx, 10, -17 + tail, 3, 2, p.cat[1]);
    paw(ctx, 6, -4, 4);
    paw(ctx, -13, -3, 8);
    head(ctx, -13, -11, false, true);
  } else if (seated) {
    const back = cat.facing === 'up' && !grooming;
    rect(ctx, -5, -11, 10, 10, p.cat[0]);
    rect(ctx, -4, -13, 8, 11, p.cat[1]);
    rect(ctx, 4, -3, 7, 2, p.cat[0]);
    rect(ctx, 9, -5 + tail, 2, 3, p.cat[2]);
    paw(ctx, -4, -3);
    paw(ctx, 1, -3);
    head(ctx, -6, -18, back, grooming, cat.facing === 'right');
    if (grooming) {
      const wash = reducedMotion ? 0 : Math.floor(time / 220) % 3;
      rect(ctx, 2, -8, 3, 4, p.cat[0]);
      paw(ctx, 2 + (wash === 1 ? 1 : 0), -11 - wash, 3);
    }
  } else if (cat.facing === 'left' || cat.facing === 'right') {
    if (cat.facing === 'left') ctx.scale(-1, 1);
    rect(ctx, -9, -11, 14, 8, p.cat[0]);
    rect(ctx, -8, -12, 12, 7, p.cat[1]);
    rect(ctx, -7, -11, 7, 1, p.cat[2]);
    rect(ctx, -12, -13 + tail, 3, 6, p.cat[0]);
    rect(ctx, -13, -15 + tail, 2, 4, p.cat[1]);
    paw(ctx, -7 + stride, -4);
    paw(ctx, -3 - stride, -5);
    paw(ctx, 3 - stride, -4);
    head(ctx, 0, -17, false, false, true);
  } else {
    const back = cat.facing === 'up';
    if (!back) {
      rect(ctx, 4, -15, 3, 8, p.cat[0]);
      rect(ctx, 6, -17 + tail, 2, 4, p.cat[1]);
    }
    rect(ctx, -5, -12, 10, 9, p.cat[0]);
    rect(ctx, -4, -11, 8, 8, p.cat[1]);
    rect(ctx, -4, -5, 3, 4, p.cat[0]);
    rect(ctx, 1, -5, 3, 4, p.cat[0]);
    paw(ctx, -4, -3 - stride);
    paw(ctx, 1, -3 + stride);
    head(ctx, -6, -18 + (walking && stride !== 0 ? 1 : 0), back, false);
    if (back) {
      rect(ctx, 3, -7, 3, 5, p.cat[0]);
      rect(ctx, 5, -4 + tail, 4, 2, p.cat[2]);
    }
  }
  ctx.restore();
}
