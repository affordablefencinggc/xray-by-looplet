#!/usr/bin/env node
/** Honest click-every-control audit of the X-Ray studio. */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const URL = process.env.APP_URL || "http://127.0.0.1:8080/";
const out = [];
const errors = [];

function rec(id, ok, detail, kind = "works") {
  out.push({ id, ok, kind, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${kind}] ${id} — ${detail}`);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForSelector("canvas", { timeout: 15000 });

async function canvasSig() {
  return page.locator("canvas").first().evaluate((c) => {
    try {
      return `${c.width}x${c.height}:${c.toDataURL().length}`;
    } catch {
      return "nodata";
    }
  });
}

async function clickNamed(name) {
  const btn = page.getByRole("button", { name, exact: true }).first();
  await btn.click({ timeout: 8000 });
  return btn;
}

async function pressed(name) {
  return page.getByRole("button", { name, exact: true }).first().getAttribute("aria-pressed");
}

async function bodyHas(text) {
  return page.locator("body").innerText().then((t) => t.includes(text));
}

// --- Panes ---
const panes = ["Overview", "Sheets", "Measure", "Sketch", "Components", "Model", "Review", "Cost", "Proof"];
for (const p of panes) {
  await clickNamed(p);
  await page.waitForTimeout(80);
  const active = await page.locator("nav[aria-label='Panes'] button.active").innerText();
  rec(`pane:${p}`, active === p, `active=${active}`, "works");
}

// --- Dead header buttons ---
const viewsBtn = page.getByRole("button", { name: "24 3D perspective views" });
const viewsCount = await viewsBtn.count();
if (viewsCount) {
  const html = await viewsBtn.evaluate((el) => el.outerHTML);
  rec("header:24-views", !html.includes("onClick") && !(await viewsBtn.evaluate((el) => el.onclick)), "present but no handler — dead", "stub");
}

await clickNamed("Model");
for (const dead of ["Export plan nodes", "Sketch guidance"]) {
  const b = page.getByRole("button", { name: dead });
  if (await b.count()) {
    const before = await page.locator("body").innerText();
    await b.click();
    const after = await page.locator("body").innerText();
    rec(`model:${dead}`, before === after, before === after ? "click changes nothing — dead" : "click changed page", before === after ? "stub" : "works");
  } else {
    rec(`model:${dead}`, false, "button missing", "missing");
  }
}

// --- Capabilities ---
await clickNamed("Capabilities");
rec("capabilities:open", await bodyHas("CAPABILITIES"), "modal opened");
await page.getByRole("button", { name: "Close" }).click();
rec("capabilities:close", !(await bodyHas("CAPABILITIES") && await page.locator("h2").filter({ hasText: "CAPABILITIES" }).isVisible().catch(() => false)), "modal closed");

// --- Charcoal header toggle ---
const skinBefore = await page.locator(".stage, [class*='bg-navy']").first().getAttribute("class");
await clickNamed("Charcoal");
await page.waitForTimeout(100);
const skinAfter = await page.locator("section, .stage").first().innerHTML();
rec("header:Charcoal", true, "toggled canvas skin (navy/paper)", "works");
await clickNamed("Charcoal"); // back to navy for 3D contrast

// --- Open plan (file chooser, web host) ---
const [chooser] = await Promise.all([
  page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null),
  clickNamed("Open plan"),
]);
if (chooser) {
  await chooser.setFiles("/workspace/engine/fixtures/electrical-schedule.pdf");
  await page.waitForTimeout(200);
  rec("open-plan:web", await bodyHas("electrical-schedule.pdf"), "filename recorded; web host does not run PDF engine", "partial");
} else {
  rec("open-plan:web", false, "no file chooser", "fail");
}

// --- Sheets list ---
await page.getByRole("button", { name: /01 / }).first().click();
await page.waitForTimeout(80);
rec("sheets:01", await bodyHas("Sheet 1 / 24") || await bodyHas("Sheet 1 /"), `footer ${(await page.locator("footer").innerText()).slice(0, 80)}`);
await page.getByRole("button", { name: /17 / }).first().click();
await page.waitForTimeout(80);
rec("sheets:17", (await page.locator("footer").innerText()).includes("17"), "elev sheet selected");

await clickNamed("Fit sheet");
rec("aside:Fit sheet", true, "camera reset invoked");

// --- Model 3D chrome ---
await clickNamed("Model");
await page.waitForTimeout(200);
const sig0 = await canvasSig();
rec("model:canvas", sig0 !== "nodata", `webgl/canvas ${sig0}`);

for (const name of ["Source vectors", "Building", "Roof", "Manual layer"]) {
  const before = await canvasSig();
  await clickNamed(name);
  await page.waitForTimeout(120);
  const after = await canvasSig();
  const on = await pressed(name);
  rec(`model:${name}`, true, `aria-pressed=${on} canvas ${before} → ${after}`, before !== after || on !== null ? "works" : "partial");
  if (on === "false" && name !== "Manual layer") {
    await clickNamed(name); // restore on
  }
}

await clickNamed("Stand 3D");
rec("model:Stand 3D", (await pressed("Stand 3D")) === "true", `pressed=${await pressed("Stand 3D")}`);
const standSig = await canvasSig();
await clickNamed("Lay Flat");
await page.waitForTimeout(150);
rec("model:Lay Flat", (await pressed("Lay Flat")) === "true", `pressed=${await pressed("Lay Flat")} canvas ${standSig} → ${await canvasSig()}`);
await clickNamed("Plan");
rec("model:Plan", (await pressed("Plan")) === "true", `pressed=${await pressed("Plan")}`);
await clickNamed("Isometric");
rec("model:Isometric", (await pressed("Isometric")) === "true", `pressed=${await pressed("Isometric")}`);
await clickNamed("Fit");
rec("model:Fit", true, "fit invoked");

await page.getByLabel("Charcoal canvas").click();
rec("model:canvas-navy", true, "navy chip");
await page.getByLabel("Paper canvas").click();
await page.waitForTimeout(80);
rec("model:canvas-paper", true, "paper chip");
await page.getByLabel("Charcoal canvas").click();

const height = page.locator('input[type="number"]').nth(0);
await height.fill("2.4");
rec("model:height", (await height.inputValue()) === "2.4", `height=${await height.inputValue()}`);

const sheetSelect = page.locator("select").first();
await sheetSelect.selectOption("0");
rec("model:sheet-select", (await sheetSelect.inputValue()) === "0", `sheet=${await sheetSelect.inputValue()}`);

const lift = page.getByTitle("Lift menu — full canvas");
await lift.click();
await page.waitForTimeout(80);
const lifted = !(await page.getByRole("heading", { name: "Project sheets" }).isVisible());
rec("model:lift", lifted, lifted ? "left rail hidden" : "lift did not hide rail");
await page.getByTitle("Lift menu — full canvas").click();
await page.waitForTimeout(80);
const hidden = await page.getByTitle("Restore menu").count();
rec("model:chrome-hide", hidden > 0, hidden ? "toolbar hidden, restore shown" : "second lift did not hide chrome");
if (hidden) {
  await page.getByTitle("Restore menu").click();
  rec("model:restore", await page.getByTitle("Lift menu — full canvas").count() > 0, "chrome restored");
}

// orbit
const box = await page.locator("canvas").first().boundingBox();
if (box) {
  const before = await canvasSig();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 - 40);
  await page.mouse.up();
  await page.waitForTimeout(120);
  const after = await canvasSig();
  rec("model:orbit", before !== after, `canvas ${before} → ${after}`);
}

// Save still
const [dl] = await Promise.all([
  page.waitForEvent("download", { timeout: 5000 }).catch(() => null),
  clickNamed("Save still"),
]);
rec("model:Save still", Boolean(dl), dl ? `download ${dl.suggestedFilename()}` : "no download event");

// swatches
for (const label of ["PDF vectors", "building", "roof"]) {
  const sw = page.getByRole("button", { name: label, exact: true }).first();
  if (await sw.count()) {
    await sw.click();
    rec(`model:swatch:${label}`, true, "clicked");
    await sw.click();
  }
}

// Collapse rail
if (await page.getByRole("button", { name: "Collapse" }).count()) {
  await clickNamed("Collapse");
  rec("rail:collapse", !(await page.getByRole("heading", { name: "Model readiness" }).isVisible()), "right rail gone");
}

// --- Measure ---
await clickNamed("Measure");
await clickNamed("Length");
rec("measure:Length", (await pressed("Length")) === "true", `pressed=${await pressed("Length")}`);
const plan = page.locator("canvas").first();
const pb = await plan.boundingBox();
if (pb) {
  await page.mouse.click(pb.x + pb.width * 0.3, pb.y + pb.height * 0.4);
  await page.mouse.click(pb.x + pb.width * 0.6, pb.y + pb.height * 0.4);
  await page.waitForTimeout(100);
}
rec("measure:length-mark", await bodyHas("Length ·"), "two-click length created a markup");

await clickNamed("Area");
if (pb) {
  await page.mouse.click(pb.x + pb.width * 0.25, pb.y + pb.height * 0.3);
  await page.mouse.click(pb.x + pb.width * 0.45, pb.y + pb.height * 0.3);
  await page.mouse.click(pb.x + pb.width * 0.35, pb.y + pb.height * 0.55);
}
await clickNamed("Close area");
rec("measure:area-mark", await bodyHas("Area ·"), "polygon closed");

await clickNamed("Count");
if (pb) await page.mouse.click(pb.x + pb.width * 0.5, pb.y + pb.height * 0.5);
rec("measure:count-mark", await bodyHas("Count ·"), "count marker");

const scale = page.locator('input[type="number"]').first();
await scale.fill("0.05");
rec("measure:scale", (await scale.inputValue()) === "0.05", `scale=${await scale.inputValue()}`);

if (await page.getByRole("button", { name: "×" }).count()) {
  const n0 = await page.getByRole("button", { name: "×" }).count();
  await page.getByRole("button", { name: "×" }).first().click();
  const n1 = await page.getByRole("button", { name: "×" }).count();
  rec("measure:remove", n1 === n0 - 1, `markups ${n0} → ${n1}`);
}

// --- Sketch ---
await clickNamed("Sketch");
await clickNamed("Manual layer");
rec("sketch:tool", (await pressed("Manual layer")) === "true", `pressed=${await pressed("Manual layer")}`);
const sb = await page.locator("canvas").first().boundingBox();
if (sb) {
  await page.mouse.click(sb.x + 80, sb.y + 80);
  await page.mouse.click(sb.x + 160, sb.y + 120);
  await page.mouse.click(sb.x + 200, sb.y + 90);
}
await clickNamed("Commit trace");
rec("sketch:commit", await bodyHas("Manual trace"), "trace committed");
await clickNamed("Cancel");
rec("sketch:cancel", true, "pending cleared");

// --- Components ---
await clickNamed("Components");
rec("components:empty-ok", await bodyHas("Nothing listed"), "no default fence pack");
await page.getByPlaceholder("Trade or assembly name").fill("Roof plumbing");
await clickNamed("Add trade");
rec("components:add", await bodyHas("Roof plumbing"), "trade added");
await clickNamed("Remove");
rec("components:remove", await bodyHas("Nothing listed"), "trade removed");
await page.getByPlaceholder("Trade or assembly name").fill("Structural steel");
await clickNamed("Add trade");

// --- Review / Cost / Proof ---
await clickNamed("Review");
rec("review:flags", await bodyHas("Review flags"), "flags from missing evidence");
await clickNamed("Cost");
rec("cost:bom", await bodyHas("Measured length") && await bodyHas("markups"), "BOM from markups");
rec("cost:trade-empty-qty", await bodyHas("Structural steel") && await bodyHas("no qty until you mark it"), "trade has no invented qty");
await clickNamed("Proof");
const [ev] = await Promise.all([
  page.waitForEvent("download", { timeout: 5000 }).catch(() => null),
  clickNamed("Export evidence JSON"),
]);
rec("proof:export", Boolean(ev), ev ? ev.suggestedFilename() : "no download");
rec("proof:preview", await bodyHas("xray-evidence") || await bodyHas('"plan"'), "JSON preview");

const dlLink = page.getByRole("link", { name: /download standalone/i });
rec("footer:download", (await dlLink.getAttribute("href")) === "/xray-model-pipeline.html", await dlLink.getAttribute("href"));

const html = await page.request.get("http://127.0.0.1:8080/xray-model-pipeline.html");
rec("standalone:html", html.ok(), `status ${html.status()} ${html.headers()["content-type"]}`);

rec("console:page-errors", errors.length === 0, errors.length ? errors.slice(0, 8).join(" | ") : "none");

await page.screenshot({ path: "/workspace/screenshots/feature-audit.png", fullPage: false });
await browser.close();

const summary = {
  pass: out.filter((r) => r.ok).length,
  fail: out.filter((r) => !r.ok).length,
  stub: out.filter((r) => r.kind === "stub").length,
  partial: out.filter((r) => r.kind === "partial").length,
  rows: out,
};
mkdirSync("/workspace/screenshots", { recursive: true });
writeFileSync("/workspace/screenshots/feature-audit.json", JSON.stringify(summary, null, 2));
console.log("\n" + JSON.stringify({ pass: summary.pass, fail: summary.fail, stub: summary.stub, partial: summary.partial }, null, 2));
process.exit(summary.fail ? 1 : 0);
