import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalStorageJson, isStorageRecord, splitStorageState } from '../src/lib/storageV2Codec.js';
import { parseStorageSnapshot } from '../src/server/storageV2Repository.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tableDefinitions = [
  { name: 'weekly_mission_rewards', keys: ['student_number', 'week_key', 'mission_type'] },
  { name: 'today_friend_rewards', keys: ['submission_id'] },
  { name: 'class_donation_requests', keys: ['request_id'] },
  { name: 'today_friend_settings', keys: ['id'] },
  { name: 'today_friend_submissions', keys: ['id'] },
  { name: 'library_competition_archives', keys: ['settings_id', 'season_id'] },
  { name: 'classword_rounds', keys: ['round_date'] },
  { name: 'classword_entries', keys: ['id'] },
  { name: 'classword_quiz_completions', keys: ['id'] },
  { name: 'classword_quizzes', keys: ['quiz_date'] },
  { name: 'announcement_notes', keys: ['date_key'] },
] as const;
const commands = ['inspect', 'pause', 'backup', 'migrate', 'reconcile', 'activate', 'reopen'] as const;
type Command = typeof commands[number];
interface Options { readonly command: Command; readonly execute: boolean; readonly backupDir?: string }
interface Control { readonly active: boolean; readonly maintenance: boolean }
interface MainRow { readonly id: 'school-timer-main'; readonly value: Record<string, unknown>; readonly updated_at: string }
interface Artifact { readonly file: string; readonly sha256: string; readonly count: number }
interface Manifest { readonly version: 1; readonly createdAt: string; readonly sourceUpdatedAt: string; readonly sourceHash: string; readonly files: Record<string, Artifact> }
export class StorageCutoverError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'StorageCutoverError'; }
}
const fail = (code: string): never => { throw new StorageCutoverError(code); };
const digest = (value: unknown): string => createHash('sha256').update(canonicalStorageJson(value)).digest('hex');
const mainRow = (value: unknown): MainRow => {
  if (!isStorageRecord(value) || value.id !== 'school-timer-main' || !isStorageRecord(value.value) || typeof value.updated_at !== 'string' || !Number.isFinite(Date.parse(value.updated_at))) return fail('CUTOVER_INVALID_SOURCE');
  return { id: 'school-timer-main', value: value.value, updated_at: value.updated_at };
};
const rows = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value) || !value.every(isStorageRecord)) return fail('CUTOVER_INVALID_ROWS');
  return value;
};
export const buildBootstrapRequest = (source: unknown): Record<string, unknown> => {
  const main = mainRow(source);
  const encoded = splitStorageState(main.value);
  if (encoded.wallets.length !== 23) return fail('CUTOVER_INCOMPLETE_WALLETS');
  return { p_expected_updated_at: main.updated_at, p_source: main.value, p_resources: encoded.resources, p_wallets: encoded.wallets, p_history: encoded.history };
};
export const validateCutoverSnapshot = (source: unknown, loaded: unknown, differences: unknown): { readonly verified: true; readonly wallets: 23; readonly sourceHash: string } => {
  const main = mainRow(source);
  const snapshot = parseStorageSnapshot(loaded);
  if (digest(snapshot.value) !== digest(main.value)) return fail('CUTOVER_PROJECTION_MISMATCH');
  if (!Array.isArray(differences) || differences.length !== 0) return fail('CUTOVER_LEDGER_MISMATCH');
  const expectedWallets = splitStorageState(main.value).wallets;
  const actualWallets = splitStorageState(snapshot.value).wallets;
  if (expectedWallets.length !== 23 || actualWallets.length !== 23 || Array.from({ length: 23 }, (_, index) => index + 1).some(student => expectedWallets.find(wallet => wallet.student_number === student)?.balance !== actualWallets.find(wallet => wallet.student_number === student)?.balance)) return fail('CUTOVER_WALLET_MISMATCH');
  return { verified: true, wallets: 23, sourceHash: digest(main.value) };
};
const parseOptions = (args: readonly string[]): Options => {
  const selected = commands.find(command => command === args[0]);
  if (!selected) return fail('CUTOVER_INVALID_COMMAND');
  let execute = false;
  let backupDir: string | undefined;
  for (let index = 1; index < args.length; index += 1) {
    if (args[index] === '--execute' && !execute) execute = true;
    else if (args[index] === '--backup-dir' && backupDir === undefined && args[index + 1] && !args[index + 1].startsWith('--')) backupDir = args[++index];
    else return fail('CUTOVER_INVALID_ARGUMENT');
  }
  if (['pause', 'migrate', 'activate', 'reopen'].includes(selected) && !execute) return fail('CUTOVER_EXECUTE_REQUIRED');
  if (['backup', 'migrate', 'reconcile', 'activate', 'reopen'].includes(selected) && !backupDir) return fail('CUTOVER_BACKUP_DIR_REQUIRED');
  if (backupDir && !isAbsolute(backupDir)) return fail('CUTOVER_ABSOLUTE_BACKUP_DIR_REQUIRED');
  return { command: selected, execute, ...(backupDir ? { backupDir } : {}) };
};
export const storageCutoverHelp = `Usage: node --import tsx dev/storageCutover.ts <command> [--backup-dir /private/path] [--execute]

Commands:
  inspect     Read control, source revision and record counts; no student content.
  pause       Drain writers and enable maintenance. Requires --execute.
  backup      Save a consistent raw backup in a NEW private directory outside this repository.
  migrate     Bootstrap once from that backup while paused. Requires --execute.
  reconcile   Compare all 23 balances, raw projection and preserved records with that backup.
  activate    Reconcile, then activate v2 while keeping maintenance ON. Requires --execute.
  reopen      Reconcile again, then clear maintenance. Requires --execute.

Environment: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (never printed).
Mutations are never retried automatically. After uncertain results inspect/reconcile first.
There is no rollback command. After new transactions, preserve the ledger and fix forward.
`;
export interface CutoverDependencies { readonly fetcher?: typeof fetch; readonly env?: Readonly<Record<string, string | undefined>> }
export const runStorageCutover = async (args: readonly string[], dependencies: CutoverDependencies = {}): Promise<Record<string, unknown>> => {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) return { help: storageCutoverHelp };
  const options = parseOptions(args);
  const env = dependencies.env ?? process.env;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return fail('CUTOVER_ENV_REQUIRED');
  let origin: URL;
  try { origin = new URL(env.SUPABASE_URL); } catch { return fail('CUTOVER_INVALID_URL'); }
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))) return fail('CUTOVER_INVALID_URL');
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') return fail('CUTOVER_INVALID_URL');
  const fetcher = dependencies.fetcher ?? fetch;
  const request = async (path: string, payload?: unknown): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetcher(`${origin.origin}/rest/v1/${path}`, { method: payload === undefined ? 'GET' : 'POST',
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(60_000) });
    } catch { return fail('CUTOVER_RESPONSE_UNCONFIRMED'); }
    if (!response.ok) return fail(`CUTOVER_HTTP_${response.status}`);
    try { return await response.json(); } catch { return fail('CUTOVER_INVALID_RESPONSE'); }
  };
  const rpc = (name: string, payload: unknown = {}) => request(`rpc/${name}`, payload);
  const getControl = async (): Promise<Control> => {
    const states = rows(await request('storage_control?singleton=eq.true&select=active,maintenance'));
    const state = states[0];
    if (states.length !== 1 || typeof state.active !== 'boolean' || typeof state.maintenance !== 'boolean') return fail('CUTOVER_INVALID_CONTROL');
    return { active: state.active, maintenance: state.maintenance };
  };
  const getMain = async (): Promise<MainRow> => {
    const found = rows(await request('app_settings?id=eq.school-timer-main&select=id,value,updated_at'));
    if (found.length !== 1) return fail('CUTOVER_SOURCE_REQUIRED');
    return mainRow(found[0]);
  };
  const getTable = async (name: string, keys: readonly string[]): Promise<Record<string, unknown>[]> => {
    const result: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 1000) {
      const query = new URLSearchParams({ select: '*', order: keys.map(key => `${key}.asc`).join(','), offset: String(offset), limit: '1000' });
      const page = rows(await request(`${name}?${query}`));
      result.push(...page);
      if (page.length < 1000) break;
    }
    const identities = result.map(row => canonicalStorageJson(keys.map(key => row[key])));
    if (new Set(identities).size !== identities.length) return fail('CUTOVER_DUPLICATE_SOURCE_ID');
    return result;
  };
  const getTables = async (): Promise<Record<string, Record<string, unknown>[]>> => Object.fromEntries(await Promise.all(tableDefinitions.map(async table => [table.name, await getTable(table.name, table.keys)])));
  const privateDirectory = async (create: boolean): Promise<string> => {
    const directory = options.backupDir;
    if (!directory) return fail('CUTOVER_BACKUP_DIR_REQUIRED');
    const parent = await realpath(dirname(directory));
    const target = resolve(parent, directory.split(sep).at(-1) ?? '');
    const relativePath = relative(repositoryRoot, target);
    if (relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..' && !isAbsolute(relativePath))) return fail('CUTOVER_BACKUP_INSIDE_REPOSITORY');
    if (create) await mkdir(target, { mode: 0o700 });
    const actual = await realpath(target);
    if (actual !== target) return fail('CUTOVER_BACKUP_SYMLINK');
    const details = await stat(actual);
    if (!details.isDirectory() || (details.mode & 0o077) !== 0) return fail('CUTOVER_BACKUP_NOT_PRIVATE');
    return actual;
  };
  const saveArtifact = async (directory: string, file: string, value: unknown, count: number): Promise<Artifact> => {
    await writeFile(resolve(directory, file), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    return { file, sha256: digest(value), count };
  };
  const loadBackup = async (): Promise<{ main: MainRow; tables: Record<string, Record<string, unknown>[]>; manifest: Manifest }> => {
    const directory = await privateDirectory(false);
    const manifestPath = resolve(directory, 'manifest.json');
    if ((await stat(manifestPath)).mode & 0o077) return fail('CUTOVER_BACKUP_NOT_PRIVATE');
    const raw: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!isStorageRecord(raw) || raw.version !== 1 || typeof raw.createdAt !== 'string' || typeof raw.sourceUpdatedAt !== 'string' || typeof raw.sourceHash !== 'string' || !isStorageRecord(raw.files)) return fail('CUTOVER_INVALID_BACKUP');
    const files: Record<string, Artifact> = {};
    const values: Record<string, unknown> = {};
    for (const name of ['main', ...tableDefinitions.map(table => table.name)]) {
      const artifact = raw.files[name];
      if (!isStorageRecord(artifact) || artifact.file !== `${name}.json` || typeof artifact.sha256 !== 'string' || typeof artifact.count !== 'number') return fail('CUTOVER_INVALID_BACKUP');
      const filename = resolve(directory, artifact.file);
      if ((await stat(filename)).mode & 0o077) return fail('CUTOVER_BACKUP_NOT_PRIVATE');
      const value: unknown = JSON.parse(await readFile(filename, 'utf8'));
      if (digest(value) !== artifact.sha256) return fail('CUTOVER_BACKUP_HASH_MISMATCH');
      values[name] = value;
      files[name] = { file: artifact.file, sha256: artifact.sha256, count: artifact.count };
    }
    const main = mainRow(values.main);
    if (main.updated_at !== raw.sourceUpdatedAt || digest(main.value) !== raw.sourceHash) return fail('CUTOVER_INVALID_BACKUP');
    const tables = Object.fromEntries(tableDefinitions.map(table => [table.name, rows(values[table.name])]));
    return { main, tables, manifest: { version: 1, createdAt: raw.createdAt, sourceUpdatedAt: raw.sourceUpdatedAt, sourceHash: raw.sourceHash, files } };
  };
  const reconcile = async (): Promise<Record<string, unknown>> => {
    if (!(await getControl()).maintenance) return fail('CUTOVER_MAINTENANCE_REQUIRED');
    const backup = await loadBackup();
    const [current, loaded, differences, tables] = await Promise.all([getMain(), rpc('storage_load_snapshot'), rpc('storage_reconcile_wallets'), getTables()]);
    if (digest(current.value) !== backup.manifest.sourceHash || current.updated_at !== backup.main.updated_at) return fail('CUTOVER_SOURCE_CHANGED');
    validateCutoverSnapshot(backup.main, loaded, differences);
    for (const table of tableDefinitions) {
      const before = backup.tables[table.name];
      const after = tables[table.name];
      const identity = (row: Record<string, unknown>) => canonicalStorageJson(table.keys.map(key => row[key]));
      const indexed = new Map(after.map(row => [identity(row), row]));
      if (before.length !== after.length || before.some(row => { const saved = indexed.get(identity(row)); return !saved || Object.keys(row).some(key => !Object.hasOwn(saved, key) || canonicalStorageJson(saved[key]) !== canonicalStorageJson(row[key])); })) return fail(`CUTOVER_RECORD_MISMATCH_${table.name.toUpperCase()}`);
    }
    return { verified: true, wallets: 23, sourceHash: backup.manifest.sourceHash, records: Object.fromEntries(tableDefinitions.map(table => [table.name, tables[table.name].length])) };
  };
  if (options.command === 'inspect') {
    const [control, source, tables] = await Promise.all([getControl(), getMain(), getTables()]);
    const state = splitStorageState(source.value);
    return { command: 'inspect', ...control, sourceUpdatedAt: source.updated_at, sourceHash: digest(source.value), resources: state.resources.length, wallets: state.wallets.length, history: state.history.length, records: Object.fromEntries(tableDefinitions.map(table => [table.name, tables[table.name].length])) };
  }
  if (options.command === 'pause') return { command: 'pause', control: await rpc('storage_set_maintenance', { p_maintenance: true, p_active: null }) };
  const control = await getControl();
  if (!control.maintenance) return fail('CUTOVER_MAINTENANCE_REQUIRED');
  if (options.command === 'backup') {
    const directory = await privateDirectory(true);
    const main = await getMain();
    const tables = await getTables();
    const [finalMain, finalTables] = await Promise.all([getMain(), getTables()]);
    if (digest(main) !== digest(finalMain) || digest(tables) !== digest(finalTables)) return fail('CUTOVER_SOURCE_CHANGED_DURING_BACKUP');
    const files: Record<string, Artifact> = { main: await saveArtifact(directory, 'main.json', main, 1) };
    for (const table of tableDefinitions) files[table.name] = await saveArtifact(directory, `${table.name}.json`, tables[table.name], tables[table.name].length);
    const manifest: Manifest = { version: 1, createdAt: new Date().toISOString(), sourceUpdatedAt: main.updated_at, sourceHash: digest(main.value), files };
    await saveArtifact(directory, 'manifest.json', manifest, 1);
    return { command: 'backup', backupDir: directory, sourceHash: manifest.sourceHash, records: Object.fromEntries(Object.entries(files).map(([key, value]) => [key, value.count])) };
  }
  if (options.command === 'migrate') {
    if (control.active) return fail('CUTOVER_ALREADY_ACTIVE');
    const backup = await loadBackup();
    const current = await getMain();
    if (digest(current) !== digest(backup.main)) return fail('CUTOVER_SOURCE_CHANGED');
    const result = await rpc('storage_bootstrap', buildBootstrapRequest(backup.main));
    if (!isStorageRecord(result) || result.migrated !== true || result.verified !== true || result.wallets !== 23) return fail('CUTOVER_MIGRATION_UNCONFIRMED');
    return { command: 'migrate', result, reconciliation: await reconcile() };
  }
  const verified = await reconcile();
  if (options.command === 'reconcile') return { command: 'reconcile', ...verified };
  if (options.command === 'activate') return { command: 'activate', reconciliation: verified, control: await rpc('storage_set_maintenance', { p_maintenance: true, p_active: true }) };
  if (!control.active) return fail('CUTOVER_ACTIVATION_REQUIRED');
  return { command: 'reopen', reconciliation: verified, control: await rpc('storage_set_maintenance', { p_maintenance: false, p_active: null }) };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runStorageCutover(process.argv.slice(2)).then(result => {
    console.log(typeof result.help === 'string' ? result.help : JSON.stringify(result, null, 2));
  }).catch((error: unknown) => {
    console.error(error instanceof StorageCutoverError ? error.code : 'CUTOVER_FAILED');
    process.exitCode = 1;
  });
}
