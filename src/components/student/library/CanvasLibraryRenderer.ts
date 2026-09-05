import type {
  LibraryPlacedBook,
  LibraryPoint,
  LibraryRect,
  LibraryRoom,
  LibraryScene,
  LibraryShelf,
} from '../../../lib/canvasLibraryWorld';
import { CANVAS_LIBRARY_PALETTE as palette } from './CanvasLibraryPalette';
import { drawCompetitionBoard } from './CanvasLibraryCompetitionBoard';

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
  context.globalAlpha = 0.38;
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
        context.globalAlpha = 0.52;
        context.fillStyle = palette.paper[3];
        context.fillRect(left + 4, y + 2, Math.max(2, Math.min(12, right - left - 7)), 1);
        context.globalAlpha = 0.38;
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

  context.fillStyle = palette.green[1];
  context.fillRect(pixel(bounds.x + 3), pixel(walkableBounds.y), 15, pixel(walkableBounds.height));
  context.fillRect(pixel(bounds.x + bounds.width - 18), pixel(walkableBounds.y), 15, pixel(walkableBounds.height));
  context.fillStyle = palette.green[3];
  context.fillRect(pixel(bounds.x + 15), pixel(walkableBounds.y), 3, pixel(walkableBounds.height - 3));
  context.fillRect(pixel(bounds.x + bounds.width - 18), pixel(walkableBounds.y), 3, pixel(walkableBounds.height - 3));
  context.fillStyle = palette.green[0];
  for (let y = pixel(walkableBounds.y + 18); y < endY - 8; y += 44) {
    context.fillRect(pixel(bounds.x + 5), y, 10, 2);
    context.fillRect(pixel(bounds.x + bounds.width - 15), y, 10, 2);
  }

  context.fillStyle = palette.timber[0];
  context.fillRect(startX, endY - 3, pixel(walkableBounds.width), 3);

  const thresholdY = pixel(bounds.y + bounds.height - 13);
  context.fillStyle = palette.timber[0];
  context.fillRect(pixel(room.spawn.x - 20), thresholdY, 40, 3);
  context.fillStyle = palette.timber[2];
  context.fillRect(pixel(room.spawn.x - 18), thresholdY, 36, 2);
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
  const lamp = room.readingArea.lampRect;
  for (let ring = 3; ring >= 0; ring -= 1) {
    context.globalAlpha = 0.08 + (3 - ring) * 0.035;
    context.fillRect(
      pixel(lamp.x - 17 - ring * 5),
      pixel(lamp.y + lamp.height - 4 - ring * 2),
      pixel(lamp.width + 34 + ring * 10),
      5 + ring * 4,
    );
  }
  context.restore();
};

