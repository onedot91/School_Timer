import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const LFS_POINTER_HEADER = 'version https://git-lfs.github.com/spec/v1\n';

// CI checks out Git LFS files as pointers while Vercel fetches the objects; both resolve to the same sha256 oid.
const contentDigest = content => {
  if (content.length < 1024) {
    const text = content.toString('utf8');
    const oid = text.startsWith(LFS_POINTER_HEADER) ? /^oid sha256:([0-9a-f]{64})$/m.exec(text)?.[1] : undefined;
    if (oid) return oid;
  }
  return createHash('sha256').update(content).digest('hex');
};

const releaseSourceEntries = async directory => {
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
  return Promise.all(files.sort().map(async file => [file, contentDigest(await readFile(resolve(directory, file)))]));
};

export const releaseSourceHash = async (directory = root) => {
  const hash = createHash('sha256');
  for (const [file, digest] of await releaseSourceEntries(directory)) {
    hash.update(file); hash.update('\0'); hash.update(digest); hash.update('\0');
  }
  return hash.digest('hex');
};

// Per-folder digests let a CI log and a Vercel log be compared when their fingerprints disagree.
export const releaseSourceBreakdown = async (directory = root) => {
  const groups = new Map();
  for (const [file, digest] of await releaseSourceEntries(directory)) {
    const parts = file.split('/');
    const nested = (parts[0] === 'public' || parts[0] === 'tests') && parts.length > 2;
    const group = parts.length === 1 ? file : nested ? parts.slice(0, 2).join('/') : `${parts[0]}/*`;
    const entry = groups.get(group) ?? { files: 0, hash: createHash('sha256') };
    entry.files += 1; entry.hash.update(file); entry.hash.update('\0'); entry.hash.update(digest); entry.hash.update('\0');
    groups.set(group, entry);
  }
  return [...groups].map(([group, { files, hash }]) => `${group} files=${files} ${hash.digest('hex').slice(0, 16)}`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--groups')) for (const line of await releaseSourceBreakdown()) console.log(line);
  const hash = await releaseSourceHash();
  const expected = process.argv.indexOf('--expect');
  if (expected !== -1 && process.argv[expected + 1] !== hash) throw new Error('RELEASE_SOURCE_CHANGED');
  console.log(hash);
}
