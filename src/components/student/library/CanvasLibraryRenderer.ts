import type {
  LibraryPlacedBook,
  LibraryPoint,
  LibraryRect,
  LibraryRoom,
  LibraryScene,
  LibraryShelf,
} from '../../../lib/canvasLibraryWorld';
import { resolveLibraryBookRoom } from '../../../lib/canvasLibraryWorld';
import { CANVAS_LIBRARY_PALETTE as palette } from './CanvasLibraryPalette';
import { resolveLibraryCatRoom } from '../../../lib/canvasLibraryCat';
import { drawLibraryAmbientLight, drawLibraryAmbientObject, drawLibraryAmbientTool } from './CanvasLibraryAmbient';
import { drawCompetitionBoard } from './CanvasLibraryCompetitionBoard';
import { drawLibraryCharacter, drawLibraryCarryBook, drawLibraryBookSpine } from './CanvasLibraryCharacter';
import { drawLibraryClerkBody, drawLibraryClerkHands, drawLibraryClerkTransfer } from './CanvasLibraryClerk';
import { getLibraryActionProgress, getLibraryBearPose, getLibraryBookMotion, getLibraryPlacedBookRect, LIBRARY_BEAR_BOUNDS } from '../../../lib/canvasLibraryPose';

const LOGICAL_WIDTH = 624;
const LOGICAL_HEIGHT = 376;

type DrawContext = CanvasRenderingContext2D;

type DepthEntity = {
  id: string;
  floorY: number;
  shadow: (context: DrawContext) => void;
  body: (context: DrawContext) => void;
};

const pixel = (value: number) => Math.round(value);

const fillRect = (
  context: DrawContext,
  rect: LibraryRect,
  color: string,
) => {
  context.fillStyle = color;
  context.fillRect(
    pixel(rect.x),
    pixel(rect.y),
    Math.max(1, pixel(rect.width)),
    Math.max(1, pixel(rect.height)),
  );
};

const insetRect = (rect: LibraryRect, amount: number): LibraryRect => ({
  x: rect.x + amount,
  y: rect.y + amount,
  width: Math.max(1, rect.width - amount * 2),
  height: Math.max(1, rect.height - amount * 2),
});

const drawPixelLine = (
  context: DrawContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
) => {
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(pixel(x1) + 0.5, pixel(y1) + 0.5);
  context.lineTo(pixel(x2) + 0.5, pixel(y2) + 0.5);
  context.stroke();
};

const coordinateNoise = (x: number, y: number) => {
  let value = Math.imul(x + 71, 0x45d9f3b) ^ Math.imul(y + 37, 0x119de1f3);
  value ^= value >>> 16;
  return value >>> 0;
};

