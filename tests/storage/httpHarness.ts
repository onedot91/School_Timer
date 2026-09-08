import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharedSettings from '../../api/shared-settings.js';
import studentEconomy from '../../api/student-economy.js';
import deviceSession from '../../api/device-session.js';
import { createDeviceSessionToken, type RequestHeaders } from '../../src/server/deviceSession.js';
import { splitStorageState, isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { DEFAULT_AUCTION_ITEMS } from '../../src/lib/currency.js';
import { createStudentEconomyState } from '../../src/lib/studentEconomy.js';
import { normalizeStudentLifeState } from '../../src/lib/studentLife.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const FIXTURE_SECRET = 'isolated-http-fixture-session-secret-2026';
const KEY = 'isolated-fixture-service-key';
const RPCS = new Set(['storage_load_snapshot', 'storage_get_receipt', 'storage_commit_mutation', 'storage_reconcile_wallets', 'claim_weekly_mission_reward_v2', 'donate_to_class_goal_v2']);
interface Database { query(sql: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>; end(): Promise<void> }
const database = (name: string): Database => {
  const driver: unknown = createRequire(import.meta.url)(process.env.STORAGE_TEST_PG_MODULE ?? '/tmp/school-storage-runtime/node_modules/pg/lib/index.js');
  if (!isStorageRecord(driver) || typeof driver.Pool !== 'function') throw new Error('FIXTURE_PG_DRIVER_REQUIRED');
  const pool: unknown = Reflect.construct(driver.Pool, [{ host: '127.0.0.1', port: 55439, user: 'postgres', password: 'local-fixture-only', database: name, max: 32 }]);
  if (!isStorageRecord(pool) || typeof pool.query !== 'function' || typeof pool.end !== 'function') throw new Error('FIXTURE_PG_POOL_INVALID');
  const query = pool.query.bind(pool), end = pool.end.bind(pool);
  return { query: async (sql, values) => {
    const raw: unknown = await query(sql, values);
    const result: unknown = Array.isArray(raw) ? raw.at(-1) : raw;
    if (!isStorageRecord(result) || !Array.isArray(result.rows) || !result.rows.every(isStorageRecord)) throw new Error('FIXTURE_PG_RESULT_INVALID');
    return { rows: result.rows };
  }, end: async () => { await end(); } };
};
export const fixtureCookie = (studentNumber: number): string => `__Host-school-timer-device=${createDeviceSessionToken(studentNumber === 0 ? { role: 'teacher' } : { role: 'student', studentNumber }, FIXTURE_SECRET)}`;
export const fakeClassroom = (): Record<string, unknown> => ({
  version: 1, weeklySchedule: [], weeklySubjects: {}, subjectCatalog: ['국어','수학'], scheduleNotice: '격리 검증 학급',
  scheduleNoticeHighlights: [], isNoticeEnabled: true, scheduleClockOffsetSeconds: 0, scheduleYoutubeUrls: {},
  favoriteYoutubeVideos: [], manualTimer: { totalTime: 180, isVisible: false },
  currencyBalances: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [String(index + 1), 100])),
  currencyHistory: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [String(index + 1), []])),
  studentEconomy: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [String(index + 1), createStudentEconomyState()])),
  studentLife: normalizeStudentLifeState({ letters: [{ id: 'private-letter-2', recipient: 2, senderLabel: '선생님', senderStudentNumber: null, replyToId: null, title: '비공개 검증', content: '학생2 전용 fixture', createdAt: '2026-09-08T00:00:00Z', readAt: null }] }),
  auctionItems: DEFAULT_AUCTION_ITEMS, auctionBids: {}, auctionBidHistory: {}, auctionAwards: {}, auctionMissions: {}, studentPets: {}, studentEmotionHistory: {},
});
const readBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))); if (chunks.reduce((sum, item) => sum + item.length, 0) > 2_000_000) throw new Error('FIXTURE_BODY_LIMIT'); }
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : undefined;
};
const json = (response: ServerResponse, status: number, body: unknown): void => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
const listen = async (server: ReturnType<typeof createServer>, port: number): Promise<number> => {
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('FIXTURE_LISTEN_FAILED'); return address.port;
};
export const startHttpHarness = async ({ name = 'storage_http_test', port = 3018, staticDirectory = process.env.STORAGE_HTTP_DIST ?? resolve(ROOT,'dist') }: { readonly name?: string; readonly port?: number; readonly staticDirectory?: string } = {}) => {
  if (!/^storage_http_test(?:_[a-z0-9_]+)?$/.test(name)) throw new Error('FIXTURE_DATABASE_NAME_REQUIRED');
  const admin = database('postgres');
  const exists = (await admin.query('select 1 from pg_database where datname=$1', [name])).rows.length > 0;
  if (!exists) await admin.query(`create database "${name}"`);
  await admin.end();
  const db = database(name);
  const initialized = await db.query("select to_regclass('public.storage_backups') as table_name");
  const ready = initialized.rows[0]?.table_name != null && (await db.query('select 1 from storage_backups limit 1')).rows.length > 0;
  for (const file of ['app_settings.sql','classword.sql','library_competition.sql','storage_v2.sql','storage_today_friend_v2.sql','storage_rewards_v2.sql','storage_classword_v2.sql']) await db.query(await readFile(resolve(ROOT, 'supabase', file), 'utf8'));
  if (!ready) {
    const source = fakeClassroom(), encoded = splitStorageState(source), timestamp = '2026-09-08T00:00:00Z';
    await db.query("insert into app_settings(id,value,updated_at) values('school-timer-main',$1,$2)", [source,timestamp]);
    await db.query('select storage_set_maintenance(true)');
    await db.query('select storage_bootstrap($1,$2,$3,$4,$5)', [timestamp,source,JSON.stringify(encoded.resources),JSON.stringify(encoded.wallets),JSON.stringify(encoded.history)]);
    await db.query('select storage_set_maintenance(false,true)');
  }
  const metrics: { rpc: string; code?: string }[] = [];
  const gateway = createServer(async (request, response) => {
    try {
      const rpc = new URL(request.url ?? '/', 'http://localhost').pathname.split('/').at(-1) ?? '';
      if (request.method !== 'POST' || !RPCS.has(rpc) || request.headers.apikey !== KEY) { json(response,403,{ error:'FIXTURE_RPC_DENIED' });return; }
      const input = await readBody(request); if (!isStorageRecord(input)) { json(response,400,{ error:'FIXTURE_RPC_BODY' });return; }
      const keys = Object.keys(input); if (!keys.every(key => /^p_[a-z_]+$/.test(key))) throw new Error('FIXTURE_RPC_PARAMETER');
      metrics.push({rpc});
      try {
        const result = await db.query(`select public.${rpc}(${keys.map((key,index)=>`${key} => $${index+1}`).join(',')}) result`, keys.map(key => Array.isArray(input[key]) ? JSON.stringify(input[key]) : input[key]));
        json(response,200,result.rows[0]?.result);
      } catch (error) {
        const code = error instanceof Error ? Reflect.get(error,'code') : undefined;
        const message = error instanceof Error ? error.message : 'FIXTURE_DATABASE_ERROR';
        metrics.push({rpc,code:typeof code==='string'?code:'UNKNOWN'});
        json(response,code==='40001'||code==='40P01'?503:409,{message,code});
      }
    } catch (error) { json(response,500,{error:error instanceof Error?error.message:'FIXTURE_GATEWAY_ERROR'}); }
  });
  const gatewayPort = await listen(gateway,0);
  const environment = { SUPABASE_URL:process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY, DEVICE_SESSION_SECRET:process.env.DEVICE_SESSION_SECRET, DEVICE_REGISTRATION_KEY:process.env.DEVICE_REGISTRATION_KEY, STORAGE_PROTOCOL_VERSION:process.env.STORAGE_PROTOCOL_VERSION };
  Object.assign(process.env,{SUPABASE_URL:`http://127.0.0.1:${gatewayPort}`,SUPABASE_SERVICE_ROLE_KEY:KEY,DEVICE_SESSION_SECRET:FIXTURE_SECRET,DEVICE_REGISTRATION_KEY:'fixture-only',STORAGE_PROTOCOL_VERSION:'2'});
  let loseRequestId: string | null = null;
  const api = createServer(async (request,response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname === '/__fixture/session') {
        const student = Number(url.searchParams.get('student') ?? '0');
        if (!Number.isInteger(student)||student<0||student>23) {json(response,400,{error:'FIXTURE_STUDENT'});return;}
        response.writeHead(302,{'Set-Cookie':`${fixtureCookie(student)}; Path=/; HttpOnly; Secure; SameSite=Strict`,Location:'/'});response.end();return;
      }
      if (url.pathname === '/api/save-alerts' && request.method === 'GET') { json(response,200,{alerts:[],hasMore:false});return; }
      const handler = url.pathname === '/api/shared-settings' ? sharedSettings : url.pathname === '/api/student-economy' ? studentEconomy : url.pathname === '/api/device-session' ? deviceSession : null;
      if (!handler) {
        if (url.pathname.startsWith('/api/')) {json(response,503,{error:'FIXTURE_FEATURE_NOT_CONFIGURED'});return;}
        const requested = resolve(staticDirectory,url.pathname.slice(1) || 'index.html');
        if (!requested.startsWith(resolve(staticDirectory)+'/')) {json(response,403,{error:'FIXTURE_PATH'});return;}
        const path = extname(requested) ? requested : resolve(staticDirectory,'index.html');
        const content = await readFile(path);
        const type = ({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'} as Record<string,string>)[extname(path)] ?? 'application/octet-stream';
        response.writeHead(200,{'Content-Type':type});response.end(content);return;
      }
      const body = await readBody(request);
      const headers: RequestHeaders = Object.fromEntries(Object.entries(request.headers));
      let status = 200;
      const apiResponse = { setHeader:(key:string,value:string)=>{response.setHeader(key,value);},status:(code:number)=>{status=code;return apiResponse;},json:(value:unknown)=>{
        if (isStorageRecord(body)&&body.requestId===loseRequestId&&status===200) {loseRequestId=null;response.destroy();return;}
        json(response,status,value);
      },end:()=>response.end() };
      const apiRequest = {method:request.method,headers,body,query:Object.fromEntries(url.searchParams)};
      await handler(apiRequest,apiResponse);
    } catch (error) { if (!response.destroyed&&!response.headersSent) json(response,500,{error:error instanceof Error?error.message:'FIXTURE_API_ERROR'}); }
  });
  const apiPort = await listen(api,port);
  return { baseUrl:`http://127.0.0.1:${apiPort}`,gatewayPort,name,metrics,query:db.query,
    loseResponse:(id:string)=>{loseRequestId=id;},
    stop:async()=>{await Promise.all([new Promise<void>(done=>api.close(()=>done())),new Promise<void>(done=>gateway.close(()=>done()))]);await db.end();for(const [key,value] of Object.entries(environment)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
  };
};
if (process.argv.includes('--serve')) {
  const harness = await startHttpHarness();
  console.log(JSON.stringify({url:harness.baseUrl,database:harness.name,teacher:`${harness.baseUrl}/__fixture/session?student=0`,student:`${harness.baseUrl}/__fixture/session?student=17`}));
  process.once('SIGINT',()=>void harness.stop());
  process.once('SIGTERM',()=>void harness.stop());
}
