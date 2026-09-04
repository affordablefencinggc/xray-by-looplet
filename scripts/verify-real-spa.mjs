import { chromium } from "playwright";
import path from "node:path";

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const distHtml = "file:///" + path.resolve("dist/index.html").replace(/\\/g, "/");
  console.log("Testing compiled SPA dist/index.html:", distHtml);

  await page.goto(distHtml, { waitUntil: "networkidle" });

  const title = await page.title();
  console.log("Page Title:", title);

  const buttons = await page.locator("button").allInnerTexts();
  console.log("Buttons found:", buttons.filter((b) => b.trim().length > 0).slice(0, 10));

  // Click Measure
  const measureBtn = page.locator("button:has-text('Measure')");
  if ((await measureBtn.count()) > 0) {
    await measureBtn.click();
    console.log("Clicked Measure tab successfully!");
  }

  await page.waitForTimeout(800);

  // Click Model
  const modelBtn = page.locator("button:has-text('Model')");
  if ((await modelBtn.count()) > 0) {
    await modelBtn.click();
    console.log("Clicked Model tab successfully!");
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: "screenshots/real-spa-verified.png" });
  console.log("Saved screenshots/real-spa-verified.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
