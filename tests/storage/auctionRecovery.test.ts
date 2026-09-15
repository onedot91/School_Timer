import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { startHttpHarness, fixtureCookie } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';

test('auction repair revives only incident tombstones once and rejects stale repair sources', async () => {
  const harness = await startHttpHarness({ name: `storage_http_test_auction_repair_${Date.now()}`, port: 0 });
  try {
    const repair = await readFile(new URL('../../dev/recover-auction-items-20260915.sql', import.meta.url), 'utf8');
    for (const [id, revision] of [['item-2-2', 8], ['item-2-3', 11]] as const) {
      await harness.query(`insert into storage_resources(resource_key,category,owner_number,value,deleted,revision,updated_at)
        values($1,'auctionItems',null,$2,true,$3,'2026-09-15T03:31:00Z')`, [`/auctionItems/@${id}`, {
        kind: 'value', parentKey: '/auctionItems', member: `@${id}`, order: 5 + revision / 100,
        data: { id, name: `합성 ${id}`, dayIndex: 1, startPrice: 10, isConfigured: true },
      }, revision]);
    }
    const preserved = (await harness.query("select * from storage_resources where resource_key not in ('/auctionItems/@item-2-2','/auctionItems/@item-2-3') order by resource_key")).rows;
    const wallets = (await harness.query('select * from wallet_accounts order by student_number')).rows;
    await harness.query("update storage_resources set revision=12 where resource_key='/auctionItems/@item-2-3'");
    await assert.rejects(harness.query(repair), /AUCTION_RESTORE_SOURCE_CHANGED/);
    await harness.query('rollback');
    assert.equal((await harness.query("select count(*)::integer n from storage_resources where resource_key in ('/auctionItems/@item-2-2','/auctionItems/@item-2-3') and deleted")).rows[0]?.n, 2);
    await harness.query("update storage_resources set revision=11 where resource_key='/auctionItems/@item-2-3'");
    await harness.query(repair);
    await harness.query(repair);
    assert.equal((await harness.query("select count(*)::integer n from storage_resources where resource_key in ('/auctionItems/@item-2-2','/auctionItems/@item-2-3') and not deleted")).rows[0]?.n, 2);
    assert.deepEqual((await harness.query("select * from storage_resources where resource_key not in ('/auctionItems/@item-2-2','/auctionItems/@item-2-3') order by resource_key")).rows, preserved);
    assert.deepEqual((await harness.query('select * from wallet_accounts order by student_number')).rows, wallets);
    assert.equal((await harness.query('select count(*)::integer n from wallet_ledger')).rows[0]?.n, 0);
    for (const actor of [0, 1]) {
      const response = await fetch(`${harness.baseUrl}/api/shared-settings`, { headers: { Cookie: fixtureCookie(actor), 'X-Storage-Projection': '1' } });
      const body: unknown = await response.json();
      assert.equal(response.status, 200);
      assert.ok(isStorageRecord(body) && isStorageRecord(body.value) && Array.isArray(body.value.auctionItems));
      assert.equal(body.value.auctionItems.filter(item => isStorageRecord(item) && item.isConfigured === true).length, 2);
    }
  } finally { await harness.stop(); }
});