const drawEntryRug = (context: DrawContext, room: LibraryRoom) => {
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

const drawCirculationInlay = (context: DrawContext, room: LibraryRoom) => {
  if (!room.failureBoard) return;
  const centerX = pixel(room.spawn.x + 57);
  context.fillStyle = palette.timber[2];
  context.fillRect(centerX, pixel(room.walkableBounds.y + 28), 2, pixel(room.walkableBounds.height - 38));
  context.fillStyle = palette.paper[1];
  context.fillRect(centerX + 2, pixel(room.walkableBounds.y + 28), 1, pixel(room.walkableBounds.height - 38));
  for (const [x, y, width] of [[132, 218, 225], [319, 146, 102], [357, 223, 149]] as const) {
    context.fillStyle = palette.timber[2];
    context.fillRect(x, y, width, 2);
    context.fillStyle = palette.paper[1];
    context.fillRect(x, y + 2, width, 1);
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

const drawLamp = (context: DrawContext, rect: LibraryRect) => {
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = Math.max(8, pixel(rect.width));
  const height = Math.max(12, pixel(rect.height));
  context.fillStyle = palette.paper[0];
  context.fillRect(x - 6, y + height - 2, width + 12, 2);
  context.fillRect(x - 2, y + height - 4, width + 4, 1);
  context.fillStyle = palette.paper[1];
  context.fillRect(x + 2, y + 2, width - 4, 4);
  context.fillStyle = palette.paper[3];
  context.fillRect(x + 4, y, width - 8, 2);
  context.fillStyle = palette.paper[0];
  context.fillRect(x, y + 6, width, 2);
  context.fillStyle = palette.timber[1];
  context.fillRect(x + Math.floor(width / 2) - 1, y + 8, 2, height - 10);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + Math.floor(width / 2) - 4, y + height - 2, 8, 2);
};

const drawFailureBoard = (context: DrawContext, rect: LibraryRect) => {
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = pixel(rect.width);
  const height = pixel(rect.height);
  const cork: LibraryRect = { x: x + 5, y: y + 7, width: width - 10, height: height - 13 };

  context.fillStyle = palette.ink[0];
  context.fillRect(x - 2, y + 2, width + 4, height - 2);
  context.fillStyle = palette.timber[0];
  context.fillRect(x, y, width, height);
  context.fillStyle = palette.timber[2];
  context.fillRect(x + 2, y + 2, width - 4, height - 4);
  context.fillStyle = palette.timber[3];
  context.fillRect(x + 4, y + 4, width - 8, height - 8);
  fillRect(context, cork, palette.timber[1]);
  context.fillStyle = palette.timber[2];
  for (let grainX = x + 11; grainX < x + width - 10; grainX += 19) {
    context.fillRect(grainX, y + 17 + (grainX % 3), 8, 1);
    context.fillRect(grainX + 3, y + height - 17 - (grainX % 5), 5, 1);
  }
  context.fillStyle = palette.paper[3];
  context.fillRect(x + Math.floor(width / 2) - 5, y - 3, 10, 3);
  context.fillStyle = palette.paper[0];
  context.fillRect(x + Math.floor(width / 2) - 3, y - 5, 6, 3);
  context.fillStyle = palette.bookCoral[0];
  context.fillRect(x + Math.floor(width / 2) - 1, y - 6, 2, 2);
  context.fillStyle = palette.paper[3];
  context.fillRect(x + 18, y + 50, width - 36, 2);
  context.fillStyle = palette.timber[3];
  context.fillRect(x + 12, y + height - 8, width - 24, 2);
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

const drawWallPlanter = (context: DrawContext, x: number, y: number) => {
  context.fillStyle = palette.green[0];
  context.fillRect(x + 5, y, 3, 16);
  context.fillRect(x, y + 3, 7, 4);
  context.fillRect(x + 8, y + 5, 7, 4);
  context.fillStyle = palette.green[3];
  context.fillRect(x + 2, y + 3, 4, 2);
  context.fillRect(x + 9, y + 5, 4, 2);
  context.fillStyle = palette.lavender[0];
  context.fillRect(x + 2, y + 15, 11, 5);
  context.fillStyle = palette.lavender[1];
  context.fillRect(x + 3, y + 15, 9, 2);
};

const drawStaticRoom = (context: DrawContext, room: LibraryRoom) => {
  drawRoomBase(context, room);
  drawMotivatedLight(context, room);
  drawCirculationInlay(context, room);
  drawWindow(context, room.readingArea.windowRect);
  drawEntryRug(context, room);
  drawRug(context, room.readingArea.rug);
  drawLamp(context, room.readingArea.lampRect);
  if (room.failureBoard) {
    drawFailureBoard(context, room.failureBoard.visualRect);
    drawWallPlanter(context, 330, 72);
    drawWallPlanter(context, 486, 67);
  }
};

const drawDecorativeBook = (context: DrawContext, book: LibraryRect, index: number) => {
  context.fillStyle = palette.ink[0];
  context.fillRect(pixel(book.x + 1), pixel(book.y + 1), pixel(book.width), pixel(book.height));
  context.fillStyle = index % 2 === 0 ? palette.bookCoral[0] : palette.bookBlue[0];
  context.fillRect(pixel(book.x), pixel(book.y), pixel(book.width), pixel(book.height));
  context.fillStyle = index % 2 === 0 ? palette.bookCoral[1] : palette.bookBlue[1];
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
  context.fillStyle = palette.paper[0];
  context.fillRect(x + width - 29, y + 15, 18, 5);
  context.fillStyle = palette.paper[3];
  context.fillRect(x + width - 26, y + 12, 12, 4);
  context.fillRect(x + width - 23, y + 10, 6, 2);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + width - 21, y + 20, 2, 13);
  context.fillRect(x + width - 25, y + 32, 10, 2);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + 10, y + height - 7, width - 20, 2);
  context.fillStyle = palette.paper[1];
  context.fillRect(x + 31, y + height - 6, 10, 2);
  context.fillRect(x + width - 41, y + height - 6, 10, 2);
  context.fillStyle = palette.timber[0];
  context.fillRect(x + 5, y + height, 6, 3);
  context.fillRect(x + width - 11, y + height, 6, 3);
};

const drawShelf = (context: DrawContext, shelf: LibraryShelf) => {
  const rect = shelf.visualRect;
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = pixel(rect.width);
  const height = pixel(rect.height);
  const frontDepth = shelf.variant === 'wide-low' ? 7 : shelf.variant === 'compact' ? 6 : 9;
  const hasRaisedCap = shelf.variant === 'narrow-tall' || shelf.variant === 'endcap';
  drawWoodBlock(context, rect, frontDepth);

  const rows = [...new Set(shelf.slots.map((slot) => pixel(slot.rect.y)))];
  for (const rowY of rows) {
    const rowSlots = shelf.slots.filter((slot) => pixel(slot.rect.y) === rowY);
    const left = Math.min(...rowSlots.map((slot) => pixel(slot.rect.x)));
    const right = Math.max(...rowSlots.map((slot) => pixel(slot.rect.x + slot.rect.width)));
    const rowHeight = Math.max(...rowSlots.map((slot) => pixel(slot.rect.height)));
    context.fillStyle = palette.timber[0];
    context.fillRect(left - 1, rowY - 1, right - left + 2, rowHeight + 2);
    context.fillStyle = palette.ink[1];
    context.fillRect(left, rowY, right - left, rowHeight);
    context.fillStyle = palette.timber[0];
    for (let markX = left + 8; markX < right - 2; markX += 17) {
      context.fillRect(markX, rowY + rowHeight - 3, 7, 1);
    }
    context.fillStyle = palette.timber[1];
    context.fillRect(left - 2, rowY + rowHeight, right - left + 4, 2);
    context.fillStyle = palette.timber[3];
    context.fillRect(left - 1, rowY + rowHeight, right - left + 2, 1);
  }

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
    context.fillStyle = palette.green[2];
    context.fillRect(x + width - 7, y + 5, 5, height - 12);
    context.fillStyle = palette.green[3];
    context.fillRect(x + width - 7, y + 5, 1, height - 13);
    context.fillRect(x + width - 6, y + 8, 3, 2);
    context.fillRect(x + width - 6, y + height - 15, 3, 2);
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

const drawPlacedBook = (
  context: DrawContext,
  room: LibraryRoom,
  book: LibraryPlacedBook,
) => {
  const slot = room.shelves.flatMap((shelf) => shelf.slots).find((item) => item.id === book.slotId);
  if (!slot) return;
  const rect = slot.rect;
  const colors = [palette.bookCoral, palette.bookBlue, palette.bookSage][Math.abs(book.slotId) % 3];
  const x = pixel(rect.x);
  const y = pixel(rect.y);
  const width = Math.max(2, pixel(rect.width));
  const height = Math.max(2, pixel(rect.height));
  context.fillStyle = palette.ink[0];
  context.fillRect(x + 1, y + 1, width, height);
  context.fillStyle = colors[0];
  context.fillRect(x, y, width, height);
  context.fillStyle = colors[1];
  context.fillRect(x, y, width, 1);
  context.fillRect(x, y + height - 1, width, 1);
  context.fillStyle = palette.paper[2];
  context.fillRect(x + width - 1, y + 1, 1, Math.max(1, height - 2));
  context.fillStyle = palette.paper[3];
  if (width > 2) context.fillRect(x + 1, y + Math.floor(height / 2), width - 2, 1);
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
  context.fillStyle = palette.ink[0];
  context.fillRect(x + 8, y + 2, width - 16, height - 1);
  context.fillRect(x + 3, y + 8, width - 6, height - 12);
  context.fillRect(x, y + 16, width, height - 20);
  context.fillStyle = palette.lavender[0];
  context.fillRect(x + 8, y + 3, width - 16, height - 5);
  context.fillRect(x + 3, y + 9, width - 6, height - 14);
  context.fillRect(x + 1, y + 17, width - 2, height - 22);
  context.fillStyle = palette.lavender[1];
  context.fillRect(x + 10, y + 5, width - 20, 4);
  context.fillRect(x + 5, y + 10, 5, height - 19);
  context.fillStyle = palette.bookCoral[1];
  context.fillRect(x + Math.floor(width / 2) - 1, y + 9, 2, height - 14);
  context.fillRect(x + 7, y + height - 8, width - 14, 2);
  context.fillStyle = palette.ink[1];
  context.fillRect(x + 6, y + height - 3, width - 12, 2);
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

const getActionProgress = (scene: LibraryScene) => {
  if (!scene.action || scene.reducedMotion) return null;
  const elapsed = Math.max(0, scene.timeMs - scene.action.startedAt);
  return elapsed < 500 ? elapsed / 500 : null;
};

const getBearFeet = (scene: LibraryScene, room?: LibraryRoom): LibraryPoint => {
  const beanbag = room?.readingArea.beanbagVisualRect;
  if (scene.seated && beanbag) {
    return {
      x: beanbag.x + beanbag.width / 2,
      y: beanbag.y + beanbag.height - 4,
    };
  }
  return scene.player.position;
};

const drawPixelOval = (context: DrawContext, x: number, y: number, width: number, height: number, color: string) => {
  context.fillStyle = color;
  for (let row = 0; row < height; row += 1) {
    const distance = (row + 0.5 - height / 2) / (height / 2);
    const inset = Math.round(width / 2 * (1 - Math.sqrt(Math.max(0, 1 - distance * distance))));
    context.fillRect(pixel(x + inset), pixel(y + row), Math.max(1, width - inset * 2), 1);
  }
};

const drawBearPart = (context: DrawContext, x: number, y: number, width: number, height: number) => {
  drawPixelOval(context, x, y, width, height, palette.bear[0]);
  drawPixelOval(context, x + 1, y + 1, width - 2, height - 2, palette.bear[2]);
};

const drawSatchel = (context: DrawContext, x: number, y: number, facing: LibraryScene['player']['facing']) => {
  const left = facing === 'left';
  const bagX = x + (left ? 1 : 22);
  drawSteppedLine(context, x + (left ? 23 : 9), y + 25, bagX + 4, y + 32, palette.bear[0]);
  drawSteppedLine(context, x + (left ? 22 : 10), y + 25, bagX + 4, y + 31, palette.paper[3]);
  context.fillStyle = palette.bear[0];
  context.fillRect(bagX + 3, y + 27, 4, 5);
  drawPixelOval(context, bagX, y + 29, 10, 8, palette.bear[0]);
  context.fillStyle = palette.paper[3];
  context.fillRect(bagX + 4, y + 28, 2, 3);
  drawPixelOval(context, bagX + 1, y + 30, 8, 6, palette.paper[3]);
  context.fillStyle = palette.paper[1];
  context.fillRect(bagX + 3, y + 32, 1, 3);
  context.fillRect(bagX + 6, y + 33, 1, 2);
  context.fillStyle = palette.bear[0];
  context.fillRect(bagX + 3, y + 36, 1, 2);
  context.fillRect(bagX + 6, y + 36, 1, 2);
};

const drawCarriedBook = (context: DrawContext, x: number, y: number) => {
  context.fillStyle = palette.ink[0];
  context.fillRect(x - 1, y - 1, 10, 8);
  context.fillStyle = palette.bookBlue[0];
  context.fillRect(x, y, 8, 6);
  context.fillStyle = palette.bookBlue[1];
  context.fillRect(x + 1, y, 6, 2);
  context.fillStyle = palette.paper[3];
  context.fillRect(x + 6, y + 2, 1, 3);
};

const drawBear = (context: DrawContext, scene: LibraryScene, room: LibraryRoom) => {
  const { player } = scene;
  const feet = getBearFeet(scene, room);
  const x = pixel(feet.x - 16);
  const y = pixel(feet.y - 38);
  const safeTime = Number.isFinite(scene.timeMs) ? Math.max(0, scene.timeMs) : 0;
  const walking = player.isWalking && !scene.reducedMotion && !scene.seated;
  const step = walking ? Math.floor(safeTime / 140) % 2 : 0;
  const facing = scene.seated ? 'down' : player.facing;
  const sideFacing = facing === 'left' || facing === 'right';
  const left = facing === 'left';
  const actionProgress = getActionProgress(scene);
  const showCarriedBook = Boolean(scene.carriedDraft)
    && !(scene.action?.kind === 'receive' && actionProgress !== null);

  const leftLift = walking && step === 1 ? 1 : 0;
  const rightLift = walking && step === 0 ? 1 : 0;
  drawBearPart(context, x + 5, y + 30 - leftLift, 9, 8);
  drawBearPart(context, x + 18, y + 30 - rightLift, 9, 8);
  drawBearPart(context, x + 3, y + 21, 26, 14);
  if (facing === 'up') drawBearPart(context, x + 13, y + 29, 6, 5);

  const armSwing = walking ? (step === 0 ? -1 : 1) : 0;
  if (showCarriedBook) {
    if (sideFacing) {
      drawBearPart(context, x + (left ? 1 : 26), y + 24, 5, 8);
      drawBearPart(context, x + (left ? 4 : 20), y + 26, 8, 7);
    } else {
      drawBearPart(context, x + 5, y + 25, 7, 8);
      drawBearPart(context, x + 20, y + 25, 7, 8);
    }
  } else {
    drawBearPart(context, x + 1, y + 23 + armSwing, 7, 10);
    drawBearPart(context, x + 24, y + 23 - armSwing, 7, 10);
  }
  context.fillStyle = palette.bear[3];
  context.fillRect(x + 7, y + 25, 2, 5);

  const headShift = left ? -1 : facing === 'right' ? 1 : 0;
  drawBearPart(context, x + 2 + headShift, y + 1, 9, 10);
  drawBearPart(context, x + 21 + headShift, y + 1, 9, 10);
  drawPixelOval(context, x + 4 + headShift, y + 3, 5, 5, palette.bear[3]);
  drawPixelOval(context, x + 23 + headShift, y + 3, 5, 5, palette.bear[3]);
  drawBearPart(context, x + 1 + headShift, y + 5, 30, 20);
  context.fillStyle = palette.bear[3];
  context.fillRect(x + 7 + headShift, y + 7, 10, 1);
  context.fillRect(x + 4 + headShift, y + 10, 1, 5);
  if (facing !== 'up') {
    context.fillStyle = palette.bear[0];
    const nearEye = left ? 7 : facing === 'right' ? 13 : 9;
    const farEye = left ? 18 : facing === 'right' ? 24 : 21;
    context.fillRect(x + nearEye, y + 14, 2, 2);
    context.fillRect(x + farEye, y + 14, 2, 2);
  }

  const tailX = facing === 'right' ? x - 2 : x + 26;
  context.fillStyle = palette.bear[0];
  context.fillRect(tailX + 2, y + 20, 5, 8);
  context.fillRect(tailX, y + 23, 8, 3);
  context.fillStyle = palette.scarf[1];
  context.fillRect(tailX + 3, y + 21, 2, 6);
  context.fillRect(tailX + 1, y + 24, 6, 1);
  drawPixelOval(context, x + 3, y + 22, 26, 6, palette.bear[0]);
  drawPixelOval(context, x + 4, y + 23, 24, 3, palette.scarf[0]);
  context.fillStyle = palette.scarf[1];
  context.fillRect(x + 7, y + 23, 18, 2);
  drawSatchel(context, x, y, showCarriedBook && sideFacing ? (left ? 'right' : 'left') : facing);

  if (scene.seated) {
    drawBearPart(context, x + 3, y + 30, 11, 8);
    drawBearPart(context, x + 18, y + 30, 11, 8);
    drawPixelOval(context, x + 6, y + 33, 5, 3, palette.bear[1]);
    drawPixelOval(context, x + 21, y + 33, 5, 3, palette.bear[1]);
  }
  if (showCarriedBook && facing !== 'up') {
    const bookX = sideFacing ? x + (left ? 0 : 24) : x + 12;
    drawCarriedBook(context, bookX, y + 27);
    if (sideFacing) {
      drawBearPart(context, bookX + (left ? -1 : 6), y + 28, 3, 4);
      drawBearPart(context, bookX + (left ? 6 : -3), y + 29, 5, 5);
    } else {
      drawBearPart(context, bookX - 2, y + 29, 4, 5);
      drawBearPart(context, bookX + 7, y + 29, 4, 5);
    }
  }
};

const findShelfForBook = (room: LibraryRoom, book: LibraryPlacedBook) =>
  room.shelves.find((shelf) => shelf.slots.some((slot) => slot.id === book.slotId));

const getEntityRect = (room: LibraryRoom, id: string): LibraryRect | null => {
  if (id === room.desk.id) return room.desk.visualRect;
  if (id === room.failureBoard?.id) return room.failureBoard.visualRect;
  if (id === room.competitionBoard?.id) return room.competitionBoard.visualRect;
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
  if (scene.seated || scene.player.position.y >= floorY) return false;
  const left = scene.player.position.x - 18;
  const right = scene.player.position.x + 18;
  const top = scene.player.position.y - 38;
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
  context.globalAlpha = 0.3;
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
      body: (context) => drawDesk(context, room),
    },
    {
      id: 'player',
      floorY: scene.player.position.y,
      shadow: (context) => {
        if (scene.seated) return;
        const feet = getBearFeet(scene, room);
        context.save();
        context.globalAlpha = 0.25;
        drawPixelOval(context, pixel(feet.x - 12), pixel(feet.y - 3), 24, 5, palette.bear[0]);
        context.restore();
      },
      body: (context) => drawBear(context, scene, room),
    },
  ];

  if (room.competitionBoard) {
    const board = room.competitionBoard;
    const floorY = board.footCollider.y + board.footCollider.height;
    entities.push({
      id: board.id,
      floorY,
      shadow: context => drawContactShadow(context, board.footCollider),
      body: context => drawWithPlayerOcclusion(context, occlusionLayer,
        isPlayerBehind(scene, board.visualRect, floorY), target => drawCompetitionBoard(target, board.visualRect)),
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
      floorY: room.readingArea.benchFootCollider.y + room.readingArea.benchFootCollider.height,
      shadow: (context) => drawContactShadow(context, room.readingArea.benchFootCollider),
      body: (context) => drawBench(context, room.readingArea.benchVisualRect),
    },
  );
  if (room.readingArea.beanbagVisualRect && room.readingArea.beanbagFootCollider) {
    const beanbagRect = room.readingArea.beanbagVisualRect;
    const beanbagCollider = room.readingArea.beanbagFootCollider;
    entities.push({
      id: 'reading-beanbag',
      floorY: beanbagCollider.y + beanbagCollider.height,
      shadow: (context) => drawContactShadow(context, beanbagCollider),
      body: (context) => drawBeanbag(context, beanbagRect),
    });
  }

  for (const shelf of room.shelves) {
    const floorY = shelf.footCollider.y + shelf.footCollider.height;
    entities.push({
      id: shelf.id,
      floorY,
      shadow: (context) => drawContactShadow(context, shelf.footCollider),
      body: (context) => drawWithPlayerOcclusion(
        context,
        occlusionLayer,
        isPlayerBehind(scene, shelf.visualRect, floorY),
        (target) => drawShelf(target, shelf),
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

  for (const book of scene.placedBooks) {
    const shelf = findShelfForBook(room, book);
    if (!shelf) continue;
    const actionProgress = getActionProgress(scene);
    if (scene.action?.kind === 'place' && scene.action.slotId === book.slotId && actionProgress !== null) continue;
    entities.push({
      id: `placed-book:${book.slotId}`,
      floorY: shelf.footCollider.y + shelf.footCollider.height + 0.25,
      shadow: () => undefined,
      body: (context) => drawWithPlayerOcclusion(
        context,
        occlusionLayer,
        isPlayerBehind(scene, shelf.visualRect, shelf.footCollider.y + shelf.footCollider.height),
        (target) => drawPlacedBook(target, room, book),
      ),
    });
  }

  return entities.sort((a, b) => a.floorY - b.floorY || a.id.localeCompare(b.id));
};

const drawBookAction = (context: DrawContext, room: LibraryRoom, scene: LibraryScene) => {
  const progress = getActionProgress(scene);
  if (progress === null || !scene.action) return;
  const eased = 1 - Math.pow(1 - progress, 3);
  const feet = getBearFeet(scene, room);
  const side = scene.player.facing === 'left' ? -12 : scene.player.facing === 'right' ? 12 : 0;
  const hand = { x: feet.x + side, y: feet.y - 8 };
  let start = hand;
  let end = hand;
  if (scene.action.kind === 'receive') {
    start = {
      x: room.desk.visualRect.x + room.desk.visualRect.width * 0.72,
      y: room.desk.visualRect.y + 15,
    };
  } else {
    const slot = room.shelves
      .flatMap((shelf) => shelf.slots)
      .find((item) => item.id === scene.action?.slotId);
    if (!slot) return;
    end = { x: slot.rect.x + slot.rect.width / 2, y: slot.rect.y + slot.rect.height / 2 };
  }
  const x = pixel(start.x + (end.x - start.x) * eased - 4);
  const y = pixel(start.y + (end.y - start.y) * eased - 3 - Math.sin(progress * Math.PI) * 4);
  drawCarriedBook(context, x, y);
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

  let disposed = false;

  return {
    draw: (scene) => {
      if (disposed) return;
      context.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      context.drawImage(staticCanvas, 0, 0);
      if (room.failureBoard) drawFailureBoardNotes(context, room.failureBoard.visualRect, scene.boardNoteCount);
      const entities = createDepthEntities(room, scene, occlusionContext);
      for (const entity of entities) entity.shadow(context);
      for (const entity of entities) entity.body(context);
      drawBookAction(context, room, scene);
      drawSelectedSlot(context, room, scene.selectedSlotId);
      drawCue(context, room, scene);
    },
    dispose: () => {
      disposed = true;
      staticCanvas.width = 0;
      staticCanvas.height = 0;
      occlusionCanvas.width = 0;
      occlusionCanvas.height = 0;
    },
  };
};
