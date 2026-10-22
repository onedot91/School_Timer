import { applyClassroomRoleMissionResultInSettings, loadStoredClassroomRoleMissionSettings, normalizeClassroomRoleMissionSettings, storeClassroomRoleMissionSettings, CLASSROOM_ROLE_MISSION_STORAGE_KEY } from './classroomRoleMission.js';
import { normalizeCurrencyBalances, normalizeCurrencyHistory } from './currency.js';
import { normalizeStudentLifeState } from './studentLife.js';
import { normalizeStudentEconomyState } from './studentEconomy.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  STUDENT_PET_HATCH_AMOUNT,
  STUDENT_PET_STORAGE_KEY,
  applyStudentPetPositionOverrides,
  feedStudentPetEgg,
  getStudentPetHatchMessage,
  getStudentPetState,
  loadStoredStudentPetSnapshot,
  moveStudentPet,
  moveGomaCharacter,
  nameStudentPet,
  normalizeStudentPetStates,
  selectStudentPet,
  storeStudentPetSnapshot,
  storeStudentPetPositionOverride,
  getStudentPetEggStage,
  STUDENT_PET_EGG_HATCHED_STAGE,
  STUDENT_PET_EGG_STAGE_COUNT,
  STUDENT_PET_KINDS,
  grantEveryStudentPet,
  hasHatchedEveryStudentPet,
  pickStudentPetHatchKind,
  STUDENT_PET_NAME_MAX_LENGTH,
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

test('feeding a full egg hatches a random kind the student does not own yet', () => {
  const owned = { id: 'cat-1', kind: 'cat', name: '냥냥이', position: { x: 0.4, y: 0.6 } } as const;
  const pet = getStudentPetState({
    2: { fedAmount: 95, eggKind: 'rabbit', ownedPets: [owned], activePetId: 'cat-1', pendingNamePetId: null },
  }, 2);

  const hatched = feedStudentPetEgg(pet, 2);
  assert.equal(hatched.fedAmount, 0);
  assert.equal(hatched.ownedPets.length, 2);
  assert.notEqual(hatched.petKind, 'cat');
  assert.equal(hatched.pendingNamePetId, hatched.activePetId);
  assert.ok(!hatched.ownedPets.some((pet) => pet.kind === hatched.eggKind));
  // The same student and collection always hatch the same kind, so a retried save agrees.
  assert.equal(feedStudentPetEgg(pet, 2).petKind, hatched.petKind);

  const fedAgain = feedStudentPetEgg(hatched, 2);
  assert.equal(fedAgain.fedAmount, 5);
  assert.equal(fedAgain.ownedPets.length, 2);
});

