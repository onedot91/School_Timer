import type { LibraryRect } from '../../../lib/canvasLibraryWorld';
import { CANVAS_LIBRARY_PALETTE as palette } from './CanvasLibraryPalette';

export const drawCompetitionBoard = (context: CanvasRenderingContext2D, rect: LibraryRect): void => {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const paint = (color: string, left: number, top: number, width: number, height: number) => {
    context.fillStyle = color;
    context.fillRect(x + left, y + top, width, height);
  };
  paint(palette.timber[0], 4, 30, rect.width - 8, rect.height - 30);
  paint(palette.timber[3], 0, 27, rect.width, 6);
  paint(palette.paper[3], 3, 27, rect.width - 6, 2);
  paint(palette.lavender[0], 7, 33, rect.width - 14, 29);
  paint(palette.lavender[1], 10, 35, rect.width - 20, 24);
  paint(palette.timber[2], 7, 62, rect.width - 14, 5);
  paint(palette.timber[0], 8, 67, 8, 3);
  paint(palette.timber[0], rect.width - 16, 67, 8, 3);
  paint(palette.bookBlue[0], 20, 41, 20, 16);
  paint(palette.bookBlue[1], 20, 41, 20, 3);
  paint(palette.paper[1], 41, 37, 25, 20);
  paint(palette.paper[3], 41, 37, 25, 3);
  paint(palette.bookCoral[0], 67, 46, 20, 11);
  paint(palette.bookCoral[1], 67, 46, 20, 3);
  paint(palette.ink[0], 43, 23, 24, 4);
  paint(palette.paper[0], 45, 20, 20, 3);
  paint(palette.paper[1], 51, 14, 8, 6);
  paint(palette.paper[0], 36, 3, 38, 4);
  paint(palette.paper[0], 36, 7, 4, 6);
  paint(palette.paper[0], 70, 7, 4, 6);
  paint(palette.paper[1], 39, 11, 10, 4);
  paint(palette.paper[1], 62, 11, 10, 4);
  paint(palette.paper[0], 44, 3, 22, 12);
  paint(palette.paper[1], 46, 3, 18, 12);
  paint(palette.paper[2], 48, 5, 5, 8);
  paint(palette.paper[3], 44, 0, 22, 3);
};
