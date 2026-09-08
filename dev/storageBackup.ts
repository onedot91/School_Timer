import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalStorageJson, isStorageRecord } from '../src/lib/storageV2Codec.js';

export const BACKUP_TABLES = [
  ['app_settings',['id']], ['announcement_notes',['date_key']], ['weekly_mission_rewards',['student_number','week_key','mission_type']],
  ['class_donation_requests',['request_id']], ['today_friend_settings',['id']], ['today_friend_submissions',['id']], ['today_friend_rewards',['submission_id']],
  ['classword_rounds',['round_date']], ['classword_entries',['id']], ['classword_quiz_completions',['id']], ['classword_quizzes',['quiz_date']],
  ['library_competition_archives',['settings_id','season_id']], ['today_friend_planning_records',['category','record_key']],
  ['storage_resources',['resource_key']], ['storage_scopes',['scope_key']], ['wallet_accounts',['student_number']], ['wallet_ledger',['resource_key']],
  ['storage_receipts',['actor_key','request_id']], ['storage_reward_claims',['claim_id']], ['storage_backups',['backup_id']], ['storage_control',['singleton']],
] as const;
export const BACKUP_SCHEMA_FILES = ['app_settings.sql','classword.sql','library_competition.sql','storage_v2.sql','storage_today_friend_v2.sql','storage_rewards_v2.sql','storage_classword_v2.sql','storage_audit_v2.sql','storage_scoped_v2.sql'] as const;
export interface BackupDatabase { query(sql: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }> }
export interface BackupColumn { name: string; type: string; nullable: boolean; identity: string }
export interface BackupTable { name: string; primaryKey: readonly string[]; columns: readonly BackupColumn[]; count: number; sha256: string; file: string }
export interface BackupSequence { name: string; table: string; column: string; lastValue: string; isCalled: boolean }
export interface BackupManifest {
  format: 'school-storage-v2-backup'; version: 2; schemaVersion: 2; protocolVersion: 2; canonicalVersion: 1; encoding: 'postgres-json-text-v1'; schemaHash: string;
  snapshot: { isolation: 'repeatable read'; readOnly: true; id: string; capturedAt: string; postgresVersion: string };
  sequenceConsistency: 'observed-after-mvcc-rows'; sequences: readonly BackupSequence[]; tables: readonly BackupTable[]; manifestHash: string;
}
export interface StorageBackup { manifest: BackupManifest; rows: Readonly<Record<string, readonly Record<string, unknown>[]>> }
export class StorageBackupError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new StorageBackupError(code); };
export const backupHash = (value: unknown): string => createHash('sha256').update(canonicalStorageJson(value)).digest('hex');
const identifier = (name: string): string => /^[a-z][a-z0-9_]*$/.test(name) ? `"${name}"` : fail('BACKUP_INVALID_IDENTIFIER');
const hashValid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const sortBackupRows = (rows: readonly Record<string, unknown>[], keys: readonly string[]): readonly Record<string, unknown>[] => {
  const seen = new Set<string>();
  for (const row of rows) {
    if (keys.some(key => row[key] === null || row[key] === undefined)) return fail('BACKUP_PRIMARY_KEY_MISSING');
    const key = canonicalStorageJson(keys.map(name => row[name]));
    if (seen.has(key)) return fail('BACKUP_DUPLICATE_PRIMARY_KEY');
    seen.add(key);
  }
  return [...rows].sort((a,b) => { const left=canonicalStorageJson(keys.map(key=>a[key])),right=canonicalStorageJson(keys.map(key=>b[key])); return left<right?-1:left>right?1:0; });
};
export const schemaFilesHash = async (root: string): Promise<string> => backupHash(await Promise.all(BACKUP_SCHEMA_FILES.map(async name => ({ name, source: await readFile(resolve(root,'supabase',name),'utf8') }))));