test('different students hatch their pets in different orders, never repeating a kind', () => {
  const firstKinds = new Set(Array.from({ length: 23 }, (_, i) => pickStudentPetHatchKind([], i + 1)));
  assert.ok(firstKinds.size >= 8, `first pets ${[...firstKinds].join()}`);
  let pet = getStudentPetState({}, 7);
  for (let i = 0; i < STUDENT_PET_KINDS.length; i += 1) pet = feedStudentPetEgg({ ...pet, fedAmount: 95 }, 7);
  assert.equal(new Set(pet.ownedPets.map((owned) => owned.kind)).size, STUDENT_PET_KINDS.length);
  assert.equal(hasHatchedEveryStudentPet(pet), true);
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

test('테스트 학생의 집 고치기는 로컬 저장 후에도 유지된다', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const snapshot = loadStoredStudentPetSnapshot();
    assert.equal(storeStudentPetSnapshot({
      ...snapshot,
      currencyBalances: { ...snapshot.currencyBalances, 24: 800 },
      studentEconomy: { 24: normalizeStudentEconomyState({ inventory: { house_repair: 1 } }) },
    }), true);
    const reloaded = loadStoredStudentPetSnapshot();
    assert.equal(reloaded.currencyBalances['24'], 800);
    assert.equal(reloaded.studentEconomy['24']?.inventory.house_repair, 1);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});


test('역할 차감의 잔액·결과·우편은 저장 실패와 재진입에서도 함께 유지된다', () => {
  const data = new Map<string, string>();
  let failSnapshot = false;
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === CLASSROOM_ROLE_MISSION_STORAGE_KEY || failSnapshot) throw new Error('QUOTA');
      data.set(key, value);
    },
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const role = normalizeClassroomRoleMissionSettings({ enabled: true, anchorDateKey: '2026-09-07', anchorStartStudentNumber: 3 });
    data.set(CLASSROOM_ROLE_MISSION_STORAGE_KEY, JSON.stringify(role));
    const initial = { ...loadStoredStudentPetSnapshot(), currencyBalances: normalizeCurrencyBalances({ 3: 100, 4: 333 }) };
    assert.equal(storeStudentPetSnapshot(initial), true);
    const applyAndStore = (requestId: string) => {
      const snapshot = loadStoredStudentPetSnapshot();
      const next = applyClassroomRoleMissionResultInSettings({ ...snapshot, classroomRoleMission: loadStoredClassroomRoleMissionSettings() }, {
        studentNumber: 3, nextResult: 'penalized', dateKey: '2026-09-07', requestId, createdAt: '2026-09-07T00:00:00.000Z',
      });
      return storeStudentPetSnapshot({ ...snapshot,
        classroomRoleMission: normalizeClassroomRoleMissionSettings(next.classroomRoleMission),
        currencyBalances: normalizeCurrencyBalances(next.currencyBalances),
        currencyHistory: normalizeCurrencyHistory(next.currencyHistory),
        studentLife: normalizeStudentLifeState(next.studentLife),
      });
    };
    const before = data.get(STUDENT_PET_STORAGE_KEY);
    failSnapshot = true;
    assert.equal(applyAndStore('failed'), false);
    assert.equal(data.get(STUDENT_PET_STORAGE_KEY), before);
    failSnapshot = false;
    assert.equal(applyAndStore('success'), true);
    assert.equal(loadStoredClassroomRoleMissionSettings().results['2026-09-07']['3'], 'penalized');
    assert.equal(applyAndStore('retry-after-reload'), true);
    const reloaded = loadStoredStudentPetSnapshot();
    assert.equal(reloaded.currencyBalances['3'], 80);
    assert.equal(reloaded.currencyBalances['4'], 333);
    assert.equal(reloaded.studentLife.letters.length, 1);
    assert.equal(reloaded.currencyHistory['3'].length, 1);
    assert.equal(storeClassroomRoleMissionSettings({ ...loadStoredClassroomRoleMissionSettings(), enabled: false }), true);
    assert.equal(loadStoredClassroomRoleMissionSettings().enabled, false);
    assert.equal(storeStudentPetSnapshot({ ...initial, currencyBalances: reloaded.currencyBalances, currencyHistory: reloaded.currencyHistory, studentLife: reloaded.studentLife }), true);
    assert.equal(loadStoredClassroomRoleMissionSettings().results['2026-09-07']['3'], 'penalized');
    assert.equal(loadStoredClassroomRoleMissionSettings().enabled, false);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('the hatch message names the animal with the right subject particle', () => {
  assert.equal(getStudentPetHatchMessage('cat'), '고양이가 태어났어요');
  assert.equal(getStudentPetHatchMessage('penguin'), '펭귄이 태어났어요');
  assert.equal(getStudentPetHatchMessage('sheep'), '양이 태어났어요');
  assert.equal(getStudentPetHatchMessage('cow'), '소가 태어났어요');
});

test('알은 고마를 줄 때마다 한 단계씩 더 갈라지고, 열린 알은 부화 장면에만 쓴다', () => {
  assert.equal(STUDENT_PET_EGG_STAGE_COUNT, 21);
  assert.equal(getStudentPetEggStage(0), 0);
  assert.equal(getStudentPetEggStage(4), 0);
  assert.equal(getStudentPetEggStage(5), 1);
  assert.equal(getStudentPetEggStage(95), 19);
  assert.equal(getStudentPetEggStage(100), STUDENT_PET_EGG_HATCHED_STAGE - 1);
  const sheet = readFileSync(new URL('../../public/pets/egg-stages.svg', import.meta.url), 'utf8');
  assert.match(sheet, new RegExp(`viewBox="0 0 ${120 * STUDENT_PET_EGG_STAGE_COUNT} 110"`));
});

test('모든 펫을 부화시키면 알을 더 키울 수 없다', () => {
  const pet = getStudentPetState({
    1: { fedAmount: 40, eggKind: 'rabbit', ownedPets: [{ id: 'cat-1', kind: 'cat', name: '나비', position: { x: 0.4, y: 0.6 } }], activePetId: 'cat-1', pendingNamePetId: null },
  }, 1);
  assert.equal(hasHatchedEveryStudentPet(pet), false);
  const all = grantEveryStudentPet(pet);
  assert.equal(all.ownedPets.length, STUDENT_PET_KINDS.length);
  assert.equal(new Set(all.ownedPets.map((owned) => owned.kind)).size, STUDENT_PET_KINDS.length);
  assert.equal(all.ownedPets[0]?.name, '나비');
  assert.equal(all.activePetId, 'cat-1');
  assert.equal(hasHatchedEveryStudentPet(all), true);
  assert.deepEqual(feedStudentPetEgg(all), all);
  assert.deepEqual(grantEveryStudentPet(all).ownedPets, all.ownedPets);
});

test('펫 이름은 8글자까지 짓고, 이미 지은 이름은 바꿀 수 없으며, 예전의 긴 이름은 그대로 둔다', () => {
  assert.equal(STUDENT_PET_NAME_MAX_LENGTH, 8);
  const hatched = getStudentPetState({
    1: { fedAmount: 0, eggKind: 'dog', ownedPets: [{ id: 'cat-1', kind: 'cat', name: '', position: { x: 0.4, y: 0.6 } }], activePetId: 'cat-1', pendingNamePetId: 'cat-1' },
  }, 1);
  const named = nameStudentPet(hatched, '가나다라마바사아자차');
  assert.equal(named?.name, '가나다라마바사아');
  assert.equal(named && nameStudentPet(named, '새이름'), null);
  const legacy = getStudentPetState({
    1: { fedAmount: 0, eggKind: 'dog', ownedPets: [{ id: 'cat-1', kind: 'cat', name: '열두글자이름을가진고양이', position: { x: 0.4, y: 0.6 } }], activePetId: 'cat-1', pendingNamePetId: null },
  }, 1);
  assert.equal(legacy.name, '열두글자이름을가진고양이'.slice(0, 12));
});
