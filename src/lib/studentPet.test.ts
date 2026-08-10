import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STUDENT_PET_HATCH_AMOUNT,
  feedStudentPetEgg,
  getStudentPetState,
  moveStudentPet,
  nameStudentPet,
  normalizeStudentPetStates,
  selectStudentPet,
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
