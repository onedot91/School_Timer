import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Netlify and Vercel deployment headers deny unused browser capabilities', async () => {
  const netlify = await readFile(new URL('../../netlify.toml', import.meta.url), 'utf8');
  const vercel = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
    readonly regions?: readonly string[];
    readonly headers?: readonly {
      readonly headers?: readonly { readonly key?: string; readonly value?: string }[];
    }[];
  };
  const vercelHeaders = Object.fromEntries(
    (vercel.headers?.[0]?.headers ?? []).flatMap((header) => (
      header.key && header.value ? [[header.key, header.value]] : []
    )),
  );
  const permissionsPolicy = /"Permissions-Policy"\s*=\s*"([^"]+)"/.exec(netlify)?.[1];
  const contentSecurityPolicy = /"Content-Security-Policy"\s*=\s*"([^"]+)"/.exec(netlify)?.[1];

  assert.deepEqual(vercel.regions, ['icn1']);
  assert.equal(permissionsPolicy, 'camera=(), microphone=(), geolocation=()');
  assert.equal(vercelHeaders['Permissions-Policy'], permissionsPolicy);
  assert.equal(vercelHeaders['Content-Security-Policy'], contentSecurityPolicy);
  assert.doesNotMatch(contentSecurityPolicy ?? '', /supabase\.co/);
  assert.match(contentSecurityPolicy ?? '', /style-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  assert.match(contentSecurityPolicy ?? '', /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
  assert.match(contentSecurityPolicy ?? '', /font-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  assert.match(contentSecurityPolicy ?? '', /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
});
