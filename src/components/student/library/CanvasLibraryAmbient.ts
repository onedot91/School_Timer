import type { LibraryAmbientObject, LibraryPoint, LibraryRoom, LibraryScene } from '../../../lib/canvasLibraryWorld';
import { getLibraryAmbientProgress, getLibraryBearPose, getLibraryTeaPositions } from '../../../lib/canvasLibraryPose';
import { drawLibraryInteractionHand } from './CanvasLibraryCharacter';
import { drawLibraryCat } from './CanvasLibraryCat';
import { CANVAS_LIBRARY_PALETTE as p } from './CanvasLibraryPalette';

type Context = CanvasRenderingContext2D;
const rect = (ctx: Context, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
};
const ease = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };
const mix = (a: LibraryPoint, b: LibraryPoint, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function drawLibraryAmbientLight(ctx: Context, room: LibraryRoom, scene: LibraryScene) {
  if (scene.ambientState?.lampOn === false) return;
  const lamp = room.ambientObjects?.find(object => object.kind === 'lamp')?.visualRect ?? room.readingArea.lampRect;
  ctx.save();
  for (let ring = 3; ring >= 0; ring -= 1) {
    ctx.globalAlpha = 0.07 + (3 - ring) * 0.035;
    rect(ctx, lamp.x - 17 - ring * 5, lamp.y + lamp.height - 4 - ring * 2, lamp.width + 34 + ring * 10, 5 + ring * 4, p.paper[3]);
  }
  ctx.restore();
}

function cup(ctx: Context, center: LibraryPoint, full: boolean) {
  rect(ctx, center.x - 4, center.y - 3, 8, 6, p.timber[0]);
  rect(ctx, center.x - 3, center.y - 2, 6, 5, p.paper[3]);
  rect(ctx, center.x + 4, center.y - 2, 3, 4, p.timber[0]);
  rect(ctx, center.x + 4, center.y - 1, 2, 2, p.paper[3]);
  rect(ctx, center.x - 2, center.y - 2, 4, 2, full ? p.timber[1] : p.paper[1]);
  rect(ctx, center.x - 3, center.y + 2, 6, 1, p.paper[1]);
}

function pot(ctx: Context, center: LibraryPoint, pouring: boolean, direction: number) {
  ctx.save();
  ctx.translate(Math.round(center.x), Math.round(center.y));
  ctx.scale(-direction, 1);
  const x = 0;
  const y = 0;
  rect(ctx, x - 5, y - 3, 10, 9, p.green[0]);
  rect(ctx, x - 6, y - 1, 12, 5, p.green[0]);
  rect(ctx, x - 4, y - 2, 8, 7, p.green[2]);
  rect(ctx, x - 3, y - 2, 6, 1, p.green[3]);
  rect(ctx, x - 4, y - 4, 8, 2, p.green[0]);
  rect(ctx, x - 1, y - 6, 2, 2, p.green[0]);
  rect(ctx, x + 5, y - 2, 4, 6, p.green[0]);
  rect(ctx, x + 6, y - 1, 2, 4, p.paper[2]);
  rect(ctx, x - 8, y - (pouring ? 0 : 2), 3, 3, p.green[0]);
  rect(ctx, x - 9, y - (pouring ? -1 : 4), 2, 3, p.green[2]);
  ctx.restore();
}

export function drawLibraryAmbientObject(ctx: Context, object: LibraryAmbientObject, scene: LibraryScene, room: LibraryRoom) {
  const { width, height } = object.visualRect;
  const x = object.visualRect.x + (object.kind === 'plant' ? 2 : 0);
  const y = object.visualRect.y + (object.kind === 'plant' ? 2 : 0);
  const active = scene.ambientAction?.objectId === object.id;
  const progress = active ? getLibraryAmbientProgress(scene) : null;
  const state = scene.ambientState;
  if (object.kind === 'plant') {
    const sway = progress !== null && (scene.ambientAction?.kind === 'water' || scene.ambientAction?.kind === 'leaves') ? Math.round(Math.sin(progress * Math.PI * 4)) : 0;
    rect(ctx, x + 5, y, 3, 16, p.green[0]);
    rect(ctx, x + sway, y + 3, 7, 4, p.green[0]);
    rect(ctx, x + 8 - sway, y + 5, 7, 4, p.green[0]);
    rect(ctx, x + 2 + sway, y + 3, 4, 2, p.green[3]);
    rect(ctx, x + 9 - sway, y + 5, 4, 2, p.green[3]);
    if (state?.wateredPlantIds.includes(object.id)) {
      rect(ctx, x + 8, y - 2, 5, 3, p.green[0]);
      rect(ctx, x + 8, y - 2, 4, 1, p.green[3]);
      rect(ctx, x + 7, y, 2, 2, p.green[1]);
    }
    rect(ctx, x + 2, y + 15, 11, 5, p.lavender[0]);
    rect(ctx, x + 3, y + 15, 9, 2, p.lavender[1]);
    rect(ctx, x - 2, y + 20, 19, 3, p.timber[0]);
    rect(ctx, x, y + 23, 3, 4, p.timber[0]);
    rect(ctx, x + 12, y + 23, 3, 4, p.timber[0]);
    rect(ctx, x - 2, y + 20, 19, 1, p.timber[3]);
  } else if (object.kind === 'cat') {
    if (scene.catState) {
      drawLibraryCat(ctx, scene.catState, Boolean(scene.reducedMotion));
      return;
    }
    const reaction = state?.catReactions ?? 0;
    const petting = progress !== null;
    const stretch = reaction === 2 || (petting && reaction === 1 && progress > 0.3);
    const awake = reaction === 1 || (petting && reaction === 0);
    const tail = !scene.reducedMotion && reaction >= 3 ? Math.round(Math.sin(scene.timeMs / 600)) : 0;
    const bodyWidth = stretch ? width + 3 : width - 3;
    const headY = y + (awake ? -3 : stretch ? 2 : 1);
    ctx.save(); ctx.globalAlpha = 0.2;
    rect(ctx, x + 1, y + height - 1, width + 2, 3, p.green[0]); ctx.restore();
    rect(ctx, x + 7, y + 3, bodyWidth - 5, 9, p.cat[0]);
    rect(ctx, x + 8, y + 2, bodyWidth - 8, 9, p.cat[1]);
    rect(ctx, x + 9, y + 3, 7, 2, p.cat[2]);
    rect(ctx, x + bodyWidth, y + 5 + tail, 5, 3, p.cat[0]);
    rect(ctx, x + bodyWidth + 3, y + 2 + tail, 2, 5, p.cat[1]);
    rect(ctx, x + 1, headY - 1, 3, 5, p.cat[0]);
    rect(ctx, x + 8, headY - 1, 3, 5, p.cat[0]);
    rect(ctx, x, headY + 3, 12, 7, p.cat[0]);
    rect(ctx, x + 1, headY + 2, 10, 7, p.cat[1]);
    rect(ctx, x + 2, headY + 1, 2, 2, p.bookCoral[1]);
    rect(ctx, x + 8, headY + 1, 2, 2, p.bookCoral[1]);
    rect(ctx, x + 3, headY + 5, awake ? 1 : 2, 1, p.catEyes);
    rect(ctx, x + 8, headY + 5, awake ? 1 : 2, 1, p.catEyes);
    rect(ctx, x + 6, headY + 7, 1, 1, p.bookCoral[0]);
    rect(ctx, x + (stretch ? -2 : 3), y + 11, stretch ? 8 : 5, 2, p.cat[2]);
    rect(ctx, x + 13, y + 11, stretch ? 9 : 5, 2, p.cat[2]);
  } else if (object.kind === 'tea') {
    const positions = getLibraryTeaPositions(object);
    const pouring = progress !== null && scene.ambientAction?.kind === 'pour';
    const drinking = progress !== null && scene.ambientAction?.kind === 'drink';
    rect(ctx, x, y + height - 1, width, 1, p.timber[1]);
    rect(ctx, positions.cup.x - 5, positions.cup.y + 3, 11, 2, p.paper[1]);
    if (!pouring) pot(ctx, positions.pot, false, positions.direction);
    if (!drinking) cup(ctx, positions.cup, Boolean(state?.teaFull) || (pouring && progress > 0.6));
    if (pouring) drawTeaInMotion(ctx, object, scene, room, true);
  }
}

function drawTeaInMotion(ctx: Context, object: LibraryAmbientObject, scene: LibraryScene, room: LibraryRoom, tableLayer: boolean) {
  const progress = getLibraryAmbientProgress(scene);
  if (progress === null) return;
  const positions = getLibraryTeaPositions(object);
  const pose = getLibraryBearPose(scene, room);
  const kind = scene.ambientAction?.kind;
  if (kind === 'pour' && tableLayer) {
    const amount = progress < 0.25 ? ease(progress / 0.25) : progress > 0.8 ? 1 - ease((progress - 0.8) / 0.2) : 1;
    const point = { x: pose.hand.x + positions.direction * 7, y: pose.hand.y - 2 };
    pot(ctx, point, amount > 0.9, positions.direction);
    if (progress > 0.3 && progress < 0.75) {
      rect(ctx, point.x + positions.direction * 8, point.y + 3, 1, 3, p.timber[2]);
      rect(ctx, point.x + positions.direction * 8, point.y + 6, 1, 3, p.timber[2]);
      rect(ctx, positions.cup.x - 2, positions.cup.y - 3, 1, 2, p.timber[2]);
    }
  } else if (kind === 'drink' && !tableLayer) {
    cup(ctx, pose.hand, progress < 0.65);
  }
}

export function drawLibraryAmbientTool(ctx: Context, room: LibraryRoom, scene: LibraryScene) {
  const action = scene.ambientAction;
  const progress = getLibraryAmbientProgress(scene);
  const object = room.ambientObjects?.find(object => object.id === action?.objectId);
  if (!action || progress === null || !object) return;
  const pose = getLibraryBearPose(scene, room);
  const hand = pose.hand;
  if (object.kind === 'tea') drawLibraryInteractionHand(ctx, pose);
  if (action.kind === 'water') {
    const target = object.actionPoint ?? object.interactionPoint;
    const direction = target.x < hand.x ? -1 : 1;
    ctx.save();
    ctx.translate(Math.round(hand.x),Math.round(hand.y));
    ctx.scale(direction,1);
    rect(ctx, -6, -2, 10, 8, p.ink[0]);
    rect(ctx, -5, -1, 8, 6, p.bookBlue[0]);
    rect(ctx, -4, 0, 6, 1, p.bookBlue[1]);
    rect(ctx, -8, -2, 3, 6, p.ink[0]);
    rect(ctx, -8, -1, 2, 4, p.paper[3]);
    rect(ctx, 3, -10, 3, 9, p.ink[0]);
    rect(ctx, 5, -12, 5, 3, p.bookBlue[1]);
    ctx.restore();
    if (progress > 0.2 && progress < 0.85) {
      for (let index = 0; index < 3; index += 1) {
        const t = (progress * 3 + index / 3) % 1;
        const drop = mix({ x: hand.x + direction * 9, y: hand.y - 11 }, target, t);
        rect(ctx, drop.x, drop.y - Math.sin(t * Math.PI) * 4, 1, 2, p.bookBlue[1]);
      }
    }
  } else if (action.kind === 'drink') drawTeaInMotion(ctx, object, scene, room, false);
}
