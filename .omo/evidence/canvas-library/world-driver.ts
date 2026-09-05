import assert from 'node:assert/strict';
import {
  createFullLibraryRoom,
  createLibraryPlayer,
  createSmallLibraryRoom,
  getNearbyLibraryTarget,
  placeLibraryDraft,
  stepLibraryPlayer,
  type LibraryPlayer,
  type LibraryPlacedBook,
  type LibraryPoint,
  type LibraryRoom,
} from '../../../src/lib/canvasLibraryWorld.js';

const room = createSmallLibraryRoom();
const originalPlayer = createLibraryPlayer(room, 7);
const roomSnapshot = structuredClone(room);

const walkTo = (start: LibraryPlayer, target: LibraryPoint): LibraryPlayer => {
  let current = start;
  for (let step = 0; step < 1_000 && Math.hypot(target.x - current.position.x, target.y - current.position.y) > 1; step += 1) {
    current = stepLibraryPlayer(room, current, {
      x: target.x - current.position.x,
      y: target.y - current.position.y,
    }, 16);
  }
  return current;
};

const atDesk = walkTo(originalPlayer, room.desk.interactionPoint);
assert.equal(getNearbyLibraryTarget(room, atDesk, [])?.kind, 'registration-desk');

const syntheticDraft = { studentNumber: 7, title: '달빛 우체국', author: '이지은', pageCount: 128 };
const shelf = room.shelves[0];
const slot = shelf?.slots[0];
assert.ok(shelf);
assert.ok(slot);
const atShelf = walkTo(atDesk, shelf.interactionPoint);
assert.equal(getNearbyLibraryTarget(room, atShelf, [])?.kind, 'shelf');
const allSlotsReachable = room.shelves.flatMap((candidateShelf) => candidateShelf.slots).every((candidateSlot) => {
  const reached = walkTo(originalPlayer, candidateSlot.interactionPoint);
  return Math.hypot(candidateSlot.interactionPoint.x - reached.position.x, candidateSlot.interactionPoint.y - reached.position.y) <= 1;
});
assert.equal(allSlotsReachable, true);
const window = room.readingArea.windowRect;
const rearWallStop = walkTo(originalPlayer, {
  x: window.x + window.width / 2,
  y: window.y + window.height / 2,
});
const rearFeetTop = rearWallStop.position.y - rearWallStop.feetCollider.height / 2;
assert.equal(rearFeetTop >= room.walkableBounds.y, true);
assert.equal(rearWallStop.position.y > window.y + window.height, true);

const placed = placeLibraryDraft(room, [], syntheticDraft, slot.id);
assert.equal(placed.carriedDraft, null);
assert.equal(placed.placedBook?.title, syntheticDraft.title);
assert.ok(placed.placedBook);
const atBook = walkTo(atShelf, slot.interactionPoint);
const bookTarget = getNearbyLibraryTarget(room, atBook, placed.placedBooks);
assert.equal(bookTarget?.kind, 'placed-book');
const readTitle = bookTarget?.kind === 'placed-book' ? bookTarget.book.title : null;
assert.equal(readTitle, syntheticDraft.title);

const rejected = placeLibraryDraft(room, placed.placedBooks, syntheticDraft, slot.id);
assert.equal(rejected.placedBook, null);
assert.equal(rejected.placedBooks, placed.placedBooks);
assert.equal(rejected.carriedDraft, syntheticDraft);

const table = room.readingArea.tableFootCollider;
const collisionStart = {
  ...originalPlayer,
  position: { x: table.x - 24, y: table.y + table.height / 2 },
};
const collisionStop = stepLibraryPlayer(room, collisionStart, { x: 1, y: 0 }, 1_000);
assert.equal(collisionStop.position.x <= table.x - collisionStop.feetCollider.width / 2, true);
assert.deepEqual(room, roomSnapshot);
assert.deepEqual(originalPlayer, createLibraryPlayer(room, 7));

