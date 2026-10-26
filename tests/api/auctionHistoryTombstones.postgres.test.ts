import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('실제 PostgreSQL: 지난 입찰 기록 묘비만 백업 후 정리하고 항목 컨테이너와 살아 있는 기록은 남긴다', { skip: !process.env.NEWSPAPER_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(process.env.NEWSPAPER_PGLITE_MODULE!);
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    const storage = await readFile('supabase/storage_v2.sql', 'utf8');
    await db.exec(storage.slice(0, storage.indexOf('create or replace function public.storage_set_maintenance')) + '\ncommit;');
    await db.exec('update public.storage_control set active=true;');
    const member = (amount: number) => `#{"amount":${amount},"bidder":4,"createdAt":"2026-10-19T01:00:00.000Z","itemId":"item-a"}`;
    const row = (key: string, value: Record<string, unknown>, deleted: boolean, age: string) =>
      db.query(`insert into public.storage_resources(resource_key,category,owner_number,value,revision,updated_at,deleted)
        values ($1,'auctionBidHistory',null,$2,3,now()-$3::interval,$4)`, [key, JSON.stringify(value), age, deleted]);
    const entry = (amount: number) => ({ kind: 'value', parentKey: '/auctionBidHistory/item-a', member: member(amount), order: amount });
    await row('/auctionBidHistory/item-a', { kind: 'array', parentKey: '/auctionBidHistory', member: 'item-a' }, true, '3 days');
    await row(`/auctionBidHistory/item-a/${member(10)}`, entry(10), true, '3 days');
    await row(`/auctionBidHistory/item-a/${member(11)}`, entry(11), true, '1 minute');
    await row(`/auctionBidHistory/item-a/${member(12)}`, entry(12), false, '3 days');
    await db.query(`insert into public.storage_resources(resource_key,category,owner_number,value,revision,updated_at,deleted)
      values ('/studentLife/letters/#old','studentLife',null,'{"kind":"value","parentKey":"/studentLife/letters","member":"#old"}',2,now()-interval '3 days',true)`);

    const sql = await readFile('supabase/storage_auction_history_tombstones.sql', 'utf8');
    // PGlite has no pg_cron; everything before the schedule is the purge contract.
    const install = sql.slice(0, sql.indexOf('-- Daily')) + '\ncommit;';
    await db.exec(install);
    await db.exec(install);

    const rows = async (query: string): Promise<unknown[][]> => {
      const result: { rows: unknown[] } = await db.query(query);
      return result.rows.map(item => item && typeof item === 'object' ? Object.values(item) : []);
    };
    assert.deepEqual((await rows('select resource_key from public.storage_resources order by resource_key')).flat(), [
      '/auctionBidHistory/item-a', `/auctionBidHistory/item-a/${member(11)}`, `/auctionBidHistory/item-a/${member(12)}`, '/studentLife/letters/#old',
    ]);
    assert.deepEqual(await rows('select resource_key,revision::integer,deleted from public.storage_purged_tombstones'),
      [[`/auctionBidHistory/item-a/${member(10)}`, 3, true]]);

    await assert.rejects(db.query("select public.storage_purge_auction_history_tombstones(interval '1 minute')"), /STORAGE_INVALID_MUTATION/);
    await db.exec('update public.storage_control set maintenance=true;');
    await assert.rejects(db.query('select public.storage_purge_auction_history_tombstones()'), /STORAGE_MAINTENANCE/);
    await db.exec('update public.storage_control set maintenance=false;');

    assert.deepEqual(await rows(`select
      has_function_privilege('anon','public.storage_purge_auction_history_tombstones(interval)','execute') anon,
      has_function_privilege('service_role','public.storage_purge_auction_history_tombstones(interval)','execute') service`), [[false, true]]);

    const rollback = await readFile('supabase/storage_auction_history_tombstones_rollback.sql', 'utf8');
    await db.exec("create schema cron; create table cron.job(jobname text); create function cron.unschedule(text) returns boolean language sql as 'select true';");
    await db.exec(rollback);
    const restored = await db.query('select 1 from public.storage_resources where resource_key=$1 and deleted', [`/auctionBidHistory/item-a/${member(10)}`]);
    assert.equal(restored.rows.length, 1);
  } finally {
    await db.close();
  }
});
