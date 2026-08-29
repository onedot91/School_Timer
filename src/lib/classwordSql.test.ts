import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../../supabase/classword.sql', import.meta.url), 'utf8');

test('낱말판 테이블은 브라우저 역할을 차단하고 서버 역할에만 권한을 연다', () => {
  for (const table of ['classword_rounds', 'classword_entries']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(
      sql,
      new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i'),
    );
    assert.match(
      sql,
      new RegExp(
        `grant select, insert, update, delete on table public\\.${table} to service_role`,
        'i',
      ),
    );
  }
});

test('낱말판 SQL은 전용 테이블만 생성한다', () => {
  const createdTables = [...sql.matchAll(/create table if not exists public\.([a-z_]+)/gi)].map(
    ([, table]) => table,
  );

  assert.deepEqual(createdTables.sort(), ['classword_entries', 'classword_rounds']);
  assert.doesNotMatch(sql, /\b(?:insert into|update|delete from)\s+public\.(?!classword_)/i);
});