const drawSteppedLine = (
  context: DrawContext,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color: string,
) => {
  let x = pixel(startX);
  let y = pixel(startY);
  const targetX = pixel(endX);
  const targetY = pixel(endY);
  const deltaX = Math.abs(targetX - x);
  const deltaY = Math.abs(targetY - y);
  const stepX = x < targetX ? 1 : -1;
  const stepY = y < targetY ? 1 : -1;
  let error = deltaX - deltaY;
  context.fillStyle = color;
  while (true) {
    context.fillRect(x, y, 1, 1);
    if (x === targetX && y === targetY) break;
    const twiceError = error * 2;
    if (twiceError > -deltaY) {
      error -= deltaY;
      x += stepX;
    }
    if (twiceError < deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
};

const drawRoomBase = (context: DrawContext, room: LibraryRoom) => {
  context.fillStyle = palette.ink[0];
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const { bounds, walkableBounds } = room;
  fillRect(context, bounds, palette.stone[0]);
  fillRect(context, insetRect(bounds, 3), palette.stone[1]);

  fillRect(context, walkableBounds, palette.paper[2]);

  const tileWidth = 56;
  const tileHeight = 14;
  const startX = pixel(walkableBounds.x);
  const startY = pixel(walkableBounds.y);
  const endX = pixel(walkableBounds.x + walkableBounds.width);
  const endY = pixel(walkableBounds.y + walkableBounds.height);
  context.save();
  context.globalAlpha = 0.18;
  for (let row = 0, y = startY; y < endY; row += 1, y += tileHeight) {
    const offset = row % 2 === 0 ? 0 : -tileWidth / 2;
    for (let x = startX + offset; x < endX; x += tileWidth) {
      const seed = coordinateNoise(Math.floor(x / tileWidth), row);
      const left = Math.max(startX, x);
      const right = Math.min(endX, x + tileWidth);
      context.fillStyle = palette.paper[0];
      context.fillRect(left, Math.min(endY - 1, y + tileHeight - 1), Math.max(1, right - left - 1), 1);
      context.fillRect(Math.max(left, right - 1), y + 2, 1, Math.min(tileHeight - 3, endY - y - 2));
      if (seed % 4 === 0) {
        context.globalAlpha = 0.28;
        context.fillStyle = palette.paper[3];
        context.fillRect(left + 4, y + 2, Math.max(2, Math.min(12, right - left - 7)), 1);
        context.globalAlpha = 0.18;
      }
      context.fillStyle = palette.paper[1];
      if (seed % 7 === 0) context.fillRect(left + 13 + (seed % 17), y + 7, 7, 1);
      if (seed % 13 === 0) context.fillRect(left + 7, y + 5, 2, 2);
    }
  }
  context.restore();

  const upperWall: LibraryRect = {
    x: bounds.x + 3,
    y: bounds.y + 3,
    width: bounds.width - 6,
    height: Math.max(10, walkableBounds.y - bounds.y - 3),
  };
  fillRect(context, upperWall, palette.green[2]);
  context.fillStyle = palette.green[3];
  context.fillRect(pixel(upperWall.x), pixel(upperWall.y), pixel(upperWall.width), 3);
  context.fillStyle = palette.green[1];
  context.fillRect(pixel(upperWall.x), pixel(upperWall.y + 6), pixel(upperWall.width), 2);
  const wainscotTop = pixel(Math.max(upperWall.y + 14, walkableBounds.y - 48));
  const wainscotBottom = pixel(walkableBounds.y - 10);
  for (let x = pixel(upperWall.x + 12); x < upperWall.x + upperWall.width - 10; x += 62) {
    const panelWidth = Math.min(51, pixel(upperWall.x + upperWall.width - x - 3));
    context.fillStyle = palette.green[1];
    context.fillRect(x, wainscotTop, panelWidth, Math.max(4, wainscotBottom - wainscotTop));
    context.fillStyle = palette.green[3];
    context.fillRect(x + 2, wainscotTop + 2, Math.max(2, panelWidth - 4), 1);
    context.fillRect(x + 2, wainscotTop + 2, 1, Math.max(2, wainscotBottom - wainscotTop - 4));
    context.fillStyle = palette.green[0];
    context.fillRect(x + 2, wainscotBottom - 2, Math.max(2, panelWidth - 3), 2);
  }
  context.fillStyle = palette.green[0];
  context.fillRect(pixel(upperWall.x), pixel(walkableBounds.y - 10), pixel(upperWall.width), 10);
  context.fillStyle = palette.timber[2];
  context.fillRect(pixel(upperWall.x + 2), pixel(walkableBounds.y - 10), pixel(upperWall.width - 4), 3);
  context.fillStyle = palette.timber[3];
  context.fillRect(pixel(upperWall.x + 2), pixel(walkableBounds.y - 10), pixel(upperWall.width - 4), 1);
  context.fillStyle = palette.timber[1];
  context.fillRect(pixel(upperWall.x + 2), pixel(walkableBounds.y - 5), pixel(upperWall.width - 4), 3);
  for (let x = 28; x < LOGICAL_WIDTH - 20; x += 96) {
    context.fillStyle = palette.green[1];
    context.fillRect(x, pixel(upperWall.y + 8), 5, Math.max(2, wainscotBottom - pixel(upperWall.y + 8)));
    context.fillStyle = palette.green[3];
    context.fillRect(x, pixel(upperWall.y + 8), 2, Math.max(2, wainscotBottom - pixel(upperWall.y + 9)));
  }

  const sideTop = pixel(walkableBounds.y - 10);
  const sideHeight = endY - sideTop;
  const leftWallX = pixel(bounds.x + 3);
  const rightWallX = endX;
  const sideWidth = Math.max(3, startX - leftWallX);
  for (const wallX of [leftWallX, rightWallX]) {
    context.fillStyle = palette.green[1];
    context.fillRect(wallX, sideTop, sideWidth, sideHeight);
    context.fillStyle = palette.green[0];
    context.fillRect(wallX, sideTop, 2, sideHeight);
    context.fillStyle = palette.green[2];
    context.fillRect(wallX + 2, sideTop, Math.max(1, sideWidth - 4), sideHeight);
  }
  context.fillStyle = palette.green[3];
  context.fillRect(startX - 2, sideTop, 2, sideHeight);
  context.fillRect(endX, sideTop, 2, sideHeight);
  context.fillStyle = palette.timber[0];
  context.fillRect(startX - 1, endY - 3, endX - startX + 2, 3);
  context.fillStyle = palette.timber[2];
  context.fillRect(startX, endY - 3, endX - startX, 1);

  if (room.exit) {
    const door = room.exit.visualRect;
    fillRect(context, { x: door.x, y: door.y + door.height - 3, width: door.width, height: 3 }, palette.timber[0]);
    fillRect(context, { x: door.x + 2, y: door.y + door.height - 3, width: door.width - 4, height: 1 }, palette.timber[3]);
  } else {
    const thresholdY = pixel(bounds.y + bounds.height - 13);
    context.fillStyle = palette.timber[0];
    context.fillRect(pixel(room.spawn.x - 20), thresholdY, 40, 3);
    context.fillStyle = palette.timber[2];
    context.fillRect(pixel(room.spawn.x - 18), thresholdY, 36, 2);
  }
};

const drawEntranceForeground = (context: DrawContext, room: LibraryRoom) => {
  if (!room.exit) return;
  const { x, y, width, height } = room.exit.visualRect;
  const doorX = pixel(x);
  const doorY = pixel(y);
  const doorWidth = pixel(width);
  const doorHeight = pixel(height);
  context.fillStyle = palette.timber[0];
  context.fillRect(doorX, doorY, doorWidth, doorHeight);
  context.fillStyle = palette.timber[3];
  context.fillRect(doorX + 1, doorY + 1, doorWidth - 2, 2);
  context.fillRect(doorX + 1, doorY + 3, 2, doorHeight - 4);
  context.fillStyle = palette.timber[1];
  context.fillRect(doorX + doorWidth - 3, doorY + 3, 2, doorHeight - 4);
  context.fillStyle = palette.ink[0];
  context.fillRect(doorX + 4, doorY + 4, doorWidth - 8, doorHeight - 7);
  context.fillStyle = palette.timber[2];
  context.fillRect(doorX + 5, doorY + 5, doorWidth - 11, doorHeight - 9);
  for (const panelY of [doorY + 8, doorY + 25]) {
    context.fillStyle = palette.timber[0];
    context.fillRect(doorX + 9, panelY, doorWidth - 20, 12);
    context.fillStyle = palette.timber[1];
    context.fillRect(doorX + 10, panelY + 1, doorWidth - 22, 10);
    context.fillStyle = palette.timber[3];
    context.fillRect(doorX + 9, panelY + 12, doorWidth - 20, 1);
  }
  context.fillStyle = palette.timber[0];
  context.fillRect(doorX + doorWidth - 12, doorY + 20, 5, 6);
  context.fillStyle = palette.paper[0];
  context.fillRect(doorX + doorWidth - 11, doorY + 20, 3, 6);
  context.fillStyle = palette.paper[1];
  context.fillRect(doorX + doorWidth - 12, doorY + 21, 5, 3);
  context.fillStyle = palette.paper[3];
  context.fillRect(doorX + doorWidth - 12, doorY + 21, 2, 1);
  context.fillStyle = palette.stone[0];
  context.fillRect(doorX + 4, doorY + 10, 2, 4);
  context.fillRect(doorX + 4, doorY + 31, 2, 4);
  context.clearRect(doorX, doorY + doorHeight - 3, doorWidth, 3);
};

const drawMotivatedLight = (context: DrawContext, room: LibraryRoom) => {
  const windowRect = room.readingArea.windowRect;
  context.save();
  context.globalAlpha = 0.28;
  context.fillStyle = palette.paper[3];
  const beamTop = pixel(room.walkableBounds.y + 1);
  const beamLeft = pixel(windowRect.x - 8);
  for (let row = 0; row < 6; row += 1) {
    context.fillRect(beamLeft - row * 13, beamTop + row * 14, pixel(windowRect.width + row * 7), 10);
  }
  context.restore();
};

const drawEntryRug = (context: DrawContext, room: LibraryRoom) => {
  if (room.exit) return;
  if (room.failureBoard) {
    drawRug(context, {
      x: room.spawn.x - 34,
      y: room.walkableBounds.y + room.walkableBounds.height - 20,
      width: 68,
      height: 20,
    });
    return;
  }
  const width = 68;
  const height = 62;
  const x = pixel(room.spawn.x - width / 2);
  const y = pixel(room.spawn.y - height / 2 - 10);
  context.fillStyle = palette.green[0];
  context.fillRect(x + 3, y, width - 6, height);
  context.fillRect(x, y + 3, width, height - 6);
  context.fillStyle = palette.green[2];
  context.fillRect(x + 4, y + 3, width - 8, height - 7);
  context.fillStyle = palette.green[1];
  context.fillRect(x + 8, y + 7, width - 16, height - 15);
  context.fillStyle = palette.green[3];
  context.fillRect(x + 11, y + 10, width - 22, 2);
  context.fillRect(x + 11, y + 10, 2, height - 23);
  context.fillStyle = palette.paper[1];
  context.fillRect(x + width / 2 - 1, y + 18, 3, 18);
  context.fillRect(x + width / 2 - 8, y + 25, 17, 3);
  context.fillStyle = palette.green[0];
  for (let fringeX = x + 6; fringeX < x + width - 5; fringeX += 5) {
    context.fillRect(fringeX, y + height, 2, 2);
  }
};

const drawWindow = (context: DrawContext, rect: LibraryRect) => {
  fillRect(context, rect, palette.ink[0]);
  fillRect(context, insetRect(rect, 2), palette.timber[1]);
  const pane = insetRect(rect, 4);
  fillRect(context, pane, palette.bookBlue[1]);
  context.fillStyle = palette.paper[3];
  context.fillRect(pixel(pane.x + 6), pixel(pane.y + 5), 5, 5);
  context.fillRect(pixel(pane.x + 5), pixel(pane.y + 6), 7, 3);
  context.fillStyle = palette.bookBlue[0];
  context.fillRect(pixel(pane.x), pixel(pane.y + pane.height - 8), pixel(pane.width), 8);
  context.fillStyle = palette.green[0];
  context.fillRect(pixel(pane.x), pixel(pane.y + pane.height - 5), pixel(pane.width), 5);
  context.fillRect(pixel(pane.x + 4), pixel(pane.y + pane.height - 9), 9, 4);
  context.fillRect(pixel(pane.x + 18), pixel(pane.y + pane.height - 7), 12, 2);
  context.fillRect(pixel(pane.x + pane.width - 17), pixel(pane.y + pane.height - 10), 12, 5);
  context.fillStyle = palette.green[2];
  context.fillRect(pixel(pane.x + 7), pixel(pane.y + pane.height - 8), 3, 3);
  context.fillRect(pixel(pane.x + pane.width - 14), pixel(pane.y + pane.height - 9), 4, 3);
  drawPixelLine(context, pane.x + pane.width / 2, pane.y, pane.x + pane.width / 2, pane.y + pane.height, palette.ink[1]);
  drawPixelLine(context, pane.x, pane.y + pane.height / 2, pane.x + pane.width, pane.y + pane.height / 2, palette.ink[1]);
  context.fillStyle = palette.timber[3];
  context.fillRect(pixel(rect.x - 2), pixel(rect.y + rect.height), pixel(rect.width + 4), 2);
  context.fillStyle = palette.timber[0];
  context.fillRect(pixel(rect.x), pixel(rect.y + rect.height + 2), pixel(rect.width + 2), 1);
};

const drawRug = (context: DrawContext, rect: LibraryRect) => {
  fillRect(context, rect, palette.green[0]);
  fillRect(context, insetRect(rect, 2), palette.green[2]);
  const inner = insetRect(rect, 5);
  fillRect(context, inner, palette.green[1]);
  context.fillStyle = palette.green[3];
  for (let x = pixel(inner.x + 3); x < inner.x + inner.width - 2; x += 8) {
    context.fillRect(x, pixel(inner.y + 2), 3, 1);
    context.fillRect(x + 3, pixel(inner.y + inner.height - 3), 3, 1);
  }
  for (let y = pixel(inner.y + 13); y < inner.y + inner.height - 12; y += 18) {
    drawSteppedLine(context, inner.x + 4, y + 4, inner.x + 10, y, palette.green[3]);
    drawSteppedLine(context, inner.x + 10, y, inner.x + 16, y + 4, palette.green[3]);
    drawSteppedLine(context, inner.x + inner.width - 16, y + 4, inner.x + inner.width - 10, y, palette.green[3]);
    drawSteppedLine(context, inner.x + inner.width - 10, y, inner.x + inner.width - 4, y + 4, palette.green[3]);
  }
  context.fillStyle = palette.green[0];
  for (let x = pixel(rect.x + 2); x < rect.x + rect.width - 1; x += 4) {
    context.fillRect(x, pixel(rect.y + rect.height), 2, 2);
  }
};

const drawLamp = (context: DrawContext, rect: LibraryRect, on = true, switchPoint?: LibraryPoint) => {
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = Math.max(8, pixel(rect.width));
  const height = Math.max(12, pixel(rect.height));
  context.fillStyle = palette.paper[0];
  context.fillRect(x - 6, y + height - 2, width + 12, 2);
  context.fillRect(x - 2, y + height - 4, width + 4, 1);
  context.fillStyle = on ? palette.paper[1] : palette.stone[1];
  context.fillRect(x + 2, y + 2, width - 4, 4);
  context.fillStyle = on ? palette.paper[3] : palette.paper[0];
  context.fillRect(x + 4, y, width - 8, 2);
  context.fillStyle = palette.paper[0];
  context.fillRect(x, y + 6, width, 2);
  context.fillStyle = palette.timber[1];
  context.fillRect(x + Math.floor(width / 2) - 1, y + 8, 2, height - 10);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + Math.floor(width / 2) - 4, y + height - 2, 8, 2);
  if (switchPoint) {
    fillRect(context, { x: switchPoint.x - 1, y: switchPoint.y - 2, width: 3, height: 5 }, palette.timber[0]);
    fillRect(context, { x: switchPoint.x - 1, y: switchPoint.y - 1, width: 2, height: 3 }, palette.paper[1]);
    fillRect(context, { x: switchPoint.x - 1, y: switchPoint.y - 1, width: 1, height: 1 }, palette.paper[3]);
  }
};

const drawFailureBoard = (context: DrawContext, rect: LibraryRect) => {
  const { x, y, width, height } = rect;
  fillRect(context, { x: x + 1, y: y + 1, width, height }, palette.green[0]);
  fillRect(context, rect, palette.timber[0]);
  fillRect(context, insetRect(rect, 1), palette.timber[2]);
  fillRect(context, { x: x + 2, y: y + 2, width: width - 4, height: 1 }, palette.timber[3]);
  fillRect(context, { x: x + 2, y: y + 3, width: 1, height: height - 5 }, palette.timber[3]);
  const cork = insetRect(rect, 4);
  fillRect(context, cork, palette.timber[1]);
  context.save();
  context.globalAlpha = 0.16;
  for (let cy = cork.y + 2; cy < cork.y + cork.height - 1; cy += 3) {
    for (let cx = cork.x + 2; cx < cork.x + cork.width - 1; cx += 3) {
      const noise = coordinateNoise(cx, cy);
      if (noise % 3 !== 0) continue;
      context.fillStyle = noise % 2 === 0 ? palette.timber[3] : palette.timber[0];
      context.fillRect(pixel(cx + noise % 2), pixel(cy), 1, 1);
    }
  }
  context.restore();
};

const drawFailureBoardNotes = (context: DrawContext, rect: LibraryRect, rawCount: number | undefined) => {
  const count = Math.min(24, Math.max(0, Math.floor(rawCount ?? 0)));
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const columns = 8;
  const rows = 3;
  const horizontalPadding = Math.max(7, Math.floor(rect.width * 0.07));
  const topPadding = Math.max(10, Math.floor(rect.height * 0.17));
  const bottomPadding = Math.max(7, Math.floor(rect.height * 0.1));
  const cellWidth = Math.max(7, Math.floor((rect.width - horizontalPadding * 2) / columns));
  const cellHeight = Math.max(9, Math.floor((rect.height - topPadding - bottomPadding) / rows));
  const paperWidth = Math.max(5, cellWidth - Math.max(2, Math.floor(cellWidth * 0.2)));
  const paperHeight = Math.max(7, cellHeight - Math.max(2, Math.floor(cellHeight * 0.18)));
  const colors = [palette.bookCoral[0], palette.bookBlue[0], palette.bookSage[0]];
  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const paperX = x + horizontalPadding + column * cellWidth;
    const paperY = y + topPadding + row * cellHeight + (column % 2);
    context.fillStyle = palette.paper[2];
    context.fillRect(paperX, paperY, paperWidth, paperHeight);
    context.fillStyle = palette.paper[3];
    context.fillRect(paperX + 1, paperY + 1, Math.max(3, paperWidth - 2), Math.max(4, paperHeight - 3));
    context.fillStyle = palette.ink[1];
    context.fillRect(paperX + 2, paperY + Math.floor(paperHeight * 0.42), Math.max(2, paperWidth - 4), 1);
    context.fillRect(paperX + 2, paperY + Math.floor(paperHeight * 0.67), Math.max(2, paperWidth - 6), 1);
    context.fillStyle = colors[index % colors.length];
    context.fillRect(paperX + Math.floor(paperWidth * 0.35), paperY - 1, Math.max(2, Math.floor(paperWidth * 0.3)), 2);
  }
};

