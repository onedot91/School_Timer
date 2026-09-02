import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STUDENT_PET_HATCH_AMOUNT,
  applyStudentPetPositionOverrides,
  feedStudentPetEgg,
  getStudentPetState,
  loadStoredStudentPetSnapshot,
  moveStudentPet,
  moveGomaCharacter,
  nameStudentPet,
  normalizeStudentPetStates,
  selectStudentPet,
  storeStudentPetSnapshot,
  storeStudentPetPositionOverride,
} from './studentPet';

test('a completed legacy egg becomes an owned pet and starts a new egg', () => {
  const pet = getStudentPetState({
    2: {
      fedAmount: STUDENT_PET_HATCH_AMOUNT,
      petKind: 'cat',
      name: '냥냥이',
      position: { x: 0.4, y: 0.6 },
    },
  }, 2);

  assert.equal(pet.fedAmount, 0);
  assert.equal(pet.ownedPets.length, 1);
  assert.equal(pet.ownedPets[0]?.name, '냥냥이');
  assert.equal(pet.eggKind, 'dog');
});

test('feeding a full egg adds the hatched pet and resets the next egg', () => {
  const pet = getStudentPetState({
    2: {
      fedAmount: 95,
      eggKind: 'rabbit',
      ownedPets: [{ id: 'cat-1', kind: 'cat', name: '냥냥이', position: { x: 0.4, y: 0.6 } }],
      activePetId: 'cat-1',
      pendingNamePetId: null,
    },
  }, 2);

  const hatched = feedStudentPetEgg(pet);

  assert.equal(hatched.fedAmount, 0);
  assert.equal(hatched.ownedPets.length, 2);
  assert.equal(hatched.petKind, 'rabbit');
  assert.equal(hatched.pendingNamePetId, hatched.activePetId);
  assert.equal(hatched.eggKind, 'dog');

  const fedAgain = feedStudentPetEgg(hatched);
  assert.equal(fedAgain.fedAmount, 5);
  assert.equal(fedAgain.ownedPets.length, 2);
});

test('only an owned pet can be selected and moved', () => {
  const pet = getStudentPetState({
    2: {
      fedAmount: 10,
      eggKind: 'rabbit',
      ownedPets: [{ id: 'cat-1', kind: 'cat', name: '냥냥이', position: { x: 0.4, y: 0.6 } }],
      activePetId: 'cat-1',
      pendingNamePetId: null,
    },
  }, 2);

  assert.equal(selectStudentPet(pet, 'fox-1'), null);
  const moved = moveStudentPet(pet, { x: 0.7, y: 0.3 });
  assert.deepEqual(moved?.position, { x: 0.7, y: 0.3 });
});

test('Goma character position is saved independently from the active pet', () => {
  const pet = getStudentPetState({ 2: { fedAmount: 0 } }, 2);
  const moved = moveGomaCharacter(pet, { x: 0.72, y: 0.46 });

  assert.deepEqual(moved.gomaPosition, { x: 0.72, y: 0.46 });
  assert.deepEqual(moved.position, pet.position);
});

test('pending pet and Goma positions survive a shared-state reload', () => {
  const storage = new Map<string, string>();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });

  try {
    const storedPet = getStudentPetState({
      2: {
        ownedPets: [{ id: 'cat-1', kind: 'cat', name: '냥냥이', position: { x: 0.4, y: 0.6 } }],
        activePetId: 'cat-1',
        gomaPosition: { x: 0.3, y: 0.7 },
      },
    }, 2);
    const movedPet = moveStudentPet(storedPet, { x: 0.74, y: 0.38 });
    const movedState = moveGomaCharacter(movedPet!, { x: 0.62, y: 0.48 });

    assert.equal(storeStudentPetPositionOverride(2, movedState), true);

    const reloaded = applyStudentPetPositionOverrides({
      2: {
        ownedPets: [{ id: 'cat-1', kind: 'cat', name: '냥냥이', position: { x: 0.4, y: 0.6 } }],
        activePetId: 'cat-1',
        gomaPosition: { x: 0.3, y: 0.7 },
      },
    });

    assert.deepEqual(reloaded['2']?.position, { x: 0.74, y: 0.38 });
    assert.deepEqual(reloaded['2']?.gomaPosition, { x: 0.62, y: 0.48 });
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('연습 모드 경매 상태는 학생과 교사 화면 재진입 후에도 유지된다', () => {
  const storage = new Map<string, string>();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });

  try {
    const snapshot = loadStoredStudentPetSnapshot();
    const item = { id: 'item-a', name: '창가 자리', startPrice: 10, dayIndex: 0 };
    const bid = { amount: 30, bidder: 7 };
    const bidEntry = {
      itemId: item.id,
      bidder: 7,
      amount: 30,
      createdAt: '2026-09-03T00:00:00.000Z',
    };
    const award = {
      itemId: item.id,
      winner: 7,
      amount: 30,
      awardedAt: '2026-09-03T00:01:00.000Z',
    };

    assert.equal(storeStudentPetSnapshot({
      ...snapshot,
      auctionItems: [item],
      auctionBids: { [item.id]: bid },
      auctionBidHistory: { [item.id]: [bidEntry] },
      auctionAwards: { [item.id]: award },
    }), true);

    const reloaded = loadStoredStudentPetSnapshot();
    assert.deepEqual(reloaded.auctionItems, [item]);
    assert.deepEqual(reloaded.auctionBids[item.id], bid);
    assert.deepEqual(reloaded.auctionBidHistory[item.id], [bidEntry]);
    assert.deepEqual(reloaded.auctionAwards[item.id], award);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('a newly hatched pet needs a name before the name request is cleared', () => {
  const hatched = feedStudentPetEgg(getStudentPetState({
    2: { fedAmount: 95, eggKind: 'cat', ownedPets: [], activePetId: null, pendingNamePetId: null },
  }, 2));

  assert.equal(nameStudentPet(hatched, ''), null);
  const named = nameStudentPet(hatched, '보리');
  assert.equal(named?.name, '보리');
  assert.equal(named?.pendingNamePetId, null);
  assert.deepEqual(normalizeStudentPetStates({ 2: named })['2'], named);
});
