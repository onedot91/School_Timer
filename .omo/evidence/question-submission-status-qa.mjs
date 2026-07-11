import { chromium } from '/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch({
  headless: true,
  executablePath:
    '/Users/ibyeonghyeon/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});

const viewports = [
  { label: 'mobile', width: 375, height: 812 },
  { label: 'tablet', width: 768, height: 900 },
  { label: 'desktop', width: 1280, height: 900 },
];

const results = [];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  const consoleMessages = [];
  const apiResponses = [];

  page.on('console', (message) => {
    consoleMessages.push(`${message.type()}: ${message.text()}`);
  });

  page.on('pageerror', (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  page.on('response', (response) => {
    if (response.url().includes('/api/question-submission-status')) {
      apiResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.setItem('school-timer-entry-number-v1', '0');
  });
  await page.reload({ waitUntil: 'networkidle' });

  await page.getByTitle('질문 제출 현황').click();
  await page.getByTitle('제출 현황 새로고침').waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForResponse(
    (response) => response.url().includes('/api/question-submission-status') && response.status() === 200,
    { timeout: 10_000 },
  );
  const firstApiResponseCount = apiResponses.length;
  await page.waitForTimeout(16_500);
  const autoRefreshApiResponseCount = apiResponses.length;

  const panelText = await page.locator('body').innerText();
  const hasRefreshButton = await page.getByTitle('제출 현황 새로고침').count();
  const screenshotPath = `.omo/evidence/question-submission-status-panel-${viewport.label}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  results.push({
    viewport,
    apiResponses,
    autoRefreshTriggered: autoRefreshApiResponseCount > firstApiResponseCount,
    hasPanelTitle: panelText.includes('질문 제출 현황'),
    hasPersonalSummary: panelText.includes('개인질문'),
    hasTopicSummary: panelText.includes('주제질문'),
    hasRefreshButton: hasRefreshButton > 0,
    hasStudentRows: panelText.includes('1') && panelText.includes('23'),
    consoleMessages,
    screenshotPath,
  });

  await page.close();
}

console.log(JSON.stringify(results, null, 2));

await browser.close();
