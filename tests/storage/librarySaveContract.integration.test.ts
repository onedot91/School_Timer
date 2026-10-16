import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import handler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { isStorageRecord, splitStorageState } from '../../src/lib/storageV2Codec.js';

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;

test('real PostgreSQL: library API preserves private records and rewards once after response loss', {
  skip: process.env.STORAGE_AUCTION_PSQL_TEST !== '1', timeout: 60000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'school-library-pg.'));
  const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args, {
    input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
  });
  invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p 55488`, '-w', 'start']);
  const query = (sql: string) => invoke('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory,
    '-p', '55488', '-U', 'postgres', '-d', 'postgres'], sql).trim();
  const savedEnv = { ...process.env }, originalFetch = globalThis.fetch;
  const at = new Date().toISOString();
  const book = { id: 'retained-book', studentNumber: 9, title: '합성 기존 책', author: '합성 작가', pageCount: 10, createdAt: at, colorIndex: 0 };
  const privateLetter = { id: 'private-letter', recipient: 9, senderLabel: '선생님', senderStudentNumber: null, title: '합성', content: '합성 비공개 기록', createdAt: at, readAt: null };
  try {
    query('create role anon; create role authenticated; create role service_role;');
    for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql',
      'storage_scoped_v2.sql', 'storage_rewards_v2.sql', 'storage_read_performance.sql', 'storage_library_placement_v2.sql']) {
      query(await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
    }
    const source = { currencyBalances: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [String(index + 1), 100])),
      currencyHistory: {}, studentLife: { books: [book], letters: [privateLetter] } };
    const encoded = splitStorageState(source);
    query(`insert into app_settings(id,value,updated_at) values('school-timer-main',${json(source)},${literal(at)});
      select storage_set_maintenance(true);
      select storage_bootstrap(${literal(at)},${json(source)},${json(encoded.resources)},${json(encoded.wallets)},${json(encoded.history)});
      select storage_set_maintenance(false,true);`);
    const secret = 'library-release-fixture-secret-at-least-32-bytes';
    Object.assign(process.env, { SUPABASE_URL: 'https://library-fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
      DEVICE_SESSION_SECRET: secret, STORAGE_PROTOCOL_VERSION: '2' });
    let lostResponses = 2;
    const failures: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://library-fixture.invalid');
      const rpc = url.pathname.split('/').at(-1);
      assert.equal(rpc, 'storage_place_library_book');
      const body: unknown = JSON.parse(String(init?.body));
      assert.ok(isStorageRecord(body));
      const args = Object.entries(body).map(([key, value]) => {
        assert.match(key, /^p_[a-z_]+$/);
        return `${key} => ${typeof value === 'string' ? literal(value) : typeof value === 'number' ? String(value) : json(value)}`;
      }).join(',');
      let output: unknown;
      try { output = JSON.parse(query(`select public.${rpc}(${args});`)); }
      catch (error) {
        const stderr: unknown = error instanceof Error ? Reflect.get(error, 'stderr') : undefined;
        failures.push(typeof stderr === 'string' ? stderr : 'FIXTURE_QUERY_FAILED');
        const message = typeof stderr === 'string' ? /ERROR:\s+([A-Z][A-Z0-9_]+)/.exec(stderr)?.[1] : undefined;
        return Response.json({ code: 'P0001', message: message ?? 'FIXTURE_DATABASE_ERROR' }, { status: 400 });
      }
      if (lostResponses > 0) { lostResponses -= 1; throw new TypeError('synthetic response loss after commit'); }
      return Response.json(output);
    };
    const call = async (student: number, requestId: string, slotId: number, selected: unknown = {
      kind: 'new', title: '합성 새 책', author: '합성 작가', pageCount: 10,
    }) => {
      let status = 0, body: unknown;
      const response = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: unknown) { body = value; } };
      await handler({ method: 'PUT', headers: { cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber: student }, secret)}`,
        'sec-fetch-site': 'same-origin', 'x-storage-projection': '1' },
      body: { protocolVersion: 2, expectedStudentNumber: student, action: 'placeLibraryBook', requestId, slotId, book: selected } }, response);
      return { status, body };
    };
    const id = '11111111-1111-4111-8111-111111111111';
    assert.equal((await call(1, id, 0)).status, 502);
    const replay = await call(1, id, 0);
    assert.equal(replay.status, 200, JSON.stringify({ response: replay.body, failures }));
    assert.equal((await call(1, id, 0)).status, 200);
    assert.equal(query('select balance from wallet_accounts where student_number=1;'), '110');
    assert.equal(query('select count(*) from wallet_ledger where student_number=1;'), '1');
    assert.equal((await call(2, '22222222-2222-4222-8222-222222222222', 0)).status, 409);
    assert.equal((await call(2, '33333333-3333-4333-8333-333333333333', 1)).status, 200);
    assert.equal((await call(1, '44444444-4444-4444-8444-444444444444', 2, { kind: 'existing', bookId: book.id })).status, 403);
    assert.equal(query('select balance from wallet_accounts where student_number=9;'), '100');
    assert.deepEqual(JSON.parse(query("select value->'data' from storage_resources where resource_key='/studentLife/books/@retained-book';")), book);
    assert.deepEqual(JSON.parse(query("select value->'data' from storage_resources where resource_key='/studentLife/letters/@private-letter';")), privateLetter);
    assert.deepEqual(JSON.parse(query('select storage_reconcile_wallets();')), []);
  } finally {
    globalThis.fetch = originalFetch; process.env = savedEnv;
    invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']);
  }
});