const drawStaticRoom = (context: DrawContext, room: LibraryRoom) => {
  drawRoomBase(context, room);
  drawMotivatedLight(context, room);
  drawWindow(context, room.readingArea.windowRect);
  drawEntryRug(context, room);
  drawRug(context, room.readingArea.rug);
  if (room.failureBoard) {
    drawFailureBoard(context, room.failureBoard.visualRect);
  }
};

const drawDecorativeBook = (context: DrawContext, book: LibraryRoom['readingArea']['decorativeBookRects'][number], index: number) => {
  const colors = (book.tone ?? (index % 2 === 0 ? 'coral' : 'blue')) === 'coral' ? palette.bookCoral : palette.bookBlue;
  context.fillStyle = palette.ink[0];
  context.fillRect(pixel(book.x + 1), pixel(book.y + 1), pixel(book.width), pixel(book.height));
  context.fillStyle = colors[0];
  context.fillRect(pixel(book.x), pixel(book.y), pixel(book.width), pixel(book.height));
  context.fillStyle = colors[1];
  context.fillRect(pixel(book.x), pixel(book.y), pixel(book.width), Math.min(2, pixel(book.height)));
  context.fillStyle = palette.paper[2];
  context.fillRect(pixel(book.x + book.width - 1), pixel(book.y + 1), 1, Math.max(1, pixel(book.height - 2)));
};

