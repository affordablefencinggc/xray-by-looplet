#!/usr/bin/env node
/** Restored ten-pane interaction audit. Runs only inside an isolated browser context. */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const timeout = Number(process.env.CURRENT_FLOW_AUDIT_TIMEOUT_MS || 60_000);
const root = process.platform === "win32" ? resolve(process.cwd(), "screenshots") : "/workspace/screenshots";
const target = new URL(url).port === "8081" ? "built" : "dev";
const prefix = `current-flow-${target}`;
const verdictPath = join(root, target === "dev" ? "current-flow-audit.json" : "current-flow-built-audit.json");
const shots = Object.fromEntries(["sheets", "calibration", "trace", "specifications", "photos", "review-approved", "review-invalidated", "reload", "mobile-measure", "mobile-proof", "failure"].map((name) => [name, join(root, `${prefix}-${name}.png`)]));
const planFixture = resolve(process.cwd(), "engine", "fixtures", "svg", "sample-plan.svg");
const photos = [resolve(process.cwd(), "public", "og.jpg"), resolve(process.cwd(), "public", "icon-512.png")];
const PANES = ["Overview", "Sheets", "Measure", "Sketch", "Components", "Model", "Render", "Review", "Cost", "Proof"];
mkdirSync(root, { recursive: true });

function ok(value, message) { if (!value) throw new Error(message); }
function observe(page, errors, name) {
  page.on("console", (msg) => { if (msg.type() === "error") errors.push({ page: name, kind: "console", message: msg.text() }); });
  page.on("pageerror", (error) => errors.push({ page: name, kind: "pageerror", message: String(error?.message || error) }));
}
async function launch() {
  const options = { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] };
  if (process.platform === "win32") {
    try { return { browser: await chromium.launch({ ...options, channel: "msedge" }), mode: "msedge" }; }
    catch (edge) {
      try { return { browser: await chromium.launch(options), mode: "bundled-chromium" }; }
      catch (bundled) { throw new Error(`Browser launch failed: ${edge.message}; ${bundled.message}`); }
    }
  }
  return { browser: await chromium.launch(options), mode: "bundled-chromium" };
}
async function open(page) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  ok(response?.ok(), `Navigation returned HTTP ${response?.status() ?? 0}`);
  const nav = page.locator('nav[aria-label="Panes"]');
  await nav.waitFor({ state: "visible", timeout });
  await page.locator('[data-hydration-status="ready"]').waitFor({ state: "attached", timeout });
  const panes = (await nav.locator("button").allTextContents()).map((text) => text.trim()).filter(Boolean);
  ok(JSON.stringify(panes) === JSON.stringify(PANES), `Ten-pane contract drifted: ${panes.join(", ")}`);
}
async function pane(page, name) {
  const button = page.locator('nav[aria-label="Panes"] button').filter({ hasText: new RegExp(`^${name}$`) });
  ok((await button.count()) === 1, `Pane ${name} is missing or duplicated`);
  await button.click();
  await page.waitForFunction((wanted) => document.querySelector('nav[aria-label="Panes"] button.active')?.textContent?.trim() === wanted, name, { timeout });
}
async function reset(page) {
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear();
    await Promise.all(["xray-plan-content-v1", "xray-photo-content-v1"].map((name) => new Promise((done) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = request.onerror = request.onblocked = () => done();
    })));
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout });
  await page.locator('[data-hydration-status="ready"]').waitFor({ state: "attached", timeout });
}
async function choose(control, wanted) {
  const options = await control.locator("option").allTextContents();
  const label = options.find((option) => option.trim().toLowerCase() === wanted.toLowerCase());
  ok(label, `Option ${wanted} unavailable; found ${options.join(", ")}`);
  await control.selectOption({ label });
}
async function screenshot(page, name) { await page.screenshot({ path: shots[name], fullPage: false, animations: "disabled" }); }

