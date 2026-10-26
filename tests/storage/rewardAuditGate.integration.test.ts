import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';
import { splitStorageState } from '../../src/lib/storageV2Codec.js';

// storage_reward_audit_gate.sql: one teacher reward audit runs at a time across the classroom and a
// busy slot fails immediately instead of waiting on a pooled connection.
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args,
  { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
const students = Array.from({ length: 23 }, (_, index) => index + 1);
test('reward audit gate admits one audit at a time and fails a busy slot at once', { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'school-audit-gate.'));
  const port = 55496;
  const query = (sql: string) => invoke('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', String(port), '-U', 'postgres', '-d', 'postgres'], sql).trim();
  invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p ${port}`, '-w', 'start']);
  const pool = new pg.Pool({ host: directory, port, user: 'postgres', database: 'postgres', max: 4 });
  pool.on('error', error => { if (Reflect.get(error, 'code') !== '57P01') throw error; });
  try {
    query('create role anon; create role authenticated; create role service_role;');
    for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql', 'storage_today_friend_v2.sql', 'storage_rewards_v2.sql',
      'newspaper_questions.sql', 'storage_classword_v2.sql', 'storage_audit_v2.sql', 'storage_scoped_v2.sql', 'storage_read_performance.sql',
      'storage_library_placement_v2.sql', 'storage_scoped_polling.sql', 'storage_scope_history_read_performance.sql', 'storage_scoped_read_execution.sql', 'storage_snapshot_execution.sql',
      'storage_ancestor_locks.sql', 'storage_command_round_trips.sql', 'storage_scope_read_buffers.sql', 'storage_student_read_gate.sql', 'storage_reward_audit_gate.sql', 'storage_reward_audit_gate.sql']) {
      query(await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
    }
    const createdAt = '2026-10-01T00:00:00Z';
    const source = { scheduleNotice: '합성 학급', studentPets: { '5': { name: '합성' } },
      currencyBalances: Object.fromEntries(students.map(student => [student, 100])),
      currencyHistory: Object.fromEntries(students.map(student => [student, []])) };
    const encoded = splitStorageState(source);
    query(`insert into app_settings(id,value,updated_at) values('school-timer-main',${json(source)},${literal(createdAt)});
      select storage_set_maintenance(true);
      select storage_bootstrap(${literal(createdAt)},${json(source)},${json(encoded.resources)},${json(encoded.wallets)},${json(encoded.history)});
      select storage_set_maintenance(false,true);`);

    const privileges = query(`select has_function_privilege('anon','public.storage_reward_audit_source_gated()','execute')||':'||
      has_function_privilege('service_role','public.storage_reward_audit_source_gated()','execute')`);
    assert.equal(privileges, 'false:true');

    const asService = async <T extends Record<string, unknown>>(sql: string) => {
      const client = await pool.connect();
      try {
        await client.query('begin; set local role service_role');
        const result = await client.query<T>(sql);
        await client.query('commit');
        return result.rows[0];
      } catch (error) { await client.query('rollback'); throw error; }
      finally { client.release(); }
    };
    const withoutClock = (value: unknown) => ({ ...(value as Record<string, unknown>), checkedAt: null });
    const open = await asService<{ gated: unknown; plain: unknown }>('select public.storage_reward_audit_source_gated() gated, public.storage_reward_audit_source() plain');
    assert.deepEqual(withoutClock(open?.gated), withoutClock(open?.plain));

    // An in-flight audit holds the only slot.
    const holder = await pool.connect();
    await holder.query('begin');
    await holder.query('select pg_advisory_xact_lock(726316, 1)');
    const started = performance.now();
    await assert.rejects(asService('select public.storage_reward_audit_source_gated()'), (error: unknown) => error instanceof Error && error.message === 'REWARD_AUDIT_BUSY');
    assert.ok(performance.now() - started < 1000, 'a busy audit slot must not wait');
    await holder.query('commit');
    holder.release();
    const reopened = await asService<{ gated: unknown }>('select public.storage_reward_audit_source_gated() gated');
    assert.deepEqual(withoutClock(reopened?.gated), withoutClock(open?.plain));
  } finally {
    await pool.end();
    invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']);
  }
});
