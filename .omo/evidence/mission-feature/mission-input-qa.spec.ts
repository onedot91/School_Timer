import { expect, test } from '@playwright/test';

test('mission content input remains stable while typing Korean text', async ({ page }) => {
  const targetText = '새 미션 2동아리 준비물 확인하기';

  page.on('pageerror', (error) => {
    throw error;
  });

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.localStorage.setItem('school-timer-entry-number-v1', '0');
  });
  await page.reload({ waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /설정/ }).first().click();
  await page.getByRole('button', { name: '경매' }).click();

  const addMission = page.getByRole('button', { name: /미션 추가/ });
  await expect(addMission).toBeVisible();
  await addMission.click();

  const input = page.getByLabel(/미션 \d+ 내용/).last();
  await expect(input).toBeVisible();
  await input.click();
  await input.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await input.type(targetText, { delay: 35 });
  await expect(input).toHaveValue(targetText);

  await page.waitForTimeout(1200);
  await expect(input).toHaveValue(targetText);
  await input.blur();
  await page.waitForTimeout(900);
  await expect(input).toHaveValue(targetText);
  await page.screenshot({ path: '.omo/evidence/mission-feature/mission-input-qa.png', fullPage: true });
});
