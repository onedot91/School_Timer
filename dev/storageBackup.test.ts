import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { BACKUP_TABLES, backupHash, readStorageBackup, sortBackupRows, validateStorageBackup, writeStorageBackup, type StorageBackup } from './storageBackup.js';

const fixture=():StorageBackup=>{
  const rows:Record<string,Record<string,unknown>[]>={};
  const tables=BACKUP_TABLES.map(([name,keys])=>{
    const columns=keys.map(key=>({name:key,type:name==='storage_backups'?'bigint':'text',nullable:false,identity:name==='storage_backups'?'a':''}));
    if(name==='storage_receipts')columns.push({name:'scope',type:'jsonb',nullable:true,identity:''});
    rows[name]=name==='storage_backups'?[{backup_id:'9007199254740993'}]:[];
    return {name,primaryKey:keys,columns,count:rows[name].length,sha256:backupHash(rows[name]),file:`${name}.json`};
  });
  const unsigned={format:'school-storage-v2-backup',version:2,schemaVersion:2,protocolVersion:2,canonicalVersion:1,encoding:'postgres-json-text-v1',schemaHash:'a'.repeat(64),snapshot:{isolation:'repeatable read',readOnly:true,id:'12:12:',capturedAt:'2026-09-08T00:00:00Z',postgresVersion:'18.4'},sequenceConsistency:'observed-after-mvcc-rows',sequences:[{name:'storage_backups_backup_id_seq',table:'storage_backups',column:'backup_id',lastValue:'9007199254740993',isCalled:true}],tables};
  return validateStorageBackup({...unsigned,manifestHash:backupHash(unsigned)},rows);
};
const resign=(value:Record<string,unknown>)=>{const {manifestHash,...unsigned}=value;return {...unsigned,manifestHash:backupHash(unsigned)};};

test('backup includes exact21 tables, receipt scope and lossless bigint identity',()=>{
  const backup=fixture();assert.equal(backup.manifest.tables.length,21);assert.equal(backup.rows.storage_backups[0].backup_id,'9007199254740993');
  assert.deepEqual(validateStorageBackup(backup.manifest,backup.rows),backup);
});

test('manifest changes, missing tables, protocol and canonical versions are rejected',()=>{
  const backup=fixture();
  assert.throws(()=>validateStorageBackup({...backup.manifest,schemaHash:'b'.repeat(64)},backup.rows),/MANIFEST_HASH_MISMATCH/);
  assert.throws(()=>validateStorageBackup(resign({...backup.manifest,tables:backup.manifest.tables.slice(1)}),backup.rows),/TABLE_SET_MISMATCH/);
  for(const key of ['version','schemaVersion','protocolVersion','canonicalVersion'])assert.throws(()=>validateStorageBackup(resign({...backup.manifest,[key]:999}),backup.rows),/INVALID_MANIFEST/);
  assert.throws(()=>validateStorageBackup(resign({...backup.manifest,snapshot:{...backup.manifest.snapshot,readOnly:false}}),backup.rows),/INVALID_MANIFEST/);
});

test('row tampering, duplicate PK, omitted columns and traversal are rejected',()=>{
  const backup=fixture();
  assert.throws(()=>validateStorageBackup(backup.manifest,{...backup.rows,storage_backups:[{backup_id:'9007199254740994'}]}),/ROW_HASH_MISMATCH/);
  assert.throws(()=>sortBackupRows([{id:'same'},{id:'same'}],['id']),/DUPLICATE_PRIMARY_KEY/);
  assert.throws(()=>validateStorageBackup(backup.manifest,{...backup.rows,storage_backups:[{}]}),/ROW_SHAPE_MISMATCH/);
  const tables=backup.manifest.tables.map(table=>table.name==='app_settings'?{...table,file:'../../escape.json'}:table);
  assert.throws(()=>validateStorageBackup(resign({...backup.manifest,tables}),backup.rows),/INVALID_TABLE/);
});

test('incomplete receipt schema and unsafe sequence state are rejected',()=>{
  const backup=fixture();
  const tables=backup.manifest.tables.map(table=>table.name==='storage_receipts'?{...table,columns:table.columns.filter(column=>column.name!=='scope')}:table);
  assert.throws(()=>validateStorageBackup(resign({...backup.manifest,tables}),backup.rows),/RECEIPT_SCOPE_MISSING/);
  assert.throws(()=>validateStorageBackup(resign({...backup.manifest,sequences:[]}),backup.rows),/INVALID_SEQUENCE/);
  assert.throws(()=>validateStorageBackup(resign({...backup.manifest,sequences:[{...backup.manifest.sequences[0],lastValue:'1'}]}),backup.rows),/INVALID_SEQUENCE/);
});

test('files use private modes and exclusive creation; partial export lacks valid manifest',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'school-backup-unit-'));const directory=resolve(root,'complete');const backup=fixture();
  await writeStorageBackup(directory,backup);
  assert.equal((await lstat(directory)).mode&0o777,0o700);assert.equal((await lstat(resolve(directory,'manifest.json'))).mode&0o777,0o600);
  assert.deepEqual(await readStorageBackup(directory),backup);
  const before=await readFile(resolve(directory,'manifest.json'),'utf8');await assert.rejects(()=>writeStorageBackup(directory,backup),/EEXIST/);
  assert.equal(await readFile(resolve(directory,'manifest.json'),'utf8'),before);
  const partial=resolve(root,'partial');await mkdir(partial,{mode:0o700});await writeFile(resolve(partial,'app_settings.json'),'[]',{mode:0o600,flag:'wx'});
  await assert.rejects(()=>readStorageBackup(partial),/BACKUP_PARTIAL_EXPORT/);
});

test('restore CLI help is safe and missing driver exits nonzero without skipping',()=>{
  const help=spawnSync(process.execPath,['--import','tsx','dev/storageRestoreDrill.ts','--help'],{encoding:'utf8'});assert.equal(help.status,0);assert.match(help.stdout,/Synthetic-only/);
  const missing=spawnSync(process.execPath,['--import','tsx','dev/storageRestoreDrill.ts'],{encoding:'utf8',env:{PATH:process.env.PATH,STORAGE_TEST_PG_MODULE:'/nonexistent-school-backup-pg'}});
  assert.equal(missing.status,1);assert.match(missing.stderr,/RESTORE_PG_DRIVER_REQUIRED/);
});

test('missing fixture database exits nonzero with instructions',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'school-backup-db-negative-'));const driver=resolve(directory,'missing.cjs');
  await writeFile(driver,"exports.Client=class {async connect(){throw new Error('ECONNREFUSED')} async end(){} async query(){return {rows:[]}}};\n",{flag:'wx',mode:0o600});
  const result=spawnSync(process.execPath,['--import','tsx','dev/storageRestoreDrill.ts'],{encoding:'utf8',env:{PATH:process.env.PATH,STORAGE_TEST_PG_MODULE:driver}});
  assert.equal(result.status,1);assert.match(result.stderr,/RESTORE_FIXTURE_DATABASE_REQUIRED/);assert.match(result.stderr,/Gate cannot skip/);
});
