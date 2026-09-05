import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryRenderer } from '../components/student/library/CanvasLibraryRenderer';
import { CANVAS_LIBRARY_PALETTE as palette } from '../components/student/library/CanvasLibraryPalette';
import { getLibraryPlacedBookRect } from './canvasLibraryPose';
import { createFullLibraryRoom, createLibraryPlayer, type LibraryScene } from './canvasLibraryWorld';

type Paint = { kind: 'rect'; x: number; y: number; width: number; height: number; color: string; alpha: number }
  | { kind: 'image'; canvas: unknown; alpha: number }
  | { kind: 'clear'; x: number; y: number; width: number; height: number };

function recordingCanvas() {
  const paints: Paint[] = [];
  const stack: Array<{ alpha: number; color: string }> = [];
  const context = {
    fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: false,
    save() { stack.push({ alpha: this.globalAlpha, color: this.fillStyle }); },
    restore() { const state = stack.pop(); if (state) { this.globalAlpha = state.alpha; this.fillStyle = state.color; } },
    fillRect(x: number, y: number, width: number, height: number) { paints.push({ kind: 'rect', x, y, width, height, color: this.fillStyle, alpha: this.globalAlpha }); },
    clearRect(x: number, y: number, width: number, height: number) { paints.push({ kind: 'clear', x, y, width, height }); },
    drawImage(canvas: unknown) { paints.push({ kind: 'image', canvas, alpha: this.globalAlpha }); },
    translate() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
  };
  const canvas = { width: 0, height: 0, getContext: () => context };
  Object.assign(context, { canvas });
  return { canvas, paints };
}

test('게시판 메모 0·1·24개는 코르크 안에 있고 출입구는 전경에 55%로 한 번 합성된다', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const layers: ReturnType<typeof recordingCanvas>[] = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => { const layer = recordingCanvas(); layers.push(layer); return layer.canvas; },
  } });
  try {
    const room = createFullLibraryRoom();
    assert.ok(room.failureBoard && room.exit);
    const target = recordingCanvas();
    const renderer = createLibraryRenderer(target.canvas as unknown as HTMLCanvasElement, room);
    const board = room.failureBoard.visualRect;
    const door = room.exit.visualRect;
    const entrance = layers.find(layer => layer.paints.some(paint => paint.kind === 'rect'
      && paint.x === door.x && paint.y === door.y && paint.width === door.width && paint.height === door.height));
    assert.ok(entrance);
    assert.ok(entrance.paints.every(paint => paint.kind !== 'rect' || (paint.alpha === 1
      && paint.x >= door.x && paint.x + paint.width <= door.x + door.width
      && paint.y >= door.y && paint.y + paint.height <= door.y + door.height)), 'no surrounding wall may be drawn');
    assert.ok(entrance.paints.some(paint => paint.kind === 'clear' && paint.x === door.x
      && paint.y === door.y + door.height - 3 && paint.width === door.width && paint.height === 3));
    const staticLayer = layers[0];
    const corkStart = staticLayer.paints.findIndex(paint => paint.kind === 'rect'
      && paint.x === board.x + 4 && paint.y === board.y + 4
      && paint.width === board.width - 8 && paint.height === board.height - 8 && paint.color === palette.timber[1]);
    assert.ok(corkStart >= 0);
    const corkTexture = staticLayer.paints.slice(corkStart + 1).filter(paint => paint.kind === 'rect'
      && paint.x > board.x + 4 && paint.x < board.x + board.width - 4
      && paint.y > board.y + 4 && paint.y < board.y + board.height - 4);
    assert.ok(corkTexture.length > 20);
    assert.ok(corkTexture.every(paint => paint.kind === 'rect' && paint.width === 1 && paint.height === 1 && paint.alpha === 0.16));
    const scene: LibraryScene = { player: createLibraryPlayer(room), placedBooks: [], carriedDraft: null,
      nearbyTarget: null, selectedSlotId: null, timeMs: 0, reducedMotion: true };
    for (const count of [0, 1, 24]) {
      target.paints.length = 0;
      renderer.draw({ ...scene, boardNoteCount: count });
      const papers = target.paints.filter(paint => paint.kind === 'rect' && paint.color === palette.paper[2]
        && paint.x >= board.x && paint.x < board.x + board.width && paint.y >= board.y && paint.y < board.y + board.height);
      assert.equal(papers.length, count);
      for (const paper of papers) {
        assert.ok(paper.kind === 'rect');
        assert.ok(paper.x >= board.x + 4 && paper.y - 1 >= board.y + 4);
        assert.ok(paper.x + paper.width <= board.x + board.width - 4);
        assert.ok(paper.y + paper.height <= board.y + board.height - 4);
      }
      const composites = target.paints.filter(paint => paint.kind === 'image' && paint.canvas === entrance.canvas);
      assert.deepEqual(composites, [{ kind: 'image', canvas: entrance.canvas, alpha: 0.55 }]);
      assert.equal(target.paints.at(-1), composites[0]);
    }
    const books = room.shelves.flatMap(shelf => shelf.slots).map(slot => ({ slotId: slot.id, title: `검수 ${slot.id}`, author: '검수', pageCount: 128, studentNumber: 1 }));
    const occlusion = layers[1];
    for (const x of [190, 290]) {
      target.paints.length = 0;
      occlusion.paints.length = 0;
      renderer.draw({ ...scene, placedBooks: books, player: { ...scene.player, position: { x, y: 192 } } });
      assert.equal(target.paints.filter(paint => paint.kind === 'image' && paint.canvas === occlusion.canvas && paint.alpha === 0.28).length, 1);
      for (const book of books.filter(book => book.slotId >= 50)) {
        const rect = getLibraryPlacedBookRect(room, book);
        assert.ok(rect);
        assert.ok(occlusion.paints.some(paint => paint.kind === 'rect' && paint.x === rect.x && paint.y === rect.y
          && paint.width === rect.width && paint.height === rect.height), `both sections must fade together: slot ${book.slotId}`);
      }
    }
    target.paints.length = 0;
    renderer.draw({ ...scene, placedBooks: books, player: { ...scene.player, position: { x: 290, y: 244 } } });
    assert.equal(target.paints.some(paint => paint.kind === 'image' && paint.canvas === occlusion.canvas && paint.alpha === 0.28), false);
    assert.equal(staticLayer.paints.some(paint => paint.kind === 'rect' && paint.x >= door.x - 3 && paint.y >= door.y - 15
      && paint.x + paint.width <= door.x + door.width + 3 && paint.y + paint.height <= door.y
      && [palette.green[1], palette.green[2], palette.green[3]].some(color => color === paint.color)), false, 'entry mat is removed');
    assert.equal(layers.length, 3, 'cached room/occlusion/entrance layers must not be recreated per frame');
    renderer.dispose();
    assert.ok(layers.every(layer => layer.canvas.width === 0 && layer.canvas.height === 0));
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
