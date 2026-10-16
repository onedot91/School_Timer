import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isStorageRecord, splitStorageState } from '../../src/lib/storageV2Codec.js';
import { applyStudentStorageCommand } from '../../src/server/studentStorageCommands.js';
import { applyTeacherStorageCommand } from '../../src/server/teacherStorageCommands.js';
import { completeFailureStoryReadScope, storageCommandScope } from '../../src/server/storageCommandScope.js';
import { buildScopedStorageMutation, parseScopedStorageSnapshot } from '../../src/server/storageV2Repository.js';

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;

test('real PostgreSQL: failure board and nested teacher settings preserve existing parents and unrelated records', { skip: process.env.STORAGE_AUCTION_PSQL_TEST !== '1', timeout: 60000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'school-settings-pg.'));
  const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p 55488`, '-w', 'start']);
  const query = (sql: string) => invoke('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55488', '-U', 'postgres', '-d', 'postgres'], sql).trim();
  const read = (sql: string): unknown => JSON.parse(query(sql));
  try {
    query('create role anon; create role authenticated; create role service_role;');
    for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql', 'storage_scoped_v2.sql', 'storage_rewards_v2.sql', 'storage_command_round_trips.sql', 'storage_progressive_reads.sql']) {
      query(await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
    }
    const createdAt = '2026-10-15T00:00:00Z';
    const story = { id: 'synthetic-story', studentNumber: 12, failure: '합성 실패 내용', lesson: '합성 배운 점', createdAt, stamps: [] };
    const source = { classDonation: { itemName: '합성 목표', targetAmount: 100 },
      studentEconomy: { 6: { deposit: 0 }, 15: { deposit: 100 }, 12: { deposit: 234 } },
      studentLife: { failureStories: [story], letters: [], books: [] },
      currencyBalances: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [String(index + 1), 100])), currencyHistory: {},
      retained: 'x'.repeat(100000) };
    const encoded = splitStorageState(source);
    query(`insert into app_settings(id,value,updated_at) values('school-timer-main',${json(source)},${literal(createdAt)});
      select storage_set_maintenance(true);
      select storage_bootstrap(${literal(createdAt)},${json(source)},${json(encoded.resources)},${json(encoded.wallets)},${json(encoded.history)});
      select storage_set_maintenance(false,true);`);
    const initialRead: unknown = read('select storage_load_teacher_changes(null);');
    assert.ok(isStorageRecord(initialRead));
    const commit = (actor: number, action: string, payload: Record<string, unknown>, requestId: string) => {
      const session = actor === 0 ? { role: 'teacher' as const, expiresAt: 0 } : { role: 'student' as const, studentNumber: actor, expiresAt: 0 };
      const scope = storageCommandScope(action, payload, session);
      let snapshot = parseScopedStorageSnapshot(read(`select storage_load_scope(${json(scope)});`));
      if (action === 'student.failure.create') {
        const completeScope = completeFailureStoryReadScope(scope, snapshot.resources.map(resource => resource.resource_key));
        snapshot = parseScopedStorageSnapshot(read(`select storage_load_scope(${json(completeScope)});`));
      }
      const mutation = actor === 0 ? applyTeacherStorageCommand(snapshot.value, action, payload, { requestId, createdAt })
        : applyStudentStorageCommand(snapshot.value, actor, action, payload, { requestId, createdAt });
      assert.ok(mutation);
      const args = buildScopedStorageMutation({ snapshot, value: mutation.value, actorKey: actor === 0 ? 'teacher:0' : `student:${actor}`, requestId, action, payload, result: mutation.result });
      const sql = `select storage_commit_scoped_and_load(${Object.entries(args).map(([key, value]) => `${key} => ${value === null ? 'null' : typeof value === 'string' ? literal(value) : json(value)}`).join(',')});`;
      let saved: unknown;
      try { saved = read(sql); }
      catch (error) { throw new Error(JSON.stringify({ action, resources: args.p_resources }), { cause: error }); }
      assert.ok(isStorageRecord(saved) && saved.saved === true);
      return { saved, sql };
    };
    const first = commit(6, 'student.failure.stamp', { storyId: story.id, stampId: 'brave' }, 'failure-stamp-0001');
    read(first.sql);
    commit(15, 'student.failure.stamp', { storyId: story.id, stampId: 'cheer' }, 'failure-stamp-0002');
    const created = commit(6, 'student.failure.create', { failure: '합성 새 실패 내용', lesson: '합성 새 배운 점' }, 'failure-create-0001');
    const balanceAfterCreate = query('select balance from wallet_accounts where student_number=6;');
    read(created.sql);
    assert.equal(query('select balance from wallet_accounts where student_number=6;'), balanceAfterCreate);
    const actorScope = storageCommandScope('student.failure.create', {}, { role: 'student', studentNumber: 6, expiresAt: 0 });
    const partialSnapshot = parseScopedStorageSnapshot(read(`select storage_load_scope(${json(actorScope)});`));
    const completeScope = completeFailureStoryReadScope(actorScope, partialSnapshot.resources.map(resource => resource.resource_key));
    const actorSnapshot = parseScopedStorageSnapshot(read(`select storage_load_scope(${json(completeScope)});`));
    const actorLife = actorSnapshot.value.studentLife;
    assert.ok(isStorageRecord(actorLife) && Array.isArray(actorLife.failureStories));
    const stories = actorLife.failureStories;
    assert.throws(() => buildScopedStorageMutation({ snapshot: actorSnapshot,
      value: { ...actorSnapshot.value, studentLife: { ...actorLife,
        failureStories: stories.map(entry => isStorageRecord(entry) && entry.id === story.id ? { ...entry, failure: 'unauthorized' } : entry) } },
      actorKey: 'student:6', requestId: 'invalid-story-write', action: 'student.failure.create', payload: {}, result: null,
    }), /STORAGE_SCOPE_VIOLATION/);
    commit(0, 'teacher.settings.patch', { changes: [{ field: 'classDonation.enabled', before: null, after: true }] }, 'settings-nested-0001');
    const delta: unknown = read(`select storage_load_teacher_changes(${json(initialRead.manifest)});`);
    assert.ok(isStorageRecord(delta) && delta.complete === false);
    const fullBytes = Buffer.byteLength(JSON.stringify(initialRead));
    const deltaBytes = Buffer.byteLength(JSON.stringify(delta));
    assert.ok(deltaBytes < fullBytes / 2);
    console.log(JSON.stringify({ fullBytes, deltaBytes }));
    assert.equal(read("select value->'data' from storage_resources where resource_key='/classDonation/itemName';"), source.classDonation.itemName);
    assert.equal(read("select value->'data' from storage_resources where resource_key='/retained';"), source.retained);
    assert.equal(query('select balance from wallet_accounts where student_number=12;'), '100');
    for (const [number, amount, expected] of [[6, 10, 105], [15, 150, 0], [6, 999, 105]]) {
      const adjusted = commit(0, 'teacher.currency.adjust', { studentNumbers: [number], amount: -amount }, `negative-adjustment-${number}-${amount}`);
      read(adjusted.sql);
      assert.equal(query(`select balance from wallet_accounts where student_number=${number};`), String(expected));
    }
    assert.equal(read("select value#>'{data,deposit}' from storage_resources where resource_key='/studentEconomy/15';"), 50);
    assert.equal(read("select jsonb_array_length(value#>'{data,pendingDeductions}') from storage_resources where resource_key='/studentEconomy/6';"), 1);
    assert.deepEqual(read("select value->'data' from storage_resources where resource_key='/studentEconomy/12';"), source.studentEconomy[12]);
    assert.equal(query('select balance from wallet_accounts where student_number=12;'), '100');
    assert.equal(read("select value->'data' from storage_resources where resource_key='/studentLife/failureStories/@synthetic-story/failure';"), story.failure);
    assert.equal(query("select count(*) from storage_resources where value->>'parentKey'='/studentLife/failureStories' and not deleted;"), '2');
    assert.equal(query("select count(*) from storage_resources where resource_key like '/studentLife/failureStories/@synthetic-story/stamps/%' and not deleted;"), '2');
  } finally { invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']); }
});
