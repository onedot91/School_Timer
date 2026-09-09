import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { createStorageV2Fixture } from './storageV2Fixture.js';
import { createSudokuPuzzle } from '../../src/lib/sudoku.js';
import { getKoreanIsoWeekKey } from '../../src/lib/weeklyMission.js';

const secret = 'storage-test-only-secret-at-least-32-bytes';
const initial = () => ({
  version: 1, scheduleNotice: 'original',
  currencyBalances: Object.fromEntries(Array.from({length:23},(_,i)=>[String(i+1),100])),
  currencyHistory: Object.fromEntries(Array.from({length:23},(_,i)=>[String(i+1),[]])),
  studentLife: { letters: [
    {id:'private-letter',recipient:4,senderStudentNumber:0,senderLabel:'teacher',title:'private',content:'private',createdAt:'2026-09-08T00:00:00.000Z',readAt:null},
    {id:'own-letter',recipient:2,senderStudentNumber:0,senderLabel:'teacher',title:'own',content:'own',createdAt:'2026-09-08T00:00:00.000Z',readAt:null},
  ],books:[],failureStories:[],failureProfileAssignments:{} },
});

const environment = async (run: (call: (actor:number,method:string,body?:unknown,query?:Record<string,string>,projection?:boolean)=>Promise<{status:number;body:unknown}>,fixture:ReturnType<typeof createStorageV2Fixture>)=>Promise<void>) => {
  const saved = {...process.env}; const originalFetch=globalThis.fetch;
  process.env.SUPABASE_URL='https://storage-fixture.test';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
  process.env.DEVICE_SESSION_SECRET=secret;process.env.STORAGE_PROTOCOL_VERSION='2';
  const fixture=createStorageV2Fixture(initial()); globalThis.fetch=async (input, init) => {
    assert.ok(!String(input).endsWith('/storage_load_snapshot'), 'Commands and receipts must not load the full class');
    return fixture.fetch(input, init);
  };
  const call=async(actor:number,method:string,body?:unknown,query?:Record<string,string>,projection=true)=>{
    let status=0;let output:unknown;
    const token=createDeviceSessionToken(actor===0?{role:'teacher'}:{role:'student',studentNumber:actor},secret);
    const response={setHeader(){},status(code:number){status=code;return this;},json(value:unknown){output=value;}};
    await handler({method,body,query,headers:{cookie:`__Host-school-timer-device=${token}`,'sec-fetch-site':'same-origin',...(projection ? {'x-storage-projection':'1'} : {})}},response);
    return {status,body:output};
  };
  try {await run(call,fixture);} finally {globalThis.fetch=originalFetch;process.env=saved;}
};
const command=(requestId:string,action:string,payload:unknown)=>({protocolVersion:2,requestId,action,payload});

test('v2 rejects legacy money snapshots and student teacher commands',()=>environment(async(call,fixture)=>{
  assert.equal((await call(2,'PUT',{value:{currencyBalances:{2:999999}}})).status,409);
  assert.equal((await call(2,'POST',command('scope-test-0001','teacher.currency.adjust',{studentNumbers:[2],amount:100}))).status,403);
  assert.equal(Reflect.get(Object(fixture.read().value.currencyBalances),'2'),100);
}));

test('confirmed request replays before checking stale teacher settings; changed payload rejects',()=>environment(async(call,fixture)=>{
  const payload={changes:[{field:'scheduleNotice',before:'original',after:'changed'}]};
  const body=command('teacher-settings-0001','teacher.settings.patch',payload);
  assert.equal((await call(0,'POST',body)).status,200);
  assert.equal((await call(0,'POST',body)).status,200);
  assert.equal((await call(0,'POST',command('teacher-settings-0001','teacher.settings.patch',{changes:[]}))).status,409);
  assert.equal(fixture.read().value.scheduleNotice,'changed');
}));

test('mail write and receipt stay actor scoped and preserve other letters',()=>environment(async(call,fixture)=>{
  const result=await call(2,'POST',command('mail-request-0001','student.letter.send',{recipient:0,title:'hello',content:'test'}));
  assert.equal(result.status,200);
  const projection=Reflect.get(Object(result.body),'value');
  const letters=Reflect.get(Object(Reflect.get(Object(projection),'studentLife')),'letters');
  assert.equal(Array.isArray(letters),true);
  assert.equal(letters.some((letter:unknown)=>Reflect.get(Object(letter),'id')==='private-letter'),false);
  assert.equal((await call(4,'GET',undefined,{requestId:'mail-request-0001'})).body && Reflect.get(Object((await call(4,'GET',undefined,{requestId:'mail-request-0001'})).body),'status'),'unknown');
  assert.equal(Reflect.get(Object(fixture.read().value.studentLife),'letters').length,3);
}));