const drawContactShadow = (context: DrawContext, rect: LibraryRect, inset = 1) => {
  context.fillStyle = palette.ink[1];
  context.fillRect(
    pixel(rect.x + inset + 2),
    pixel(rect.y + rect.height - 1),
    Math.max(2, pixel(rect.width - inset * 2)),
    3,
  );
};

const drawWoodBlock = (context: DrawContext, rect: LibraryRect, frontDepth: number) => {
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = Math.max(2, pixel(rect.width));
  const height = Math.max(2, pixel(rect.height));
  const lip = Math.min(Math.max(2, frontDepth), Math.max(2, height - 2));
  context.fillStyle = palette.timber[0];
  context.fillRect(x, y, width, height);
  context.fillStyle = palette.timber[2];
  context.fillRect(x + 1, y + 1, width - 2, height - lip - 1);
  context.fillStyle = palette.timber[3];
  context.fillRect(x + 2, y + 1, Math.max(1, width - 4), 2);
  context.fillStyle = palette.timber[1];
  context.fillRect(x + 1, y + height - lip, width - 2, lip - 1);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + width - 3, y + 4, 2, Math.max(2, height - lip - 5));
  context.fillStyle = palette.timber[3];
  context.fillRect(x + 2, y + 2, 1, Math.max(2, height - lip - 4));
  context.fillStyle = palette.timber[0];
  context.fillRect(x, y + height - 2, width, 2);
  context.fillStyle = palette.timber[3];
  context.fillRect(x + 3, y + 4, Math.max(4, Math.min(18, width / 5)), 1);
  context.fillRect(x + Math.floor(width * 0.55), y + 8, Math.max(5, Math.min(22, width / 4)), 1);
  context.fillStyle = palette.timber[1];
  context.fillRect(x + Math.floor(width * 0.32), y + Math.max(5, height - lip - 8), Math.max(6, Math.min(25, width / 4)), 1);
  context.fillRect(x + 3, y + 3, 3, 3);
  context.fillRect(x + width - 6, y + 3, 3, 3);
  context.fillStyle = palette.timber[3];
  context.fillRect(x + 4, y + 3, 1, 1);
  context.fillRect(x + width - 5, y + 3, 1, 1);
};

const drawDesk = (context: DrawContext, room: LibraryRoom) => {
  const rect = room.desk.visualRect;
  drawWoodBlock(context, rect, 7);
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = pixel(rect.width);
  const height = pixel(rect.height);
  context.fillStyle = palette.timber[1];
  context.fillRect(x + 8, y + 8, width - 16, height - 23);
  context.fillStyle = palette.timber[2];
  context.fillRect(x + 10, y + 10, width - 20, height - 27);
  context.fillStyle = palette.timber[3];
  context.fillRect(x + 11, y + 10, width - 23, 2);
  context.fillRect(x + 11, y + 12, 2, height - 31);
  context.fillStyle = palette.paper[0];
  context.fillRect(x + Math.floor(width * 0.2), y + 16, 22, 15);
  context.fillStyle = palette.paper[3];
  context.fillRect(x + Math.floor(width * 0.2) + 1, y + 15, 21, 14);
  context.fillStyle = palette.bookCoral[0];
  context.fillRect(x + Math.floor(width * 0.2) + 3, y + 18, 2, 9);
  drawPixelLine(context, x + Math.floor(width * 0.2) + 8, y + 19, x + Math.floor(width * 0.2) + 18, y + 19, palette.paper[0]);
  drawPixelLine(context, x + Math.floor(width * 0.2) + 8, y + 23, x + Math.floor(width * 0.2) + 16, y + 23, palette.paper[0]);
  drawSteppedLine(context, x + Math.floor(width * 0.2) + 18, y + 8, x + Math.floor(width * 0.2) + 10, y + 18, palette.ink[1]);
  if (!room.ambientObjects?.some(object => object.kind === 'tea')) {
    context.fillStyle = palette.paper[0];
    context.fillRect(x + width - 29, y + 15, 18, 5);
    context.fillStyle = palette.paper[3];
    context.fillRect(x + width - 26, y + 12, 12, 4);
    context.fillRect(x + width - 23, y + 10, 6, 2);
    context.fillStyle = palette.timber[0];
    context.fillRect(x + width - 21, y + 20, 2, 13);
    context.fillRect(x + width - 25, y + 32, 10, 2);
  }
  context.fillStyle = palette.timber[0];
  context.fillRect(x + 10, y + height - 7, width - 20, 2);
  context.fillStyle = palette.paper[1];
  context.fillRect(x + 31, y + height - 6, 10, 2);
  context.fillRect(x + width - 41, y + height - 6, 10, 2);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + 5, y + height, 6, 3);
  context.fillRect(x + width - 11, y + height, 6, 3);
};

