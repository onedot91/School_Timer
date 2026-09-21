import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

// Explicit opt-in: creates only browser sessions and reads projections. Never calls mutation APIs.
assert.ok(process.argv.includes('--production-readonly'), 'Requires --production-readonly');
const origin = 'https://school-timer-five.vercel.app';
const students = [...Array.from({ length: 23 }, (_, i) => i + 1), 1, 2];
const nativeFetch = globalThis.fetch;
const request = async (path, init = {}) => {
  assert.ok(path === '/api/device-session' || path === '/api/shared-settings');
  assert.ok(!init.method || (path === '/api/device-session' && init.method === 'POST'));
  return nativeFetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(12_000), redirect: 'error' });
};
const summarize = (rows) => {
  const durations = rows.map(r => r.ms).sort((a,b) => a-b);
  return { requests: rows.length, successes: rows.filter(r=>r.ok).length, failures: rows.filter(r=>!r.ok).map(({ status, error, ms })=>({status,error,ms})),
    p50Ms:durations[Math.floor(durations.length*.5)],p95Ms:durations[Math.floor(durations.length*.95)],maxMs:durations.at(-1) };
};
const sessions = await Promise.all(students.map(async entryNumber => {
  const response = await request('/api/device-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({entryNumber})});
  assert.equal(response.status,200,'session registration failed');
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('__Host-school-timer-device='),'missing session');
  await response.arrayBuffer();
  return {entryNumber,cookie};
}));
console.log(JSON.stringify({phase:'registered',sessions:sessions.length,distinctStudents:23,duplicateSessions:2,at:new Date().toISOString()}));
let failed = false;
for(let round=1;round<=3;round++) {
  const rows = await Promise.all(sessions.map(async ({entryNumber,cookie}) => {
    const start = performance.now();
    let status;
    try {
      const response = await request('/api/shared-settings',{headers:{Cookie:cookie,'X-Storage-Projection':'1'}});
      status=response.status;
      const body=await response.json();
      const ownBalances=body?.value?.currencyBalances;
      const ownHistory=body?.value?.currencyHistory;
      const scoped=body?.scope==='student' && body?.value && typeof body.updated_at==='string'
        && ownBalances && Object.keys(ownBalances).length === 1 && Object.keys(ownBalances).every(key=>key===String(entryNumber))
        && ownHistory && Object.keys(ownHistory).length === 1 && Object.keys(ownHistory).every(key=>key===String(entryNumber));
      return {ok:response.ok && Boolean(scoped),status,error:response.ok ? (scoped?undefined:'INVALID_STUDENT_PROJECTION'):'HTTP_FAILURE',ms:Math.round(performance.now()-start)};
    } catch(error) {
      return {ok:false,status,error:['TimeoutError','AbortError','TypeError','SyntaxError'].includes(error?.name)?error.name:'READ_FAILURE',ms:Math.round(performance.now()-start)};
    }
  }));
  console.log(JSON.stringify({phase:'concurrent-read',round,...summarize(rows),at:new Date().toISOString()}));
  if(rows.some(r=>!r.ok)){failed=true;break;}
  if(round<3) await new Promise(resolve=>setTimeout(resolve,2000));
}
process.exitCode=failed?1:0;