test('twenty-three independent mailbox writes all survive concurrently',()=>environment(async(call,fixture)=>{
  const responses=await Promise.all(Array.from({length:23},(_,i)=>call(i+1,'POST',command(`concurrent-mail-${i+1}`,'student.letter.send',{recipient:0,title:'hello',content:`fixture${i+1}`}))));
  assert.deepEqual(responses.map(response=>response.status),Array(23).fill(200));
  assert.equal(Reflect.get(Object(fixture.read().value.studentLife),'letters').length,25);
}));

test('lost command response is recoverable by the same receipt without another credit',()=>environment(async(call,fixture)=>{
  fixture.loseNextCommitResponse();
  const body=command('adjust-once-0001','teacher.currency.adjust',{studentNumbers:[17],amount:6});
  assert.equal((await call(0,'POST',body)).status,502);
  const receipt=await call(0,'GET',undefined,{requestId:'adjust-once-0001'});
  assert.equal(receipt.status,200);
  assert.equal(Reflect.get(Object(receipt.body),'status'),'committed');
  assert.equal((await call(0,'POST',body)).status,200);
  assert.equal(Reflect.get(Object(fixture.read().value.currencyBalances),'17'),106);
}));


test('partial mail response carries only visible resources while metadata uses an empty scope',()=>environment(async(call)=>{
  const result = await call(2,'POST',command('partial-mail-0001','student.letter.send',{recipient:0,title:'hello',content:'test'}));
  assert.equal(result.status,200);
  const patch = Reflect.get(Object(result.body),'storagePatch');
  assert.equal(Reflect.get(Object(patch),'complete'),false);
  assert.ok(!JSON.stringify(patch).includes('private-letter'));
  assert.ok(!JSON.stringify(patch).includes('currencyBalances'));
  const receipt = await call(2,'GET',undefined,{requestId:'partial-mail-0001'});
  assert.equal(receipt.status,200);
  assert.deepEqual(Reflect.get(Object(receipt.body),'storagePatch'),patch);
  assert.equal((await call(2,'GET',undefined,{metadata:'1'})).status,200);
}));


test('old v2 clients are rejected before a partial response or mutation',()=>environment(async(call,fixture)=>{
  const body=command('old-browser-0001','teacher.currency.adjust',{studentNumbers:[17],amount:6});
  assert.equal((await call(0,'POST',body,undefined,false)).status,426);
  assert.equal((await call(0,'GET',undefined,{requestId:'old-browser-0001'},false)).status,426);
  assert.equal(fixture.receipts.size,0);
  assert.equal(Reflect.get(Object(fixture.read().value.currencyBalances),'17'),100);
}));

test('23 students can bid and teacher student-view bids retain actor-scoped receipts',()=>environment(async(call,fixture)=>{
  // Default Monday item remains visible on the fixed weekday used by this test.
  const date = new Date('2026-09-09T03:00:00Z');
  const originalNow = globalThis.Date;
  class FixedDate extends originalNow { constructor(value?: string | number) { super(value ?? date.getTime()); } }
  globalThis.Date = FixedDate as DateConstructor;
  try {
    for (let student=1;student<=23;student++) {
      const result=await call(student,'POST',command(`auction-student-${student}`, 'student.auction.bid',{itemId:'item-a',amount:student+10}));
      assert.equal(result.status,200,JSON.stringify(result.body));
    }
    const request={...command('auction-teacher-view','student.auction.bid',{itemId:'item-a',amount:40}),studentNumber:6};
    const saved=await call(0,'POST',request);
    assert.equal(saved.status,200,JSON.stringify(saved.body));
    assert.equal(Reflect.get(Object(Reflect.get(Object(fixture.read().value.auctionBids),'item-a')),'bidder'),6);
    assert.equal(Reflect.get(Object((await call(0,'GET',undefined,{requestId:request.requestId,studentNumber:'6'})).body),'status'),'committed');
    assert.equal(Reflect.get(Object((await call(0,'GET',undefined,{requestId:request.requestId,studentNumber:'7'})).body),'status'),'unknown');
    assert.equal(Reflect.get(Object((await call(6,'GET',undefined,{requestId:request.requestId})).body),'status'),'unknown');
    assert.equal((await call(7,'POST',request)).status,403);
    assert.equal((await call(0,'POST',{...request,studentNumber:24})).status,400);
    assert.equal((await call(0,'POST',{...request,action:'student.pet.feed'})).status,403);
    assert.equal((await call(0,'POST',request)).status,200);
  } finally {globalThis.Date=originalNow;}
}));

