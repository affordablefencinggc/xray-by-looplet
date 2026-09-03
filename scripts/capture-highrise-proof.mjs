import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });

  // Select 16 storeys highrise
  const selects = await page.locator("select").all();
  for (const s of selects) {
    const text = await s.innerText();
    if (text.includes("Storey") || text.includes("Highrise")) {
      await s.selectOption("16");
      break;
    }
  }

  // Click Stand 3D
  const standBtn = page.locator("button:has-text('Stand 3D')");
  if ((await standBtn.count()) > 0) {
    await standBtn.click();
  }

  // Set Isometric camera
  const isoBtn = page.locator("button:has-text('Isometric')");
  if ((await isoBtn.count()) > 0) {
    await isoBtn.click();
  }

  await page.waitForTimeout(1200);

  await page.screenshot({ path: "screenshots/highrise-wireframe-proof.png" });
  console.log("Screenshot successfully saved to screenshots/highrise-wireframe-proof.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
