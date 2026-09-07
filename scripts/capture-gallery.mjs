import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await chromium.launch({ executablePath: edgePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1800 } });
  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:5176/design-options.html?page=1 ...');
  await page.goto('http://127.0.0.1:5176/design-options.html?page=1', { waitUntil: 'domcontentloaded' });

  // Wait for the first canvas to be scene-ready
  await page.waitForSelector('canvas[data-scene-ready="true"]', { timeout: 15000 });
  // Wait a moment for the visible cards on page 1 to complete rendering
  await page.waitForTimeout(2000);

  fs.mkdirSync('screenshots/design-gallery', { recursive: true });
  const outPath = path.resolve('screenshots/design-gallery/gallery-page1.png');
  await page.screenshot({ path: outPath, fullPage: true });
  console.log('Full page screenshot saved to:', outPath);

  // Extract info on designs
  const designs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('article[data-style]')).map(el => {
      const id = el.dataset.style;
      const title = el.querySelector('h2')?.textContent?.trim();
      const family = el.querySelector('small')?.textContent?.trim();
      const desc = el.querySelector('p')?.textContent?.trim();
      return { id, title, family, desc };
    });
  });

  console.log('Designs on page 1:', JSON.stringify(designs, null, 2));
  await browser.close();
}

main().catch(console.error);
