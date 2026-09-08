import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, readdir, writeFile, copyFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_DRIVER = '/tmp/school-storage-runtime/node_modules/pg';
const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, isolatedModules: true };

/** Emit the real source graph without repairing imports; bare Node must resolve exactly what ships. */
export async function emitServerModules({ root = ROOT, entries, includeHarness = true }) {
  const outputDirectory = await mkdtemp(resolve(tmpdir(), 'school-emitted-runtime-'));
  await writeFile(resolve(outputDirectory, 'package.json'), JSON.stringify({ type: 'module' }));
  const roots = entries ?? (await readdir(resolve(root, 'api'))).filter(name => name.endsWith('.ts') && !name.endsWith('.d.ts')).sort().map(name => `api/${name}`);
  const queue = [...roots, ...(includeHarness ? ['tests/storage/httpHarness.ts'] : [])];
  const files = new Map();
  while (queue.length) {
    const sourcePath = resolve(root, queue.shift());
    if (files.has(sourcePath) || sourcePath.endsWith('.d.ts')) continue;
    const localPath = relative(root, sourcePath);
    if (localPath.startsWith('..') || isAbsolute(localPath)) throw new Error('EMITTED_SOURCE_OUTSIDE_ROOT');
    const source = await readFile(sourcePath, 'utf8');
    files.set(sourcePath, source);
    const info = ts.preProcessFile(source, true, true);
    for (const imported of info.importedFiles) {
      if (!imported.fileName.startsWith('.')) continue;
      const resolved = ts.resolveModuleName(imported.fileName, sourcePath, compilerOptions, ts.sys).resolvedModule;
      if (!resolved) throw new Error(`EMITTED_DEPENDENCY_NOT_FOUND: ${localPath}: ${imported.fileName}`);
      if (!resolved.resolvedFileName.endsWith('.d.ts')) queue.push(relative(root, resolved.resolvedFileName));
    }
    const destination = resolve(outputDirectory, localPath.replace(/\.(?:tsx?|mts)$/, '.js'));
    await mkdir(dirname(destination), { recursive: true });
    const emitted = /\.(?:tsx?|mts)$/.test(sourcePath)
      ? ts.transpileModule(source, { fileName: sourcePath, compilerOptions, reportDiagnostics: true }) : { outputText: source, diagnostics: [] };
    const errors = emitted.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error) ?? [];
    if (errors.length) throw new Error(`EMITTED_TRANSPILE_FAILED: ${localPath}: ${errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('; ')}`);
    await writeFile(destination, emitted.outputText);
  }
  if (includeHarness) {
    await mkdir(resolve(outputDirectory, 'supabase'));
    for (const name of (await readdir(resolve(root, 'supabase'))).filter(name => extname(name) === '.sql'))
      await copyFile(resolve(root, 'supabase', name), resolve(outputDirectory, 'supabase', name));
  }
  // Package resolution is ordinary Node ESM. No loader or source-directory fallback is registered.
  try { await symlink(resolve(root, 'node_modules'), resolve(outputDirectory, 'node_modules'), 'dir'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const hash = createHash('sha256');
  for (const [path, source] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) hash.update(relative(root, path)).update('\0').update(source).update('\0');
  return { outputDirectory, sourceHash: hash.digest('hex'), moduleCount: files.size, handlers: roots.map(path => path.replace(/\.(?:tsx?|mts)$/, '.js')) };
}

export function runBareNode(scriptPath, { driver, timeout = 60_000 } = {}) {
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SystemRoot'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  if (driver) env.STORAGE_TEST_PG_MODULE = driver;
  return spawnSync(process.execPath, [scriptPath], { env, encoding: 'utf8', timeout, maxBuffer: 2_000_000 });
}

export async function writeImportProbe(emission, extraSource = '') {
  const path = resolve(emission.outputDirectory, 'runtime-probe.mjs');
  await writeFile(path, `import assert from 'node:assert/strict';\nassert.deepEqual(process.execArgv, []);\nconst handlers = ${JSON.stringify(emission.handlers)};\nfor (const path of handlers) { const module = await import('./' + path); assert.equal(typeof module.default, 'function', path + ' default export'); }\n${extraSource}\n`);
  return path;
}

const httpProbe = `
const {startHttpHarness,fixtureCookie}=await import('./tests/storage/httpHarness.js');
const harness=await startHttpHarness({name:'storage_http_test_emitted_'+process.pid+'_'+Date.now(),port:0});
const request=async(actor,path,body,method)=>{
 const response=await fetch(harness.baseUrl+path,{method:method??(body===undefined?'GET':'POST'),headers:{...(actor===null?{}:{Cookie:fixtureCookie(actor)}),'Content-Type':'application/json','sec-fetch-site':'same-origin','x-storage-projection':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json()};
};
try {
 assert.equal((await request(null,'/api/shared-settings')).status,401);
 const teacher=await request(0,'/api/shared-settings');assert.equal(teacher.status,200);
 const student=await request(17,'/api/shared-settings');assert.equal(student.status,200);
 assert.deepEqual(Object.keys(student.body.value.currencyBalances),['17']);
 assert.equal(JSON.stringify(student.body).includes('학생2 전용 fixture'),false);
 const legacy=await request(0,'/api/shared-settings',{value:teacher.body.value,expectedUpdatedAt:teacher.body.updated_at},'PUT');assert.equal(legacy.status,409);
 harness.metrics.length=0;
 const patch={protocolVersion:2,requestId:'emitted-teacher-settings',action:'teacher.settings.patch',payload:{changes:[{field:'scheduleNotice',before:'격리 검증 학급',after:'emitted 검증'}]}};
 assert.equal((await request(0,'/api/shared-settings',patch)).status,200);
 const letter={protocolVersion:2,requestId:'emitted-letter-17',action:'student.letter.send',payload:{recipient:0,title:'합성',content:'emitted fixture'}};
 assert.equal((await request(17,'/api/shared-settings',letter)).status,200);
 assert.equal((await request(17,'/api/shared-settings',letter)).status,200);
 assert.equal((await request(17,'/api/shared-settings?requestId=emitted-letter-17')).body.status,'committed');
 const deposit={protocolVersion:2,requestId:'emitted-deposit-17',studentNumber:17,action:{type:'deposit',amount:30}};
 const first=await request(17,'/api/student-economy',deposit);assert.equal(first.status,200);
 assert.deepEqual(await request(17,'/api/student-economy',deposit),first);
 assert.equal((await request(17,'/api/student-economy?protocolVersion=2&studentNumber=17&requestId=emitted-deposit-17')).body.status,'committed');
 assert.equal((await harness.query('select balance from wallet_accounts where student_number=17')).rows[0].balance,70);
 assert.equal((await harness.query('select count(*)::integer total from wallet_ledger where student_number=17 and not historical')).rows[0].total,1);
 assert.equal((await harness.query("select count(*)::integer total from storage_resources where resource_key='/studentLife/letters/@emitted-letter-17' and not deleted")).rows[0].total,1);
 assert.equal(harness.metrics.filter(item=>item.rpc==='storage_load_snapshot').length,0);
 assert.deepEqual((await harness.query('select storage_reconcile_wallets() result')).rows[0].result,[]);
 console.log(JSON.stringify({nodeVersion:process.version,nodeExecArgv:process.execArgv,handlerCount:handlers.length,database:harness.name,cases:11,fullCommandReads:0,reconciliation:[]}));
} finally {await harness.stop();}
`;

export async function verifyServerRuntime({ driver = process.env.STORAGE_TEST_PG_MODULE ?? DEFAULT_DRIVER } = {}) {
  let pg;
  try { pg = createRequire(import.meta.url)(driver); if (typeof pg.Client !== 'function') throw new Error('PG_CLIENT_REQUIRED'); } catch { throw new Error('EMITTED_PG_DRIVER_REQUIRED: Set STORAGE_TEST_PG_MODULE to an installed pg driver. No runtime gate was skipped.'); }
  const connection = new pg.Client({ host: '127.0.0.1', port: 55439, user: 'postgres', password: 'local-fixture-only', database: 'postgres', connectionTimeoutMillis: 2000 });
  try { await connection.connect(); await connection.query('select 1'); }
  catch { throw new Error('EMITTED_FIXTURE_DATABASE_REQUIRED: Start the isolated PostgreSQL fixture at 127.0.0.1:55439 (postgres / local-fixture-only). No runtime gate was skipped.'); }
  finally { await connection.end(); }
  const emission = await emitServerModules({});
  const probe = await writeImportProbe(emission, httpProbe);
  const child = runBareNode(probe, { driver });
  if (child.status !== 0) throw new Error(`EMITTED_RUNTIME_FAILED: exit=${child.status ?? 'none'} ${child.error?.code ?? ''}\n${child.stderr.slice(-8000)}`);
  const result = JSON.parse(child.stdout.trim());
  return { ...result, sourceHash: emission.sourceHash, moduleCount: emission.moduleCount, outputDirectory: emission.outputDirectory };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) console.log('Usage: node dev/verifyServerRuntime.mjs [--output <result.json>]\nRequires isolated PostgreSQL at 127.0.0.1:55439 and pg via STORAGE_TEST_PG_MODULE. Emits all API dependencies and tests with bare Node; failures never skip. Synthetic DB and emitted files are retained; live credentials are never loaded or written.');
  else {
    try {
      if (args.length && (args.length !== 2 || args[0] !== '--output')) throw new Error('Unknown arguments; use --help.');
      const result = await verifyServerRuntime();
      const output = JSON.stringify(result, null, 2)+'\n';
      if (args[0] === '--output') await writeFile(resolve(args[1]), output);
      process.stdout.write(output);
    } catch (error) { console.error(error instanceof Error ? error.message : 'EMITTED_RUNTIME_FAILED'); process.exitCode = 1; }
  }
}
