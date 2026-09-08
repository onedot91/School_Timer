import assert from 'node:assert/strict';
import test from 'node:test';
import { startHttpHarness, fixtureCookie } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { parseStorageProjectionPatch } from '../../src/lib/storageProjectionPatch.js';
import { createStudentEconomyState } from '../../src/lib/studentEconomy.js';

test('real PostgreSQL economy scope: full reads zero, transfer/house parity and valid actor patches', async () => {
  const harness = await startHttpHarness({name:`storage_http_test_economy_${process.pid}_${Date.now()}`,port:0});
  const call = async(student:number, action:unknown,id:string) => {
    const response=await fetch(`${harness.baseUrl}/api/student-economy`,{method:'POST',headers:{Cookie:fixtureCookie(student),'sec-fetch-site':'same-origin','Content-Type':'application/json','X-Storage-Projection':'1'},body:JSON.stringify({protocolVersion:2,studentNumber:student,action,requestId:id})});
    const body:unknown=await response.json();
    assert.equal(response.status,200,JSON.stringify(body));assert.ok(isStorageRecord(body));
    const patch=parseStorageProjectionPatch(body.storagePatch);
    assert.deepEqual(patch.wallets.map(wallet=>wallet.student_number),[student]);
    assert.deepEqual(patch.historyStudents,[student]);assert.equal(patch.complete,false);
    assert.ok(!patch.resources.some(row=>row.resource_key==='/studentLife/books'||row.resource_key==='/studentLife/failureStories'));
    return body;
  };
  try {
    const deposit=await call(1,{type:'deposit',amount:30},'scope-deposit-one');assert.equal(deposit.balance,70);
    const transfer=await call(2,{type:'transfer',amount:20,recipientNumber:3,dateKey:'2026-09-08'},'scope-transfer-two');
    assert.equal(transfer.balance,80);assert.deepEqual(transfer.currencyBalanceEntries,{2:80});
    assert.equal((await harness.query('select balance from wallet_accounts where student_number=3')).rows[0]?.balance,120);
    const recipientLetter=await harness.query("select value->'data' letter from storage_resources where resource_key='/studentLife/letters/@bank-scope-transfer-two-transfer-in'");
    assert.ok(isStorageRecord(recipientLetter.rows[0]?.letter));assert.equal(recipientLetter.rows[0].letter.recipient,3);
    const economy=createStudentEconomyState();
    await harness.query('select storage_write_resource($1,$2,$3,$4)',['/studentEconomy/4','studentEconomy',4,{kind:'value',parentKey:'/studentEconomy',member:'4',data:{...economy,inventory:{...economy.inventory,house_repair:1}}}]);
    const house=await call(4,{type:'buy_house',houseId:'student-house-7'},'scope-house-four');assert.equal(house.balance,0);
    assert.equal((await harness.query('select balance from wallet_accounts where student_number=7')).rows[0]?.balance,110);
    assert.deepEqual(house.currencyBalanceEntries,{4:0});
    assert.ok(!JSON.stringify(house).includes('scope-transfer-two'));
    await call(4,{type:'buy_house',houseId:'student-house-7'},'scope-house-four');
    assert.equal((await harness.query('select balance from wallet_accounts where student_number=7')).rows[0]?.balance,110);
    const profile=await call(5,{type:'draw_profile'},'scope-profile-five');assert.equal(profile.applied,true);
    const receipt=await fetch(`${harness.baseUrl}/api/student-economy?protocolVersion=2&studentNumber=5&requestId=scope-profile-five`,{headers:{Cookie:fixtureCookie(5),'X-Storage-Projection':'1'}});
    const receiptBody:unknown=await receipt.json();assert.equal(receipt.status,200);assert.ok(isStorageRecord(receiptBody)&&isStorageRecord(receiptBody.result));
    parseStorageProjectionPatch(receiptBody.result.storagePatch);
    assert.equal(harness.metrics.filter(entry=>entry.rpc==='storage_load_snapshot').length,0);
    assert.equal(harness.metrics.filter(entry=>entry.rpc==='storage_commit_mutation').length,0);
    assert.ok(harness.metrics.some(entry=>entry.rpc==='storage_commit_scoped_mutation'));
    assert.deepEqual((await harness.query('select storage_reconcile_wallets() result')).rows[0]?.result,[]);
    console.log(JSON.stringify({economyFullReads:0,economyFullCommits:0,scopedReads:harness.metrics.filter(entry=>entry.rpc==='storage_load_scope').length,scopedCommits:harness.metrics.filter(entry=>entry.rpc==='storage_commit_scoped_mutation').length,reconciliation:[]}));
  } finally {await harness.stop();}
});