async function importPlan(page) {
  ok(existsSync(planFixture), `Missing fixture ${planFixture}`);
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 3_000 }).catch(() => null);
  await page.getByRole("button", { name: /Open plan/i }).first().click();
  const chooser = await chooserPromise;
  if (chooser) await chooser.setFiles(planFixture);
  else await page.locator('input[type="file"][accept*="pdf"]').last().setInputFiles(planFixture);
  await pane(page, "Sheets");
  await page.getByRole("img", { name: "sample-plan.svg source plan" }).waitFor({ state: "visible", timeout });
  const metadata = page.locator(".source-metadata");
  const text = await metadata.innerText();
  ok(/Pages\s*1\b/i.test(text), `Wrong SVG page metadata: ${text}`);
  const sha256 = (await metadata.locator("dd").nth(2).innerText()).trim();
  ok(/^[a-f0-9]{64}$/i.test(sha256), `No full SHA-256: ${sha256}`);
  await screenshot(page, "sheets");
  return { name: "sample-plan.svg", pages: 1, sha256 };
}
async function calibrate(page) {
  await pane(page, "Measure");
  const panel = page.locator(".calibration-panel");
  await panel.getByLabel("Known distance").fill("5");
  await panel.getByRole("button", { name: "Pick two points" }).click();
  const canvas = page.getByLabel("Select calibration points on plan");
  const box = await canvas.boundingBox();
  ok(box && box.width >= 300 && box.height >= 220, "Calibration canvas is not usable");
  const y = Math.round(box.height * 0.55);
  await canvas.click({ position: { x: Math.round(box.width * 0.3), y } });
  await canvas.click({ position: { x: Math.round(box.width * 0.7), y } });
  await panel.locator('.calibration-candidates input[type="radio"]:checked').waitFor({ state: "attached", timeout });
  await panel.getByRole("button", { name: "Lock scale" }).click();
  await panel.getByText("Locked", { exact: true }).waitFor({ state: "visible", timeout });
  const run = page.locator('[aria-label="Measurement tools"] button').filter({ hasText: /^Run/ });
  ok(!(await run.isDisabled()), "Run stayed disabled after scale lock");
  const scale = await panel.locator(".calibration-locked-scale strong").innerText();
  await screenshot(page, "calibration");
  return { locked: true, scale };
}
async function createRun(page) {
  const run = page.locator('[aria-label="Measurement tools"] button').filter({ hasText: /^Run/ });
  await run.click(); ok((await run.getAttribute("aria-pressed")) === "true", "Run tool did not activate");
  const canvas = page.getByLabel("Plan drawing canvas");
  const box = await canvas.boundingBox(); ok(box && box.width >= 300 && box.height >= 220, "Trace canvas is not usable");
  const y = Math.round(box.height * 0.55);
  for (const ratio of [0.3, 0.5, 0.7]) await canvas.click({ position: { x: Math.round(box.width * ratio), y } });
  await page.getByRole("button", { name: "Finish trace" }).click();
  const editor = page.locator(".trace-editor-panel");
  await editor.getByRole("heading", { name: /Run 0?1/ }).waitFor({ state: "visible", timeout });
  const summary = await editor.locator(".trace-length-summary").innerText();
  ok(/Gross\s*5\.00 m/i.test(summary), `Expected 5.00 m run: ${summary}`);
  return editor;
}
async function vertexHistory(page) {
  const panel = page.locator(".trace-editor-panel");
  const revision = async () => Number.parseInt((await panel.locator(".trace-revision").first().innerText()).replace(/\D/g, ""), 10);
  const before = await revision();
  await panel.getByLabel("Vertex").selectOption("1");
  await panel.getByRole("button", { name: "Insert after" }).click();
  const inserted = await revision(); ok(inserted === before + 1, "Insert did not increment run revision");
  await panel.getByRole("button", { name: "Remove vertex" }).click();
  const removed = await revision(); ok(removed === inserted + 1, "Remove did not increment run revision");
  await panel.getByRole("button", { name: "Undo last trace edit" }).click();
  await panel.getByRole("button", { name: "Redo trace edit" }).click();
  return { before, inserted, removed, undo: true, redo: true };
}
async function specifyRun(page) {
  const p = page.locator(".specification-panel");
  await choose(p.getByLabel("Fence system"), "Colorbond");
  await p.getByLabel("Profile / product").fill("Good Neighbour");
  await p.getByLabel("Height (m)").fill("1.8");
  await p.getByLabel("Bay width (m)").fill("2.4");
  await choose(p.getByLabel("Ground"), "Concrete");
  await choose(p.getByLabel("Slope"), "Level");
  await choose(p.getByLabel("Access"), "Restricted");
  await choose(p.getByLabel("Sleepers"), "Concrete");
  const removal = p.locator("details").filter({ hasText: "Existing fence removal" });
  await removal.locator("summary").click();
  await removal.getByRole("checkbox", { name: /Removal required/i }).check();
  await removal.getByLabel("Removal material").fill("Timber paling");
  await removal.getByLabel("Removal length (m)").fill("5");
  await removal.getByRole("checkbox", { name: /Disposal required/i }).check();
  const retaining = p.locator("details").filter({ hasText: /^Retaining/ });
  await retaining.locator("summary").click();
  await retaining.getByRole("checkbox", { name: /Retaining required/i }).check();
  await choose(retaining.getByLabel("Retaining type"), "Concrete sleeper");
  await retaining.getByLabel("Retaining height (m)").fill("0.4");
  await retaining.getByLabel("Retaining condition").fill("Existing low edge in sound condition");
  const corners = p.locator("details").filter({ hasText: "Corner treatments" });
  await corners.locator("summary").click();
  await choose(corners.getByLabel("Vertex 2 corner treatment"), "Boxed");
  await corners.getByLabel("Vertex 2 corner notes").fill("Box around existing pier");
  const posts = p.locator("details").filter({ hasText: "Post overrides" });
  await posts.locator("summary").click();
  const v2 = posts.locator(".post-override-row").filter({ hasText: "Vertex 2" });
  await v2.getByRole("button", { name: "Add post override" }).click();
  await v2.getByLabel("Vertex 2 post size").fill("100 x 100 SHS");
  await v2.getByLabel("Vertex 2 post length metres").fill("2.7");
  await v2.getByLabel("Vertex 2 embedment metres").fill("0.9");
  await v2.getByLabel("Vertex 2 post notes").fill("Deeper footing beside retaining edge");
  await p.getByLabel("Run notes").fill("Maintain stepped alignment along the rear boundary.");
  await screenshot(page, "specifications");
  return { system: "colorbond", profile: "Good Neighbour" };
}
async function createGate(page) {
  await page.locator('[aria-label="Measurement tools"] button').filter({ hasText: /^Gate/ }).click();
  const canvas = page.getByLabel("Plan drawing canvas"); const box = await canvas.boundingBox(); ok(box, "No gate canvas");
  // Click just outside the run hit-test radius. Gate placement then projects
  // the point onto the selected run, instead of treating it as a run-select.
  await canvas.click({ position: { x: Math.round(box.width * 0.5), y: Math.round(box.height * 0.55) + 28 } });
  const g = page.locator(".gate-editor");
  await g.getByRole("heading", { name: /Gate 0?1/ }).waitFor({ state: "visible", timeout });
  await g.getByLabel("Clear width (m)").fill("1.2");
  await choose(g.getByLabel("Gate type"), "Single");
  await g.getByLabel("Gate height (m)").fill("1.8");
  await g.getByLabel("Ground clearance (m)").fill("0.05");
  await choose(g.getByLabel("Opening direction"), "Inward"); await choose(g.getByLabel("Hinge side"), "Left");
  await g.getByLabel("Hardware").fill("Heavy-duty galvanised hinges"); await g.getByLabel("Latch").fill("Key-lockable D-latch");
  await g.getByLabel("Gate post size").fill("100 x 100 SHS"); await g.getByLabel("Finish").fill("Monument powder coat");
  await g.getByRole("checkbox", { name: /Motorised gate/i }).check(); await g.getByLabel("Gate notes").fill("Allow conduit route beside hinge post.");
  const summary = await page.locator(".trace-length-summary").innerText();
  ok(/Gate deduction\s*[−-]1\.20 m/i.test(summary) && /Net run\s*3\.80 m/i.test(summary), `Gate deduction failed: ${summary}`);
  await screenshot(page, "trace");
  return { width: "1.2", height: "1.8", net: "3.80 m" };
}
async function addPhotos(page) {
  for (const path of photos) ok(existsSync(path), `Missing photo fixture ${path}`);
  await pane(page, "Proof"); const p = page.locator(".photo-evidence-panel");
  await p.locator('input[type="file"]').setInputFiles(photos);
  await page.waitForFunction(() => document.querySelectorAll(".photo-evidence-card").length === 2, undefined, { timeout });
  const boundary = p.locator(".photo-evidence-card").filter({ hasText: "og.jpg" });
  const gate = p.locator(".photo-evidence-card").filter({ hasText: "icon-512.png" });
  await boundary.getByLabel("Caption").fill("Front boundary, access and existing fence condition");
  await boundary.getByRole("checkbox", { name: /Run 0?1/i }).check();
  await gate.getByLabel("Caption").fill("Gate opening and hinge-post location");
  await gate.getByRole("checkbox", { name: /Gate 0?1/i }).check();
  await gate.getByRole("button", { name: /Move icon-512\.png earlier/i }).click();
  const order = await p.locator(".photo-card-title strong").allTextContents();
  ok(order.join("|") === "icon-512.png|og.jpg", `Photo reorder failed: ${order}`);
  const ready = await p.locator(".photo-thumbnail img").evaluateAll((images) => images.length === 2 && images.every((image) => image.complete && image.naturalWidth > 0));
  ok(ready && (await p.getByText(/Hash pending/i).count()) === 0, "Photo originals/hashes not ready");
  await screenshot(page, "photos"); return { order, count: 2 };
}
async function approve(page) {
  await pane(page, "Review");
  await page.getByLabel("Reviewer").fill("SC-06D Auditor");
  await page.getByLabel("Decision note").fill("Originals, specifications, geometry and links checked.");
  const entities = page.locator(".review-entity-list article"); ok((await entities.count()) === 2, "Expected one run and one gate for review");
  for (const entity of await entities.all()) await entity.getByRole("button", { name: "Approve", exact: true }).click();
  const status = await entities.locator(".review-entity-select span").allTextContents();
  ok(status.every((text) => /approved$/i.test(text)), `Approval failed: ${status}`);
  await screenshot(page, "review-approved"); return status;
}
async function invalidate(page) {
  await pane(page, "Measure"); const p = page.locator(".specification-panel");
  const revision = async () => Number.parseInt((await p.locator(".trace-revision").innerText()).replace(/\D/g, ""), 10);
  const before = await revision(); await p.getByLabel("Run notes").fill("Approval invalidation audit mutation."); const after = await revision();
  ok(after === before + 1, "Approved run mutation did not increment revision");
  await pane(page, "Review");
  const run = await page.locator(".review-entity-list article").filter({ hasText: /Run 0?1/ }).locator(".review-entity-select span").innerText();
  const gate = await page.locator(".review-entity-list article").filter({ hasText: /Gate 0?1/ }).locator(".review-entity-select span").innerText();
  ok(/needs-review$/i.test(run), `Run approval not invalidated: ${run}`); ok(/approved$/i.test(gate), `Gate approval changed: ${gate}`);
  await screenshot(page, "review-invalidated"); return { before, after, run, gate };
}
async function jobRevision(page) {
  await pane(page, "Proof");
  const row = page.locator(".proof-summary > div").filter({ hasText: "Job revision" });
  const value = Number.parseInt(await row.locator("b").innerText(), 10); ok(Number.isInteger(value), "No numeric job revision"); return value;
}
async function reloadProof(page, expected) {
  await page.reload({ waitUntil: "domcontentloaded", timeout }); await page.locator('[data-hydration-status="ready"]').waitFor({ state: "attached", timeout });
  await pane(page, "Sheets"); await page.getByRole("img", { name: "sample-plan.svg source plan" }).waitFor({ state: "visible", timeout });
  ok((await page.locator(".source-metadata dd").nth(2).innerText()).trim() === expected.document.sha256, "Document hash changed after reload");
  // Pane selection is intentionally transient. Re-select the persisted run via
  // the Review UI before returning to its Measure inspector.
  await pane(page, "Review");
  await page.locator(".review-entity-list article").filter({ hasText: /Run 0?1/ }).locator(".review-entity-select").click();
  await pane(page, "Measure"); await page.locator(".calibration-panel").getByText("Locked", { exact: true }).waitFor({ state: "visible", timeout });
  const run = page.locator(".specification-panel");
  ok((await run.getByLabel("Fence system").inputValue()) === expected.run.system, "Run system did not persist");
  ok((await run.getByLabel("Profile / product").inputValue()) === expected.run.profile, "Run profile did not persist");
  ok((await run.getByLabel("Run notes").inputValue()) === "Approval invalidation audit mutation.", "Run mutation did not persist");
  const runRevision = Number.parseInt((await run.locator(".trace-revision").innerText()).replace(/\D/g, ""), 10);
  ok(runRevision === expected.invalidation.after, "Run revision changed on reload");
  await pane(page, "Proof"); const p = page.locator(".photo-evidence-panel");
  await page.waitForFunction(() => document.querySelectorAll(".photo-thumbnail img").length === 2, undefined, { timeout });
  const order = await p.locator(".photo-card-title strong").allTextContents(); ok(order.join("|") === expected.photos.order.join("|"), "Photo order did not persist");
  ok(await p.locator(".photo-evidence-card").filter({ hasText: "og.jpg" }).getByRole("checkbox", { name: /Run 0?1/i }).isChecked(), "Run-photo link did not persist");
  ok(await p.locator(".photo-evidence-card").filter({ hasText: "icon-512.png" }).getByRole("checkbox", { name: /Gate 0?1/i }).isChecked(), "Gate-photo link did not persist");
  ok((await jobRevision(page)) === expected.jobRevision, "Job revision changed on reload");
  await screenshot(page, "reload");
  return { documentBytes: true, documentHash: true, calibration: true, runSpec: true, runRevision, photoBytes: true, photoHashes: true, photoLinks: true, photoOrder: true, jobRevision: expected.jobRevision };
}
async function updateRemovePhoto(page) {
  await pane(page, "Proof"); const p = page.locator(".photo-evidence-panel");
  await p.locator(".photo-evidence-card").filter({ hasText: "og.jpg" }).getByLabel("Caption").fill("Updated after reload: front boundary evidence retained");
  await p.locator(".photo-evidence-card").filter({ hasText: "icon-512.png" }).getByRole("button", { name: /Remove icon-512\.png/i }).click();
  await page.waitForFunction(() => document.querySelectorAll(".photo-evidence-card").length === 1, undefined, { timeout });
  await page.reload({ waitUntil: "domcontentloaded", timeout }); await page.locator('[data-hydration-status="ready"]').waitFor({ state: "attached", timeout }); await pane(page, "Proof");
  const cards = page.locator(".photo-evidence-card"); ok((await cards.count()) === 1, "Removed photo returned after reload");
  ok((await cards.getByLabel("Caption").inputValue()).startsWith("Updated after reload"), "Updated caption did not persist");
  return { updated: true, removed: true, remaining: "og.jpg", removalPersisted: true };
}
async function noOverflow(page, label) {
  const result = await page.evaluate(() => ({ document: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, body: document.body.scrollWidth > document.body.clientWidth + 1 }));
  ok(!result.document && !result.body, `${label} has horizontal overflow`); return result;
}
async function mobileProof(context, errors) {
  const page = await context.newPage(); observe(page, errors, `${target}-mobile`); await page.setViewportSize({ width: 390, height: 844 }); await open(page);
  await pane(page, "Measure"); await page.locator(".calibration-panel").getByText("Locked", { exact: true }).waitFor({ state: "visible", timeout });
  const measure = await noOverflow(page, "Mobile Measure");
  const toolbar = await page.locator(".measure-document-preview .canvas-toolbar").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const stage = element.parentElement?.getBoundingClientRect();
    return { leftInset: Math.round(rect.left - (stage?.left ?? 0)), rightInset: Math.round((stage?.right ?? 0) - rect.right), width: Math.round(rect.width), stageWidth: Math.round(stage?.width ?? 0) };
  });
  ok(toolbar.leftInset >= 0 && toolbar.rightInset >= 0 && toolbar.width <= toolbar.stageWidth, `Mobile canvas toolbar is clipped: ${JSON.stringify(toolbar)}`);
  measure.toolbar = toolbar; await screenshot(page, "mobile-measure");
  await pane(page, "Proof"); await page.locator(".photo-evidence-card").waitFor({ state: "visible", timeout });
  const proof = await noOverflow(page, "Mobile Proof"); await screenshot(page, "mobile-proof"); await page.close(); return { measure, proof };
}

