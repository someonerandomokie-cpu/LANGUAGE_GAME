const puppeteer = require('puppeteer');

(async () => {
  const baseUrl = process.env.SMOKE_URL || 'http://localhost:5178';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  const clickByText = async (text) => {
    await page.waitForXPath(`//button[normalize-space(.)='${text}']`);
    const [btn] = await page.$x(`//button[normalize-space(.)='${text}']`);
    if (!btn) throw new Error(`Button not found: ${text}`);
    await btn.click();
  };

  const clickTestId = async (testId) => {
    await page.waitForSelector(`[data-testid="${testId}"]`, { visible: true });
    await page.click(`[data-testid="${testId}"]`);
  };

  console.log('Opening app:', baseUrl);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  // Opening → Avatar
  await clickTestId('btn-begin');

  // Avatar: enter name and continue
  await page.waitForSelector('input[placeholder="Enter a name"]');
  await page.type('input[placeholder="Enter a name"]', 'Alex');
  await clickByText('Continue →');

  // Traits: continue
  await clickTestId('btn-traits-continue');

  // Genres: pick up to 3 and continue
  const genreButtons = ['Romance','Adventure','Mystery'];
  for (const g of genreButtons) {
    await clickByText(g);
  }
  await clickTestId('btn-genres-continue');

  // Language: choose Spanish
  await clickByText('Spanish');

  // Plot page: wait, then continue to story
  await page.waitForSelector('[data-testid="btn-plot-continue"]', { visible: true });
  await clickTestId('btn-plot-continue');

  // Home: start Episode 1
  await clickByText('Start Episode 1');

  // Animation: short dev delay, then lesson
  await page.waitForTimeout(1400);

  // Lesson → Quiz
  await clickTestId('btn-lesson-quiz');

  // Quiz: answer all questions correctly
  await page.waitForTimeout(500);
  const questions = await page.$$('div[style*="background: rgba(255, 255, 255, 0.1)"]');
  for (let i = 0; i < Math.min(5, questions.length); i++) {
    // Click first answer choice for each question (assumed correct for basic test)
    const choices = await page.$$('button[style*="background"]');
    if (choices[i * 4]) await choices[i * 4].click();
    await page.waitForTimeout(200);
  }

  // All answered & passed, click Continue →
  await page.waitForSelector('[data-testid="btn-quiz-continue"]', { visible: true });
  await clickTestId('btn-quiz-continue');

  // Wait for confetti period and transition to dialogue
  await page.waitForTimeout(3300);

  // Dialogue: verify we see episode/page label or a dialogue card
  await page.waitForXPath("//div[contains(., 'Episode')]");
  await page.waitForXPath("//div[contains(@style, 'background: #FFFFFF')]");

  console.log('Smoke test passed: reached dialogue after confetti.');
  await browser.close();
  process.exit(0);
})().catch(async (err) => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
