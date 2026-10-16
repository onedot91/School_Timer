import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import handler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { createAuctionItemTemplate, clampAuctionBidAmount } from '../../src/lib/currency.js';
import { splitStorageState, isStorageRecord } from '../../src/lib/storageV2Codec.js';

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;

test('real PostgreSQL: atomic bids preserve wallet reservations, replay, business rules and legacy writers', {
  skip: process.env.STORAGE_AUCTION_PSQL_TEST !== '1', timeout: 60000,
}, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-16T00:00:00Z') });
  const directory = await mkdtemp(join(tmpdir(), 'school-atomic-bid-'));
  const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args, {
    input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
  });
  invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p 55488`, '-w', 'start']);
  const args = ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55488', '-U', 'postgres', '-d', 'postgres'];
  const query = (sql: string) => invoke('psql', args, sql).trim();
  const asyncQuery = (sql: string): Promise<unknown> => new Promise((resolve, reject) => {
    const child = execFile('psql', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr)); else { try { resolve(JSON.parse(stdout.trim())); } catch (error) { reject(error); } }
    });
    child.stdin?.end(sql);
  });
  const previousEnv = { ...process.env }, previousFetch = globalThis.fetch;
  try {
    query('create role anon; create role authenticated; create role service_role;');
    for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql',
      'storage_scoped_v2.sql', 'storage_rewards_v2.sql', 'storage_command_round_trips.sql']) {
      query(await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
    }
    const contracts = () => query("select jsonb_agg(jsonb_build_array(proname,md5(prosrc),proconfig) order by proname,oid) from pg_proc where pronamespace='public'::regnamespace;");
    const beforeReapply = contracts();
    query(await readFile(new URL('../../supabase/storage_command_round_trips.sql', import.meta.url), 'utf8'));
    assert.equal(contracts(), beforeReapply);
    const items = Array.from({ length: 6 }, (_, index) => ({ ...createAuctionItemTemplate(0, index), isConfigured: true }));
    const source = { auctionItems: items, auctionBids: {}, auctionAwards: {}, auctionBidHistory: {},
      currencyBalances: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [index + 1, 1000])), currencyHistory: {}, retained: 'synthetic untouched data' };
    const encoded = splitStorageState(source), at = new Date().toISOString();
    query(`insert into app_settings(id,value,updated_at) values('school-timer-main',${json(source)},${literal(at)});
      select storage_set_maintenance(true);
      select storage_bootstrap(${literal(at)},${json(source)},${json(encoded.resources)},${json(encoded.wallets)},${json(encoded.history)});
      select storage_set_maintenance(false,true);`);
    const secret = 'atomic-auction-test-only-secret-at-least-32-bytes';
    Object.assign(process.env, { SUPABASE_URL: 'https://atomic-auction.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
      DEVICE_SESSION_SECRET: secret, STORAGE_PROTOCOL_VERSION: '2', STORAGE_COMBINED_COMMANDS: '1', STORAGE_ATOMIC_AUCTION_BIDS: '1' });
    let loseResponse = false, atomicWrites = 0;
    let beforeAtomic: (() => void) | undefined;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input)); assert.equal(url.origin, 'https://atomic-auction.invalid');
      const rpc = url.pathname.split('/').at(-1) ?? '';
      assert.ok(['storage_prepare_command', 'storage_load_scope', 'storage_get_receipt', 'storage_commit_scoped_and_load', 'storage_place_auction_bid'].includes(rpc), rpc);
      const body: unknown = JSON.parse(String(init?.body)); assert.ok(isStorageRecord(body));
      if (rpc === 'storage_place_auction_bid') { atomicWrites++; beforeAtomic?.(); beforeAtomic = undefined; }
      const parameters = Object.entries(body).map(([key, value]) => {
        assert.match(key, /^p_[a-z_]+$/);
        return `${key} => ${value === null ? 'null' : typeof value === 'string' ? literal(value) : json(value)}`;
      }).join(',');
      let output: unknown;
      try { output = await asyncQuery(`select public.${rpc}(${parameters});`); }
      catch (error) {
        const code = error instanceof Error ? /STORAGE_[A-Z_]+/.exec(error.message)?.[0] : undefined;
        if (!code) throw error;
        return Response.json({ message: code }, { status: 400 });
      }
      if (rpc === 'storage_place_auction_bid' && loseResponse) { loseResponse = false; throw new TypeError('synthetic lost bid response'); }
      return Response.json(output);
    };
    const call = async (student: number, id: string, item: number, amount: number, teacher = false) => {
      let status = 0, body: unknown;
      const response = { setHeader() {}, status(value: number) { status = value; return this; }, json(value: unknown) { body = value; } };
      const token = createDeviceSessionToken(teacher ? { role: 'teacher' } : { role: 'student', studentNumber: student }, secret);
      await handler({ method: 'POST', headers: { cookie: `__Host-school-timer-device=${token}`, 'sec-fetch-site': 'same-origin', 'x-storage-projection': '1' },
        body: { protocolVersion: 2, requestId: id, action: 'student.auction.bid', payload: { itemId: items[item].id, amount }, ...(teacher ? { studentNumber: student } : {}) } }, response);
      return { status, body };
    };
    loseResponse = true;
    assert.equal((await call(1, 'atomic-bid-replay', 0, 100)).status, 502);
    assert.equal((await call(1, 'atomic-bid-replay', 0, 100)).status, 200);
    assert.equal(atomicWrites, 1);
    assert.equal((await call(1, 'atomic-bid-replay', 0, 101)).status, 409);
    assert.equal(query("select count(*) from storage_resources where value->>'parentKey'='/auctionBidHistory/item-a' and not deleted;"), '1');
    const reservations = await Promise.all([call(2, 'reserve-first-item', 0, 700), call(2, 'reserve-second-item', 1, 700)]);
    assert.deepEqual(reservations.map(result => result.status).sort(), [200, 400]);
    assert.deepEqual(reservations.find(result => result.status === 400)?.body, { error: 'INSUFFICIENT_FUNDS', businessRejected: true });
    assert.equal(query('select balance from wallet_accounts where student_number=2;'), '1000');
    const writeResource = (key: string, category: string, value: unknown) => query(`select storage_write_resource(${literal(key)},${literal(category)},null,${json(value)});`);
    beforeAtomic = () => { writeResource(`/auctionBids/${items[2].id}`, 'auctionBids', { kind: 'value', parentKey: '/auctionBids', member: items[2].id, data: { bidder: 3, amount: 900 } }); };
    assert.deepEqual(await call(4, 'racing-latest-bid', 2, 500), { status: 400, body: { error: 'BID_TOO_LOW', businessRejected: true } });
    beforeAtomic = () => { writeResource(`/auctionAwards/${items[3].id}`, 'auctionAwards', { kind: 'value', parentKey: '/auctionAwards', member: items[3].id, data: { winner: 3, amount: 10, awardedAt: at } }); };
    assert.deepEqual(await call(4, 'racing-final-award', 3, 500), { status: 400, body: { error: 'ALREADY_AWARDED', businessRejected: true } });
    const writesBeforeConfig = atomicWrites;
    beforeAtomic = () => { writeResource(`/auctionItems/@${items[4].id}`, 'auctionItems', { kind: 'value', parentKey: '/auctionItems', member: `@${items[4].id}`, order: 4, data: { ...items[4], name: '변경된 합성 물품' } }); };
    assert.equal((await call(5, 'racing-item-config', 4, 100)).status, 200);
    assert.equal(atomicWrites - writesBeforeConfig, 2);
    assert.equal((await call(6, 'teacher-proxy-bid', 5, 100, true)).status, 200);
    process.env.STORAGE_ATOMIC_AUCTION_BIDS = '0';
    assert.equal((await call(7, 'legacy-after-atomic', 2, 901)).status, 200);
    assert.deepEqual(JSON.parse(query('select storage_reconcile_wallets();')), []);
    assert.equal(query('select count(*) from wallet_ledger;'), '0');
    assert.equal(JSON.parse(query("select value->'data' from storage_resources where resource_key='/retained';")), source.retained);
    for (const value of [null, true, false, [], [42], [[42]], [true], '0x10', '0b11', '0o12', ' 21.99 ', '9.999999999999999999', '1e400', { value: 1 }]) {
      assert.equal(Number(query(`select storage_auction_amount(${json(value)});`)), clampAuctionBidAmount(value));
    }
    for (const role of ['anon', 'authenticated']) assert.equal(query(`select has_function_privilege('${role}','storage_place_auction_bid(jsonb)','execute');`), 'f');
    assert.equal(query("select has_function_privilege('service_role','storage_place_auction_bid(jsonb)','execute');"), 't');
  } finally {
    globalThis.fetch = previousFetch; process.env = previousEnv;
    invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']);
  }
});
