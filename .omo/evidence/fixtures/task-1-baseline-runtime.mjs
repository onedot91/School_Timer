import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const readTimeout = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
};

export const createWholeRunDeadline = (totalMs, cleanupReserveMs) => {
  const startedAt = Date.now(); const deadlineAt = startedAt + totalMs; const workDeadlineAt = deadlineAt - cleanupReserveMs;
  const remaining = (stage) => Math.max(0, (stage === 'cleanup' ? deadlineAt : workDeadlineAt) - Date.now());
  const within = async (label, work, stage = 'work') => {
    const timeoutMs = remaining(stage);
    if (timeoutMs < 1) throw new Error(`${label} exceeded whole-run ${stage} deadline`);
    let timer;
    try { return await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded whole-run ${stage} deadline`)), timeoutMs); })]); } finally { clearTimeout(timer); }
  };
  return { totalMs, cleanupReserveMs, startedAt, deadlineAt, within, remaining };
};

export const createRuntime = ({ root, results, deadline, assert, fixturePath, appUrl, stateUrl, controlUrl }) => {
  const owned = []; let activeVite;
  const waitFor = async (predicate, label, timeoutMs = 10000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) { try { if (await predicate()) return; } catch { /* bounded readiness probe */ } await wait(100); }
    throw new Error(`timed out waiting for ${label}`);
  };
  const portListeners = async (port) => {
    try { const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { timeout: Math.max(1, deadline.remaining('cleanup')) }); return stdout.trim(); }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 1) return ''; throw error; }
  };
  const requireFree = async (port, stage) => { const listeners = await portListeners(port); assert(!listeners, `${stage}: TCP ${port} is already occupied: ${listeners}`); };
  const start = (label, command, args, env) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const record = { label, pid: child.pid ?? null, command: [command, ...args].join(' '), stdout: '', stderr: '', stopped: false };
    child.stdout.on('data', (chunk) => { record.stdout += chunk.toString(); }); child.stderr.on('data', (chunk) => { record.stderr += chunk.toString(); });
    owned.push({ child, record }); results.processCleanup.owned.push(record); return child;
  };
  const stop = async (child) => {
    const entry = owned.find((item) => item.child === child);
    if (!child || child.exitCode !== null || child.signalCode !== null) { if (entry) entry.record.stopped = true; return; }
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), wait(Math.min(4000, deadline.remaining('cleanup')))]);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    if (entry) entry.record.stopped = true;
  };
  const startFixture = async () => { await requireFree(54329, 'before fake Supabase startup'); const child = start('fake-supabase', process.execPath, [fixturePath], {}); await waitFor(async () => (await fetch(stateUrl)).ok, 'fake Supabase on 54329'); return child; };
  const startVite = async (supabaseEnabled) => { await requireFree(4175, 'before Vite startup'); const env = supabaseEnabled ? { VITE_SUPABASE_URL: 'http://127.0.0.1:54329', VITE_SUPABASE_ANON_KEY: 'qa-only-fake-key' } : { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }; activeVite = start(supabaseEnabled ? 'vite-supabase-enabled' : 'vite-supabase-disabled', 'npm', ['run', 'dev', '--', '--port', '4175', '--host', '127.0.0.1'], env); await waitFor(async () => (await fetch(appUrl)).ok, `Vite ${supabaseEnabled ? 'Supabase-enabled' : 'Supabase-disabled'} on 4175`); };
  const control = async (body) => { const response = await fetch(controlUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); assert(response.ok, `fixture control returned ${response.status}`); return response.json(); };
  const fixtureState = async () => { const response = await fetch(stateUrl); assert(response.ok, `fixture state returned ${response.status}`); return response.json(); };
  const cleanup = async (browser) => {
    results.processCleanup.cleanupStartedAt = new Date().toISOString();
    try { await deadline.within('active Vite shutdown', () => stop(activeVite), 'cleanup'); } catch (error) { results.errors.push({ type: 'cleanup', message: error.message }); }
    try { await deadline.within('Chromium shutdown', () => browser?.close(), 'cleanup'); } catch (error) { results.errors.push({ type: 'cleanup', message: error.message }); }
    for (const { child } of [...owned].reverse()) { try { await deadline.within('owned process shutdown', () => stop(child), 'cleanup'); } catch (error) { results.errors.push({ type: 'cleanup', message: error.message }); } }
    for (const port of [4175, 54329]) { try { const listeners = await portListeners(port); results.processCleanup.finalPortChecks.push({ port, listeners, free: !listeners }); if (listeners) results.errors.push({ type: 'cleanup', message: `TCP ${port} still listening: ${listeners}` }); } catch (error) { results.errors.push({ type: 'cleanup', message: error.message }); } }
    results.processCleanup.cleanupCompletedAt = new Date().toISOString();
  };
  return { control, fixtureState, requireFree, startFixture, startVite, stopActiveVite: async () => { await stop(activeVite); activeVite = undefined; }, cleanup };
};