let browser, context, desktop; const errors = [], checks = {}, blocked = []; let launchMode = "unknown";
try {
  const launched = await launch(); browser = launched.browser; launchMode = launched.mode;
  context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: false }); desktop = await context.newPage(); observe(desktop, errors, `${target}-desktop`);
  await open(desktop); await reset(desktop);
  checks.document = await importPlan(desktop); checks.calibration = await calibrate(desktop); await createRun(desktop);
  checks.vertexHistory = await vertexHistory(desktop); checks.run = await specifyRun(desktop); checks.gate = await createGate(desktop);
  checks.photos = await addPhotos(desktop); checks.approvals = await approve(desktop); checks.invalidation = await invalidate(desktop);
  const revision = await jobRevision(desktop); checks.reload = await reloadProof(desktop, { ...checks, jobRevision: revision });
  checks.photoUpdateRemoval = await updateRemovePhoto(desktop); checks.desktopOverflow = await noOverflow(desktop, "Desktop workbench"); checks.mobile = await mobileProof(context, errors);
  blocked.push("Invalid/oversized imports, calibration conflicts, split/merge/delete, and corrupt-original recovery remain lower-level-test proof, not this happy path.");
  blocked.push("BOM, pricing, export/download, external handoff, sync, provider render, and installer controls were intentionally not activated.");
  ok(errors.length === 0, `Browser errors: ${JSON.stringify(errors)}`);
  const verdict = { ok: true, target, url, launchMode, checks, blocked, errors, screenshots: shots }; writeFileSync(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`); console.log(JSON.stringify(verdict, null, 2));
} catch (error) {
  const message = String(error?.stack || error?.message || error);
  try { if (desktop && !desktop.isClosed()) await screenshot(desktop, "failure"); } catch {}
  const verdict = { ok: false, target, url, launchMode, error: message, checks, blocked, errors, screenshots: shots }; writeFileSync(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`); console.error(JSON.stringify(verdict, null, 2)); process.exitCode = 1;
} finally { await context?.close().catch(() => undefined); await browser?.close().catch(() => undefined); }
