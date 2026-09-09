import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const requirementId = process.argv[3] ?? "X-RAY";
const outputDir = process.argv[4] ?? "screenshots";

await fs.mkdir(outputDir, { recursive: true });

const desktop = {
  name: "desktop",
  viewport: { width: 1280, height: 800 },
  hasTouch: false,
  isMobile: false,
  deviceScaleFactor: 1,
};

const ios = {
  name: "ios",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
};

const failures = [];
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === "win32" ? "msedge" : undefined),
  headless: true,
});

async function verifyViewport(config) {
  const context = await browser.newContext({
    viewport: config.viewport,
    hasTouch: config.hasTouch,
    isMobile: config.isMobile,
    deviceScaleFactor: config.deviceScaleFactor,
  });

  const page = await context.newPage();

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push({
        viewport: config.name,
        type: "console-error",
        text: message.text(),
      });
    }

    if (/hydration mismatch|hydration failed/i.test(message.text())) {
      failures.push({
        viewport: config.name,
        type: "hydration-warning",
        text: message.text(),
      });
    }
  });

  page.on("pageerror", (error) => {
    failures.push({
      viewport: config.name,
      type: "page-error",
      text: String(error),
    });
  });

  page.on("crash", () => {
    failures.push({
      viewport: config.name,
      type: "page-crash",
      text: "Browser page crashed",
    });
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const screenshotPath = path.join(
    outputDir,
    `${requirementId}-${config.name}-after.png`,
  );

  await page.screenshot({
    path: screenshotPath,
    fullPage: false,
  });

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );

  if (hasHorizontalOverflow) {
    failures.push({
      viewport: config.name,
      type: "horizontal-overflow",
      text: "documentElement.scrollWidth exceeds window.innerWidth",
    });
  }

  const undersizedControls = await page
    .locator("[data-xray-control]")
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label:
              element.getAttribute("aria-label") ??
              element.textContent?.trim() ??
              "unnamed-control",
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter(({ width, height }) => width < 44 || height < 44),
    )
    .catch(() => []);

  if (config.name === "ios" && undersizedControls.length > 0) {
    failures.push({
      viewport: config.name,
      type: "undersized-touch-target",
      text: JSON.stringify(undersizedControls),
    });
  }

  const control = page.locator("[data-xray-control]").first();

  if ((await control.count()) > 0) {
    await control.click({ force: true });
    await page.waitForTimeout(150);

    await page.screenshot({
      path: path.join(
        outputDir,
        `${requirementId}-${config.name}-interaction.png`,
      ),
      fullPage: false,
    });
  }

  await context.close();

  return {
    screenshotPath,
    hasHorizontalOverflow,
    undersizedControls,
  };
}

const result = {
  desktop: await verifyViewport(desktop),
  ios: await verifyViewport(ios),
  failures,
};

await browser.close();

console.log(JSON.stringify(result, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}
