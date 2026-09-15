import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import sharedSettings from '../../api/shared-settings.js';
import { createLibraryCompetition, getLibraryCompetitionMonth, parseLibraryCompetitionState } from '../../src/lib/libraryCompetition.js';
import { applyLibraryPlacementCommand, type LibraryPlacementCommand } from '../../src/lib/canvasLibraryPlacement.js';
import { commitCompetition, loadCompetitionRow } from '../../src/server/libraryCompetitionRepository.js';
import { storagePayloadHash } from '../../src/server/storageV2Repository.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { fakeClassroom, fixtureCookie, startHttpHarness } from './httpHarness.js';

const record = (value: unknown): Record<string, unknown> => { assert.ok(isStorageRecord(value)); return value; };
const command = (slot: number, seasonId?: string): LibraryPlacementCommand => ({ action: 'placeLibraryBook', requestId: randomUUID(), slotId: slot,
  ...(seasonId ? { seasonId } : {}), book: { kind: 'new', title: '합성 검증 책', author: '검증', pageCount: 0, reflection: '테스트 감상' } });
const initial = () => {
  const value = fakeClassroom(), at = new Date(Date.now() - 10_000).toISOString();
  return { ...value, libraryCompetition: createLibraryCompetition({ seasonId: getLibraryCompetitionMonth(at), seed: 'isolated-library', startedAt: at, bookIds: [] }) };
};
const send = async (url: string, student: number, body: LibraryPlacementCommand) => {
  const response = await fetch(`${url}/api/shared-settings`, { method: 'PUT', headers: { 'content-type': 'application/json', cookie: fixtureCookie(student),
    'sec-fetch-site': 'same-origin', 'x-storage-projection': '1' }, body: JSON.stringify({ ...body, expectedStudentNumber: student, protocolVersion: 2 }) });
  return { status: response.status, body: record(await response.json()) };
};

