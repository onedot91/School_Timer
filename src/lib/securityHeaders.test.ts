import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Netlify deployment headers deny unused browser capabilities', async () => {
  const config = await readFile(new URL('../../netlify.toml', import.meta.url), 'utf8');
  const permissionsPolicy = /"Permissions-Policy"\s*=\s*"([^"]+)"/.exec(config)?.[1];
  const contentSecurityPolicy = /"Content-Security-Policy"\s*=\s*"([^"]+)"/.exec(config)?.[1];

  assert.equal(permissionsPolicy, 'camera=(), microphone=(), geolocation=()');
  assert.doesNotMatch(contentSecurityPolicy ?? '', /supabase\.co/);
  assert.match(contentSecurityPolicy ?? '', /style-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  assert.match(contentSecurityPolicy ?? '', /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
  assert.match(contentSecurityPolicy ?? '', /font-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  assert.match(contentSecurityPolicy ?? '', /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
});
