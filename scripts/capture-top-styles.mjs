import { chromium } from 'playwright';
import path from 'node:path';

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await chromium.launch({ executablePath: edgePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const styles = [1, 2, 16, 21, 26, 46];
  for (const id of styles) {
    console.log(`Loading style ${id}...`);
    await page.goto(`http://127.0.0.1:5176/design-options.html?style=${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(1500);
    const outPath = path.resolve(`screenshots/design-gallery/style-${id}.png`);
    await page.screenshot({ path: outPath });
    console.log(`Saved style ${id} to ${outPath}`);
  }

  await browser.close();
}

main().catch(console.error);
