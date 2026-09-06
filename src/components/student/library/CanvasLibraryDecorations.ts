import type { LibraryDecoration, LibraryScene } from '../../../lib/canvasLibraryWorld';
import { CANVAS_LIBRARY_PALETTE as palette } from './CanvasLibraryPalette';

export const drawLibraryDecoration = (context: CanvasRenderingContext2D, decoration: LibraryDecoration, scene?: LibraryScene) => {
  const { x, y, width, height } = decoration.visualRect;
  const paint = (color: string, left: number, top: number, w: number, h: number) => {
    context.fillStyle = color;
    context.fillRect(Math.round(x + left), Math.round(y + top), w, h);
  };
  const oval = (color: string, left: number, top: number, w: number, h: number) => {
    for (let row = 0; row < h; row += 1) {
      const distance = (row + 0.5) / h * 2 - 1;
      const inset = Math.round(w / 2 * (1 - Math.sqrt(1 - distance * distance)));
      paint(color, left + inset, top + row, w - inset * 2, 1);
    }
  };

  if (decoration.kind === 'return-cart') {
    for (const wheelX of [8, 34]) {
      paint(palette.ink[0], wheelX, height - 6, 6, 6);
      paint(palette.stone[0], wheelX + 1, height - 5, 4, 4);
      paint(palette.stone[2], wheelX + 2, height - 4, 1, 1);
    }
    paint(palette.timber[0], 2, 7, width - 4, 36);
    paint(palette.timber[2], 4, 9, width - 8, 31);
    paint(palette.recess[0], 7, 14, width - 14, 23);
    paint(palette.recess[1], 8, 15, width - 16, 20);
    paint(palette.timber[3], 3, 8, width - 6, 2);
    paint(palette.timber[1], width - 6, 10, 3, 30);
    paint(palette.timber[0], 0, 7, 3, 20);
    paint(palette.timber[0], 0, 2, 12, 3);
    paint(palette.timber[0], 0, 2, 3, 7);
    paint(palette.timber[3], 1, 2, 10, 1);
    paint(palette.timber[0], 6, 24, width - 12, 4);
    paint(palette.timber[2], 6, 24, width - 12, 2);
    paint(palette.timber[3], 7, 24, width - 14, 1);
    for (const [left, top, w, tone] of [[10, 19, 21, 0], [13, 15, 23, 1], [11, 32, 20, 2], [15, 28, 19, 3]]) {
      paint(palette.bookSpines[tone][0], left, top, w, 4);
      paint(palette.paper[3], left + 2, top + 1, w - 3, 2);
      paint(palette.bookSpines[tone][1], left, top, w, 1);
    }
    paint(palette.timber[3], 5, 38, width - 10, 1);
    paint(palette.paper[3], 18, 6, 14, 7);
    paint(palette.green[0], 21, 8, 8, 2);
    paint(palette.green[0], 21, 7, 2, 4);
    return;
  }

  if (decoration.kind === 'wall-clock') {
    oval(palette.green[1], 1, 2, width - 1, height - 2);
    oval(palette.timber[0], 0, 0, width - 1, height - 1);
    oval(palette.timber[2], 1, 1, width - 3, height - 3);
    oval(palette.paper[3], 3, 3, width - 7, height - 7);
    for (const [left, top, w, h] of [[12, 4, 1, 3], [12, 19, 1, 2], [4, 12, 3, 1], [19, 12, 2, 1]]) paint(palette.timber[0], left, top, w, h);
    return;
  }

  if (decoration.kind === 'cat-bed') {
    oval(palette.paper[0], 0, 2, width, height - 2);
    oval(palette.timber[1], 0, 0, width, height - 3);
    oval(palette.timber[3], 1, 1, width - 2, height - 5);
    oval(palette.timber[0], 4, 3, width - 8, height - 8);
    oval(palette.bookCoral[0], 6, 4, width - 12, height - 10);
    oval(palette.bookCoral[1], 8, 5, width - 16, height - 13);
    paint(palette.timber[2], 5, height - 7, width - 10, 4);
    paint(palette.timber[3], 6, height - 7, width - 12, 1);
    for (let left = 7; left < width - 6; left += 5) paint(palette.timber[1], left, height - 5, 2, 2);
    return;
  }

  if (decoration.kind === 'globe') {
    paint(palette.timber[0], 7, 24, 15, 3);
    paint(palette.timber[2], 8, 24, 12, 1);
    paint(palette.timber[1], 13, 19, 3, 5);
    oval(palette.paper[0], 1, 0, 23, 23);
    oval(palette.paper[3], 3, 1, 19, 19);
    oval(palette.ink[1], 4, 2, 17, 18);
    oval(palette.bookBlue[0], 5, 3, 15, 16);
    oval(palette.bookBlue[1], 6, 4, 12, 12);
    paint(palette.green[1], 7, 5, 5, 4);
    paint(palette.green[1], 10, 8, 4, 3);
    paint(palette.green[1], 12, 11, 3, 5);
    paint(palette.green[2], 8, 5, 4, 2);
    paint(palette.green[2], 16, 8, 3, 4);
    paint(palette.paper[0], 16, 1, 3, 2);
    paint(palette.paper[0], 7, 18, 3, 3);
    return;
  }

  if (decoration.kind === 'tall-plant') {
    paint(palette.timber[0], 17, 12, 3, 33);
    paint(palette.timber[1], 17, 12, 1, 33);
    for (const [left, top, direction] of [[3, 9, 1], [20, 3, -1], [0, 25, 1], [21, 21, -1]]) {
      oval(palette.green[0], left, top, 15, 11);
      oval(palette.green[1], left + 1, top, 12, 8);
      paint(palette.green[2], left + 3, top + 2, 6, 2);
      for (let step = 0; step < 7; step += 1) paint(palette.green[0], direction === 1 ? left + 10 + step : left + 3 - step, top + 6 + step, 2, 2);
    }
    paint(palette.timber[0], 7, 40, 22, 4);
    paint(palette.timber[0], 9, 44, 18, 11);
    paint(palette.timber[0], 11, 55, 14, 2);
    paint(palette.paper[2], 8, 41, 20, 2);
    paint(palette.paper[1], 10, 44, 16, 10);
    paint(palette.paper[3], 11, 44, 3, 8);
    paint(palette.paper[0], 24, 44, 2, 10);
    paint(palette.timber[1], 11, 55, 14, 1);
    if (scene?.ambientState?.wateredPlantIds.includes(decoration.id)) {
      oval(palette.green[0], 12, 0, 10, 8);
      oval(palette.green[2], 13, 0, 8, 6);
      paint(palette.green[3], 15, 1, 3, 2);
    }
    return;
  }


};

export const getLibraryClockHands = (timestamp: number) => {
  const now = new Date(timestamp + 9 * 60 * 60 * 1000);
  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  return { hour: (hour % 12 + minute / 60) * Math.PI / 6 - Math.PI / 2,
    minute: minute * Math.PI / 30 - Math.PI / 2,
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
};

export const drawLibraryClockHands = (context: CanvasRenderingContext2D, decoration: LibraryDecoration, timestamp: number) => {
  const hands = getLibraryClockHands(timestamp);
  const center = { x: decoration.visualRect.x + 12, y: decoration.visualRect.y + 12 };
  context.save();
  context.fillStyle = palette.ink[0];
  for (const [angle, length] of [[hands.hour, 5], [hands.minute, 8]]) {
    for (let step = 0; step <= length * 2; step += 1) {
      context.fillRect(Math.round(center.x + Math.cos(angle) * step / 2), Math.round(center.y + Math.sin(angle) * step / 2), 1, 1);
    }
  }
  context.fillStyle = palette.timber[1];
  context.fillRect(center.x, center.y, 2, 2);
  context.restore();
};
