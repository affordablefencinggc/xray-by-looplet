/**
 * Live proof for the assistant surface work (SC-14 to SC-23) and the SC-19 rail bounds fix.
 *
 * WHY THIS EXISTS RATHER THAN A FAST-CDP SCENARIO
 * The agent-browser CLI could not attach across seven attempts, its CDP read timing out even on
 * about:blank while the dev server answered in 11 ms. Playwright resolves directly in this repo,
 * so this drives the browser itself and skips that layer. It follows the same discipline the
 * fast-cdp skill asks for: reactive waits on real DOM state rather than sleeps, in-page closures
 * that measure many things in one round trip, fail-fast with a non-zero exit, and a screenshot at
 * every milestone.
 *
 * WHAT IT PROVES, AND WHAT IT DELIBERATELY DOES NOT
 * Everything here is layout, wiring and state that can be observed WITHOUT spending a provider
 * call. No check sends a message to Gemini. The context system's behaviour under real traffic
 * (compaction at turn 8, the pinned pair surviving an upsert, a log entry per turn) is covered by
 * 938 unit tests; what those tests cannot see is whether the panel actually renders, whether the
 * rail sits in its column, and whether the meter and light are wired to real state. That gap is
 * what this closes.
 *
 * USAGE
 *   node scripts/live-assistant-proof.mjs                 # visible Edge, default dev server
 *   node scripts/live-assistant-proof.mjs --headless      # no window
 *   XRAY_URL=http://127.0.0.1:8080/ node scripts/live-assistant-proof.mjs
 *   XRAY_CHANNEL=chrome node scripts/live-assistant-proof.mjs
 *
 * Exit code 0 means every check passed. Any failure exits 1 and names the check.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const URL = process.env.XRAY_URL || "http://127.0.0.1:8091/";
const CHANNEL = process.env.XRAY_CHANNEL || "msedge";
const HEADLESS = process.argv.includes("--headless");
const OUT = "proof/growth/2026-09-09-assistant-surface";
/** Over the 941px breakpoint at which railLayout measures rails, so rail mode is reachable. */
const VIEWPORT = { width: 1440, height: 900 };

mkdirSync(OUT, { recursive: true });

const results = [];
const log = (...parts) => console.log(...parts);

/** Records a check. `detail` is printed on failure so a red line explains itself. */
function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  log(`${passed ? "PASS" : "FAIL"}  ${name}${passed || !detail ? "" : `\n        ${detail}`}`);
}

/** Reads the whole assistant surface in ONE round trip; measuring piecemeal is slow and racy. */
const SURVEY = () => {
  const box = (node) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return {
      left: Math.round(r.left), right: Math.round(r.right),
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      width: Math.round(r.width), height: Math.round(r.height),
    };
  };
  const el = document.querySelector(".live-assistant");
  const meter = document.querySelector(".assistant-context-meter");
  const light = document.querySelector(".assistant-status-light");
  const root = getComputedStyle(document.documentElement);
  return {
    present: !!el,
    open: el ? el.classList.contains("is-open") : null,
    railAttr: document.documentElement.getAttribute("data-assistant-rail"),
    menuWidth: root.getPropertyValue("--right-menu-width").trim(),
    seamLeft: root.getPropertyValue("--assistant-seam-left").trim(),
    assistant: box(el),
    launcher: box(document.querySelector(".live-assistant-launcher")),
    rightRail: box(document.querySelector(".studio-right-rail")),
    meter: meter ? { box: box(meter), level: meter.dataset.level, label: meter.textContent.trim(), percent: meter.getAttribute("aria-valuenow") } : null,
    light: light ? { on: light.classList.contains("is-on"), box: box(light) } : null,
    composer: box(document.querySelector(".live-assistant textarea")),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    // Any element whose box escapes the viewport horizontally is a layout bug on a tablet.
    overflowing: [...document.querySelectorAll(".live-assistant *")]
      .filter((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1); })
      .slice(0, 5)
      .map((n) => `${n.tagName.toLowerCase()}.${(n.className || "").toString().split(" ")[0]}`),
  };
};

