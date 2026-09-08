import assert from 'node:assert/strict';
import test from 'node:test';
import { ClasswordRepositoryError, saveClasswordEntry, loadClasswordQuizRewardAmount } from '../../src/server/classwordRepository.js';
const configuration = { url: 'https://example.invalid', key: 'test-only' };
const input = { requestId: 'fixture-request-1', dateKey: '2026-09-08', studentNumber: 3, initial: 'ㄱ', word: '강아지' } as const;

test('entry and reward use exactly one versioned atomic command', async () => {
 const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(String(url),'https://example.invalid/rest/v1/rpc/classword_command_v2');
  assert.deepEqual(JSON.parse(String(init?.body)),{p_actor:3,p_request_id:input.requestId,p_action:'save_entry',p_payload:{dateKey:input.dateKey,initial:'ㄱ',word:'강아지'},p_protocol_version:2});
  return Response.json({entry:{id:'entry-1',round_date:input.dateKey,student_number:3,initial:'ㄱ',word:'강아지',created_at:'2026-09-08T01:00:00Z',updated_at:'2026-09-08T01:00:00Z'},reward:{missionType:'classword_word_entry',weekKey:input.dateKey,completed:true,awarded:true,rewardAmount:5,balance:105}});
 };
 try{const result=await saveClasswordEntry(configuration,input);assert.equal(result.reward.balance,105);assert.equal(calls,1);}finally{globalThis.fetch=originalFetch;}
});
for(const code of ['CLASSWORD_STUDENT_ALREADY_ENTERED','CLASSWORD_INITIAL_OCCUPIED','CLASSWORD_ENTRY_CHANGED','STORAGE_REQUEST_REUSED']){
 test(`recognized command rejection ${code} stays a business conflict`,async()=>{
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({code:'P0001',message:code},{status:400});
  try{await assert.rejects(saveClasswordEntry(configuration,input),(error:unknown)=>error instanceof ClasswordRepositoryError&&error.code===code&&error.status===409);}finally{globalThis.fetch=originalFetch;}
 });
}
for(const body of [{code:'23505'},{code:'23503'},{code:'23505',message:'private unknown error'}]){
 test('unknown database error is not a slot conflict',async()=>{
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json(body,{status:409});
  try{await assert.rejects(saveClasswordEntry(configuration,input),(error:unknown)=>error instanceof ClasswordRepositoryError&&error.code==='CLASSWORD_DATABASE_HTTP_409'&&error.status===502);}finally{globalThis.fetch=originalFetch;}
 });
}

for (const entries of [[], [{delta: 5, reason: 'weekly_mission', balance_before: 100, balance_after: 105}], [{delta: 6, reason: 'weekly_mission', balance_before: 100, balance_after: 106}]]) {
 test(`quiz reward read requires matching ledger: ${JSON.stringify(entries)}`, async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(url)=>String(url).includes('/weekly_mission_rewards')
   ? Response.json([{reward_amount:6}]) : Response.json(entries);
  try { assert.equal(await loadClasswordQuizRewardAmount(configuration,'2026-09-08',3), entries[0]?.delta === 6 ? 6 : null); }
  finally {globalThis.fetch=originalFetch;}
 });
}
