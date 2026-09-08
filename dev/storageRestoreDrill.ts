import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isStorageRecord } from '../src/lib/storageV2Codec.js';
import { startHttpHarness, fixtureCookie } from '../tests/storage/httpHarness.js';
import { BACKUP_SCHEMA_FILES, BACKUP_TABLES, backupHash, captureStorageBackup, readStorageBackup, schemaFilesHash, writeStorageBackup, type BackupDatabase, type StorageBackup } from './storageBackup.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
interface Connection extends BackupDatabase { connect():Promise<void>; end():Promise<void> }
interface Target { host:string; name:string }
const targetValid=(target:Target):void=>{
  if (!['127.0.0.1','localhost','::1'].includes(target.host)||target.name.length>63||!/^storage_http_test_restore_[a-z0-9_]{1,90}$/.test(target.name)) throw new Error('RESTORE_FRESH_LOCAL_DATABASE_REQUIRED');
};
const client=(name:string,host='127.0.0.1'):Connection=>{
  let driver:unknown;
  try {driver=createRequire(import.meta.url)(process.env.STORAGE_TEST_PG_MODULE??'/tmp/school-storage-runtime/node_modules/pg');}catch{throw new Error('RESTORE_PG_DRIVER_REQUIRED: Set STORAGE_TEST_PG_MODULE to an installed pg driver. Gate cannot skip.');}
  if(!isStorageRecord(driver)||typeof driver.Client!=='function')throw new Error('RESTORE_PG_DRIVER_REQUIRED');
  const instance:unknown=Reflect.construct(driver.Client,[{host,port:55439,user:'postgres',password:'local-fixture-only',database:name,connectionTimeoutMillis:2000}]);
  if(!isStorageRecord(instance)||typeof instance.connect!=='function'||typeof instance.end!=='function'||typeof instance.query!=='function')throw new Error('RESTORE_PG_DRIVER_REQUIRED');
  const connect=instance.connect.bind(instance),end=instance.end.bind(instance),query=instance.query.bind(instance);
  return {connect:async()=>{await connect();},end:async()=>{await end();},query:async(sql,values)=>{
    const raw:unknown=await query(sql,values);const result:unknown=Array.isArray(raw)?raw.at(-1):raw;
    if(!isStorageRecord(result)||!Array.isArray(result.rows)||!result.rows.every(isStorageRecord))throw new Error('RESTORE_DATABASE_RESPONSE_INVALID');
    return {rows:result.rows};
  }};
};
const restoreOrder=BACKUP_TABLES.map(([name])=>name);
export const restoreFreshDatabase=async({directory,target,schemaHash,afterImport,successFile}:{directory:string;target:Target;schemaHash:string;successFile?:string;afterImport?:(db:BackupDatabase)=>Promise<void>}):Promise<{name:string;manifestHash:string;tables:Record<string,string>}>=>{
  targetValid(target);
  // Every file is verified before a connection is opened or a destination is created.
  const backup=await readStorageBackup(directory);
  if(backup.manifest.schemaHash!==schemaHash||schemaHash!==await schemaFilesHash(ROOT))throw new Error('RESTORE_SCHEMA_HASH_MISMATCH');
  const admin=client('postgres',target.host);await admin.connect();
  try{
    const serverAddress=(await admin.query('select host(inet_server_addr()) address')).rows[0]?.address;
    if(serverAddress!=='127.0.0.1'&&serverAddress!=='::1')throw new Error('RESTORE_FRESH_LOCAL_DATABASE_REQUIRED');
    if((await admin.query('select 1 from pg_database where datname=$1',[target.name])).rows.length)throw new Error('RESTORE_DATABASE_ALREADY_EXISTS');
    await admin.query(`create database "${target.name}" template template0`);
  }finally{await admin.end();}
  const db=client(target.name,target.host);await db.connect();
  try{
    for(const file of BACKUP_SCHEMA_FILES)await db.query(await readFile(resolve(ROOT,'supabase',file),'utf8'));
    await db.query('begin');
    try{
      for(const name of restoreOrder){
        const table=backup.manifest.tables.find(table=>table.name===name);assert.ok(table);
        const columns=(await db.query("select a.attname name,format_type(a.atttypid,a.atttypmod) type,not a.attnotnull nullable,a.attidentity identity from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum",[`public.${name}`])).rows;
        if(backupHash(columns)!==backupHash(table.columns))throw new Error('RESTORE_COLUMN_SCHEMA_MISMATCH');
        const count=(await db.query(`select count(*)::integer count from public."${name}"`)).rows[0]?.count;
        if(name==='storage_control'){
          if(count!==1||backup.rows[name].length!==1||backup.rows[name][0].singleton!==true)throw new Error('RESTORE_CONTROL_SEED_MISMATCH');
          // The only replacement is the schema's fixed seed in this freshly-created, empty database.
          const row=backup.rows[name][0];await db.query('update public.storage_control set active=$1,maintenance=$2,updated_at=$3 where singleton',[row.active,row.maintenance,row.updated_at]);
        }else{
          if(count!==0)throw new Error('RESTORE_TABLE_NOT_EMPTY');
          for(const row of backup.rows[name]){
            const names=table.columns.map(column=>`"${column.name}"`).join(',');
            const parameters=table.columns.map((column,index)=>`$${index+1}::${column.type}`).join(',');
            await db.query(`insert into public."${name}" (${names}) overriding system value values (${parameters})`,table.columns.map(column=>row[column.name]));
          }
        }
      }
      for(const sequence of backup.manifest.sequences)await db.query('select setval($1::regclass,$2::bigint,$3)',[`public.${sequence.name}`,sequence.lastValue,sequence.isCalled]);
      if(afterImport)await afterImport(db);
      await db.query('commit');
    }catch(error){await db.query('rollback');throw error;}
    const actual=await captureStorageBackup(db,schemaHash);
    compareRestoredBackup(backup,actual);
    const result={name:target.name,manifestHash:backup.manifest.manifestHash,tables:Object.fromEntries(actual.manifest.tables.map(table=>[table.name,table.sha256]))};
    if(successFile)await writeFile(successFile,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
    return result;
  }finally{await db.end();}
};
export const compareRestoredBackup=(source:StorageBackup,restored:StorageBackup):void=>{
  assert.deepEqual(restored.manifest.tables,source.manifest.tables,'every table schema/count/PK/hash');
  assert.deepEqual(restored.manifest.sequences,source.manifest.sequences,'identity sequence state');
  assert.deepEqual(restored.rows.wallet_accounts,source.rows.wallet_accounts,'all balances/opening balances/revisions');
  assert.deepEqual(restored.rows.wallet_ledger,source.rows.wallet_ledger,'ledger historical flags, values and ordering');
  assert.deepEqual(restored.rows.storage_receipts,source.rows.storage_receipts,'idempotency receipts and scopes');
  assert.deepEqual(restored.rows.storage_reward_claims,source.rows.storage_reward_claims,'reward claims');
};

export const runStorageRestoreDrill=async()=>{
  const started=Date.now();const preflight=client('postgres');
  try{await preflight.connect();await preflight.query('select 1');}catch{throw new Error('RESTORE_FIXTURE_DATABASE_REQUIRED: Start isolated PostgreSQL at 127.0.0.1:55439. Gate cannot skip.');}finally{await preflight.end();}
  const root=await mkdtemp(resolve(tmpdir(),'school-private-restore-'));const backupDirectory=resolve(root,'backup');const schemaHash=await schemaFilesHash(ROOT);
  const suffix=`${process.pid}_${Date.now()}`;
  const harness=await startHttpHarness({name:`storage_http_test_restore_source_${suffix}`,port:0});
  const request=async(actor:number,action:string,payload:unknown,id:string)=>{
    const response=await fetch(`${harness.baseUrl}/api/shared-settings`,{method:'POST',headers:{Cookie:fixtureCookie(actor),'Content-Type':'application/json','X-Storage-Projection':'1'},body:JSON.stringify({protocolVersion:2,requestId:id,action,payload})});
    assert.equal(response.status,200);return response.json();
  };
  let source:StorageBackup;
  try{
    await request(0,'teacher.settings.patch',{changes:[{field:'scheduleNotice',before:'격리 검증 학급',after:'백업 복원 합성 검증'}]},'restore-teacher');
    for(let actor=1;actor<=23;actor++){
      await request(actor,'student.letter.send',{recipient:0,title:'합성',content:`복원 fixture ${actor}`},`restore-letter-${actor}`);
      await harness.query("select classword_command_v2($1,$2,'complete_quiz',$3,2)",[actor,`restore-quiz-${actor}`,{dateKey:'2026-09-08',questionId:'restore-quiz',question:{meaning:'합성'}}]);
    }
    await harness.query("select classword_command_v2(0,'restore-topic','save_topic',$1,2)",[{dateKey:'2026-09-08',topic:'합성'}]);
    await harness.query("select classword_command_v2(1,'restore-entry','save_entry',$1,2)",[{dateKey:'2026-09-08',initial:'ㄱ',word:'가방'}]);
    await harness.query("insert into announcement_notes(date_key,date_text,note) values('2026-09-08','합성 날짜','복원 검증')");
    await harness.query("with setup as materialized (select set_config('school_timer.today_friend_v2','2',true)) insert into today_friend_settings(id,state) select 'main',$1 from setup",[{version:1,weeks:[]}]);
    await harness.query("insert into today_friend_planning_records(category,record_key,value,sort_order) values('questions','restore-question',$1,7)",[{id:'restore-question',unknown:'preserved'}]);
    await harness.query("insert into class_donation_requests(request_id,result) values('restore-donation',$1)",[{fixture:true}]);
    await harness.query("select persist_today_friend_submission_v2($1,0,'restore-friend-submit','student:1',$2,2)",[{id:'restore-friend',submission_date:'2026-09-08',student_number:1,partner_number:2,genre:'interview',payload:{answer:'합성'},status:'submitted',revision:0,reward_status:'pending',updated_at:'2026-09-08T00:00:00Z'},backupHash({fixture:'restore-friend'})]);
    await harness.query("select approve_today_friend_submission_v2('restore-friend',2,1)");
    await harness.query("insert into library_competition_archives(settings_id,season_id,archived_at,standings,books) values('school-timer-main','2026-08','2026-09-01T00:00:00Z',$1,$2)",[JSON.stringify(Array.from({length:17},(_,i)=>({studentNumber:i+1,score:0}))),JSON.stringify([{id:'archived-fixture',studentNumber:1,title:'합성'}])]);
    await harness.query("select classword_command_v2(0,'restore-question','save_quiz',$1,2)",[{quiz_date:'2026-09-08',question_id:'restore-quiz',initial_hint:'ㄱ',meaning:'합성 문제',answer:'가방',written_prefix:'',written_suffix:'',spoken_prefix:'',spoken_suffix:''}]);
    const legacyValue={kind:'value',parentKey:'/currencyHistory/17',member:'@historical-fixture',order:0,data:{id:'historical-fixture',studentNumber:17,delta:6,before:328,after:334,reason:'weekly_mission',createdAt:'2026-09-07T00:00:00Z',unknown:{preserved:true}}};
    await harness.query("insert into wallet_ledger(resource_key,entry_id,student_number,delta,balance_before,balance_after,reason,created_at,operation_id,historical,sort_order,value) values('/currencyHistory/17/@historical-fixture','historical-fixture',17,6,328,334,'weekly_mission','2026-09-07T00:00:00Z','legacy-fixture',true,4,$1)",[legacyValue]);
    await harness.query("select setval('storage_backups_backup_id_seq',9007199254740993,true)");
    await harness.query("insert into storage_backups(source_updated_at,value) values('2026-09-08T00:00:00Z',$1)",[{fixture:'large identity metadata'}]);
    assert.deepEqual((await harness.query('select storage_reconcile_wallets() result')).rows[0]?.result,[]);
    const connection=client(harness.name);await connection.connect();try{
      let injected=false;
      source=await captureStorageBackup({query:async(sql,values)=>{
        const result=await connection.query(sql,values);
        if(!injected&&sql.startsWith('select to_jsonb(t)')){
          injected=true;
          await harness.query("select classword_command_v2(17,'concurrent-after-snapshot','complete_quiz',$1,2)",[{dateKey:'2026-09-10',questionId:'concurrent-after-snapshot'}]);
        }
        return result;
      }},schemaHash);
      assert.equal(source.rows.storage_receipts.some(row=>row.request_id==='concurrent-after-snapshot'),false);
      assert.equal(source.rows.wallet_ledger.length,26);
    }finally{await connection.end();}
    await writeStorageBackup(backupDirectory,source);
  }finally{await harness.stop();}
  assert.equal(source.rows.wallet_accounts.length,23);
  assert.ok(source.rows.storage_receipts.some(row=>row.scope!==null));assert.ok(source.rows.storage_reward_claims.length>=23);
  const restores=[];
  for(let attempt=1;attempt<=2;attempt++){
    const target={host:'127.0.0.1',name:`storage_http_test_restore_copy${attempt}_${suffix}`};
    const result=await restoreFreshDatabase({directory:backupDirectory,target,schemaHash,successFile:resolve(root,`restore${attempt}-success.json`)});
    const db=client(target.name);await db.connect();
    try{
      const before=(await db.query('select balance from wallet_accounts where student_number=17')).rows[0]?.balance;
      const count=(await db.query('select count(*)::integer count from wallet_ledger')).rows[0]?.count;
      const receipt=(await db.query("select storage_get_receipt('classword:17','restore-quiz-17') result")).rows[0]?.result;assert.ok(isStorageRecord(receipt)&&receipt.found===true);
      await db.query("select classword_command_v2(17,'restore-quiz-17','complete_quiz',$1,2)",[{dateKey:'2026-09-08',questionId:'restore-quiz',question:{meaning:'합성'}}]);
      assert.equal((await db.query('select balance from wallet_accounts where student_number=17')).rows[0]?.balance,before);
      assert.equal((await db.query('select count(*)::integer count from wallet_ledger')).rows[0]?.count,count);
      await db.query("select classword_command_v2(17,'restore-new-quiz','complete_quiz',$1,2)",[{dateKey:'2026-09-09',questionId:'restore-new-quiz'}]);
      assert.equal((await db.query('select count(*)::integer count from wallet_ledger')).rows[0]?.count,Number(count)+1);
      assert.deepEqual((await db.query('select storage_reconcile_wallets() result')).rows[0]?.result,[]);
      restores.push({...result,replayAdditionalEntries:0,newEntries:1,reconciliation:[]});
    }finally{await db.end();}
  }
  const negatives:string[]=[];
  const tamperedDirectory=resolve(root,'tampered');await mkdir(tamperedDirectory,{mode:0o700});
  for(const table of source.manifest.tables){
    const rows=table.name==='wallet_accounts'?source.rows[table.name].map((row,index)=>index===0?{...row,balance:Number(row.balance)+1}:row):source.rows[table.name];
    await writeFile(resolve(tamperedDirectory,table.file),JSON.stringify(rows),{flag:'wx',mode:0o600});
  }
  await writeFile(resolve(tamperedDirectory,'manifest.json'),JSON.stringify(source.manifest),{flag:'wx',mode:0o600});
  const tamperedName=`storage_http_test_restore_tampered_${suffix}`;
  await assert.rejects(()=>restoreFreshDatabase({directory:tamperedDirectory,target:{host:'127.0.0.1',name:tamperedName},schemaHash}),/BACKUP_ROW_HASH_MISMATCH/);
  const checker=client('postgres');await checker.connect();try{assert.equal((await checker.query('select 1 from pg_database where datname=$1',[tamperedName])).rows.length,0);}finally{await checker.end();}
  negatives.push('tampered backup rejected before destination creation');
  await assert.rejects(()=>restoreFreshDatabase({directory:backupDirectory,target:{host:'example.invalid',name:`storage_http_test_restore_remote_${suffix}`},schemaHash}),/RESTORE_FRESH_LOCAL_DATABASE_REQUIRED/);negatives.push('remote rejected');
  await assert.rejects(()=>restoreFreshDatabase({directory:backupDirectory,target:{host:'127.0.0.1',name:restores[0].name},schemaHash}),/RESTORE_DATABASE_ALREADY_EXISTS/);negatives.push('existing database rejected');
  const failedTarget={host:'127.0.0.1',name:`storage_http_test_restore_failed_${suffix}`};
  await assert.rejects(()=>restoreFreshDatabase({directory:backupDirectory,target:failedTarget,schemaHash,successFile:resolve(root,'failed-restore-success.json'),afterImport:async db=>{await db.query('select 1/0');}}),/division by zero/);negatives.push('restore transaction rollback');
  await assert.rejects(()=>access(resolve(root,'failed-restore-success.json')));negatives.push('failed restore emits no success manifest');
  const failed=client(failedTarget.name);await failed.connect();try{assert.equal((await failed.query('select count(*)::integer count from wallet_accounts')).rows[0]?.count,0);}finally{await failed.end();}
  const evidence={format:'school-storage-restore-drill',synthetic:true,nodeVersion:process.version,postgresVersion:source.manifest.snapshot.postgresVersion,schemaHash,sourceManifestHash:source.manifest.manifestHash,
    sourceTables:Object.fromEntries(source.manifest.tables.map(table=>[table.name,{count:table.count,sha256:table.sha256}])),backupDirectory,sourceDatabase:harness.name,concurrentMvccWriteExcluded:true,restores,negatives,milliseconds:Date.now()-started};
  // Success evidence is written only after both full comparisons and negative scenarios complete.
  await writeFile(resolve(root,'success.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
  await assert.rejects(()=>access(resolve(backupDirectory,'success.json'))); // Backup content remains an exact manifest + table set.
  return {...evidence,evidencePath:resolve(root,'success.json')};
};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.includes('--help'))console.log('Usage: node --import tsx dev/storageRestoreDrill.ts [--output <new-evidence.json>]\nSynthetic-only. Requires local PostgreSQL 127.0.0.1:55439 and pg via STORAGE_TEST_PG_MODULE. Creates fresh DBs, retains fixtures/backups, never deletes/truncates/overwrites databases.');
  else try{
    if(args.length&&(args.length!==2||args[0]!=='--output'))throw new Error('Use --help for valid arguments.');
    const result=await runStorageRestoreDrill();const text=JSON.stringify(result,null,2)+'\n';
    if(args[0]==='--output')await writeFile(resolve(args[1]),text,{flag:'wx',mode:0o600});
    process.stdout.write(text);
  }catch(error){
    const message=error instanceof Error&&/^(?:RESTORE_|BACKUP_|Use --help)/.test(error.message)?error.message:'RESTORE_DRILL_FAILED: fixture verification failed; no source rows are logged.';
    console.error(message);process.exitCode=1;
  }
}