const fullRoom = createFullLibraryRoom();
const fullRoomSnapshot = structuredClone(fullRoom);
const fullPlayer = createLibraryPlayer(fullRoom, 7);
const fullSlots = fullRoom.shelves.flatMap((candidateShelf) => candidateShelf.slots);
const queue: LibraryPlayer[] = [fullPlayer];
const graphPlayers: LibraryPlayer[] = [fullPlayer];
const visited = new Set([`${fullPlayer.position.x},${fullPlayer.position.y}`]);
for (let cursor = 0; cursor < queue.length && cursor < 50_000; cursor += 1) {
  const current = queue[cursor];
  assert.ok(current);
  for (const input of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]) {
    const next = stepLibraryPlayer(fullRoom, current, input, 40);
    const key = `${Math.round(next.position.x)},${Math.round(next.position.y)}`;
    if (visited.has(key)) continue;
    visited.add(key);
    queue.push(next);
    graphPlayers.push(next);
  }
}
assert.equal(queue.length < 50_000, true);
const fullSlotsReachable = fullSlots.every((candidateSlot) => graphPlayers.some((player) => (
  Math.hypot(player.position.x - candidateSlot.interactionPoint.x, player.position.y - candidateSlot.interactionPoint.y) <= 28
)));
assert.equal(fullSlotsReachable, true);

const fullBooks = fullSlots.reduce<readonly LibraryPlacedBook[]>(
  (books, candidateSlot) => placeLibraryDraft(fullRoom, books, { ...syntheticDraft, title: `책 ${candidateSlot.id}` }, candidateSlot.id).placedBooks,
  [],
);
assert.equal(fullBooks.length, 100);
const shelfPickersReachable = fullRoom.shelves.every((candidateShelf) => {
  const nearest = graphPlayers.reduce((best, player) => (
    Math.hypot(player.position.x - candidateShelf.interactionPoint.x, player.position.y - candidateShelf.interactionPoint.y)
    < Math.hypot(best.position.x - candidateShelf.interactionPoint.x, best.position.y - candidateShelf.interactionPoint.y) ? player : best
  ));
  const target = getNearbyLibraryTarget(fullRoom, nearest, fullBooks);
  return target?.kind === 'shelf'
    && target.shelfId === candidateShelf.id
    && candidateShelf.slots.every((candidateSlot) => fullBooks.some((book) => book.slotId === candidateSlot.id));
});
assert.equal(shelfPickersReachable, true);

const fullDirectSlot = fullRoom.shelves[0]?.slots[0];
assert.ok(fullDirectSlot);
assert.equal(getNearbyLibraryTarget(fullRoom, { ...fullPlayer, position: fullDirectSlot.interactionPoint }, fullBooks)?.kind, 'placed-book');
const overflowDraft = { ...syntheticDraft, title: '101번째 책' };
const overflow = placeLibraryDraft(fullRoom, fullBooks, overflowDraft, fullDirectSlot.id);
assert.equal(overflow.placedBook, null);
assert.equal(overflow.placedBooks, fullBooks);
assert.equal(overflow.carriedDraft, overflowDraft);
assert.deepEqual(fullRoom, fullRoomSnapshot);

console.log(JSON.stringify({
  deskTarget: 'registration-desk',
  shelfTarget: shelf.id,
  placedSlotId: placed.placedBook.slotId,
  readTitle,
  collisionStoppedX: collisionStop.position.x,
  allSlotsReachable,
  rearFeetTop,
  floorStartY: room.walkableBounds.y,
  wallAndWindowInteriorsUnreachable: true,
  rejectedSecondPlacementRetainedFirst: rejected.placedBooks === placed.placedBooks,
  inputsUnchanged: true,
  fullRoom: {
    slotCount: fullSlots.length,
    stableFirstSlotId: fullSlots[0]?.id,
    stableLastSlotId: fullSlots.at(-1)?.id,
    graphStateCount: graphPlayers.length,
    all100InteractionPointsReachable: fullSlotsReachable,
    allFiveFullyOccupiedShelfPickersReachable: shelfPickersReachable,
    directBookOutsidePickerCenter: true,
    rejected101stPlacementRetained100: overflow.placedBooks === fullBooks,
    roomInputUnchanged: true,
  },
}, null, 2));
