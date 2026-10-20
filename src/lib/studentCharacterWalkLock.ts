export interface StudentCharacterWalkLock<T> {
  readonly walkCycle: number;
  readonly walker: T;
}

// 한 번 걷기 시작한 캐릭터는 그 걸음이 끝날 때까지 유지한다.
// 섞는 순서(일정 칸·타이머 종류·이미지 실패)가 바뀌어도 걷던 캐릭터를 다시 마운트하면 화면 끝으로 순간이동한다.
export const resolveLockedStudentCharacterWalker = <T extends { readonly character: { readonly id: string } }>(
  locks: Map<number, StudentCharacterWalkLock<T>>,
  streamIndex: number,
  walkCycle: number,
  visibleCharacterIds: ReadonlySet<string>,
  pick: () => T | null,
): T | null => {
  const locked = locks.get(streamIndex);
  if (locked && locked.walkCycle === walkCycle && visibleCharacterIds.has(locked.walker.character.id)) {
    return locked.walker;
  }
  const walker = pick();
  if (walker) locks.set(streamIndex, { walkCycle, walker });
  else locks.delete(streamIndex);
  return walker;
};
