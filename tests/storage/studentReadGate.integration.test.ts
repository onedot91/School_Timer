import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';
import { splitStorageState } from '../../src/lib/storageV2Codec.js';

// storage_student_read_gate.sql: student reads share a classroom-wide pair of slots, a full gate
// fails immediately, and the ungated teacher reads keep running while students hold every slot.
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args,
  { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
const students = Array.from({ length: 23 }, (_, index) => index + 1);
const scope = { resources: [{ path: '/scheduleNotice' }, { path: '/studentPets', students: [5] }], wallets: [5], history: [5], writeResources: [], writeWallets: [] };

test('student read gate bounds concurrent student reads and leaves teacher reads open', { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'school-read-gate.'));
  const port = 55495;
  const query = (sql: string) => invoke('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', String(port), '-U', 'postgres', '-d', 'postgres'], sql).trim();
  invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p ${port}`, '-w', 'start']);
  const pool = new pg.Pool({ host: directory, port, user: 'postgres', database: 'postgres', max: 6 });
  pool.on('error', error => { if (Reflect.get(error, 'code') !== '57P01') throw error; });
  try {
    query('create role anon; create role authenticated; create role service_role;');
    for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql', 'storage_today_friend_v2.sql', 'storage_rewards_v2.sql',
      'newspaper_questions.sql', 'storage_classword_v2.sql', 'storage_audit_v2.sql', 'storage_scoped_v2.sql', 'storage_read_performance.sql',
      'storage_library_placement_v2.sql', 'storage_scoped_polling.sql', 'storage_scope_history_read_performance.sql', 'storage_scoped_read_execution.sql', 'storage_snapshot_execution.sql',
      'storage_ancestor_locks.sql', 'storage_command_round_trips.sql', 'storage_scope_read_buffers.sql', 'storage_student_read_gate.sql', 'storage_student_read_gate.sql']) {
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

    const privileges = query(`select string_agg(p||':'||has_function_privilege('anon',p,'execute')||':'||has_function_privilege('service_role',p,'execute'),',' order by p)
      from unnest(array['public.storage_student_read_slot()','public.storage_load_scope_student(jsonb)','public.storage_load_scope_metadata_student(jsonb)','public.storage_poll_scope_student(jsonb,text)']) p`);
    assert.equal(privileges, ['public.storage_load_scope_metadata_student(jsonb):false:true', 'public.storage_load_scope_student(jsonb):false:true',
      'public.storage_poll_scope_student(jsonb,text):false:true', 'public.storage_student_read_slot():false:false'].join(','));

    const asService = async <T extends Record<string, unknown>>(sql: string, values: unknown[] = []) => {
      const client = await pool.connect();
      try {
        await client.query('begin; set local role service_role');
        const result = await client.query<T>(sql, values);
        await client.query('commit');
        return result.rows[0];
      } catch (error) { await client.query('rollback'); throw error; }
      finally { client.release(); }
    };
    const parameter = JSON.stringify(scope);
    const open = await asService<{ gated: unknown; plain: unknown; meta: unknown; poll: unknown }>(`select public.storage_load_scope_student($1::jsonb) gated,
      public.storage_load_scope($1::jsonb) plain, public.storage_load_scope_metadata_student($1::jsonb) meta, public.storage_poll_scope_student($1::jsonb,null) poll`, [parameter]);
    assert.deepEqual(open?.gated, open?.plain);
    assert.ok(open?.meta && open.poll);

    // Two in-flight student reads hold both classroom slots.
    const holders = await Promise.all([pool.connect(), pool.connect()]);
    for (const holder of holders) {
      await holder.query('begin');
      const taken = await holder.query<{ slot: unknown }>('select public.storage_student_read_slot() slot');
      assert.equal(taken.rowCount, 1);
    }
    const started = performance.now();
    for (const sql of ['select public.storage_load_scope_student($1::jsonb)', 'select public.storage_load_scope_metadata_student($1::jsonb)',
      'select public.storage_poll_scope_student($1::jsonb,null)']) {
      await assert.rejects(asService(sql, [parameter]), (error: unknown) => error instanceof Error && error.message === 'STORAGE_READ_BUSY', sql);
    }
    assert.ok(performance.now() - started < 1000, 'a full gate must not wait for a slot');
    const teacher = await asService<{ plain: unknown }>('select public.storage_load_scope($1::jsonb) plain', [parameter]);
    assert.deepEqual(teacher?.plain, open?.plain);

    await holders[0].query('commit');
    holders[0].release();
    const reopened = await asService<{ gated: unknown }>('select public.storage_load_scope_student($1::jsonb) gated', [parameter]);
    assert.deepEqual(reopened?.gated, open?.plain);
    await holders[1].query('commit');
    holders[1].release();
  } finally {
    await pool.end();
    invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']);
  }
});
