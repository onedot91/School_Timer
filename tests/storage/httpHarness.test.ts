import assert from 'node:assert/strict';
import test from 'node:test';
import { startHttpHarness, fixtureCookie } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { DEFAULT_AUCTION_ITEMS } from '../../src/lib/currency.js';

test('real HTTP + PostgreSQL: 24 sessions, atomic wallet races, scoped receipts, loss recovery, stale teacher and privacy', async () => {
  const harness = await startHttpHarness({name:`storage_http_test_${process.pid}_${Date.now()}`,port:0});
  const request = async (student: number,path: string,body?: unknown) => {
    const response = await fetch(`${harness.baseUrl}${path}`,{method:body===undefined?'GET':'POST',headers:{Cookie:fixtureCookie(student),'sec-fetch-site':'same-origin','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const value: unknown = await response.json();
    return {status:response.status,body:value};
  };
  const command = (student:number,action:string,payload:unknown,id:string) => request(student,'/api/shared-settings',{protocolVersion:2,requestId:id,action,payload});
  const economy = (student:number,action:unknown,id:string) => request(student,'/api/student-economy',{protocolVersion:2,studentNumber:student,action,requestId:id});
  const wallet = async (student:number) => (await harness.query('select balance from wallet_accounts where student_number=$1',[student])).rows[0]?.balance;
  try {
    const initial = await request(0,'/api/shared-settings');
    assert.equal(initial.status,200);
    const started = Date.now();
    const parallel = await Promise.all([
      ...Array.from({length:23},(_,index)=>command(index+1,'student.letter.send',{recipient:0,title:`fixture${index+1}`,content:`parallel student${index+1}`},`parallel-letter-${index+1}`)),
      command(0,'teacher.settings.patch',{changes:[{field:'scheduleNotice',before:'격리 검증 학급',after:'24명 동시 저장 완료'}]},'parallel-teacher-settings'),
    ]);
    assert.deepEqual(parallel.map(result=>result.status),Array(24).fill(200),JSON.stringify({failures:parallel.filter(result=>result.status!==200),metrics:harness.metrics.filter(metric=>metric.code)}));
    const letters = await harness.query("select count(*)::integer total from storage_resources where resource_key like '/studentLife/letters/@parallel-letter-%' and not deleted");
    assert.equal(letters.rows[0]?.total,23);
    console.log(JSON.stringify({case:'24 independent HTTP writers',milliseconds:Date.now()-started,sessions:24,statuses:parallel.map(result=>result.status)}));

    const debits = await Promise.all([economy(1,{type:'deposit',amount:80},'race-debit-first'),economy(1,{type:'deposit',amount:80},'race-debit-second')]);
    assert.deepEqual(debits.map(result=>result.status).sort(),[200,400]);
    assert.equal(await wallet(1),20);
    assert.equal((await harness.query("select count(*)::integer total from wallet_ledger where student_number=1 and not historical")).rows[0]?.total,1);

    const reservedRace = await Promise.all([
      economy(3,{type:'deposit',amount:80},'race-bank-student3'),
      command(3,'student.pet.feed',{},'race-feed-student3'),
      command(3,'student.auction.bid',{itemId:DEFAULT_AUCTION_ITEMS[0].id,amount:99},'race-bid-student3'),
    ]);
    assert.ok(reservedRace.every(result=>[200,400,409].includes(result.status)),JSON.stringify(reservedRace));
    const balance3 = await wallet(3);assert.equal(typeof balance3,'number');
    const bidRow = await harness.query("select value->'data' bid from storage_resources where resource_key=$1 and not deleted",[`/auctionBids/${DEFAULT_AUCTION_ITEMS[0].id}`]);
    const bid = bidRow.rows[0]?.bid;
    const reserved = isStorageRecord(bid)&&bid.bidder===3&&typeof bid.amount==='number'?bid.amount:0;
    assert.ok(typeof balance3==='number'&&balance3>=reserved);
    assert.ok(reservedRace.some(result=>result.status!==200));

    const first = await economy(4,{type:'deposit',amount:30},'receipt-replay-4');
    const replay = await economy(4,{type:'deposit',amount:30},'receipt-replay-4');
    assert.equal(first.status,200);assert.deepEqual(replay,first);assert.equal(await wallet(4),70);
    assert.ok(!JSON.stringify(first.body).includes('학생2 전용 fixture'));
    assert.equal((await economy(4,{type:'deposit',amount:40},'receipt-replay-4')).status,409);
    assert.equal(await wallet(4),70);

    harness.loseResponse('lost-response-student5');
    await assert.rejects(()=>economy(5,{type:'deposit',amount:30},'lost-response-student5'));
    const receipt = await request(5,'/api/student-economy?protocolVersion=2&studentNumber=5&requestId=lost-response-student5');
    assert.equal(receipt.status,200);assert.ok(isStorageRecord(receipt.body)&&receipt.body.status==='committed');
    assert.ok(!JSON.stringify(receipt.body).includes('학생2 전용 fixture'));
    assert.equal((await economy(5,{type:'deposit',amount:30},'lost-response-student5')).status,200);
    assert.equal(await wallet(5),70);
    assert.equal((await harness.query("select count(*)::integer total from wallet_ledger where student_number=5 and not historical")).rows[0]?.total,1);
    assert.equal((await request(6,'/api/student-economy?protocolVersion=2&studentNumber=5&requestId=lost-response-student5')).status,403);

    const teacherBeforeReward = await request(0,'/api/shared-settings');
    assert.equal(teacherBeforeReward.status,200);
    await harness.query("select storage_apply_wallet_delta(17,'http-quiz-six',6,'weekly_mission',now(),'http-quiz-six')");
    const notice = await command(0,'teacher.settings.patch',{changes:[{field:'scheduleNotice',before:'24명 동시 저장 완료',after:'보상 후 교사 저장'}]},'stale-teacher-after-six');
    assert.equal(notice.status,200);assert.equal(await wallet(17),106);
    assert.ok(isStorageRecord(teacherBeforeReward.body));
    const old = await fetch(`${harness.baseUrl}/api/shared-settings`,{method:'PUT',headers:{Cookie:fixtureCookie(0),'sec-fetch-site':'same-origin','Content-Type':'application/json'},body:JSON.stringify({value:teacherBeforeReward.body.value,expectedUpdatedAt:teacherBeforeReward.body.updated_at})});
    assert.equal(old.status,409);assert.equal(await wallet(17),106);

    const scoped = await request(1,'/api/shared-settings');assert.equal(scoped.status,200);
    assert.ok(!JSON.stringify(scoped.body).includes('학생2 전용 fixture'));
    assert.ok(isStorageRecord(scoped.body)&&isStorageRecord(scoped.body.value)&&isStorageRecord(scoped.body.value.currencyBalances));
    assert.deepEqual(Object.keys(scoped.body.value.currencyBalances),['1']);
    assert.equal((await command(1,'teacher.currency.adjust',{studentNumbers:[2],amount:10},'forbidden-actor-command')).status,403);
    assert.deepEqual((await harness.query('select storage_reconcile_wallets() result')).rows[0]?.result,[]);
    await harness.query('select storage_set_maintenance(true)');
    assert.equal((await economy(6,{type:'deposit',amount:30},'maintenance-student6')).status,503);
    assert.equal(await wallet(6),100);
    console.log(JSON.stringify({database:harness.name,baseUrl:harness.baseUrl,committedReceipts:(await harness.query('select count(*)::integer total from storage_receipts')).rows[0]?.total,reconciliation:'zero mismatches',cases:9}));
  } finally { await harness.stop(); }
});
