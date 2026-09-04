import { chromium } from "playwright";
import path from "node:path";
import http from "node:http";
import fs from "node:fs";

async function main() {
  const server = http.createServer((req, res) => {
    let file = path.join("dist", req.url === "/" ? "index.html" : req.url);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file);
      const mime =
        ext === ".js"
          ? "application/javascript"
          : ext === ".css"
          ? "text/css"
          : "text/html";
      res.writeHead(200, { "Content-Type": mime });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => server.listen(8099, resolve));
  console.log("Static test server listening on 8099");

  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:8099/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // 1. Capture WTC 1 Model view
  await page.screenshot({ path: "screenshots/wtc1-verified.png" });
  console.log("Saved screenshots/wtc1-verified.png");

  // 2. Click Render tab
  const renderTab = page.locator("button:has-text('Render')");
  if ((await renderTab.count()) > 0) {
    await renderTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "screenshots/render-studio-verified.png" });
    console.log("Saved screenshots/render-studio-verified.png");
  }

  // 3. Switch project preset to Fencing and go to Cost tab
  const projectSelect = page.locator("select").first();
  await projectSelect.selectOption("fencing");
  await page.waitForTimeout(500);

  const costTab = page.locator("button:has-text('Cost')");
  if ((await costTab.count()) > 0) {
    await costTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "screenshots/fencing-bom-verified.png" });
    console.log("Saved screenshots/fencing-bom-verified.png");
  }

  await browser.close();
  server.close();
  console.log("Verification complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
