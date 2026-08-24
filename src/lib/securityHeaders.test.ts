import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('deployment headers deny unused browser capabilities', async () => {
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
    headers: Array<{ headers: Array<{ key: string; value: string }> }>;
  };
  const headers = config.headers.flatMap((entry) => entry.headers);
  const permissionsPolicy = headers.find((header) => header.key === 'Permissions-Policy');
  const contentSecurityPolicy = headers.find((header) => header.key === 'Content-Security-Policy');

  assert.equal(permissionsPolicy?.value, 'camera=(), microphone=(), geolocation=()');
  assert.doesNotMatch(contentSecurityPolicy?.value ?? '', /supabase\.co/);
});
