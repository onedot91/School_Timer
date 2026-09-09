import { TEACHER_SETTING_FIELDS } from '../lib/teacherStorageCommand.js';
import { isStorageRecord, storageResourceKey } from '../lib/storageV2Codec.js';
import type { DeviceSession } from './deviceSession.js';
import { parseStorageScope, StorageScopeError, type StorageResourceSelector, type StorageScope } from './storageScope.js';

const allStudents = Array.from({ length: 23 }, (_, index) => index + 1);
const auction = ['auctionItems', 'auctionBids', 'auctionAwards', 'auctionBidHistory'];
const settings = [...TEACHER_SETTING_FIELDS, 'classroomRoleMission.enabled', 'classroomRoleMission.anchorDateKey',
  'classroomRoleMission.anchorStartStudentNumber', 'classDonation.enabled', 'classDonation.itemName', 'classDonation.targetAmount'];
const validStudents = (input: unknown): number[] => Array.isArray(input) ? [...new Set(input.filter((value): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 23))] : [];

/** Server-selected dependencies; neither resource paths nor owner scopes come from the request. */
export const storageCommandScope = (action: string, payload: unknown, session: DeviceSession, legacyReceipt = false): StorageScope => {
  const input = isStorageRecord(payload) ? payload : {};
  const resources: StorageResourceSelector[] = [], writes: StorageResourceSelector[] = [];
  const wallets = new Set<number>(), writeWallets = new Set<number>(), history = new Set<number>();
  const revisions = new Set<string>();
  const add = (selection: StorageResourceSelector, writable = true, collection = false) => {
    resources.push(selection); if (writable) writes.push(selection);
    if (collection) revisions.add(selection.students ? `scope:${selection.path.slice(1).split('/')[0]}:${selection.students[0]}` : `collection:${selection.path}`);
  };
  const field = (name: string, writable = true, collection = true) => {
    const path = storageResourceKey(...name.split('.'));
    add({ path }, writable);
    if (collection) revisions.add(name.includes('.') ? path : `scope:${name}:all`);
  };
  const money = (students: readonly number[], writable = true) => students.forEach(number => {
    wallets.add(number); history.add(number); if (writable) writeWallets.add(number);
  });
  const mail = (actor: number, direction: 'participant' | 'recipient' = 'recipient') => add({ path: '/studentLife/letters', mail: { actor, direction } });
  const own = session.role === 'student' ? session.studentNumber : null;
  const target = legacyReceipt ? allStudents : validStudents(input.studentNumbers ?? [input.studentNumber]);
  if (own !== null) {
    if (!action.startsWith('student.')) throw new StorageScopeError();
    if (action === 'student.letter.send' || action === 'student.letter.read') mail(own, 'participant');
    else if (action === 'student.failure.create') {
      add({ path: '/studentLife/failureStories', students: [own] }); money([own]);
    } else if (action === 'student.failure.stamp') {
      const path = !legacyReceipt && typeof input.storyId === 'string'
        ? storageResourceKey('studentLife', 'failureStories', `@${input.storyId}`) : '/studentLife/failureStories';
      add({ path }, true, true);
      revisions.add(`collection:${path}/stamps`);
    } else if (['student.pet.name', 'student.pet.select', 'student.pet.move', 'student.pet.feed'].includes(action)) {
      add({ path: '/studentPets', students: [own] }, true, true);
      if (action === 'student.pet.feed') { money([own]); auction.slice(0, 3).forEach(name => field(name, false)); }
    } else if (action === 'student.emotion.save') { add({ path: '/studentEmotionHistory', students: [own] }, true, true); money([own]); }
    else if (['student.sudoku.save', 'student.sudoku.complete', 'student.baseball.save', 'student.baseball.complete'].includes(action)) {
      add({ path: action.includes('.sudoku.') ? '/studentSudoku' : '/studentNumberBaseball', students: [own] }, true, true); money([own]);
    } else if (action === 'student.auction.bid') {
      auction.forEach(name => field(name, name === 'auctionBids' || name === 'auctionBidHistory')); money([own], false);
    } else throw new StorageScopeError();
  } else {
    if (!action.startsWith('teacher.')) throw new StorageScopeError();
    if (action === 'teacher.settings.patch') {
      const fields = legacyReceipt ? settings : Array.isArray(input.changes) ? input.changes.flatMap(change =>
        isStorageRecord(change) && typeof change.field === 'string' && settings.includes(change.field) ? [change.field] : []) : [];
      fields.forEach(name => field(name));
    } else if (['teacher.currency.adjust', 'teacher.currency.set', 'teacher.currency.reset'].includes(action)) money(action.endsWith('.reset') ? allStudents : target);
    else if (action === 'teacher.currency.deduct') {
      money(target); add({ path: '/studentEconomy', students: target.length ? target : allStudents }); target.forEach(number => mail(number));
    } else if (action === 'teacher.role.result') {
      field('classroomRoleMission'); money(target); target.forEach(number => mail(number));
    } else if (action === 'teacher.auction.finalize' || action === 'teacher.auction.remove') {
      auction.forEach(name => field(name));
      // An auction can refund the persisted winner, not an owner supplied by the browser.
      money(allStudents);
      if (action.endsWith('.remove')) field('auctionArchives');
    } else if (action === 'teacher.auction.weekly-close') {
      [...auction, 'auctionArchives', 'studentEconomy', 'studentStockMarket', 'teacherWeeklySettlements'].forEach(name => field(name)); money(allStudents);
    } else if (action === 'teacher.mail.send') {
      (legacyReceipt ? allStudents : validStudents(input.recipients)).forEach(number => mail(number));
    } else if (action === 'teacher.mail.read') mail(0);
    else if (action === 'teacher.writing.publish') { field('dailyWriting'); allStudents.forEach(number => mail(number)); }
    else if (action === 'teacher.writing.reward' || action === 'teacher.writing.cancel') { field('dailyWriting'); money(target); }
    else if (action === 'teacher.donation.reset') { field('classDonation'); field('classDonationArchives'); }
    else throw new StorageScopeError();
  }
  return parseStorageScope({ resources, wallets: [...wallets], history: [...history], writeResources: writes,
    writeWallets: [...writeWallets], revisionKeys: [...revisions] });
};

export const studentEditRevisionKeys = (action: string, studentNumber: number): readonly string[] => {
  const category = ['student.sudoku.save', 'student.sudoku.complete'].includes(action) ? 'studentSudoku'
    : action === 'student.emotion.save' ? 'studentEmotionHistory'
    : ['student.pet.name', 'student.pet.select', 'student.pet.move'].includes(action) ? 'studentPets' : null;
  return category ? [`scope:${category}:${studentNumber}`] : [];
};
