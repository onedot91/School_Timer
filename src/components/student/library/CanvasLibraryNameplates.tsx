import { useMemo, type RefObject } from 'react';
import type { LibraryRect, LibraryRoom, LibraryScene } from '../../../lib/canvasLibraryWorld';
import { getLibraryBearPose, LIBRARY_BEAR_BOUNDS } from '../../../lib/canvasLibraryPose';

export const isLibraryFurnitureOccluded = (scene: LibraryScene, rect: LibraryRect, floorY: number) => {
  if (scene.seated || scene.ambientState?.benchObjectId || scene.player.position.y >= floorY) return false;
  const left = scene.player.position.x + LIBRARY_BEAR_BOUNDS.left;
  const right = scene.player.position.x + LIBRARY_BEAR_BOUNDS.right;
  const top = scene.player.position.y + LIBRARY_BEAR_BOUNDS.top;
  return right > rect.x && left < rect.x + rect.width
    && scene.player.position.y > rect.y && top < rect.y + rect.height;
};

export const getLibraryNameplates = (room: LibraryRoom) => {
  const nameplates: Array<{ id: string; text: string; rect: LibraryRect; fontSize: number; foregroundFloorY?: number; occlusion?: { rect: LibraryRect; floorY: number } }> = [];
  const groupIds = new Set(room.shelves.map(shelf => shelf.visualGroupId).filter(id => id !== undefined));
  for (const id of groupIds) {
    const shelves = room.shelves.filter(shelf => shelf.visualGroupId === id);
    const x = Math.min(...shelves.map(shelf => shelf.visualRect.x));
    const y = Math.min(...shelves.map(shelf => shelf.visualRect.y));
    const right = Math.max(...shelves.map(shelf => shelf.visualRect.x + shelf.visualRect.width));
    const bottom = Math.max(...shelves.map(shelf => shelf.visualRect.y + shelf.visualRect.height));
    nameplates.push({ id, text: '우리 반 책장', rect: { x: Math.round((x + right) / 2) - 33, y: y + 1, width: 66, height: 10 }, fontSize: 8,
      occlusion: { rect: { x, y, width: right - x, height: bottom - y }, floorY: Math.max(...shelves.map(shelf => shelf.footCollider.y + shelf.footCollider.height)) } });
  }
  const desk = room.desk.visualRect;
  nameplates.push({ id: room.desk.id, text: '책 등록', rect: { x: Math.round(desk.x + desk.width / 2) - 22, y: desk.y + desk.height - 11, width: 44, height: 10 }, fontSize: 8,
    foregroundFloorY: room.desk.footCollider.y + room.desk.footCollider.height });
  if (room.failureBoard) {
    const board = room.failureBoard.visualRect;
    nameplates.push({ id: room.failureBoard.id, text: '?', rect: { x: Math.round(board.x + board.width / 2) - 10, y: board.y + 6, width: 20, height: 14 }, fontSize: 11 });
  }
  return nameplates;
};

export const getLibraryNameplateOpacity = (nameplate: ReturnType<typeof getLibraryNameplates>[number], scene: LibraryScene, room: LibraryRoom) => {
  if (nameplate.foregroundFloorY !== undefined) {
    const feet = getLibraryBearPose(scene, room).feet;
    const rect = nameplate.rect;
    if (scene.action?.kind === 'receive' || (feet.y >= nameplate.foregroundFloorY
      && feet.x + LIBRARY_BEAR_BOUNDS.right > rect.x && feet.x + LIBRARY_BEAR_BOUNDS.left < rect.x + rect.width
      && feet.y > rect.y && feet.y + LIBRARY_BEAR_BOUNDS.top < rect.y + rect.height)) return 0;
  }
  return nameplate.occlusion && isLibraryFurnitureOccluded(scene, nameplate.occlusion.rect, nameplate.occlusion.floorY) ? 0.28 : 1;
};

export function CanvasLibraryNameplates({ room, displayScale, elementsRef, scene }: {
  room: LibraryRoom;
  displayScale: number;
  elementsRef?: RefObject<Array<HTMLSpanElement | null>>;
  scene?: LibraryScene;
}) {
  const nameplates = useMemo(() => getLibraryNameplates(room), [room]);
  return nameplates.map((nameplate, index) => <span key={nameplate.id}
    ref={element => { if (elementsRef) elementsRef.current[index] = element; }}
    className="student-canvas-library-nameplate" aria-hidden="true"
    style={{ left: `${nameplate.rect.x / room.width * 100}%`, top: `${nameplate.rect.y / room.height * 100}%`,
      width: `${nameplate.rect.width / room.width * 100}%`, height: `${nameplate.rect.height / room.height * 100}%`,
      fontSize: nameplate.fontSize * displayScale, opacity: scene ? getLibraryNameplateOpacity(nameplate, scene, room) : 1 }}>
    {nameplate.text}
  </span>);
}
