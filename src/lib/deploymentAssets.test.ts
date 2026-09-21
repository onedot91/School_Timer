import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build } from 'vite';
import { deploymentAssets } from '../../dev/deploymentAssets';
import { spawnSync } from 'node:child_process';

test('Vite 설정이 불러오는 로컬 빌드 파일은 Vercel 배포에서 제외되지 않는다', async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const source = await readFile(path.join(root, 'vite.config.ts'), 'utf8');
  const dependencies = [...source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)]
    .map(match => `${match[1].slice(2)}.ts`);
  assert.ok(dependencies.length > 0);
  for (const file of dependencies) {
    const result = spawnSync('git', ['-c', `core.excludesFile=${path.join(root, '.vercelignore')}`,
      'check-ignore', '--no-index', file], { cwd: root, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 1, `${file} is excluded from the Vercel build: ${result.stdout}${result.stderr}`);
  }
});

test('실제 빌드의 HTML, 지연 import, 공유 import, CSS preload 경로에 배포 ID를 붙인다', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'school-assets-')));
  await writeFile(path.join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
  await writeFile(path.join(root, 'main.js'), 'import { value } from "./shared.js"; window.value = value; window.openPage = () => import("./page.js");');
  await writeFile(path.join(root, 'shared.js'), 'export const value = Math.random();');
  await writeFile(path.join(root, 'page.js'), 'import { value } from "./shared.js"; import "./page.css"; export default value;');
  await writeFile(path.join(root, 'page.css'), 'body { color: green; }');
  for (const id of ['dpl_Test123', undefined]) {
    const result = await build({ root, configFile: false, logLevel: 'silent', plugins: [deploymentAssets(id)], build: { write: false, minify: false } });
    assert.ok(!Array.isArray(result) && 'output' in result);
    const outputs = result.output;
    const html = outputs.find(output => output.fileName === 'index.html');
    assert.ok(html?.type === 'asset' && typeof html.source === 'string');
    const code = outputs.filter(output => output.type === 'chunk').map(output => output.code).join('\n');
    if (id) {
      assert.match(html.source, /\.js\?dpl=dpl_Test123/);
      assert.match(code, /import\("\.\/page-[^"?]+\.js\?dpl=dpl_Test123"\)/);
      assert.match(code, /\.css\?dpl=dpl_Test123/);
      assert.doesNotMatch(code, /["'][^"']*\.js["']/);
      assert.ok(outputs.every(output => !output.fileName.includes('?')));
    } else {
      assert.doesNotMatch(html.source + code, /\?dpl=/);
    }
  }
});