export const validateStorageBackup = (input: unknown, rowInput: unknown): StorageBackup => {
  if (!isStorageRecord(input) || input.format !== 'school-storage-v2-backup' || input.version !== 2 || input.schemaVersion !== 2 || input.encoding !== 'postgres-json-text-v1' || input.protocolVersion !== 2 || input.canonicalVersion !== 1
    || !hashValid(input.schemaHash) || !hashValid(input.manifestHash) || !isStorageRecord(input.snapshot) || input.snapshot.isolation !== 'repeatable read'
    || input.snapshot.readOnly !== true || typeof input.snapshot.id !== 'string' || !input.snapshot.id || typeof input.snapshot.capturedAt !== 'string'
    || !Number.isFinite(Date.parse(input.snapshot.capturedAt)) || typeof input.snapshot.postgresVersion !== 'string'
    || input.sequenceConsistency !== 'observed-after-mvcc-rows' || !Array.isArray(input.sequences) || !Array.isArray(input.tables) || !isStorageRecord(rowInput)) return fail('BACKUP_INVALID_MANIFEST');
  const {manifestHash,...unsigned}=input;
  if (backupHash(unsigned)!==manifestHash) return fail('BACKUP_MANIFEST_HASH_MISMATCH');
  if (input.tables.length !== BACKUP_TABLES.length || Object.keys(rowInput).length !== BACKUP_TABLES.length) return fail('BACKUP_TABLE_SET_MISMATCH');
  const tables: BackupTable[]=[];const rows: Record<string,readonly Record<string,unknown>[]>={};
  for (const [name,keys] of BACKUP_TABLES) {
    const matches=input.tables.filter(table=>isStorageRecord(table)&&table.name===name);
    if (matches.length!==1) return fail('BACKUP_TABLE_SET_MISMATCH');
    const table=matches[0];const data=rowInput[name];
    if (!isStorageRecord(table)||table.file!==`${name}.json`||canonicalStorageJson(table.primaryKey)!==canonicalStorageJson(keys)
      || !Array.isArray(table.columns)||table.columns.length===0||!Number.isSafeInteger(table.count)||typeof table.count!=='number'||table.count<0||!hashValid(table.sha256)
      ||!Array.isArray(data)||!data.every(isStorageRecord)) return fail('BACKUP_INVALID_TABLE');
    const columns: BackupColumn[]=[];
    for (const column of table.columns) {
      if (!isStorageRecord(column)||typeof column.name!=='string'||!/^[a-z][a-z0-9_]*$/.test(column.name)||typeof column.type!=='string'||!column.type||typeof column.nullable!=='boolean'||typeof column.identity!=='string'||!['','a','d'].includes(column.identity)) return fail('BACKUP_INVALID_COLUMNS');
      columns.push({name:column.name,type:column.type,nullable:column.nullable,identity:column.identity});
    }
    if (new Set(columns.map(column=>column.name)).size!==columns.length||keys.some(key=>!columns.some(column=>column.name===key))) return fail('BACKUP_INVALID_COLUMNS');
    if (name==='storage_receipts'&&!columns.some(column=>column.name==='scope')) return fail('BACKUP_RECEIPT_SCOPE_MISSING');
    if (data.some(row=>Object.keys(row).length!==columns.length||columns.some(column=>!Object.hasOwn(row,column.name)
      || (!column.nullable&&row[column.name]===null) || (['json','jsonb'].includes(column.type)&&row[column.name]!==null&&typeof row[column.name]!=='string') || (column.type==='bigint'&&row[column.name]!==null&&(typeof row[column.name]!=='string'||!/^[-]?\d+$/.test(String(row[column.name]))))))) return fail(`BACKUP_ROW_SHAPE_MISMATCH:${name}`);
    for(const row of data)for(const column of columns)if(['json','jsonb'].includes(column.type)&&typeof row[column.name]==='string'){
      try{JSON.parse(String(row[column.name]));}catch{return fail('BACKUP_INVALID_JSON_COLUMN');}
    }
    const sorted=sortBackupRows(data,keys);
    if (data.length!==table.count||backupHash(sorted)!==table.sha256||canonicalStorageJson(sorted)!==canonicalStorageJson(data)) return fail('BACKUP_ROW_HASH_MISMATCH');
    rows[name]=data;tables.push({name,primaryKey:keys,columns,count:table.count,sha256:table.sha256,file:table.file});
  }
  const sequences: BackupSequence[]=[];
  for (const sequence of input.sequences) {
    if (!isStorageRecord(sequence)||sequence.name!=='storage_backups_backup_id_seq'||sequence.table!=='storage_backups'||sequence.column!=='backup_id'
      ||typeof sequence.lastValue!=='string'||!/^\d+$/.test(sequence.lastValue)||typeof sequence.isCalled!=='boolean') return fail('BACKUP_INVALID_SEQUENCE');
    if (BigInt(sequence.lastValue)<1n||BigInt(sequence.lastValue)>9223372036854775807n) return fail('BACKUP_INVALID_SEQUENCE');
    sequences.push({name:sequence.name,table:sequence.table,column:sequence.column,lastValue:sequence.lastValue,isCalled:sequence.isCalled});
  }
  if (sequences.length!==1||rows.storage_backups.some(row=>BigInt(String(row.backup_id))>BigInt(sequences[0].lastValue))||(!sequences[0].isCalled&&rows.storage_backups.length>0)) return fail('BACKUP_INVALID_SEQUENCE');
  return {manifest:{format:'school-storage-v2-backup',version:2,schemaVersion:2,protocolVersion:2,canonicalVersion:1,encoding:'postgres-json-text-v1',schemaHash:input.schemaHash,
    snapshot:{isolation:'repeatable read',readOnly:true,id:input.snapshot.id,capturedAt:input.snapshot.capturedAt,postgresVersion:input.snapshot.postgresVersion},sequenceConsistency:'observed-after-mvcc-rows',sequences,tables,manifestHash},rows};
};

