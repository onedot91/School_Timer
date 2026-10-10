import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fakeClassroom, fixtureCookie, startHttpHarness } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';

const source = fakeClassroom();
source.dailyWriting = Object.fromEntries(Array.from({length: 23}, (_, index) => [index + 1, { text: 'Synthetic writing fixture '.repeat(200) }]));
source.currencyHistory = Object.fromEntries(Array.from({length: 23}, (_, index) => [index + 1, Array.from({length: 100}, (_, item) => ({
  id: `history-${index + 1}-${item}`, studentNumber:index + 1, delta:0, before:100, after:100, reason:'Synthetic fixture', createdAt:'2026-09-08T00:00:00Z',
}))]));
const h = await startHttpHarness({ name:`storage_http_test_read_bench_${process.pid}_${Date.now()}`,port:0,initialValue:source });
const evidence: unknown[] = [];
const previous = process.env.STORAGE_PROGRESSIVE_READS;
const percentile = (values:number[], fraction:number) => [...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*fraction))];
try {
  for (const file of ['storage_scoped_polling','storage_scope_history_read_performance','storage_scoped_read_execution','storage_snapshot_execution','storage_ancestor_locks','storage_progressive_reads']) {
    await h.query(await readFile(new URL(`../../supabase/${file}.sql`,import.meta.url),'utf8'));
  }
  evidence.push({fixture: (await h.query('select (select count(*) from storage_resources) resources,(select count(*) from wallet_ledger) history')).rows});
  for (const flag of ['0','1']) {
    process.env.STORAGE_PROGRESSIVE_READS=flag;
    for (let round=0; round<3; round++) {
      h.metrics.length=0;
      const samples=await Promise.all(Array.from({length:25},async (_,index)=>{
        const actor=index<23?index+1:0, start=performance.now();
        const query=flag==='1'?(actor?'?overview=1':'?changes=1'):'';
        const response=await fetch(`${h.baseUrl}/api/shared-settings${query}`,{headers:{Cookie:fixtureCookie(actor),'X-Storage-Projection':'1',...(flag==='1'?{'X-Storage-Compact':'1'}:{})}});
        const text=await response.text();assert.equal(response.status,200,text);
        return {milliseconds:performance.now()-start,bytes:Buffer.byteLength(text)};
      }));
      evidence.push({scenario:'25 initial readers:23 students+2 teachers',progressive:flag==='1',round,
        requests:25,rpcs:h.metrics.length,responseBytes:samples.reduce((sum,row)=>sum+row.bytes,0),
        dbResponseBytes:h.metrics.reduce((sum,row)=>sum+(row.responseBytes??0),0),p50Ms:percentile(samples.map(row=>row.milliseconds),.5),p95Ms:percentile(samples.map(row=>row.milliseconds),.95),
        rpcTimeSumMs:h.metrics.reduce((sum,row)=>sum+(row.milliseconds??0),0)});
    }
  }
  process.env.STORAGE_PROGRESSIVE_READS='1';
  const first=await (await fetch(`${h.baseUrl}/api/shared-settings?changes=1`,{headers:{Cookie:fixtureCookie(0)}})).json();
  assert.ok(isStorageRecord(first)&&isStorageRecord(first.readManifest));
  for (const mode of ['metadata','idle changes','changed full','changed delta']) {
    const times:number[]=[], dbTimes:number[]=[], sizes:number[]=[];
    for (let sample=0;sample<15;sample++) {
      if(mode.startsWith('changed')) await h.query("update storage_resources set revision=revision+1,value=jsonb_set(value,'{data}',to_jsonb($1::text)) where resource_key='/scheduleNotice'",[`synthetic-${sample}`]);
      h.metrics.length=0;const start=performance.now();
      const query=mode==='metadata'?'?metadata=1':mode==='changed full'?'':'?changes=1';
      const response=await fetch(`${h.baseUrl}/api/shared-settings${query}`,{headers:{Cookie:fixtureCookie(0),...(query==='?changes=1'?{'X-Storage-Read-Manifest':JSON.stringify(first.readManifest)}:{})}});
      const text=await response.text();assert.equal(response.status,200,text);
      times.push(performance.now()-start);sizes.push(Buffer.byteLength(text));dbTimes.push(h.metrics.reduce((sum,row)=>sum+(row.milliseconds??0),0));
    }
    evidence.push({scenario:mode,p50Ms:percentile(times,.5),p95Ms:percentile(times,.95),rpcP50Ms:percentile(dbTimes,.5),responseBytes:sizes[0]});
  }
  await writeFile('.omo/evidence/read-loading/benchmark.json',JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} finally {
  if(previous===undefined)delete process.env.STORAGE_PROGRESSIVE_READS;else process.env.STORAGE_PROGRESSIVE_READS=previous;
  await h.stop();
}
