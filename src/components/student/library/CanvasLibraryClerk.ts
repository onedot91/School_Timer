import type { LibraryRoom, LibraryScene } from '../../../lib/canvasLibraryWorld';
import { getLibraryBookMotion, getLibraryClerkHand } from '../../../lib/canvasLibraryPose';
import { drawLibraryCarryBook } from './CanvasLibraryCharacter';
import { CANVAS_LIBRARY_PALETTE as palette } from './CanvasLibraryPalette';

type Context = CanvasRenderingContext2D;
const colors = palette.clerk;
const rect = (context: Context, x: number, y: number, width: number, height: number, color: string) => {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), width, height);
};

function greeting(scene: LibraryScene) {
  if (scene.reducedMotion || scene.clerkState?.greetingStartedAt === undefined) return 0;
  const elapsed = scene.clerkState.timeMs - scene.clerkState.greetingStartedAt;
  return elapsed >= 0 && elapsed < 1200 ? Math.round(Math.sin(elapsed / 95) * 2) + 3 : 0;
}

export function drawLibraryClerkBody(context: Context, room: LibraryRoom, scene: LibraryScene) {
  const clerk = room.desk.clerk;
  if (!clerk) return;
  const { x, y } = clerk.visualRect;
  const time = scene.reducedMotion ? 0 : scene.clerkState?.timeMs ?? 0;
  const blink = time % 4600 > 4440;
  rect(context, x + 8, y + 24, 21, 12, colors.outline);
  rect(context, x + 9, y + 25, 19, 10, colors.furLight);
  rect(context, x + 11, y + 28, 15, 8, colors.coral);
  rect(context, x + 11, y + 25, 2, 10, colors.coral);
  rect(context, x + 24, y + 25, 2, 10, colors.coral);
  rect(context, x + 15, y + 27, 7, 1, colors.outline);
  rect(context, x + 13, y + 25, 5, 2, colors.furLight);
  rect(context, x + 20, y + 25, 4, 2, colors.furLight);
  rect(context, x + 14, y + 32, 8, 3, colors.outline);
  rect(context, x + 15, y + 32, 6, 2, colors.coralLight);
  rect(context, x + 20, y + 30, 1, 3, palette.green[0]);

  rect(context, x + 8, y + 2, 21, 25, colors.outline);
  rect(context, x + 5, y + 7, 27, 16, colors.outline);
  rect(context, x + 7, y + 6, 23, 18, colors.fur);
  rect(context, x + 10, y + 4, 17, 21, colors.fur);
  rect(context, x + 9, y + 10, 19, 2, colors.furLight);
  rect(context, x + 12, y + 24, 13, 1, colors.ear);

  rect(context, x + 10, y, 17, 2, colors.outline);
  rect(context, x + 7, y + 2, 23, 4, colors.outline);
  rect(context, x + 5, y + 5, 27, 4, colors.outline);
  rect(context, x + 10, y + 1, 17, 2, colors.coralLight);
  rect(context, x + 8, y + 3, 21, 3, colors.coral);
  rect(context, x + 6, y + 6, 25, 2, colors.coral);
  for (const dx of [12, 23]) {
    rect(context, x + dx, y + 2, 1, 4, colors.furLight);
    rect(context, x + dx - 1, y + 3, 3, 2, colors.furLight);
    rect(context, x + dx, y + 3, 1, 1, colors.coral);
  }
  rect(context, x + 30, y + 5, 5, 4, colors.outline);
  rect(context, x + 31, y + 6, 3, 2, colors.coral);
  rect(context, x + 31, y + 9, 5, 3, colors.outline);
  rect(context, x + 32, y + 9, 3, 2, colors.coralLight);

  for (const dx of [1, 27]) {
    rect(context, x + dx + 2, y + 8, 5, 17, colors.outline);
    rect(context, x + dx, y + 11, 9, 11, colors.outline);
    rect(context, x + dx + 1, y + 10, 7, 12, colors.ear);
    rect(context, x + dx + 2, y + 22, 5, 2, colors.earShade);
    rect(context, x + dx + 2, y + 10, 3, 2, colors.fur);
  }
  rect(context, x + 12, y + 15, 2, blink ? 1 : 2, colors.outline);
  rect(context, x + 23, y + 15, 2, blink ? 1 : 2, colors.outline);
  rect(context, x + 17, y + 18, 4, 2, colors.outline);
  rect(context, x + 18, y + 20, 2, 2, colors.outline);
  rect(context, x + 15, y + 21, 2, 1, colors.outline);
  rect(context, x + 17, y + 22, 2, 1, colors.outline);
  rect(context, x + 20, y + 22, 2, 1, colors.outline);
  rect(context, x + 22, y + 21, 1, 1, colors.outline);
}

export function drawLibraryClerkHands(context: Context, room: LibraryRoom, scene: LibraryScene) {
  const clerk = room.desk.clerk;
  if (!clerk) return;
  const hand = getLibraryClerkHand(scene, room);
  if (!hand) return;
  const receiving = scene.action?.kind === 'receive';
  const wave = receiving ? 0 : greeting(scene);
  const sorting = !scene.reducedMotion && !wave && !receiving
    ? Math.floor((scene.clerkState?.timeMs ?? 0) / 900) % 6 === 0 ? 1 : 0 : 0;
  if (!receiving) {
    const center = { x: hand.x + sorting, y: hand.y };
    drawLibraryCarryBook(context, center, 0, undefined, { width: 10, height: 7 });
  }
  for (const direction of [-1, 1]) {
    const x = hand.x + direction * 5 + sorting;
    const y = wave && direction < 0 ? clerk.visualRect.y + 27 - wave : hand.y;
    const shoulderX = clerk.handoffPoint.x + direction * 9;
    const shoulderY = clerk.visualRect.y + 29;
    const steps = Math.ceil(Math.max(Math.abs(x - shoulderX), Math.abs(y - shoulderY)));
    for (let step = 0; step <= steps; step += 1) {
      const progress = steps === 0 ? 1 : step / steps;
      rect(context, shoulderX + (x - shoulderX) * progress - 2, shoulderY + (y - shoulderY) * progress - 1, 4, 3, colors.outline);
    }
    for (let step = 0; step <= steps; step += 1) {
      const progress = steps === 0 ? 1 : step / steps;
      rect(context, shoulderX + (x - shoulderX) * progress - 1, shoulderY + (y - shoulderY) * progress, 2, 1, colors.furLight);
    }
    rect(context, x - 3, y - 2, 6, 5, colors.outline);
    rect(context, x - 2, y - 1, 4, 3, colors.fur);
    rect(context, x - 1, y - 1, 2, 1, colors.furLight);
  }
}

export function drawLibraryClerkTransfer(context: Context, room: LibraryRoom, scene: LibraryScene) {
  if (!room.desk.clerk || scene.action?.kind !== 'receive') return;
  const motion = getLibraryBookMotion(scene, room);
  if (!motion?.visible) return;
  drawLibraryCarryBook(context, motion.center, motion.turn, scene.carriedDraft ?? undefined, motion);
}
