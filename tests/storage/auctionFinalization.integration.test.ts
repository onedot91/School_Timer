import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleStorageCommand } from '../../src/server/storageCommandHandler.js';
import { isStorageRecord, splitStorageState } from '../../src/lib/storageV2Codec.js';

const enabled = process.env.STORAGE_AUCTION_PSQL_TEST === '1';
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;

test('real PostgreSQL: auction scopes survive unrelated credits, bid races and response retries while rejecting outside writes', { skip: !enabled, timeout: 60000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'school-auction-pg.'));
  const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p 55488`, '-w', 'start']);
  const query = (sql: string) => invoke('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55488', '-U', 'postgres', '-d', 'postgres'], sql).trim();
  const read = (sql: string): unknown => JSON.parse(query(sql));
  const originalFetch = globalThis.fetch;
  const originalCombined = process.env.STORAGE_COMBINED_COMMANDS;
  try {
    query('create role anon; create role authenticated; create role service_role;');
    for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql', 'storage_scoped_v2.sql', 'storage_rewards_v2.sql', 'storage_command_round_trips.sql']) {
      query(await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
    }
    const source = {
      auctionItems: ['item-a', 'item-b', 'item-c', 'item-d'].map(id => ({ id, name: '합성 물품', dayIndex: 0, startPrice: 10, isConfigured: true })),
      auctionBids: { 'item-a': { bidder: 2, amount: 30 }, 'item-b': { bidder: 2, amount: 40 }, 'item-c': { bidder: 2, amount: 50 }, 'item-d': { bidder: 2, amount: 20 } },
      auctionAwards: { 'item-e': { itemId: 'item-e', winner: 7, amount: 12, awardedAt: '2026-10-14T01:00:00Z', opaque: 'keep' } }, currencyHistory: {},
      currencyBalances: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [String(index + 1), 1000])),
      opaque: { keep: 'synthetic-private-fixture' },
    };
    const encoded = splitStorageState(source);
    query(`insert into app_settings(id,value,updated_at) values('school-timer-main',${json(source)},'2026-10-15T00:00:00Z');
      select storage_set_maintenance(true);
      select storage_bootstrap('2026-10-15T00:00:00Z',${json(source)},${json(encoded.resources)},${json(encoded.wallets)},${json(encoded.history)});
      select storage_set_maintenance(false,true);`);
    const calls: Record<string, unknown>[] = [];
    const failures: unknown[] = [];
    let beforeRead: ((body: Record<string, unknown>) => void) | undefined;
    let beforeCommit: ((body: Record<string, unknown>) => void) | undefined;
    let lastCommit: Record<string, unknown> | undefined;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://auction-fixture.invalid');
      const rpc = url.pathname.split('/').at(-1);
      assert.ok(rpc && ['storage_get_receipt', 'storage_load_scope', 'storage_prepare_command', 'storage_commit_scoped_mutation', 'storage_commit_scoped_and_load'].includes(rpc));
      const body: unknown = JSON.parse(String(init?.body));
      assert.ok(isStorageRecord(body));
      calls.push({ rpc, ...body });
      if (rpc === 'storage_load_scope') beforeRead?.(body);
      if (rpc.startsWith('storage_commit')) {
        lastCommit = body;
        beforeCommit?.(body);
      }
      const args = Object.entries(body).map(([key, value]) => {
        assert.match(key, /^p_[a-z_]+$/);
        return `${key} => ${value === null ? 'null' : typeof value === 'string' ? literal(value) : json(value)}`;
      }).join(',');
      try { return Response.json(read(`select public.${rpc}(${args});`)); }
      catch (error) {
        const diagnostic = error instanceof Error ? Reflect.get(error, 'stderr') : undefined;
        failures.push({ diagnostic, resources: body.p_resources });
        const message = typeof diagnostic === 'string' ? /ERROR:\s+([A-Z][A-Z0-9_]+)/.exec(diagnostic)?.[1] : undefined;
        if (message !== 'STORAGE_SCOPE_VIOLATION') throw error;
        return Response.json({ message }, { status: 400 });
      }
    };
    const call = async (itemId: string, requestId: string) => {
      let status = 0; let output: unknown;
      const response = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: unknown) { output = value; } };
      await handleStorageCommand({ method: 'POST', headers: { 'x-storage-projection': '1' }, body: { protocolVersion: 2, requestId,
        action: 'teacher.auction.finalize', payload: { itemId, useLatestBid: true, expectedBidder: 17, studentNumber: 17 } } }, response,
      { url: 'https://auction-fixture.invalid', key: 'synthetic' }, { role: 'teacher', expiresAt: 0 }, () => ({}));
      assert.equal(status, 200, JSON.stringify({ output, failures }));
      assert.ok(isStorageRecord(output));
      return output;
    };
    const balance = (student: number) => Number(query(`select balance from wallet_accounts where student_number=${student};`));
    const changeBid = (item: string, bidder: number, amount: number) => query(`update storage_resources set value=jsonb_set(value,'{data}',${json({ bidder, amount })}), revision=revision+1 where resource_key=${literal(`/auctionBids/${item}`)};`);

    process.env.STORAGE_COMBINED_COMMANDS = '1';
    beforeCommit = () => {
      beforeCommit = undefined;
      query("select storage_apply_wallet_delta(3,'unrelated-credit',1,'weekly_mission',now(),'unrelated-credit');");
    };
    await call('item-a', 'auction-fixture-a');
    assert.equal(calls.filter(body => body.rpc === 'storage_commit_scoped_and_load').length, 1);
    assert.equal(balance(2), 970);
    assert.equal(balance(3), 1001);
    assert.ok(lastCommit && isStorageRecord(lastCommit.p_expected) && isStorageRecord(lastCommit.p_scope));
    assert.deepEqual(lastCommit.p_scope.wallets, [2]);
    assert.equal(Object.hasOwn(lastCommit.p_expected, 'wallet:3'), false);
    assert.equal(query("select count(*) from wallet_ledger where student_number=2;"), '1');
    await call('item-a', 'auction-fixture-a');
    assert.equal(balance(2), 970);
    assert.equal(query("select count(*) from wallet_ledger where student_number=2;"), '1');

    beforeRead = body => {
      if (isStorageRecord(body.p_scope) && Array.isArray(body.p_scope.wallets) && body.p_scope.wallets.length) {
        beforeRead = undefined;
        changeBid('item-b', 4, 40);
      }
    };
    await call('item-b', 'auction-fixture-b');
    assert.equal(balance(2), 970);
    assert.equal(balance(4), 960);

    beforeCommit = () => { beforeCommit = undefined; changeBid('item-c', 2, 60); };
    await call('item-c', 'auction-fixture-c');
    assert.equal(balance(2), 910);
    assert.equal(query("select count(*) from wallet_ledger where student_number=2;"), '2');

    process.env.STORAGE_COMBINED_COMMANDS = '0';
    await call('item-d', 'auction-fixture-d');
    assert.equal(balance(2), 890);
    assert.deepEqual(read("select value->'data' from storage_resources where resource_key='/auctionAwards/item-e';"), source.auctionAwards['item-e']);
    assert.ok(lastCommit && isStorageRecord(lastCommit.p_expected));
    const unrelated: unknown = read("select to_jsonb(r) from storage_resources r where resource_key='/opaque/keep';");
    assert.ok(isStorageRecord(unrelated));
    const tampered = { ...lastCommit, p_request_id: 'auction-fixture-invalid',
      p_expected: { ...lastCommit.p_expected, '/opaque/keep': unrelated.revision },
      p_resources: [{ resource_key: unrelated.resource_key, category: unrelated.category, owner_number: unrelated.owner_number,
        value: { kind: 'value', parentKey: '/opaque', member: 'keep', data: 'unauthorized' } }] };
    const rejection = await fetch('https://auction-fixture.invalid/rest/v1/rpc/storage_commit_scoped_mutation', { body: JSON.stringify(tampered) });
    assert.equal(rejection.status, 400);
    assert.deepEqual(read("select value->'data' from storage_resources where resource_key='/opaque/keep';"), source.opaque.keep);
    assert.ok(calls.filter(body => body.rpc === 'storage_load_scope').every(body => isStorageRecord(body.p_scope)
      && Array.isArray(body.p_scope.wallets) && body.p_scope.wallets.length <= 1));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCombined === undefined) delete process.env.STORAGE_COMBINED_COMMANDS;
    else process.env.STORAGE_COMBINED_COMMANDS = originalCombined;
    invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']);
  }
});