const drawShelf = (context: DrawContext, shelf: LibraryShelf, drawFrame = true) => {
  const rect = shelf.visualRect;
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = pixel(rect.width);
  const height = pixel(rect.height);
  const frontDepth = shelf.variant === 'wide-low' ? 7 : shelf.variant === 'compact' ? 6 : 9;
  const hasRaisedCap = shelf.variant === 'narrow-tall' || shelf.variant === 'endcap';
  if (drawFrame) drawWoodBlock(context, rect, frontDepth);

  const horizontalInset = shelf.variant === 'wide-low' || shelf.variant === 'endcap' ? 8 : 9;
  const left = x + horizontalInset;
  const right = x + width - horizontalInset;
  const rows = [...new Set(shelf.slots.map((slot) => pixel(slot.rect.y)))];
  for (const rowY of rows) {
    const rowSlots = shelf.slots.filter((slot) => pixel(slot.rect.y) === rowY);
    const rowHeight = Math.max(...rowSlots.map((slot) => pixel(slot.rect.height)));
    context.fillStyle = palette.timber[0];
    context.fillRect(left - 1, rowY - 1, right - left + 2, rowHeight + 2);
    context.fillStyle = palette.recess[1];
    context.fillRect(left, rowY, right - left, rowHeight);
    context.fillStyle = palette.recess[0];
    context.fillRect(left, rowY, right - left, 3);
    context.fillRect(left, rowY, 2, rowHeight);
    context.fillStyle = palette.recess[2];
    context.fillRect(left + 2, rowY + rowHeight - 2, right - left - 2, 2);
    context.fillStyle = palette.timber[0];
    for (let markX = left + 8; markX < right - 2; markX += 17) {
      context.fillRect(markX, rowY + rowHeight - 3, 7, 1);
    }
    context.fillStyle = palette.timber[1];
    context.fillRect(left - 2, rowY + rowHeight, right - left + 4, 2);
    context.fillStyle = palette.timber[3];
    context.fillRect(left - 1, rowY + rowHeight, right - left + 2, 1);
  }

  if (!drawFrame) return;

  context.fillStyle = palette.timber[3];
  context.fillRect(x + 2, y + 1, width - 4, hasRaisedCap ? 3 : 2);
  context.fillStyle = palette.timber[1];
  context.fillRect(x + 5, y + 6, 2, height - 13);
  context.fillRect(x + width - 7, y + 6, 2, height - 13);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + 3, y + height, 5, 3);
  context.fillRect(x + width - 8, y + height, 5, 3);
  if (hasRaisedCap) {
    context.fillStyle = palette.timber[1];
    context.fillRect(x - 2, y + 3, 2, height - 5);
    context.fillStyle = palette.timber[3];
    context.fillRect(x - 1, y - 2, width + 2, 3);
  }
  if (shelf.variant === 'compact') {
    context.fillStyle = palette.lavender[1];
    context.fillRect(x + 4, y + 3, width - 8, 3);
    context.fillStyle = palette.lavender[0];
    context.fillRect(x + 2, y + height - 8, width - 4, 2);
    for (let trimX = x + 8; trimX < x + width - 7; trimX += 12) {
      context.fillRect(trimX, y + 4, 4, 2);
    }
  }
  if (shelf.variant === 'endcap') {
    context.fillStyle = palette.timber[1];
    context.fillRect(x + width - 7, y + 5, 5, height - 12);
    context.fillStyle = palette.timber[3];
    context.fillRect(x + width - 7, y + 5, 1, height - 13);
  }
  if (shelf.variant === 'wide-low') {
    context.fillStyle = palette.bookBlue[1];
    for (let trimX = x + 5; trimX < x + width - 7; trimX += 10) {
      context.fillRect(trimX, y + 2, 5, 2);
    }
  }
  if (shelf.variant === 'narrow-tall') {
    context.fillStyle = palette.bookCoral[1];
    context.fillRect(x - 1, y - 2, width + 2, 2);
    context.fillStyle = palette.bookCoral[0];
    context.fillRect(x + 3, y + height - 6, 4, 3);
    context.fillRect(x + width - 7, y + height - 6, 4, 3);
  }
};

const enclosingRect = (rects: readonly LibraryRect[]): LibraryRect => {
  const x = Math.min(...rects.map(rect => rect.x));
  const y = Math.min(...rects.map(rect => rect.y));
  return { x, y, width: Math.max(...rects.map(rect => rect.x + rect.width)) - x,
    height: Math.max(...rects.map(rect => rect.y + rect.height)) - y };
};

const drawShelfGroup = (context: DrawContext, shelves: readonly LibraryShelf[], rect: LibraryRect) => {
  if (shelves.length === 1) {
    drawShelf(context, shelves[0]);
    return;
  }
  drawWoodBlock(context, rect, 7);
  for (const shelf of shelves) drawShelf(context, shelf, false);
  fillRect(context, { x: rect.x + 2, y: rect.y + 1, width: rect.width - 4, height: 2 }, palette.timber[3]);
  for (const x of [rect.x + 4, rect.x + rect.width - 9]) {
    fillRect(context, { x, y: rect.y + rect.height, width: 5, height: 3 }, palette.timber[0]);
  }
  for (const shelf of shelves.slice(1)) {
    fillRect(context, { x: shelf.visualRect.x - 2, y: rect.y + 5, width: 4, height: rect.height - 12 }, palette.timber[1]);
    fillRect(context, { x: shelf.visualRect.x - 2, y: rect.y + 5, width: 1, height: rect.height - 12 }, palette.timber[3]);
  }
};

const drawPlacedBook = (
  context: DrawContext,
  room: LibraryRoom,
  book: LibraryPlacedBook,
) => {
  const rect = getLibraryPlacedBookRect(room, book);
  if (rect) drawLibraryBookSpine(context,rect,book);
};

