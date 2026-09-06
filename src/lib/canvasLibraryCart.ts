import { findLibraryPlayerPath, stepLibraryPlayer, type LibraryPlayer, type LibraryPoint, type LibraryRect, type LibraryRoom } from './canvasLibraryWorld.js';

const sameRect = (a: LibraryRect, b: LibraryRect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const overlaps = (a: LibraryRect, b: LibraryRect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const resolveLibraryCartRoom = (room: LibraryRoom, position?: LibraryPoint): LibraryRoom => {
  const cart = room.decorations?.find(decoration => decoration.kind === 'return-cart');
  if (!position || !cart?.footCollider || (position.x === cart.visualRect.x && position.y === cart.visualRect.y)) return room;
  const dx = position.x - cart.visualRect.x;
  const dy = position.y - cart.visualRect.y;
  const footCollider = { ...cart.footCollider, x: cart.footCollider.x + dx, y: cart.footCollider.y + dy };
  const moved = { ...cart, visualRect: { ...cart.visualRect, ...position }, footCollider,
    interactionPoint: cart.interactionPoint ? { x: cart.interactionPoint.x + dx, y: cart.interactionPoint.y + dy } : undefined };
  return { ...room, decorations: room.decorations?.map(decoration => decoration.id === cart.id ? moved : decoration),
    obstacles: room.obstacles.map(rect => sameRect(rect, cart.footCollider!) ? footCollider : rect) };
};

export const stepLibraryCart = (room: LibraryRoom, player: LibraryPlayer, input: LibraryPoint, elapsedMs: number) => {
  const cart = room.decorations?.find(decoration => decoration.kind === 'return-cart');
  if (!cart?.footCollider || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return { player, position: cart?.visualRect };
  let currentRoom = room;
  let currentPlayer = player;
  let position: LibraryPoint = { x: cart.visualRect.x, y: cart.visualRect.y };
  let remaining = Math.min(100, elapsedMs) * 0.6;
  while (remaining > 0) {
    const duration = Math.min(10, remaining);
    remaining -= duration;
    const nextPlayer = stepLibraryPlayer(currentRoom, currentPlayer, input, duration);
    const dx = nextPlayer.position.x - currentPlayer.position.x;
    const dy = nextPlayer.position.y - currentPlayer.position.y;
    if (dx === 0 && dy === 0) break;
    const nextPosition = { x: position.x + dx, y: position.y + dy };
    const proposed = resolveLibraryCartRoom(currentRoom, nextPosition);
    const nextCart = proposed.decorations!.find(decoration => decoration.id === cart.id)!;
    const rect = nextCart.visualRect;
    const bounds = room.walkableBounds;
    if (rect.x < bounds.x || rect.y < bounds.y || rect.x + rect.width > bounds.x + bounds.width || rect.y + rect.height > bounds.y + bounds.height
      || proposed.obstacles.some(obstacle => obstacle !== nextCart.footCollider && overlaps(obstacle, nextCart.footCollider!))) break;
    currentRoom = proposed;
    currentPlayer = nextPlayer;
    position = nextPosition;
  }
  return { player: { ...currentPlayer, isWalking: position.x !== cart.visualRect.x || position.y !== cart.visualRect.y }, position };
};

export const canParkLibraryCart = (room: LibraryRoom, player: LibraryPlayer) => {
  const targets = [room.desk.interactionPoint, ...room.shelves.map(shelf => shelf.interactionPoint),
    ...[room.readingArea.interactionPoint, room.failureBoard?.interactionPoint, room.competitionBoard?.interactionPoint].filter((point): point is LibraryPoint => Boolean(point)),
    ...(room.ambientObjects ?? []).filter(object => object.kind !== 'cat').map(object => object.interactionPoint)];
  if (room.exit) targets.push({ x: room.exit.triggerRect.x + room.exit.triggerRect.width / 2, y: room.exit.triggerRect.y - 4 });
  return targets.every(point => findLibraryPlayerPath(room, player, point) !== null);
};