test('receiptOnly confirms a committed save even when the current projection cannot load', () => environment(async (call, fixture) => {
  const request = command('projection-unavailable-0001', 'teacher.currency.adjust', { studentNumbers: [2], amount: 6 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/storage_load_scope') && fixture.receipts.size) throw new TypeError('Fixture projection unavailable');
    return originalFetch(input, init);
  };
  assert.equal((await call(0, 'POST', request)).status, 502);
  const confirmed = await call(0, 'GET', undefined, { requestId: request.requestId, receiptOnly: '1' });
  assert.equal(confirmed.status, 200);
  assert.deepEqual(Object.keys(Object(confirmed.body)).sort(), ['action', 'committedAt', 'payloadHash', 'result', 'status']);
  assert.equal(Reflect.get(Object(confirmed.body), 'status'), 'committed');
  assert.equal(Reflect.get(Object(fixture.read().value.currencyBalances), '2'), 106);
  assert.deepEqual((await call(3, 'GET', undefined, { requestId: request.requestId, receiptOnly: '1' })).body, { status: 'unknown' });
}));

test('same request committed between receipt lookup and validation returns committed instead of a stale conflict', () => environment(async (call) => {
  const request = command('concurrent-settings-replay', 'teacher.settings.patch', { changes: [{ field: 'scheduleNotice', before: 'original', after: 'saved' }] });
  assert.equal((await call(0, 'POST', request)).status, 200);
  assert.equal((await call(0, 'POST', command('later-settings-edit-0001', 'teacher.settings.patch', { changes: [{ field: 'scheduleNotice', before: 'saved', after: 'later edit' }] }))).status, 200);
  const originalFetch = globalThis.fetch;
  let lookups = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/storage_get_receipt') && ++lookups === 1) return Response.json({ found: false });
    return originalFetch(input, init);
  };
  assert.equal((await call(0, 'POST', request)).status, 200);
  assert.equal(lookups, 2);
}));

test('failed receipt recheck does not report a definitive business rejection', () => environment(async (call) => {
  const originalFetch = globalThis.fetch;
  let lookups = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/storage_get_receipt') && ++lookups === 2) throw new TypeError('Fixture receipt unavailable');
    return originalFetch(input, init);
  };
  const result = await call(0, 'POST', command('ambiguous-settings-0001', 'teacher.settings.patch', { changes: [{ field: 'scheduleNotice', before: 'outdated', after: 'new' }] }));
  assert.equal(result.status, 502);
  assert.deepEqual(result.body, { error: 'STORAGE_CONFIRMATION_UNAVAILABLE' });
}));

test('sudoku edit revisions reject reverse-order old input and replay the same committed request', () => environment(async (call, fixture) => {
  process.env.STORAGE_REQUIRE_EDIT_REVISIONS = '1';
  const week = getKoreanIsoWeekKey(new Date()), puzzle = createSudokuPuzzle(2, week, 'basic');
  const key = `2:${week}:basic`, revisionKey = 'scope:studentSudoku:2';
  const oldCells = [...puzzle.puzzle], newCells = [...oldCells];
  const open = newCells.findIndex(cell => cell === 0); assert.ok(open >= 0); newCells[open] = 1;
  const payload = { key, cells: newCells, expectedRevisions: { [revisionKey]: 0 } };
  const newest = command('sudoku-new-input-0001', 'student.sudoku.save', payload);
  const saved = await call(2, 'POST', newest);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const patch = Reflect.get(Object(saved.body), 'storagePatch');
  assert.ok(Reflect.get(Object(Reflect.get(Object(patch), 'revisions')), revisionKey) > 0);
  assert.equal(Reflect.get(Object(Reflect.get(Object(patch), 'revisions')), 'scope:studentSudoku:3'), undefined);
  const stale = await call(2, 'POST', command('sudoku-old-input-0001', 'student.sudoku.save', { ...payload, cells: oldCells }));
  assert.equal(stale.status, 409);
  assert.deepEqual(stale.body, { error: 'STUDENT_EDIT_CONFLICT' });
  assert.deepEqual(Reflect.get(Object(Reflect.get(Object(fixture.read().value.studentSudoku), key)), 'cells'), newCells);
  assert.equal((await call(2, 'POST', newest)).status, 200);
  assert.equal((await call(2, 'POST', { ...newest, payload: { ...payload, cells: oldCells } })).status, 409);
  assert.equal((await call(2, 'POST', command('revision-wrong-scope', 'student.sudoku.save', { ...payload, expectedRevisions: { 'scope:studentSudoku:3': 0 } }))).status, 400);
  assert.equal((await call(2, 'POST', command('revision-missing-map', 'student.sudoku.save', { key, cells: oldCells }))).status, 426);
}));

test('emotion retry cannot move an old dated draft into today', () => environment(async (call) => {
  const result = await call(2, 'POST', command('emotion-old-date-0001', 'student.emotion.save', { dateKey: '2000-01-01', emotionId: 'happy', comment: '', selfMessage: '' }));
  assert.equal(result.status, 409);
  assert.equal(Reflect.get(Object(result.body), 'error'), 'STUDENT_SAVE_CONTEXT_CHANGED');
}));