const drawReadingTable = (context: DrawContext, rect: LibraryRect) => {
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = pixel(rect.width);
  const height = pixel(rect.height);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + 3, y, width - 6, height);
  context.fillRect(x, y + 3, width, height - 6);
  context.fillStyle = palette.timber[2];
  context.fillRect(x + 3, y + 1, width - 6, height - 4);
  context.fillRect(x + 1, y + 3, width - 2, height - 8);
  context.fillStyle = palette.timber[3];
  context.fillRect(x + 4, y + 2, width - 9, 2);
  context.fillStyle = palette.timber[1];
  context.fillRect(x + 3, y + height - 5, width - 6, 4);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + 8, y + height - 1, 5, 3);
  context.fillRect(x + width - 13, y + height - 1, 5, 3);
};

const drawBench = (context: DrawContext, rect: LibraryRect) => {
  drawWoodBlock(context, rect, 4);
  const x = pixel(rect.x);
  const y = pixel(rect.y + rect.height);
  const width = pixel(rect.width);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + 3, y, 4, 3);
  context.fillRect(x + width - 7, y, 4, 3);
};

const drawBeanbag = (context: DrawContext, rect: LibraryRect) => {
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = pixel(rect.width);
  const height = pixel(rect.height);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + 7, y + height - 5, 4, 5);
  context.fillRect(x + width - 11, y + height - 5, 4, 5);
  context.fillStyle = palette.ink[1];
  context.fillRect(x + 6, y + 2, width - 12, height - 8);
  context.fillRect(x + 3, y + 6, width - 6, height - 11);
  context.fillStyle = palette.lavender[0];
  context.fillRect(x + 7, y + 3, width - 14, 15);
  context.fillRect(x + 4, y + 7, width - 8, 15);
  context.fillStyle = palette.lavender[1];
  context.fillRect(x + 8, y + 4, width - 16, 3);
  context.fillRect(x + 6, y + 8, 2, 9);
  context.fillStyle = palette.ink[1];
  context.fillRect(x + 8, y + 18, width - 16, 2);
  context.fillStyle = palette.lavender[1];
  context.fillRect(x + 8, y + 20, width - 16, height - 28);
  context.fillStyle = palette.lavender[0];
  context.fillRect(x + 8, y + height - 8, width - 16, 4);
  context.fillStyle = palette.ink[1];
  context.fillRect(x + 7, y + height - 4, width - 14, 1);
};

const drawBeanbagArms = (context: DrawContext, rect: LibraryRect) => {
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = pixel(rect.width);
  const height = pixel(rect.height);
  for (const armX of [x + 1, x + width - 9]) {
    context.fillStyle = palette.ink[1];
    context.fillRect(armX, y + 15, 8, height - 19);
    context.fillStyle = palette.lavender[0];
    context.fillRect(armX + 1, y + 16, 6, height - 21);
    context.fillStyle = palette.lavender[1];
    context.fillRect(armX + 1, y + 16, 6, 3);
  }
};

const drawVase = (context: DrawContext, rect: LibraryRect) => {
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = pixel(rect.width);
  const height = pixel(rect.height);
  context.fillStyle = palette.green[0];
  context.fillRect(x + Math.floor(width / 2), y - 6, 1, 8);
  context.fillRect(x + 2, y - 4, 1, 6);
  context.fillRect(x + width - 3, y - 5, 1, 7);
  context.fillStyle = palette.bookCoral[0];
  context.fillRect(x, y - 6, 5, 4);
  context.fillRect(x + width - 5, y - 7, 5, 4);
  context.fillStyle = palette.paper[2];
  context.fillRect(x + 1, y - 5, 2, 2);
  context.fillRect(x + width - 4, y - 6, 2, 2);
  context.fillStyle = palette.ink[0];
  context.fillRect(x + 1, y + 1, width - 2, height - 1);
  context.fillStyle = palette.bookBlue[0];
  context.fillRect(x + 2, y + 1, width - 4, height - 3);
  context.fillStyle = palette.bookBlue[1];
  context.fillRect(x + 3, y + 2, Math.max(2, width - 6), 3);
  context.fillStyle = palette.ink[1];
  context.fillRect(x, y + height - 2, width, 2);
};

const drawPixelOval = (context: DrawContext, x: number, y: number, width: number, height: number, color: string) => {
  context.fillStyle = color;
  for (let row = 0; row < height; row += 1) {
    const distance = (row + 0.5 - height / 2) / (height / 2);
    const inset = Math.round(width / 2 * (1 - Math.sqrt(Math.max(0, 1 - distance * distance))));
    context.fillRect(pixel(x + inset), pixel(y + row), Math.max(1, width - inset * 2), 1);
  }
};

const findShelfForBook = (room: LibraryRoom, book: LibraryPlacedBook) =>
  room.shelves.find((shelf) => shelf.slots.some((slot) => slot.id === book.slotId));

const getEntityRect = (room: LibraryRoom, id: string): LibraryRect | null => {
  if (id === room.desk.id) return room.desk.clerk?.visualRect ?? room.desk.visualRect;
  if (id === room.failureBoard?.id) return room.failureBoard.visualRect;
  if (id === room.competitionBoard?.id) return room.competitionBoard.visualRect;
  const ambient = room.ambientObjects?.find(object => object.id === id);
  if (ambient) return ambient.visualRect;
  if (id === 'reading-nook') return room.readingArea.beanbagVisualRect ?? room.readingArea.rug;
  const shelf = room.shelves.find((item) => item.id === id);
  if (shelf) return shelf.visualRect;
  if (id.startsWith('placed-book:')) {
    const slotId = Number(id.slice('placed-book:'.length));
    return room.shelves.flatMap((item) => item.slots).find((slot) => slot.id === slotId)?.rect ?? null;
  }
  return null;
};

const drawCornerHighlight = (context: DrawContext, rect: LibraryRect) => {
  const x = pixel(rect.x - 2);
  const y = pixel(rect.y - 2);
  const right = pixel(rect.x + rect.width + 2);
  const bottom = pixel(rect.y + rect.height + 2);
  context.fillStyle = palette.paper[3];
  context.fillRect(x, y, 7, 2);
  context.fillRect(x, y, 2, 7);
  context.fillRect(right - 7, y, 7, 2);
  context.fillRect(right - 2, y, 2, 7);
  context.fillRect(x, bottom - 2, 7, 2);
  context.fillRect(x, bottom - 7, 2, 7);
  context.fillRect(right - 7, bottom - 2, 7, 2);
  context.fillRect(right - 2, bottom - 7, 2, 7);
};

const drawCue = (context: DrawContext, room: LibraryRoom, scene: LibraryScene) => {
  const target = scene.nearbyTarget;
  if (!target) return;
  const rect = getEntityRect(room, target.id);
  if (rect) drawCornerHighlight(context, rect);
};

const drawSelectedSlot = (context: DrawContext, room: LibraryRoom, selectedSlotId: number | null) => {
  if (selectedSlotId === null) return;
  const slot = room.shelves.flatMap((shelf) => shelf.slots).find((item) => item.id === selectedSlotId);
  if (slot) drawCornerHighlight(context, insetRect(slot.rect, -1));
};

