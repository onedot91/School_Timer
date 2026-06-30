import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = path.resolve('.omo/evidence/mission-feature');
const actionLogPath = path.join(evidenceDir, 'browser-action-log.md');
const url = 'http://127.0.0.1:3000';
const entryStorageKey = 'school-timer-entry-number-v1';
const missionsStorageKey = 'auctionMissions-v1';
const missionText = '책상 정리하기';
const missionReward = 25;
const missionPayload = [{ id: 'mission-qa', content: missionText, rewardAmount: missionReward }];

const entries: string[] = [];

function log(message: string) {
  entries.push(`- ${message}`);
}

async function seedStorage(page: Page, entryNumber: number, withMission: boolean) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(
    ({ entryKey, missionKey, entryValue, missions }) => {
      window.localStorage.clear();
      window.localStorage.setItem(entryKey, String(entryValue));
      if (missions) {
        window.localStorage.setItem(missionKey, JSON.stringify(missions));
      } else {
        window.localStorage.removeItem(missionKey);
      }
    },
    {
      entryKey: entryStorageKey,
      missionKey: missionsStorageKey,
      entryValue: entryNumber,
      missions: withMission ? missionPayload : null,
    },
  );
  await page.reload({ waitUntil: 'networkidle' });
}

async function openAuctionSettings(page: Page) {
  await page.getByLabel('설정').first().click();
  await page.getByRole('button', { name: '경매' }).click();
  await expect(page.getByRole('heading', { name: '물품 설정 및 현황' })).toBeVisible();
}

async function verifyTeacherMission(page: Page) {
  await openAuctionSettings(page);
  await expect(page.getByLabel('미션 1 내용')).toHaveValue(missionText);
  await expect(page.getByLabel('미션 1 보상')).toHaveValue(String(missionReward));
}

async function verifyStudentMission(page: Page) {
  await expect(page.getByRole('heading', { name: '오늘의 경매' })).toBeVisible();
  const missionSection = page.getByRole('heading', { name: '오늘의 미션' }).locator('xpath=ancestor::section[1]');
  await expect(missionSection).toBeVisible();
  await expect(missionSection).toContainText(missionText);
  await expect(missionSection).toContainText(`${missionReward} 고마`);
  await expect(missionSection.getByRole('button')).toHaveCount(0);
}

async function verifyMissionAbsent(page: Page) {
  await expect(page.getByRole('heading', { name: '오늘의 경매' })).toBeVisible();
  await expect(page.getByText(missionText)).toHaveCount(0);
  await expect(page.getByText('오늘의 미션')).toHaveCount(0);
}

async function runFallbackScenario(page: Page, mode: 'desktop' | 'mobile') {
  log(`## ${mode} fallback scenario start viewport=${JSON.stringify(page.viewportSize())}`);
  log('UI mission creation was attempted in mission-browser-qa.spec.ts and did not persist the custom values; using requested localStorage fallback.');

  log(`set ${entryStorageKey}=0 and ${missionsStorageKey}=${JSON.stringify(missionPayload)}`);
  await seedStorage(page, 0, true);
  await verifyTeacherMission(page);
  await page.screenshot({
    path: path.join(evidenceDir, mode === 'desktop' ? 'teacher-mission-settings.png' : 'teacher-mission-settings-mobile.png'),
    fullPage: true,
  });
  log(`screenshot saved: ${mode === 'desktop' ? 'teacher-mission-settings.png' : 'teacher-mission-settings-mobile.png'}`);

  log(`set ${entryStorageKey}=1 with same ${missionsStorageKey} payload`);
  await seedStorage(page, 1, true);
  await verifyStudentMission(page);
  await page.screenshot({
    path: path.join(evidenceDir, mode === 'desktop' ? 'student-mission-display.png' : 'student-mission-display-mobile.png'),
    fullPage: true,
  });
  log(`observable PASS: student page shows 오늘의 미션, "${missionText}", "${missionReward} 고마", and no completion/claim button`);
  log(`screenshot saved: ${mode === 'desktop' ? 'student-mission-display.png' : 'student-mission-display-mobile.png'}`);

  log(`negative: remove ${missionsStorageKey}, keep ${entryStorageKey}=1, reload student`);
  await seedStorage(page, 1, false);
  await verifyMissionAbsent(page);
  await page.screenshot({
    path: path.join(evidenceDir, mode === 'desktop' ? 'student-mission-deleted.png' : 'student-mission-deleted-mobile.png'),
    fullPage: true,
  });
  log(`observable PASS: "${missionText}" absent and no blank mission section/card remains`);
  log(`screenshot saved: ${mode === 'desktop' ? 'student-mission-deleted.png' : 'student-mission-deleted-mobile.png'}`);
  log(`## ${mode} fallback scenario PASS`);
}

test.describe.configure({ mode: 'serial' });

test('mission feature localStorage fallback QA - desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await runFallbackScenario(page, 'desktop');
});

test('mission feature localStorage fallback QA - mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await runFallbackScenario(page, 'mobile');
});

test.afterAll(() => {
  fs.writeFileSync(
    actionLogPath,
    [
      '# Mission Feature Browser Action Log',
      '',
      `URL: ${url}`,
      'Surface: Vite web app in Chromium via Playwright test',
      'Mode: localStorage fallback with Supabase env disabled for deterministic local rendering',
      '',
      ...entries,
      '',
    ].join('\n'),
  );
});
