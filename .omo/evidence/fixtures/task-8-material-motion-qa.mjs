import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = process.cwd();
const outputPath = path.join(root, '.omo/evidence/task-8-apple-ui-refresh-plan/material-motion-runtime.json');
const appUrl = 'http://127.0.0.1:4175/';
const stateUrl = 'http://127.0.0.1:54329/__qa/state';
const children = [];
const result = { success: false, completedAt: null, errors: [], default: null, reduced: null, cleanup: [] };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const start = (label, command, args, environment = {}) => {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...environment }, stdio: ['ignore', 'pipe', 'pipe'] });
  const receipt = { label, stderr: '' };
  child.stderr.on('data', (chunk) => { receipt.stderr += chunk.toString(); });
  children.push({ child, receipt });
};
const waitForUrl = async (url) => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* local readiness */ }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
};
const readPresentation = (element) => {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    connected: element.isConnected,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    opacity: Number(style.opacity),
    transform: style.transform,
    filter: style.filter,
  };
};

let browser;
try {
  await mkdir(path.dirname(outputPath), { recursive: true });
  start('fake-supabase', process.execPath, ['.omo/evidence/fixtures/fake-supabase.mjs']);
  await waitForUrl(stateUrl);
  start('vite', 'npm', ['run', 'dev', '--', '--port', '4175', '--host', '127.0.0.1'], {
    DISABLE_HMR: '1',
    VITE_SUPABASE_URL: 'http://127.0.0.1:54329',
    VITE_SUPABASE_ANON_KEY: 'qa-only-fake-key',
  });
  await waitForUrl(appUrl);
  browser = await chromium.launch({ headless: true });

  const run = async (reducedMotion) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 600 }, reducedMotion });
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('school-timer-entry-number-v1', '0');
    });
    await context.route('https://librarylibrary.vercel.app/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    const trigger = page.getByRole('button', { name: '설정', exact: true });
    const triggerBox = await trigger.boundingBox();
    assert(triggerBox, 'settings trigger geometry missing');
    await trigger.click();
    const locator = page.locator('.app-settings-modal');
    await locator.waitFor();
    const node = await locator.elementHandle();
    assert(node, 'material node missing');
    await page.waitForTimeout(reducedMotion === 'reduce' ? 120 : 260);
    await page.getByRole('button', { name: '백업', exact: true }).focus();
    let rest = await node.evaluate(readPresentation);
    for (let attempt = 0; attempt < 40 && rest.opacity < 0.999; attempt += 1) {
      await page.waitForTimeout(20);
      rest = await node.evaluate(readPresentation);
    }
    if (reducedMotion === 'reduce') {
      await page.locator('.app-settings-modal .settings-header button').last().click();
      const closeImmediate = await node.evaluate(readPresentation);
      await locator.waitFor({ state: 'detached' });
      await trigger.click();
      await locator.waitFor();
      const reopenedNode = await locator.elementHandle();
      assert(reopenedNode, 'reduced-motion material did not reopen');
      const openImmediate = await reopenedNode.evaluate(readPresentation);
      await page.waitForTimeout(40);
      const openMid = await reopenedNode.evaluate(readPresentation);
      await page.waitForTimeout(180);
      let settled = await reopenedNode.evaluate(readPresentation);
      for (let attempt = 0; attempt < 40 && settled.opacity < 0.999; attempt += 1) {
        await page.waitForTimeout(20);
        settled = await reopenedNode.evaluate(readPresentation);
      }
      const sample = { rest, closeImmediate, openImmediate, openMid, settled, sameNodeConnected: false, classification: 'reduced-motion-opacity-only-detach-and-reopen' };
      result.reduced = sample;
      const hasNoVisualFilter = (value) => value === 'none' || value.startsWith('blur(0px)');
      assert(openImmediate.transform === 'none' && hasNoVisualFilter(openImmediate.filter), 'reduced motion open changed scale or filter');
      assert(openMid.transform === 'none' && hasNoVisualFilter(openMid.filter), 'reduced motion mid changed scale or filter');
      assert(settled.opacity >= 0.999, 'reduced motion material did not settle');
      await page.getByRole('button', { name: '백업', exact: true }).focus();
      await page.locator('.app-settings-modal .settings-header button').last().click();
      await locator.waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '설정', null, { timeout: 500 });
      sample.focusAfterExit = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '');
      assert(sample.focusAfterExit === '설정', `reduced settings focus returned to ${sample.focusAfterExit}`);
      await context.close();
      return sample;
    }
    const triggerNode = await trigger.elementHandle();
    assert(triggerNode, 'settings trigger node missing');
    const closeNode = await page.locator('.app-settings-modal .settings-header button').last().elementHandle();
    assert(closeNode, 'settings close node missing');
    const reversal = await page.evaluate(([material, opener, closer]) => new Promise((resolve, reject) => {
      const read = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          connected: element.isConnected,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          opacity: Number(style.opacity),
          transform: style.transform,
          filter: style.filter,
        };
      };
      let attempts = 0;
      let closeImmediate;
      const observer = new MutationObserver(() => {
        attempts += 1;
        const closeMid = read(material);
        if (closeMid.opacity > 0.01 && closeMid.opacity < 0.92) {
          observer.disconnect();
          opener.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          queueMicrotask(() => resolve({ closeImmediate, closeMid, reverseImmediate: read(material), sameNodeConnected: material.isConnected, attempts }));
        }
      });
      observer.observe(material, { attributes: true, attributeFilter: ['style'] });
      closer.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      closeImmediate = read(material);
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`exit never emitted a renderer-local reversal value; opacity=${read(material).opacity}`));
      }, 1000);
    }), [node, triggerNode, closeNode]);
    const { closeImmediate, closeMid, reverseImmediate, sameNodeConnected } = reversal;
    let reverseMid = reverseImmediate;
    for (let attempt = 0; attempt < 20 && reverseMid.opacity <= reverseImmediate.opacity + 0.05; attempt += 1) {
      await page.waitForTimeout(20);
      reverseMid = await node.evaluate(readPresentation);
    }
    let settled = await node.evaluate(readPresentation);
    for (let attempt = 0; attempt < 40 && settled.opacity < 0.999; attempt += 1) {
      await page.waitForTimeout(10);
      settled = await node.evaluate(readPresentation);
    }
    const sample = { rest, closeImmediate, closeMid, reverseImmediate, reverseMid, settled, sameNodeConnected, trustedInitialOpen: true, rendererCoordination: { protocol: 'same-page synthetic close/reopen MouseEvents + style MutationObserver', attempts: reversal.attempts, exitDurationSeconds: 0.34 } };
    result[reducedMotion === 'reduce' ? 'reduced' : 'default'] = sample;
    assert(sameNodeConnected, 'rapid reopen did not retain the exiting material node');
    assert(closeMid.opacity < rest.opacity, 'exit opacity did not change');
    if (reducedMotion === 'no-preference') {
      assert(reverseImmediate.opacity > 0 && reverseImmediate.opacity < 1, 'rapid reopen restarted from an opacity endpoint');
      assert(reverseMid.opacity > reverseImmediate.opacity, 'rapid reopen did not reverse the opacity direction');
      assert(closeMid.transform !== rest.transform && closeMid.filter !== rest.filter, 'default exit did not synchronize scale and filter');
      assert(reverseMid.transform !== closeMid.transform && reverseMid.filter !== closeMid.filter, 'default reversal did not retarget scale and filter');
    } else {
      assert(closeMid.transform === rest.transform && closeMid.filter === rest.filter, 'reduced motion changed scale or filter');
    }
    assert(settled.opacity >= 0.999, 'material did not settle');
    await page.getByRole('button', { name: '백업', exact: true }).focus();
    await page.evaluate((material) => {
      window.__materialExitOwnership = new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          const opacity = Number(getComputedStyle(material).opacity);
          if (opacity <= 0.01 || opacity >= 0.92) return;
          observer.disconnect();
          let branch = material;
          let backgroundInert = false;
          while (branch.parentElement) {
            const parent = branch.parentElement;
            backgroundInert ||= [...parent.children].some((sibling) => sibling !== branch && sibling instanceof HTMLElement && sibling.inert);
            branch = parent;
          }
          resolve({
            opacity,
            activeInside: material.contains(document.activeElement),
            backgroundInert,
            role: material.getAttribute('role'),
            ariaModal: material.getAttribute('aria-modal'),
          });
        });
        observer.observe(material, { attributes: true, attributeFilter: ['style'] });
        setTimeout(() => reject(new Error('exit ownership midpoint missing')), 1000);
      });
    }, node);
    await page.keyboard.press('Escape');
    sample.exitOwnership = await page.evaluate(() => window.__materialExitOwnership);
    assert(sample.exitOwnership.activeInside, 'focus left the material during exit');
    assert(sample.exitOwnership.backgroundInert, 'background inert ownership ended before exit completion');
    assert(sample.exitOwnership.role === 'dialog' && sample.exitOwnership.ariaModal === 'true', 'dialog semantics ended before exit completion');
    await locator.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '설정', null, { timeout: 500 });
    sample.focusAfterExit = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '');
    assert(sample.focusAfterExit === '설정', `settings focus returned to ${sample.focusAfterExit}`);
    await context.close();
    return sample;
  };

  result.default = await run('no-preference');
  result.reduced = await run('reduce');
  result.success = true;
} catch (error) {
  result.errors.push(error instanceof Error ? String(error.stack ?? error.message) : String(error));
} finally {
  await browser?.close().catch(() => {});
  for (const { child, receipt } of children.reverse()) {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), wait(2000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    result.cleanup.push({ label: receipt.label, stopped: true, stderr: receipt.stderr });
  }
  result.completedAt = new Date().toISOString();
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}

if (!result.success) process.exitCode = 1;