const isPlayerBehind = (scene: LibraryScene, rect: LibraryRect, floorY: number) => {
  if (scene.seated || scene.ambientState?.benchObjectId || scene.player.position.y >= floorY) return false;
  const left = scene.player.position.x + LIBRARY_BEAR_BOUNDS.left;
  const right = scene.player.position.x + LIBRARY_BEAR_BOUNDS.right;
  const top = scene.player.position.y + LIBRARY_BEAR_BOUNDS.top;
  return right > rect.x
    && left < rect.x + rect.width
    && scene.player.position.y > rect.y
    && top < rect.y + rect.height;
};

const drawWithPlayerOcclusion = (
  context: DrawContext,
  layer: DrawContext,
  occluded: boolean,
  draw: (target: DrawContext) => void,
) => {
  if (!occluded) {
    draw(context);
    return;
  }
  layer.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  draw(layer);
  context.save();
  context.globalAlpha = 0.28;
  context.drawImage(layer.canvas, 0, 0);
  context.restore();
};

const createDepthEntities = (
  room: LibraryRoom,
  scene: LibraryScene,
  occlusionLayer: DrawContext,
): DepthEntity[] => {
  const entities: DepthEntity[] = [
    {
      id: room.desk.id,
      floorY: room.desk.footCollider.y + room.desk.footCollider.height,
      shadow: (context) => drawContactShadow(context, room.desk.footCollider),
      body: (context) => {
        drawLibraryClerkBody(context, room, scene);
        drawDesk(context, room);
        drawLibraryClerkHands(context, room, scene);
      },
    },
    {
      id: 'player',
      floorY: getLibraryBearPose(scene, room).feet.y,
      shadow: (context) => {
        if (scene.seated || getLibraryBearPose(scene,room).benchSeated) return;
        const feet = getLibraryBearPose(scene, room).feet;
        context.save();
        context.globalAlpha = 0.25;
        drawPixelOval(context, pixel(feet.x - 12), pixel(feet.y - 3), 24, 5, palette.bear[0]);
        context.restore();
      },
      body: (context) => {
        if (getLibraryBearPose(scene,room).facing === 'up') drawBookTransfer(context,room,scene);
        drawLibraryCharacter(context,scene,room);
      },
    },
  ];

  if (room.competitionBoard) {
    const board = room.competitionBoard;
    const floorY = board.footCollider.y + board.footCollider.height;
    entities.push({
      id: board.id,
      floorY,
      shadow: () => undefined,
      body: context => drawWithPlayerOcclusion(
        context,
        occlusionLayer,
        isPlayerBehind(scene, board.visualRect, floorY),
        target => {
          drawContactShadow(target, board.footCollider);
          drawCompetitionBoard(target, board.visualRect);
        },
      ),
    });
  }

  entities.push(
    {
      id: 'reading-table',
      floorY: room.readingArea.tableFootCollider.y + room.readingArea.tableFootCollider.height,
      shadow: (context) => drawContactShadow(context, room.readingArea.tableFootCollider),
      body: (context) => drawReadingTable(context, room.readingArea.tableVisualRect),
    },
    {
      id: 'reading-bench',
      floorY: getLibraryBearPose(scene, room).benchSeated
        ? getLibraryBearPose(scene, room).feet.y - 1
        : room.readingArea.benchFootCollider.y + room.readingArea.benchFootCollider.height,
      shadow: (context) => drawContactShadow(context, room.readingArea.benchFootCollider),
      body: (context) => drawBench(context, room.readingArea.benchVisualRect),
    },
  );
  if (room.readingArea.beanbagVisualRect && room.readingArea.beanbagFootCollider) {
    const beanbagRect = room.readingArea.beanbagVisualRect;
    const beanbagCollider = room.readingArea.beanbagFootCollider;
    entities.push({
      id: 'reading-beanbag',
      floorY: scene.seated ? getLibraryBearPose(scene, room).feet.y - 1 : beanbagCollider.y + beanbagCollider.height,
      shadow: (context) => drawContactShadow(context, beanbagCollider),
      body: (context) => drawBeanbag(context, beanbagRect),
    });
    entities.push({
      id: 'reading-beanbag-arms',
      floorY: scene.seated ? getLibraryBearPose(scene, room).feet.y + 1 : beanbagCollider.y + beanbagCollider.height + 0.1,
      shadow: () => undefined,
      body: context => drawBeanbagArms(context, beanbagRect),
    });
  }

  const shelfGroups = new Map<string, LibraryShelf[]>();
  for (const shelf of room.shelves) {
    const id = shelf.visualGroupId ?? shelf.id;
    const group = shelfGroups.get(id) ?? [];
    group.push(shelf);
    shelfGroups.set(id, group);
  }
  for (const [id, shelves] of shelfGroups) {
    const visualRect = enclosingRect(shelves.map(shelf => shelf.visualRect));
    const footCollider = enclosingRect(shelves.map(shelf => shelf.footCollider));
    const floorY = footCollider.y + footCollider.height;
    entities.push({
      id,
      floorY,
      shadow: (context) => drawContactShadow(context, footCollider),
      body: (context) => drawWithPlayerOcclusion(
        context,
        occlusionLayer,
        isPlayerBehind(scene, visualRect, floorY),
        (target) => {
          drawShelfGroup(target, shelves, visualRect);
          for (const book of scene.placedBooks) {
            if (!shelves.some(shelf => findShelfForBook(room, book)?.id === shelf.id)) continue;
            const progress = getLibraryActionProgress(scene);
            if (scene.action?.kind === 'place' && scene.action.slotId === book.slotId && progress !== null && progress < 0.8) continue;
            drawPlacedBook(target, room, book);
          }
        },
      ),
    });
  }

  for (const [index, book] of room.readingArea.decorativeBookRects.entries()) {
    entities.push({
      id: `reading-book:${index}`,
      floorY: room.readingArea.tableFootCollider.y + room.readingArea.tableFootCollider.height + 0.25,
      shadow: () => undefined,
      body: (context) => drawDecorativeBook(context, book, index),
    });
  }
  if (room.readingArea.vaseRect) {
    const vaseRect = room.readingArea.vaseRect;
    entities.push({
      id: 'reading-vase',
      floorY: room.readingArea.tableFootCollider.y + room.readingArea.tableFootCollider.height + 0.5,
      shadow: () => undefined,
      body: (context) => drawVase(context, vaseRect),
    });
  }

  const ambientObjects = room.ambientObjects ?? [];
  if (!ambientObjects.some(object => object.kind === 'lamp')) {
    entities.push({ id: 'reading-lamp', floorY: room.readingArea.lampRect.y + room.readingArea.lampRect.height,
      shadow: () => undefined, body: context => drawLamp(context, room.readingArea.lampRect) });
  }
  for (const object of ambientObjects) {
    if (object.kind === 'bench') continue;
    const tabletop = object.kind === 'tea';
    const support = room.readingArea.tableFootCollider;
    const floorY = support.y + support.height;
    entities.push({
      id: object.id,
      floorY: tabletop ? floorY + 0.75 : object.visualRect.y + object.visualRect.height,
      shadow: () => undefined,
      body: context => object.kind === 'lamp'
        ? drawLamp(context, object.visualRect, scene.ambientState?.lampOn !== false, object.actionPoint)
        : drawLibraryAmbientObject(context, object, scene, room),
    });
  }
  if (scene.ambientAction) {
    const object = ambientObjects.find(object => object.id === scene.ambientAction?.objectId);
    const tabletop = object?.kind === 'tea';
    const pose = getLibraryBearPose(scene,room);
    const support = room.readingArea.tableFootCollider;
    const supportBottom = support.y + support.height;
    entities.push({ id: 'ambient-tool',
      floorY: tabletop ? Math.max(pose.feet.y + 0.1, supportBottom + 1) : pose.feet.y + (pose.facing === 'up' ? -0.1 : 0.1),
      shadow: () => undefined, body: context => drawLibraryAmbientTool(context,room,scene) });
  }

  return entities.sort((a, b) => a.floorY - b.floorY || a.id.localeCompare(b.id));
};

