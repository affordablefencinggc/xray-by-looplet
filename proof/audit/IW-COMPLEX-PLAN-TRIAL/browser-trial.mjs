import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { chromium } from "playwright";

const source = resolve("downloads/high_rise_plans/03_Seattle_Altitude_Hotel_and_Residences_50Story_Tower.pdf");
const inspection = JSON.parse(readFileSync("proof/audit/IW-COMPLEX-PLAN-TRIAL/plan-inspection.json", "utf8"));
const url = process.argv[2] ?? "http://127.0.0.1:8081/";
assert.ok(["http://127.0.0.1:8080/", "http://127.0.0.1:8081/"].includes(url));
const isDev = url.includes(":8080/");
const screenshotDir = resolve("screenshots/complex-plan-trial", isDev ? "dev" : ".");
mkdirSync(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1600, height: 1050 } });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const report = { source, classification: inspection.classification, pages: inspection.pages, bytes: inspection.bytes, sha256: inspection.sha256, url, checks: [], screenshots: [], errors: [], materialStorage: {
  basis: "packed/stacked dimensions; aisle/handling allowance separate",
  totalStorageM3: null, totalSpecifiedWeightKg: null,
  reason: "No real stock/material schedule is linked to this drawing. Demonstration inventory is excluded.",
  required: ["material quantities", "units per package and package dimensions", "specified unit or package weights where available"],
} };
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (e) => { if (e.type() === "error") report.errors.push(e.text()); });
async function shot(name) {
  const path = resolve(screenshotDir, `${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  report.screenshots.push(path);
}
async function ready() {
  await page.waitForFunction(() => !document.querySelector(".workbench-loading"));
}
async function planReady() {
  await page.locator('.document-preview[data-source-ready="true"]').waitFor({ timeout: 60000 });
}
async function savedJob() {
  return page.evaluate(() => JSON.parse(localStorage.getItem("xray:fencing-job:v2")));
}
try {
  await page.goto(report.url, { waitUntil: "domcontentloaded" });
  await ready();
  const started = performance.now();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open plan", exact: true }).first().click();
  await (await chooserPromise).setFiles(source);
  await planReady();
  report.importAndFirstRenderMs = Math.round(performance.now() - started);
  const job = await savedJob();
  const doc = job.documents.find((d) => d.id === job.activeDocumentId);
  assert.equal(doc.name, basename(source));
  assert.equal(doc.pageCount, inspection.pages);
  assert.equal(doc.sha256, inspection.sha256);
  assert.equal(await page.getByRole("button", { name: /^Open source page / }).count(), 58);
  report.documentId = doc.id;
  report.checks.push("Actual file-picker import: 58 pages and SHA-256 match the original 20.5 MB file");
  await shot("01-imported-cover");

  report.navigation = [];
  for (const number of [42, 44, 48, 50, 53, 58]) {
    const start = performance.now();
    await page.getByRole("button", { name: `Open source page ${number}`, exact: true }).click();
    await planReady();
    assert.equal((await savedJob()).activeSheet, number - 1);
    const image = await page.locator("img.document-source-page").evaluate((img) => ({ width: img.naturalWidth, height: img.naturalHeight, complete: img.complete }));
    assert.ok(image.complete && image.width > 500 && image.height > 500);
    report.navigation.push({ page: number, renderMs: Math.round(performance.now() - start), image });
    if ([44, 48, 50].includes(number)) await shot(`page-${number}`);
  }
  report.checks.push("Navigated/rendered six distant pages: parking, ground-floor layout, typical residential, hotel, rooftop and shadow study");
  await page.getByRole("button", { name: "Open source page 48", exact: true }).click();
  await planReady();
  await page.getByRole("button", { name: "Fit sheet", exact: true }).click();
  await shot("residential-plan-fitted");

  await page.getByRole("button", { name: "Components", exact: true }).click();
  await page.locator(".components-workspace").waitFor();
  assert.equal(await page.getByText("Demonstration Dataset", { exact: true }).count(), 1);
  const invKey = `xray:component-inventory:v1:${encodeURIComponent(job.id)}`;
  const inventory = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), invKey);
  assert.equal(inventory.instances.length, 60);
  assert.equal(inventory.instances.filter((i) => i.parentAssemblyInstanceId !== null).length, 48);
  assert.ok(inventory.evidence.every((e) => e.documentId !== doc.id));
  report.checks.push("Capability boundary confirmed: importing the real tower does not extract components; 12 connections/48 bolts remain explicitly labelled demo data and refer to another document");
  await shot("components-remain-demonstration");

  await page.getByRole("button", { name: "Sheets", exact: true }).click();
  await planReady();
  const reloadStart = performance.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready();
  await planReady();
  const restored = await savedJob();
  assert.equal(restored.activeDocumentId, doc.id);
  assert.equal(restored.activeSheet, 47);
  assert.equal(restored.documents.find((d) => d.id === doc.id).sha256, inspection.sha256);
  report.reloadAndRenderMs = Math.round(performance.now() - reloadStart);
  report.checks.push("Full reload restored original drawing bytes, document identity/hash and selected page 48");

  await page.setViewportSize({ width: 390, height: 844 });
  await planReady();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await shot("mobile-residential-plan");
  report.checks.push("Mobile: actual high-rise drawing renders without horizontal document overflow");

  await page.setViewportSize({ width: 1600, height: 1050 });
  const oversized = resolve("artifacts/research/construction-platforms-2026-09-05/DGS-24-235656-main-construction-plans.pdf");
  const tooLargeChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open plan", exact: true }).first().click();
  await (await tooLargeChooser).setFiles(oversized);
  await page.getByText(/larger than the 100 MB plan limit/).first().waitFor();
  assert.equal((await savedJob()).activeDocumentId, doc.id);
  report.checks.push("425-page / 308.6 MB DGS construction set rejected by the 100 MB limit; the already-open tower drawing remains intact");
  await shot("large-set-limit");
  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.failure = error.stack;
  report.body = await page.locator("body").innerText().catch(() => "unavailable");
  await shot("failure").catch(() => {});
  process.exitCode = 1;
} finally {
  writeFileSync(`proof/audit/IW-COMPLEX-PLAN-TRIAL/${isDev ? "dev-results" : "results"}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