export const captureStorageBackup = async (db: BackupDatabase, schemaHash: string): Promise<StorageBackup> => {
  await db.query('begin isolation level repeatable read read only');
  try {
    await db.query("set local time zone 'UTC'");
    const info=(await db.query("select pg_current_snapshot()::text id,transaction_timestamp()::text captured_at,current_setting('server_version') postgres_version,current_setting('transaction_isolation') isolation,current_setting('transaction_read_only') read_only")).rows[0];
    if (info?.isolation!=='repeatable read'||info.read_only!=='on') return fail('BACKUP_SNAPSHOT_REQUIRED');
    const names=(await db.query("select tablename name from pg_tables where schemaname='public' order by tablename")).rows.map(row=>row.name);
    if (canonicalStorageJson(names)!==canonicalStorageJson(BACKUP_TABLES.map(([name])=>name).sort())) return fail('BACKUP_TABLE_SET_MISMATCH');
    const tables: BackupTable[]=[];const rows: Record<string,readonly Record<string,unknown>[]>={};
    for (const [name,keys] of BACKUP_TABLES) {
      const columnsRaw=(await db.query("select a.attname name,format_type(a.atttypid,a.atttypmod) type,not a.attnotnull nullable,a.attidentity identity from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum",[`public.${name}`])).rows;
      const columns=columnsRaw.map(column=>({name:String(column.name),type:String(column.type),nullable:Boolean(column.nullable),identity:String(column.identity)}));
      const primaryKeys=(await db.query("select a.attname name from pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum,position) join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum where i.indrelid=$1::regclass and i.indisprimary order by k.position",[`public.${name}`])).rows.map(row=>row.name);
      if (canonicalStorageJson(primaryKeys)!==canonicalStorageJson(keys)) return fail('BACKUP_PRIMARY_KEY_SCHEMA_MISMATCH');
      const wide=columns.filter(column=>column.type==='bigint'||column.type.startsWith('numeric')||column.type==='jsonb'||column.type==='json');
      const patches=wide.length?` || jsonb_build_object(${wide.map(column=>`'${column.name}',t.${identifier(column.name)}::text`).join(',')})`:'';
      const data=(await db.query(`select to_jsonb(t)${patches} row from public.${identifier(name)} t`)).rows.map(row=>row.row);
      if (!data.every(isStorageRecord)) return fail('BACKUP_INVALID_ROWS');
      for(const row of data)for(const column of columns)if(['json','jsonb'].includes(column.type)&&typeof row[column.name]==='string'){
      try{JSON.parse(String(row[column.name]));}catch{return fail('BACKUP_INVALID_JSON_COLUMN');}
    }
    const sorted=sortBackupRows(data,keys);rows[name]=sorted;tables.push({name,primaryKey:keys,columns,count:sorted.length,sha256:backupHash(sorted),file:`${name}.json`});
    }
    const sequenceNames=(await db.query("select sequencename name from pg_sequences where schemaname='public' order by sequencename")).rows.map(row=>row.name);
    if (canonicalStorageJson(sequenceNames)!==canonicalStorageJson(['storage_backups_backup_id_seq'])) return fail('BACKUP_SEQUENCE_SET_MISMATCH');
    const sequence=(await db.query('select last_value::text last_value,is_called from public.storage_backups_backup_id_seq')).rows[0];
    const unsigned={format:'school-storage-v2-backup',version:2,schemaVersion:2,protocolVersion:2,canonicalVersion:1,encoding:'postgres-json-text-v1',schemaHash,
      snapshot:{isolation:'repeatable read',readOnly:true,id:info.id,capturedAt:info.captured_at,postgresVersion:info.postgres_version},sequenceConsistency:'observed-after-mvcc-rows',
      sequences:[{name:'storage_backups_backup_id_seq',table:'storage_backups',column:'backup_id',lastValue:sequence.last_value,isCalled:sequence.is_called}],tables};
    const backup=validateStorageBackup({...unsigned,manifestHash:backupHash(unsigned)},rows);
    await db.query('commit');return backup;
  } catch(error) {await db.query('rollback');throw error;}
};

