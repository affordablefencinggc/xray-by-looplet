import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createDefaultJob, parseFencingJob } from "../../../src/studio/domain.ts";
import { createSampleStructuralInventory, addComponentType, updateAssemblyRule, queryInventory } from "../../../src/studio/construction/inventory.ts";
import { inventoryStorageKey } from "../../../src/studio/construction/inventoryPersistence.ts";
import { FENCING_JOB_STORAGE_KEY } from "../../../src/studio/persistence.ts";

const url = process.argv[2] ?? "http://127.0.0.1:8080/";
const label = process.argv[3] ?? "dev";
assert.ok(["http://127.0.0.1:8080/", "http://127.0.0.1:8081/"].includes(url));
assert.ok(["dev", "built"].includes(label));
const out = resolve("screenshots/inventory-integrity");
mkdirSync(out, { recursive: true });
const job = parseFencingJob({ ...createDefaultJob(), id: "job-inventory-integrity-qa", name: "Inventory regression QA", documents: [], activeDocumentId: null, calibrations: [] });
const key = inventoryStorageKey(job.id);
let inventory = createSampleStructuralInventory();
const rule = inventory.assemblyRules[0];
const bolt = inventory.instances.find((i) => i.parentAssemblyInstanceId !== null);
inventory = { ...inventory, instances: inventory.instances.map((i) => i.id === bolt.id ? {
  ...i, displayMark: "QA custom anchor", revision: 3,
  review: { ...i.review, status: "verified", note: "M20 reviewed from section" },
} : i) };
const type = inventory.types.find((t) => t.id === bolt.typeId);
inventory = addComponentType(inventory, { ...type, id: "fastener/m24", standardName: "M24 Structural Bolt",
  nominalDimensions: { ...type.nominalDimensions, diameter: { value: 24, unit: "mm" } } });
const quotas = rule.childQuotas.map((q) => ({ ...q, typeId: "fastener/m24", unresolvedFields: ["embedment"] }));
inventory = updateAssemblyRule(inventory, rule.id, quotas, "QA rule editor");
inventory = updateAssemblyRule(inventory, rule.id, quotas.map((q) => ({ ...q, unresolvedFields: [] })), "QA rule editor");
assert.equal(queryInventory(inventory).unresolvedCount, 0);
const changedBolt = inventory.instances.find((i) => i.id === bolt.id);
assert.equal(changedBolt.revision, 5);
assert.equal(changedBolt.review.status, "stale_revision");

const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
const report = { url, label, checks: [], screenshots: [], errors: [] };
async function seededPage(width, height, payload) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(({ jobKey, job, key, payload }) => {
    if (!localStorage.getItem("inventory-qa-seeded")) {
      localStorage.setItem(jobKey, JSON.stringify(job));
      localStorage.setItem(key, payload);
      localStorage.setItem("inventory-qa-seeded", "1");
    }
  }, { jobKey: FENCING_JOB_STORAGE_KEY, job, key, payload });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (e) => { if (e.type() === "error") report.errors.push(e.text()); });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open plan", exact: true }).first().waitFor();
  await page.waitForFunction(() => !document.querySelector(".workbench-loading"));
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await page.locator(".components-workspace").waitFor();
  return { context, page };
}
async function screenshot(page, name) {
  const path = resolve(out, `${label}-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
}
try {
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    const { context, page } = await seededPage(width, height, JSON.stringify(inventory));
    await page.getByRole("button", { name: "fastener", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Collapse bolts", exact: true }).count(), 12);
    assert.equal(await page.locator(".components-workspace").getByText("M24 Structural Bolt", { exact: true }).count(), 48);
    assert.equal(await page.locator(".components-workspace").getByText("Detail Rule: 4× M24 Structural Bolt", { exact: true }).count(), 12);
    await page.getByPlaceholder("Search marks, types, grids...").fill("QA custom anchor");
    await page.locator(".components-workspace").getByText("QA custom anchor", { exact: true }).click();
    if (name === "desktop") {
      const inspector = page.getByRole("complementary", { name: "Component inspector" });
      await inspector.getByText("Needs re-review", { exact: true }).waitFor();
      await inspector.getByText("Rev 5", { exact: true }).waitFor();
      await inspector.getByText("Fully parameterized (0 RFIs)", { exact: true }).waitFor();
      assert.equal(await inspector.getByRole("button", { name: "Doc not imported", exact: true }).count(), 3);
      for (const button of await inspector.getByRole("button", { name: "Doc not imported", exact: true }).all()) assert.equal(await button.isDisabled(), true);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflow`);
    await screenshot(page, `${name}-components`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector(".workbench-loading"));
    await page.getByRole("button", { name: "Components", exact: true }).click();
    await page.locator(".components-workspace").waitFor();
    const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
    assert.deepEqual(persisted.instances.find((i) => i.id === bolt.id), changedBolt);
    report.checks.push(`${name}: fastener filter shows 48 bolts; custom mark, revised M24, resolved RFIs and stale approval survive reload; no overflow`);
    await context.close();
  }

  const future = JSON.stringify({ schema: "xray.component-inventory/v99", revision: 99, evidence: "preserve exactly" });
  const { context, page } = await seededPage(1440, 1000, future);
  await page.getByRole("button", { name: "Retry restore", exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry restore", exact: true }).click();
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), future);
  if (label === "dev") {
    const result = await page.evaluate(async () => {
      // Use the exact HMR URL imported by Studio, avoiding a second store module.
      const storeUrl = performance.getEntriesByType("resource").map((entry) => entry.name)
        .find((name) => new URL(name).pathname === "/src/studio/store.ts");
      if (!storeUrl) throw new Error("Studio's loaded store module was not found");
      const { useStudio } = await import(storeUrl);
      const { updateDisplayMark } = await import("/src/studio/construction/inventory.ts");
      const s = useStudio.getState();
      s.setComponentInventory(updateDisplayMark(s.componentInventory, "conn-c1-01", "Session-only edit"));
      return s.saveCurrentInventory();
    });
    assert.equal(result.reason, "recovery-required");
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), future);
    report.checks.push("dev browser: actual ordinary edit and explicit Save preserve newer-version bytes");
  }
  await screenshot(page, "recovery-protected");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector(".workbench-loading"));
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await page.getByRole("button", { name: "Retry restore", exact: true }).waitFor();
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), future);
  await page.getByRole("button", { name: "Reset to demo data", exact: true }).click();
  await page.getByRole("button", { name: "Retry restore", exact: true }).waitFor({ state: "hidden" });
  assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).schema, key), "xray.component-inventory/v1");
  report.checks.push("recovery: rejected restore and reload preserve exact bytes; explicit demo replacement succeeds and clears protection");
  await context.close();
  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.failure = error.stack;
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      report.bodyText = await page.locator("body").innerText();
      await screenshot(page, "failure");
    }
  }
  throw error;
} finally {
  writeFileSync(resolve(out, `${label}-report.json`), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}