const browser = await chromium.launch({ channel: CHANNEL, headless: HEADLESS });
let survey = null;
try {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 300)));
  page.on("console", (message) => { if (message.type() === "error") pageErrors.push(`console: ${message.text().slice(0, 300)}`); });

  log(`\nopening ${URL} in ${CHANNEL}${HEADLESS ? " (headless)" : ""} at ${VIEWPORT.width}x${VIEWPORT.height}\n`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // ---- 1. The app renders at all -------------------------------------------------------------
  await page.waitForSelector(".live-assistant", { timeout: 60_000 });
  check("the app loads and mounts the Live assistant", true, await page.title());
  await page.screenshot({ path: `${OUT}/sc-live-01-loaded.png`, fullPage: false });

  // ---- 2. SC-19: the COLLAPSED rail stays inside the right menu column ------------------------
  // This is the reported bug: it spanned the viewport and covered the canvas and the log tabs.
  survey = await page.evaluate(SURVEY);
  if (survey.open) {
    const collapse = page.locator('[aria-label="Collapse live assistant"]');
    if (await collapse.count()) { await collapse.first().click(); await page.waitForFunction(() => !document.querySelector(".live-assistant")?.classList.contains("is-open"), { timeout: 10_000 }); }
  }
  survey = await page.evaluate(SURVEY);
  await page.screenshot({ path: `${OUT}/sc-live-02-collapsed.png` });

  const rail = survey.assistant;
  check(
    "SC-19: the collapsed rail does not span the whole viewport",
    !!rail && rail.width < survey.viewport.w - 2,
    `rail width ${rail?.width} of viewport ${survey.viewport.w}`,
  );
  check(
    "SC-19: the collapsed rail is pinned to the right edge",
    !!rail && Math.abs(rail.right - survey.viewport.w) <= 2,
    `rail right edge ${rail?.right}, viewport ${survey.viewport.w}`,
  );
  // The seam is the check that matters most: the rail must be FLUSH against the column's inner
  // edge, not merely inside the column. A width-based rule put it in the right area but floating.
  check(
    "SC-19: the seam variable is published on <html>",
    !!survey.seamLeft,
    "--assistant-seam-left is unset, so the rail falls back to full width",
  );
  check(
    "SC-19: the rail's left edge is flush with the column seam",
    !!survey.seamLeft && !!rail && Math.abs(rail.left - parseInt(survey.seamLeft, 10)) <= 2,
    `rail left ${rail?.left}px vs seam ${survey.seamLeft || "(unset)"}`,
  );
  if (survey.rightRail) {
    // Directional, not absolute. The measured rect.left for the right side is the resizer HANDLE,
    // 2px inside the column, so the rail must sit at or right of the column edge — never left of
    // it, which is the overlap that put the rail on top of the menu.
    check(
      "SC-19: the rail does not overlap the menu column",
      rail.left >= survey.rightRail.left,
      `rail left ${rail?.left}px is left of the column edge ${survey.rightRail.left}px, so it overlaps`,
    );
    check(
      "SC-19: the rail sits flush, not floating inside the column",
      rail.left - survey.rightRail.left <= 4,
      `rail left ${rail?.left}px is ${rail.left - survey.rightRail.left}px inside the column edge`,
    );
  }

  // ---- 3. SC-19: the collapsed rail carries a connection light --------------------------------
  check(
    "SC-19: the collapsed rail shows a connection light",
    !!survey.light,
    "no .assistant-status-light found beside the Live assistant label",
  );

  // ---- 4. The panel opens ---------------------------------------------------------------------
  const launcher = page.locator(".live-assistant-launcher");
  await launcher.first().click();
  await page.waitForFunction(() => document.querySelector(".live-assistant")?.classList.contains("is-open"), { timeout: 15_000 });
  survey = await page.evaluate(SURVEY);
  await page.screenshot({ path: `${OUT}/sc-live-03-open.png` });
  check("the panel opens from the collapsed rail", survey.open === true);

  // ---- 5. SC-20: the context meter sits at the bottom LEFT, under the chat --------------------
  check("SC-20: the context meter is rendered", !!survey.meter, "no .assistant-context-meter");
  if (survey.meter && survey.assistant) {
    const m = survey.meter.box, a = survey.assistant;
    check(
      "SC-20: the meter sits in the lower-left of the panel",
      m.left - a.left < a.width / 2 && m.top > a.top + a.height / 2,
      `meter at (${m.left},${m.top}); panel (${a.left},${a.top}) ${a.width}x${a.height}`,
    );
    check(
      "SC-20: the meter reports a real level, not a placeholder",
      ["ok", "warn", "full"].includes(survey.meter.level),
      `data-level=${survey.meter.level} label=${survey.meter.label}`,
    );
  }

  // ---- 6. Nothing overflows the viewport (tablet/desktop only, but still must fit) ------------
  check(
    "no element inside the assistant overflows the viewport horizontally",
    survey.overflowing.length === 0,
    survey.overflowing.join(", "),
  );

  // ---- 7. SC-18: the plus menu offers Projects ------------------------------------------------
  const add = page.locator('[aria-label="Add to assistant"]');
  if (await add.count()) {
    await add.first().click();
    await page.waitForTimeout(250);
    const projects = await page.locator(".assistant-projects-item").count();
    check("SC-18: the plus menu offers a Projects option", projects > 0, `${projects} project items`);
    await page.screenshot({ path: `${OUT}/sc-live-04-add-menu.png` });
    await page.keyboard.press("Escape");
  } else {
    check("SC-18: the plus menu offers a Projects option", false, "no [aria-label='Add to assistant'] button");
  }

  // ---- 8. SC-20: the permission control replaces the old allow-edits checkbox -----------------
  const permission = await page.evaluate(() => {
    const wanted = ["ask", "auto", "readonly", "edit freely", "read only"];
    const hit = [...document.querySelectorAll(".live-assistant button, .live-assistant select, .live-assistant [role=radio]")]
      .find((n) => wanted.some((w) => (n.textContent || "").toLowerCase().includes(w) || (n.getAttribute("aria-label") || "").toLowerCase().includes(w)));
    return hit ? (hit.getAttribute("aria-label") || hit.textContent || "").trim().slice(0, 60) : null;
  });
  check("SC-20: a permission control is present", !!permission, permission || "no ask/edit-freely/read-only control found");

  // ---- 9. SC-18: the size adjuster in the top-right corner is gone ----------------------------
  const resizer = await page.locator(".live-assistant .assistant-resize-handle, .live-assistant .assistant-corner").count();
  check("SC-18: the corner size adjuster is not shown", resizer === 0, `${resizer} resize handles still rendered`);

  // ---- 10. The composer is usable and is the white field below the seam -----------------------
  check("the composer is present and visible", !!survey.composer && survey.composer.height > 0);

  // ---- 11. No page errors during any of the above ---------------------------------------------
  check("no uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

  await page.screenshot({ path: `${OUT}/sc-live-05-final.png` });
} finally {
  await browser.close();
}

// ---- Report ----------------------------------------------------------------------------------
const failed = results.filter((r) => !r.passed);
const report = [
  "SC-14..SC-23 live assistant proof",
  `url ${URL}  channel ${CHANNEL}  viewport ${VIEWPORT.width}x${VIEWPORT.height}`,
  "",
  ...results.map((r) => `${r.passed ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  [${r.detail}]` : ""}`),
  "",
  `${results.length - failed.length}/${results.length} passed`,
  failed.length ? "" : "screenshots: sc-live-01-loaded.png .. sc-live-05-final.png",
].join("\n");
writeFileSync(`${OUT}/live-assistant-proof.txt`, report + "\n");

log(`\n${results.length - failed.length}/${results.length} passed`);
log(`report: ${OUT}/live-assistant-proof.txt`);
if (failed.length) { log(`\nfailed: ${failed.map((r) => r.name).join("; ")}`); process.exit(1); }
