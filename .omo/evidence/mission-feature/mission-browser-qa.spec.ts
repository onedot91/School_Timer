import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = path.resolve('.omo/evidence/mission-feature');
const actionLogPath = path.join(evidenceDir, 'browser-action-log.md');
const url = 'http://127.0.0.1:3000';
const entryStorageKey = 'school-timer-entry-number-v1';
const missionText = '책상 정리하기';
const missionReward = '25';

const entries: string[] = [];

function log(message: string) {
  entries.push(`- ${message}`);
}

async function gotoFreshEntrySelect(page: Page) {
  log(`goto ${url} with fresh localStorage context`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '번호 선택' })).toBeVisible();
}

async function selectTeacherEntry(page: Page) {
  log('click hidden 0-entry unlock button 5 times, then click aria-label="0번 학급 시계 선택"');
  const unlock = page.getByLabel('0번 표시 숨김 버튼');
  for (let index = 0; index < 5; index += 1) {
    await unlock.click();
  }
  await page.getByLabel('0번 학급 시계 선택').click();
  await expect(page.getByLabel('설정').first()).toBeVisible();
}

async function switchEntry(page: Page, entryNumber: number) {
  log(`set localStorage ${entryStorageKey}=${entryNumber} and reload`);
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: entryStorageKey, value: String(entryNumber) },
  );
  await page.reload({ waitUntil: 'networkidle' });
}

async function openAuctionSettings(page: Page) {
  log('click settings button aria-label="설정"');
  await page.getByLabel('설정').first().click();
  log('click settings tab role=button name="경매"');
  await page.getByRole('button', { name: '경매' }).click();
  await expect(page.getByRole('heading', { name: '물품 설정 및 현황' })).toBeVisible();
}

async function addMission(page: Page) {
  log('click text button "미션 추가"');
  await page.getByRole('button', { name: /미션 추가/ }).click();
  log(`fill aria-label="미션 1 내용" with "${missionText}"`);
  await page.getByLabel('미션 1 내용').fill(missionText);
  log(`fill aria-label="미션 1 보상" with "${missionReward}"`);
  await page.getByLabel('미션 1 보상').fill(missionReward);
  await expect(page.getByLabel('미션 1 내용')).toHaveValue(missionText);
  await expect(page.getByLabel('미션 1 보상')).toHaveValue(missionReward);
  await expect(page.locator('section').filter({ hasText: '미션' })).toContainText('고마');
  log(`observable PASS: settings panel input values show "${missionText}" and "${missionReward} 고마"`);
}

async function verifyStudentMission(page: Page) {
  await expect(page.getByRole('heading', { name: '오늘의 경매' })).toBeVisible();
  const missionSection = page.getByRole('heading', { name: '오늘의 미션' }).locator('xpath=ancestor::section[1]');
  await expect(missionSection).toBeVisible();
  await expect(missionSection).toContainText(missionText);
  await expect(missionSection).toContainText(`${missionReward} 고마`);
  await expect(missionSection.getByRole('button')).toHaveCount(0);
  log(`observable PASS: student page shows 오늘의 미션, "${missionText}", "${missionReward} 고마", and no mission buttons`);
}

async function deleteMission(page: Page) {
  log('click aria-label="미션 1 삭제"');
  await page.getByLabel('미션 1 삭제').click();
  await expect(page.getByText('등록된 미션이 없습니다.')).toBeVisible();
  log('observable PASS: teacher settings shows empty mission state after delete');
}

async function verifyMissionDeleted(page: Page) {
  await expect(page.getByRole('heading', { name: '오늘의 경매' })).toBeVisible();
  await expect(page.getByText(missionText)).toHaveCount(0);
  await expect(page.getByText('오늘의 미션')).toHaveCount(0);
  log(`observable PASS: deleted mission "${missionText}" is absent and no blank mission section remains`);
}

async function runScenario(page: Page, mode: 'desktop' | 'mobile') {
  log(`## ${mode} scenario start viewport=${JSON.stringify(page.viewportSize())}`);
  await gotoFreshEntrySelect(page);
  await selectTeacherEntry(page);
  await openAuctionSettings(page);
  await addMission(page);
  await page.screenshot({
    path: path.join(evidenceDir, mode === 'desktop' ? 'teacher-mission-settings.png' : 'teacher-mission-settings-mobile.png'),
    fullPage: true,
  });
  log(`screenshot saved: ${mode === 'desktop' ? 'teacher-mission-settings.png' : 'teacher-mission-settings-mobile.png'}`);

  await switchEntry(page, 1);
  await verifyStudentMission(page);
  await page.screenshot({
    path: path.join(evidenceDir, mode === 'desktop' ? 'student-mission-display.png' : 'student-mission-display-mobile.png'),
    fullPage: true,
  });
  log(`screenshot saved: ${mode === 'desktop' ? 'student-mission-display.png' : 'student-mission-display-mobile.png'}`);

  await switchEntry(page, 0);
  await openAuctionSettings(page);
  await deleteMission(page);
  await switchEntry(page, 1);
  await verifyMissionDeleted(page);
  await page.screenshot({
    path: path.join(evidenceDir, mode === 'desktop' ? 'student-mission-deleted.png' : 'student-mission-deleted-mobile.png'),
    fullPage: true,
  });
  log(`screenshot saved: ${mode === 'desktop' ? 'student-mission-deleted.png' : 'student-mission-deleted-mobile.png'}`);
  log(`## ${mode} scenario PASS`);
}

test.describe.configure({ mode: 'serial' });

test('mission feature integrated browser QA - desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await runScenario(page, 'desktop');
});

test('mission feature integrated browser QA - mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await runScenario(page, 'mobile');
});

test.afterAll(() => {
  fs.writeFileSync(
    actionLogPath,
    [
      '# Mission Feature Browser Action Log',
      '',
      `URL: ${url}`,
      'Surface: Vite web app in Chromium via npx playwright test',
      '',
      ...entries,
      '',
    ].join('\n'),
  );
});
