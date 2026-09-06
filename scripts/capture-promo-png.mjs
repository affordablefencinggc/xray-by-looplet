import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function capture() {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({
    viewport: { width: 1240, height: 1800 },
    deviceScaleFactor: 2
  });

  const filePath = 'file:///' + path.resolve('public/xray-promo-a4.html').replace(/\\/g, '/');
  console.log('Loading:', filePath);
  await page.goto(filePath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const element = await page.$('.a4-page');
  if (!element) {
    throw new Error('.a4-page element not found');
  }

  const outputPath = path.resolve('public/xray-promo-a4.png');
  await element.screenshot({ path: outputPath });
  console.log('Successfully saved PNG to:', outputPath);

  const artifactPath = 'C:/Users/danie/.gemini/antigravity-ide/brain/d74a3234-349b-4906-8533-ec109623013c/xray-promo-a4.png';
  await element.screenshot({ path: artifactPath });
  console.log('Successfully saved PNG to artifacts:', artifactPath);

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