const drawBookTransfer = (context: DrawContext, room: LibraryRoom, scene: LibraryScene) => {
  if (room.desk.clerk && scene.action?.kind === 'receive') return;
  const motion = getLibraryBookMotion(scene,room);
  if (!motion?.visible || motion.inHands) return;
  const book = scene.carriedDraft ?? scene.placedBooks.find(book => book.slotId === scene.action?.slotId);
  drawLibraryCarryBook(context,motion.center,motion.turn,book,motion);
};

const drawBookAction = (context: DrawContext, room: LibraryRoom, scene: LibraryScene) => {
  const motion = getLibraryBookMotion(scene, room);
  if (!motion) return;
  if (getLibraryBearPose(scene,room).facing !== 'up') drawBookTransfer(context,room,scene);
  const progress = getLibraryActionProgress(scene);
  if (!motion.landed || progress === null) return;
  const slot = room.shelves.flatMap(shelf => shelf.slots).find(slot => slot.id === scene.action?.slotId);
  if (!slot) return;
  const spread = Math.floor((progress - 0.8) * 30);
  const cx = pixel(slot.rect.x + slot.rect.width / 2);
  const cy = pixel(slot.rect.y + slot.rect.height / 2);
  context.fillStyle = palette.paper[3];
  for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
    context.fillRect(cx + dx * (5 + spread), cy + dy * (4 + spread), 2, 1);
    context.fillRect(cx + dx * (5 + spread), cy + dy * (4 + spread) - 1, 1, 3);
  }
};

const drawLivingLight = (context: DrawContext, room: LibraryRoom, scene: LibraryScene) => {
  if (scene.reducedMotion) return;
  const window = room.readingArea.windowRect;
  const phase = scene.timeMs / 6500;
  context.save();
  context.globalAlpha = 0.12 + Math.sin(phase) * 0.025;
  context.fillStyle = palette.paper[3];
  const top = pixel(room.walkableBounds.y + 3);
  for (let row = 0; row < 4; row += 1) {
    context.fillRect(pixel(window.x - 12 - row * 12), top + row * 12, pixel(window.width + row * 6), 8);
  }
  context.globalAlpha = 0.4;
  for (let dot = 0; dot < 3; dot += 1) {
    const x = window.x + 8 + dot * 16 + Math.round(Math.sin(phase + dot) * 2);
    const y = top + 9 + dot * 12 + Math.round(Math.cos(phase + dot) * 3);
    context.fillRect(pixel(x), pixel(y), 1, 1);
  }
  context.restore();
};

export const createLibraryRenderer = (
  canvas: HTMLCanvasElement,
  room: LibraryRoom,
): { draw: (scene: LibraryScene) => void; dispose: () => void; } => {
  canvas.width = LOGICAL_WIDTH;
  canvas.height = LOGICAL_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context를 사용할 수 없습니다.');
  context.imageSmoothingEnabled = false;

  const staticCanvas = document.createElement('canvas');
  staticCanvas.width = LOGICAL_WIDTH;
  staticCanvas.height = LOGICAL_HEIGHT;
  const staticContext = staticCanvas.getContext('2d');
  if (!staticContext) throw new Error('정적 Canvas 2D context를 사용할 수 없습니다.');
  staticContext.imageSmoothingEnabled = false;
  drawStaticRoom(staticContext, room);

  const occlusionCanvas = document.createElement('canvas');
  occlusionCanvas.width = LOGICAL_WIDTH;
  occlusionCanvas.height = LOGICAL_HEIGHT;
  const occlusionContext = occlusionCanvas.getContext('2d');
  if (!occlusionContext) throw new Error('가림 Canvas 2D context를 사용할 수 없습니다.');
  occlusionContext.imageSmoothingEnabled = false;

  const entranceCanvas = document.createElement('canvas');
  entranceCanvas.width = LOGICAL_WIDTH;
  entranceCanvas.height = LOGICAL_HEIGHT;
  const entranceContext = entranceCanvas.getContext('2d');
  if (!entranceContext) throw new Error('출입구 Canvas 2D context를 사용할 수 없습니다.');
  entranceContext.imageSmoothingEnabled = false;
  drawEntranceForeground(entranceContext, room);

  let disposed = false;
  let packedBooks: LibraryScene['placedBooks'] | undefined;
  let packedRoom = room;

  return {
    draw: (scene) => {
      if (disposed) return;
      if (packedBooks !== scene.placedBooks) {
        packedBooks = scene.placedBooks;
        packedRoom = resolveLibraryBookRoom(room, scene.placedBooks);
      }
      const currentRoom = resolveLibraryCatRoom(packedRoom, scene.catState, scene.player);
      context.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      context.drawImage(staticCanvas, 0, 0);
      drawLivingLight(context, room, scene);
      drawLibraryAmbientLight(context, room, scene);
      if (room.failureBoard) drawFailureBoardNotes(context, room.failureBoard.visualRect, scene.boardNoteCount);
      const entities = createDepthEntities(currentRoom, scene, occlusionContext);
      for (const entity of entities) entity.shadow(context);
      for (const entity of entities) entity.body(context);
      drawBookAction(context, currentRoom, scene);
      drawLibraryClerkTransfer(context, currentRoom, scene);
      if (room.exit) {
        context.save();
        context.globalAlpha = 0.55;
        context.drawImage(entranceCanvas, 0, 0);
        context.restore();
      }
      drawSelectedSlot(context, currentRoom, scene.selectedSlotId);
      drawCue(context, currentRoom, scene);
    },
    dispose: () => {
      disposed = true;
      staticCanvas.width = 0;
      staticCanvas.height = 0;
      occlusionCanvas.width = 0;
      occlusionCanvas.height = 0;
      entranceCanvas.width = 0;
      entranceCanvas.height = 0;
    },
  };
};
