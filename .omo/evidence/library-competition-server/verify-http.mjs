import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

const child = spawn(process.execPath, ['--import', 'tsx', '.omo/evidence/library-competition-server/http-smoke.mjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
const exit = once(child, 'exit');
const lines = createInterface({ input: child.stdout });
try {
  const [line] = await once(lines, 'line');
  const { port } = JSON.parse(line);
  assert.ok(Number.isInteger(port));
  const invoke = (body) => {
    const output = execFileSync('curl', ['-sS', '-i', '-X', 'PUT', `http://127.0.0.1:${port}/api/shared-settings`, '-H', 'Content-Type: application/json', '--data', JSON.stringify(body)], { encoding: 'utf8', timeout: 8000 });
    const [header, payload] = output.split('\r\n\r\n');
    return { header: header.split('\r\n')[0], body: JSON.parse(payload) };
  };
  const opened = invoke({ action: 'libraryCompetition', intent: 'open' });
  assert.equal(opened.header, 'HTTP/1.1 200 OK');
  assert.equal(opened.body.competition.standings.length, 17);
  const forbidden = invoke({ action: 'libraryCompetitionSettings', expectedRevision: 0, speed: 1, paused: false, counts: [] });
  assert.equal(forbidden.header, 'HTTP/1.1 403 Forbidden');
  assert.equal(forbidden.body.error, 'LIBRARY_COMPETITION_FORBIDDEN');
  const stale = invoke({ action: 'placeLibraryBook', requestId: '123e4567-e89b-42d3-a456-426614174000', seasonId: '2025-12', slotId: 0, book: { kind: 'new', title: '검증 책', author: '검증 작가', pageCount: 100 } });
  assert.equal(stale.header, 'HTTP/1.1 409 Conflict');
  assert.equal(stale.body.error, 'LIBRARY_SEASON_CHANGED');
  console.log(JSON.stringify({ tier: 'actual HTTP adapter / fake PostgREST seam (NOT real SQL)', opened: { status: opened.header, rows: 17 }, forbidden, stale, verdict: 'PASS' }));
} finally {
  lines.close();
  child.kill('SIGTERM');
  await exit;
  console.log(JSON.stringify({ cleanup: 'HTTP fixture process exited; ephemeral listener closed' }));
}
