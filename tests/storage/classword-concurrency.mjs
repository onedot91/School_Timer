import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const pg=require(process.env.STORAGE_TEST_PG_MODULE??process.env.PG_MODULE_PATH??'pg');
const url=new URL(process.env.STORAGE_TEST_DATABASE_URL??process.env.CLASSWORD_TEST_DATABASE_URL??'');
assert.ok(['127.0.0.1','localhost'].includes(url.hostname),'Only isolated localhost PostgreSQL is permitted');
assert.equal(url.pathname,'/postgres');
const databaseName=`storage_classword_${process.pid}_${Date.now()}`;
const creator=new pg.Client({connectionString:url.toString()});await creator.connect();
try { await creator.query(`create database ${databaseName}`); } finally { await creator.end(); }
url.pathname=`/${databaseName}`;
const config={connectionString:url.toString()};
const admin=new pg.Client(config);await admin.connect();
try {
 for(const file of ['app_settings.sql','classword.sql','library_competition.sql','storage_v2.sql','storage_today_friend_v2.sql','storage_rewards_v2.sql','storage_classword_v2.sql']) await admin.query(await readFile(new URL(`../../supabase/${file}`,import.meta.url),'utf8'));
 await admin.query(await readFile(new URL('./classword-v2.sql',import.meta.url),'utf8'));
 await admin.query('update public.storage_control set active=true,maintenance=false where singleton');
 await admin.query('insert into public.wallet_accounts(student_number,balance,opening_balance) select n,100,100 from generate_series(1,23)n on conflict do nothing');
 const dateKey='2099-10-10';
 const clients=await Promise.all(Array.from({length:24},async()=>{const c=new pg.Client(config);await c.connect();return c}));
 const command=(c,actor,id,action,payload)=>c.query('select public.classword_command_v2($1,$2,$3,$4::jsonb,2) result',[actor,id,action,JSON.stringify(payload)]);
 try {
  const occupied=await Promise.allSettled(clients.slice(0,23).map((c,i)=>command(c,i+1,`parallel-entry-${dateKey}-${i}`,'save_entry',{dateKey,initial:'ㄱ',word:'강아지'})));
  assert.equal(occupied.filter(r=>r.status==='fulfilled').length,1);
  for(const r of occupied.filter(r=>r.status==='rejected'))assert.equal(r.reason.message,'CLASSWORD_INITIAL_OCCUPIED');
  const winner=occupied.findIndex(r=>r.status==='fulfilled')+1;
  const quiz=await Promise.all(clients.map(c=>command(c,winner,`parallel-quiz-${dateKey}`,'complete_quiz',{dateKey,questionId:'fixture-question',question:{id:'fixture-question'}})));
  for(const r of quiz)assert.deepEqual(r.rows[0].result,quiz[0].rows[0].result);
  const ledger=await admin.query('select count(*)::integer count from public.wallet_ledger where student_number=$1 and entry_id like $2',[winner,`%${dateKey}`]);
  assert.equal(ledger.rows[0].count,2);
  console.log('PASS: SQL assertions; 23 students same initial exactly one winner; 24 identical quiz requests one reward and one completion');
 } finally {await Promise.all(clients.map(c=>c.end()));}
} finally {await admin.end();}