if (process.argv.includes('--worker')) {
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      let status = 200;
      const apiResponse = { setHeader: (name: string, value: string) => { response.setHeader(name,value); }, status: (value: number) => { status=value; return apiResponse; },
        json: (value: unknown) => { response.writeHead(status, { 'content-type':'application/json' }); response.end(JSON.stringify(value)); } };
      await sharedSettings({ method: request.method, headers: request.headers, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }, apiResponse);
    } catch { response.writeHead(500); response.end('{"error":"FIXTURE_WORKER_ERROR"}'); }
  });
  server.listen(0,'127.0.0.1', () => { const address=server.address(); if (address && typeof address!=='string') process.send?.({port:address.port}); });
  process.once('SIGTERM', () => { server.close(() => process.exit(0)); });
} else {
  const workers: ReturnType<typeof fork>[] = [];
  const startWorker = async () => {
    const child=fork(fileURLToPath(import.meta.url),['--worker'],{execArgv:['--import','tsx'],stdio:['ignore','ignore','inherit','ipc'],env:{PATH:process.env.PATH,
      SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY,DEVICE_SESSION_SECRET:process.env.DEVICE_SESSION_SECRET,STORAGE_PROTOCOL_VERSION:'2'}});
    workers.push(child);
    return new Promise<string>((resolve,reject) => { child.once('error',reject); child.once('exit',code=>reject(new Error(`Worker exited ${code}`)));
      child.once('message',message=>{ const data=record(message); assert.equal(typeof data.port,'number'); resolve(`http://127.0.0.1:${data.port}`); }); });
  };
  const baseline=await startHttpHarness({name:`storage_http_test_library_before_${Date.now()}`,port:0,initialValue:initial(),rpcDelayMs:80});
  try {
    const config={url:process.env.SUPABASE_URL!,key:process.env.SUPABASE_SERVICE_ROLE_KEY!};
    const season=getLibraryCompetitionMonth(new Date().toISOString());
    const started=performance.now();
    const results=await Promise.all(Array.from({length:23},async(_,i)=>{
      const cmd=command(i,season);
      for(let attempt=0;attempt<5;attempt++) {
        const row=await loadCompetitionRow(config,i+1); assert.ok(row);
        const at=new Date(Math.max(Date.now(),Date.parse(row.updated_at)+1)).toISOString();
        const applied=applyLibraryPlacementCommand(row.value,i+1,cmd,at); assert.ok(applied.ok);
        if(await commitCompetition(config,{current:row,value:applied.value,updatedAt:at,actorKey:`student:${i+1}`,requestId:cmd.requestId,action:cmd.action,payload:cmd,result:{book:applied.book}})) {
          await loadCompetitionRow(config,i+1); return 200;
        }
        if(attempt<4) await new Promise(resolve=>setTimeout(resolve,20+Math.floor(Math.random()*81)));
      }
      return 409;
    }));
    console.log(JSON.stringify({scenario:'before: original five-round CAS, 23 distinct slots, PostgreSQL and 160ms RPC delay',success:results.filter(s=>s===200).length,conflict:results.filter(s=>s===409).length,rpcs:baseline.metrics.filter(m=>!m.code).length,elapsedMs:Math.round(performance.now()-started)}));
  } finally {await baseline.stop();}
  const h=await startHttpHarness({name:`storage_http_test_library_after_${Date.now()}`,port:0,initialValue:initial(),rpcDelayMs:80});
  try {
    const urls=await Promise.all([startWorker(),startWorker()]);
    const season=getLibraryCompetitionMonth(new Date().toISOString());
    const requests=Array.from({length:46},(_,i)=>({student:i%23+1,command:command(i,season)}));
    const started=performance.now();
    const responses=await Promise.all(requests.map((r,i)=>send(urls[i%2],r.student,r.command)));
    assert.ok(responses.every(r=>r.status===200),JSON.stringify(responses.map(r=>({status:r.status,error:r.body.error}))));
    const books=(await h.query("select value->'data' book from storage_resources where not deleted and value->>'parentKey'='/studentLife/books'")).rows;
    assert.equal(books.length,46);
    assert.equal((await h.query('select count(*)::int n from wallet_ledger where not historical')).rows[0].n,23);
    assert.ok((await h.query('select balance from wallet_accounts')).rows.every(r=>r.balance===110));
    assert.equal((await h.query('select count(*)::int n from storage_receipts')).rows[0].n,46);
    assert.ok(parseLibraryCompetitionState((await h.query("select storage_project_node('/libraryCompetition') state")).rows[0].state));
    console.log(JSON.stringify({scenario:'after: 46 distinct slots, two API processes, PostgreSQL and 160ms RPC delay',success:46,rpcs:h.metrics.filter(m=>!m.code).length,elapsedMs:Math.round(performance.now()-started),rewards:23}));
    const duplicate=await Promise.all(Array.from({length:23},(_,i)=>send(urls[i%2],1,requests[0].command)));
    assert.ok(duplicate.every(r=>r.status===200));
    assert.equal((await h.query('select count(*)::int n from storage_receipts')).rows[0].n,46);
    const reused=await send(urls[0],1,{...requests[0].command,slotId:99}); assert.equal(reused.status,409); assert.equal(reused.body.error,'STORAGE_REQUEST_REUSED');
    const sameSlot=await Promise.all(Array.from({length:23},(_,i)=>send(urls[i%2],i+1,command(46,season))));
    assert.equal(sameSlot.filter(r=>r.status===200).length,1); assert.ok(sameSlot.filter(r=>r.status!==200).every(r=>r.body.error==='LIBRARY_SLOT_OCCUPIED'));
    const lost=command(47,season); h.loseResponse(lost.requestId);
    await assert.rejects(()=>send(h.baseUrl,1,lost));
    assert.equal((await send(urls[0],1,lost)).status,200);
    assert.equal((await h.query('select count(*)::int n from storage_receipts where request_id=$1',[lost.requestId])).rows[0].n,1);
    assert.deepEqual((await h.query('select storage_reconcile_wallets() result')).rows[0].result,[]);
    const ownBookId=record(responses[0].body.book).id; assert.equal(typeof ownBookId,'string');
    const foreign=await send(urls[0],2,{...command(48,season),book:{kind:'existing',bookId:String(ownBookId)}}); assert.equal(foreign.status,403);
    const old=await send(urls[0],1,command(48,'2000-01')); assert.equal(old.body.error,'LIBRARY_SEASON_CHANGED');
    const beforeMalformed=(await h.query('select count(*)::int n from storage_receipts')).rows[0].n;
    await h.query("select storage_write_resource('/libraryCompetition/seed','libraryCompetition',null,jsonb_build_object('kind','value','parentKey','/libraryCompetition','member','seed','data',''))");
    assert.equal((await send(urls[0],1,command(48,season))).body.error,'LIBRARY_COMPETITION_INVALID_STATE');
    assert.equal((await h.query('select count(*)::int n from storage_receipts')).rows[0].n,beforeMalformed);
    await h.query("select storage_write_resource('/libraryCompetition/seed','libraryCompetition',null,jsonb_build_object('kind','value','parentKey','/libraryCompetition','member','seed','data','restored-fixture'))");
    const cmd=command(48,season);
    await h.query('select storage_set_maintenance(true)');
    assert.equal((await send(urls[0],1,cmd)).body.error,'STORAGE_MAINTENANCE');
    await h.query('select storage_set_maintenance(false)');
    assert.equal((await send(urls[0],1,cmd)).status,200);
    const permissions=await h.query("select has_function_privilege('anon','storage_place_library_book(integer,jsonb,text,integer)','EXECUTE') anon,has_function_privilege('authenticated','storage_place_library_book(integer,jsonb,text,integer)','EXECUTE') authenticated,has_function_privilege('service_role','storage_place_library_book(integer,jsonb,text,integer)','EXECUTE') service");
    assert.deepEqual(permissions.rows[0],{anon:false,authenticated:false,service:true});
    const replay=await h.query('select storage_place_library_book($1,$2,$3,2) result',[1,requests[0].command,storagePayloadHash('placeLibraryBook',requests[0].command)]); assert.equal(record(replay.rows[0].result).saved,true);
    const competitionBefore=record((await h.query("select storage_project_node('/libraryCompetition') state")).rows[0].state);
    const future=new Date(Date.now()+60_000).toISOString();
    const futureEvent={id:'future-adjustment',at:future,speed:1,paused:false,counts:[]};
    await h.query("select storage_write_resource('/libraryCompetition/adjustments/@future-adjustment','libraryCompetition',null,$1)", [{kind:'value',parentKey:'/libraryCompetition/adjustments',member:'@future-adjustment',order:0,data:futureEvent}]);
    const futureResult=await send(urls[0],1,command(49,season)); assert.equal(futureResult.status,200);
    assert.ok(String(record(futureResult.body.book).createdAt)>=future);
    assert.ok(parseLibraryCompetitionState((await h.query("select storage_project_node('/libraryCompetition') state")).rows[0].state));
    const corruptedFields: Array<[string,unknown]> = [
      ['seed',42],['seed','\t'],['startedAt','not-a-date'],['revision',1.5],
      ['placements',[{bookId:'bad',at:'not-a-date'}]],
      ['placements',[{bookId:'duplicate',at:future},{bookId:'duplicate',at:future}]],
      ['adjustments',[{id:'bad',at:future,speed:1,paused:false,counts:[{schoolId:'school-03',count:1}]}]],
    ];
    for(const [field,data] of corruptedFields) {
      const key='/libraryCompetition/'+field;
      const original=record((await h.query('select value from storage_resources where resource_key=$1',[key])).rows[0].value);
      await h.query("select storage_write_resource($1,'libraryCompetition',null,$2)",[key,{...original,kind:'value',data}]);
      const receiptCount=(await h.query('select count(*)::int n from storage_receipts')).rows[0].n;
      assert.equal((await send(urls[0],1,command(50,season))).body.error,'LIBRARY_COMPETITION_INVALID_STATE');
      assert.equal((await h.query('select count(*)::int n from storage_receipts')).rows[0].n,receiptCount);
      await h.query("select storage_write_resource($1,'libraryCompetition',null,$2)",[key,original]);
    }
    for(const [id,title] of [[123,'numeric id'],['whitespace-id','\t']] as const) {
      await h.query("select storage_write_resource('/studentLife/books/@corrupt-fixture','studentLife',1,$1)",[{kind:'value',parentKey:'/studentLife/books',member:'@corrupt-fixture',order:500,data:{id,title,studentNumber:1,author:'fixture',pageCount:10,createdAt:future,colorIndex:0}}]);
      const bad=await send(urls[0],1,{...command(50,season),book:{kind:'existing',bookId:String(id)}}); assert.equal(bad.status,400); assert.equal(bad.body.error,'INVALID_LIBRARY_COMMAND');
      assert.equal((await h.query("select count(*)::int n from storage_resources where value->>'parentKey'='/studentLife/books' and value#>'{data,librarySlot}'='50'::jsonb")).rows[0].n,0);
    }
    const beforeWalletRace=Number((await h.query('select balance from wallet_accounts where student_number=1')).rows[0].balance);
    const walletRace=await Promise.all([send(urls[1],1,command(50,season)),h.query("select storage_apply_wallet_delta(1,'fixture-debit',-7,'manual',clock_timestamp(),'fixture:debit')")]);
    assert.equal(walletRace[0].status,200);
    assert.equal((await h.query('select balance from wallet_accounts where student_number=1')).rows[0].balance,beforeWalletRace-7);
    assert.deepEqual((await h.query('select storage_reconcile_wallets() result')).rows[0].result,[]);
    assert.ok(Number(competitionBefore.revision)<Number(record((await h.query("select storage_project_node('/libraryCompetition') state")).rows[0].state).revision));
    console.log(JSON.stringify({scenario:'replay, same slot, changed payload, lost HTTP response, ownership, season, malformed state, maintenance, grants, ledger reconciliation',passed:true,database:h.name}));
  } finally {
    await Promise.all(workers.map(child=>new Promise<void>(resolve=>{if(child.exitCode!==null){resolve();return;}child.once('exit',()=>resolve());child.kill('SIGTERM');})));
    await h.stop();
  }
  const priorDate=new Date(); priorDate.setUTCDate(1); priorDate.setUTCMonth(priorDate.getUTCMonth()-1); priorDate.setUTCHours(0,0,0,0);
  const priorAt=priorDate.toISOString(), priorSeason=getLibraryCompetitionMonth(priorAt);
  const rolloverSource=fakeClassroom();
  const oldBook={id:'archived-fixture',studentNumber:2,title:'지난달 합성 책',author:'검증',pageCount:10,createdAt:priorAt,colorIndex:0,librarySlot:0,opaque:{preserve:true}};
  const unplaced={id:'unplaced-fixture',studentNumber:1,title:'기존 합성 책',author:'검증',pageCount:20,createdAt:priorAt,colorIndex:2,opaque:{preserve:true}};
  const rollover=await startHttpHarness({name:`storage_http_test_library_rollover_${Date.now()}`,port:0,rpcDelayMs:80,initialValue:{...rolloverSource,
    libraryCompetition:createLibraryCompetition({seasonId:priorSeason,seed:'prior-fixture',startedAt:priorAt,bookIds:[oldBook.id]}),
    studentLife:{...record(rolloverSource.studentLife),books:[oldBook,unplaced]}}});
  try {
    const season=getLibraryCompetitionMonth(new Date().toISOString());
    const responses=await Promise.all(Array.from({length:23},(_,i)=>send(rollover.baseUrl,i+1,command(i,season))));
    assert.ok(responses.every(r=>r.status===200),JSON.stringify(responses.map(r=>({status:r.status,error:r.body.error}))));
    assert.deepEqual((await rollover.query('select books from library_competition_archives')).rows.map(r=>r.books),[[oldBook]]);
    const moved=await send(rollover.baseUrl,1,{...command(23,season),book:{kind:'existing',bookId:unplaced.id}}); assert.equal(moved.status,200);
    assert.deepEqual(record((await rollover.query("select value->'data' book from storage_resources where value#>>'{data,id}'='unplaced-fixture' and not deleted")).rows[0].book).opaque,{preserve:true});
    assert.equal((await rollover.query('select balance from wallet_accounts where student_number=1')).rows[0].balance,110);
    assert.equal((await rollover.query('select count(*)::int n from wallet_ledger where not historical')).rows[0].n,23);
    assert.deepEqual((await rollover.query('select storage_reconcile_wallets() result')).rows[0].result,[]);
    console.log(JSON.stringify({scenario:'23 simultaneous placements during monthly rollover, archive preservation and existing book placement',passed:true,rpcs:rollover.metrics.filter(m=>!m.code).length}));
  } finally {await rollover.stop();}

}