export const writeStorageBackup = async (directory: string, backup: StorageBackup): Promise<void> => {
  const checked=validateStorageBackup(backup.manifest,backup.rows);
  await mkdir(directory,{mode:0o700});
  for (const table of checked.manifest.tables) await writeFile(resolve(directory,table.file),canonicalStorageJson(checked.rows[table.name])+'\n',{mode:0o600,flag:'wx'});
  // A partial export never has a manifest.
  await writeFile(resolve(directory,'manifest.json'),canonicalStorageJson(checked.manifest)+'\n',{mode:0o600,flag:'wx'});
};
export const readStorageBackup = async (directory: string): Promise<StorageBackup> => {
  const info=await lstat(directory);if (!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0) return fail('BACKUP_PRIVATE_DIRECTORY_REQUIRED');
  const expected=['manifest.json',...BACKUP_TABLES.map(([name])=>`${name}.json`)].sort();
  if (canonicalStorageJson((await readdir(directory)).sort())!==canonicalStorageJson(expected)) return fail('BACKUP_PARTIAL_EXPORT');
  const read=async(name:string):Promise<unknown>=>{
    const file=await open(resolve(directory,name),constants.O_RDONLY|constants.O_NOFOLLOW);
    try {const stat=await file.stat();if(!stat.isFile()||(stat.mode&0o077)!==0)return fail('BACKUP_PRIVATE_FILE_REQUIRED');return JSON.parse(await file.readFile('utf8'));}finally{await file.close();}
  };
  const manifest=await read('manifest.json');const rows:Record<string,unknown>={};
  for(const [name]of BACKUP_TABLES)rows[name]=await read(`${name}.json`);
  return validateStorageBackup(manifest,rows);
};
