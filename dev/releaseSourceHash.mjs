import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export const releaseSourceHash = async (directory = root) => {
  const files = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vercel.json', 'index.html', '.vercelignore'];
  const walk = async path => {
    for (const entry of await readdir(resolve(directory, path), { withFileTypes: true })) {
      if (entry.name === '.DS_Store' || entry.name.endsWith('.log')) continue;
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error('RELEASE_SOURCE_SYMLINK');
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) files.push(child);
    }
  };
  for (const folder of ['src', 'api', 'public', 'supabase', 'dev', 'tests', '.github/workflows']) await walk(folder);
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(file); hash.update('\0'); hash.update(await readFile(resolve(directory, file))); hash.update('\0');
  }
  return hash.digest('hex');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hash = await releaseSourceHash();
  const expected = process.argv.indexOf('--expect');
  if (expected !== -1 && process.argv[expected + 1] !== hash) throw new Error('RELEASE_SOURCE_CHANGED');
  console.log(hash);
}
