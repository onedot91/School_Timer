import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fakeClassroom, fixtureCookie, startHttpHarness } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';

const students = Array.from({ length: 23 }, (_, i) => i + 1);
const actors = [...students,0,0,...(process.argv.includes('--40-sessions') ? students.slice(0,15) : [])];
const minutes = Number(process.env.SOAK_MINUTES ?? 0);
assert.ok(Number.isFinite(minutes) && minutes >= 0 && minutes <= 60);
const rounds = minutes ? Math.ceil(minutes * 2) : 2;
const initialValue = fakeClassroom();
initialValue.currencyBalances = Object.fromEntries(students.map(n => [n, 1000]));
const service = await startHttpHarness({ name: `storage_http_test_background_${Date.now()}`, port: 0, initialValue, weeklyMissions: true, rpcDelayMs: 100 });
const durations: Record<string, number[]> = {};
const started = performance.now();
const loseFirstMissionResponse = process.argv.includes('--lose-first-mission-response');
let recoveredMissionResponses = 0;
const call = async (actor: number, path: string, body?: unknown) => {
  const before = performance.now();
  const response = await fetch(`${service.baseUrl}/api/${path}`, {
    method: body ? 'POST' : 'GET', headers: { Cookie: fixtureCookie(actor), 'sec-fetch-site': 'same-origin', 'X-Storage-Projection': '1', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000),
  });
  const value: unknown = await response.json();
  (durations[`${path}:${body ? 'write' : 'read'}`] ??= []).push(performance.now() - before);
  assert.equal(response.status, 200, `${path} status=${response.status} code=${isStorageRecord(value) ? value.error : 'INVALID'}`);
  return value;
};
const percentile = (values: number[], p: number) => Math.round([...values].sort((a,b) => a-b)[Math.min(values.length-1,Math.floor(values.length*p))]);
try {
  await service.query(await readFile(new URL('../../supabase/storage_scoped_polling.sql', import.meta.url), 'utf8'));
  await service.query(`insert into newspaper_questions(student_number,question_type,question_text,week_key)
    select n,'personal','합성 검증 질문',to_char(now() at time zone 'Asia/Seoul','IYYY-IW') from generate_series(1,23)n`);
  await service.query(`begin; set local school_timer.storage_protocol='2'; insert into classword_entries(round_date,initial,word,student_number)
    select (now() at time zone 'Asia/Seoul')::date-(d+((n-1)/14)*3),
      (array['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'])[((n-1)%14)+1],'합성',n
    from generate_series(1,23)n cross join generate_series(1,3)d; commit;`);
  await Promise.all(actors.map(actor => call(actor,'device-session')));
  if (loseFirstMissionResponse) service.loseResponse('lost-initial-mission');
  for (let round=0; round<rounds; round++) {
    const roundStart = performance.now();
    await Promise.all(actors.map(async (actor,slot) => {
      await call(actor,'shared-settings');
      if (actor) {
        const [missions] = await Promise.all([
          (async () => {
            const body = {protocolVersion:2,studentNumber:actor,...(loseFirstMissionResponse && actor===1 && round===0 ? {requestId:'lost-initial-mission'} : {})};
            if (body.requestId) {
              await assert.rejects(call(actor,'weekly-missions',body), {name:'TypeError'});
              recoveredMissionResponses++;
            }
            return call(actor,'weekly-missions',body);
          })(),
          call(actor,'student-economy',{protocolVersion:2,studentNumber:actor,action:{type:'deposit',amount:10},requestId:`background-${actor}-${slot}-${round}`}),
        ]);
        assert.ok(isStorageRecord(missions) && Array.isArray(missions.missions));
        assert.equal(missions.missions.length, 2);
        for (const mission of missions.missions) {
          assert.ok(isStorageRecord(mission));
          // On replay, older dates are settled; the UI then reports yesterday's status.
          const expected = mission.missionType === 'personal_question' || round === 0 || actor <= 14;
          assert.equal(mission.completed, expected);
        }
      } else {
        await call(0,'shared-settings',{protocolVersion:2,requestId:`background-teacher-${slot}-${round}`,action:'teacher.settings.patch',payload:{changes:slot===23
          ? [{field:'scheduleNotice',before:round ? `검증 ${round-1}`:'격리 검증 학급',after:`검증 ${round}`}]
          : [{field:'manualTimer',before:{totalTime:180+round,isVisible:false},after:{totalTime:181+round,isVisible:false}}]}});
      }
    }));
    const balances=(await service.query('select balance from wallet_accounts order by student_number')).rows.map(row=>row.balance);
    assert.deepEqual(balances,students.map(actor => 1030-10*(round+1)*actors.filter(value => value===actor).length));
    assert.equal((await service.query('select count(*)::integer count from weekly_mission_rewards')).rows[0]?.count,92);
    assert.deepEqual((await service.query('select storage_reconcile_wallets() result')).rows[0]?.result,[]);
    console.log(JSON.stringify({phase:'round',round:round+1,sessions:actors.length,ms:Math.round(performance.now()-roundStart),reconciliationErrors:0,rewardClaims:92}));
    if(minutes) await new Promise(resolve=>setTimeout(resolve,Math.max(0,(round+1)*30_000-(performance.now()-started))));
  }
  assert.equal(recoveredMissionResponses, Number(loseFirstMissionResponse));
  console.log(JSON.stringify({phase:'complete', recoveredMissionResponses,sessions:actors.length,rounds,elapsedMs:Math.round(performance.now()-started),
    requests:Object.fromEntries(Object.entries(durations).map(([path,values])=>[path,{count:values.length,p95:percentile(values,.95),max:Math.round(Math.max(...values))}])),
    rewardClaims:92,reconciliationErrors:0,duplicateRewards:0}));
} finally { await service.stop(); }
