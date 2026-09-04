#!/usr/bin/env node
/**
 * Read-only browser audit for the restored X-Ray workbench.
 *
 * The audit only changes the selected pane. It deliberately does not activate
 * imports, downloads, CRM actions, render generation, form fields, or canvas
 * tools. Visible claims and controls are inventory, not evidence of behavior.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

export const EXPECTED_PANES = [
  "Overview",
  "Sheets",
  "Measure",
  "Sketch",
  "Components",
  "Model",
  "Render",
  "Review",
  "Cost",
  "Proof",
];

const CLAIM_PATTERN = /\b(?:verified|ready|complete|live|detected|generated|qualified|trusted|proof)\b/i;
const SIDE_EFFECT_PATTERN = /\b(?:download|export|import|open plan|push|crm|generate|render image|save still|install|build bom|handoff|capture)\b/i;

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeText(value) {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function launchBrowser() {
  return chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  });
}

async function waitForHydrationCapableNavigation(page, timeoutMs) {
  const nav = page.locator('nav[aria-label="Panes"]');
  await nav.waitFor({ state: "visible", timeout: timeoutMs });

  // React delegates events, so `onclick` is normally null. Its attached props
  // marker is a useful non-mutating signal; the navigation check below remains
  // the authoritative proof and works if React changes that internal marker.
  const reactPropsObserved = await page
    .waitForFunction(
      () => {
        const button = document.querySelector('nav[aria-label="Panes"] button');
        return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactProps$")));
      },
      undefined,
      { timeout: Math.min(timeoutMs, 10_000) },
    )
    .then(() => true)
    .catch(() => false);

  await page.waitForTimeout(300);
  return reactPropsObserved;
}

async function visibleControlInventory(scope) {
  return scope.locator("button, a, input, select, textarea, [role=button]").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute("type"),
        name: (
          element.getAttribute("aria-label") ||
          element.textContent ||
          element.getAttribute("title") ||
          element.getAttribute("placeholder") ||
          ""
        ).replace(/\s+/g, " ").trim(),
      }))
      .filter((entry) => entry.name),
  );
}

async function readOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const main = document.querySelector(".studio-main");
    const measure = (element) =>
      element
        ? {
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            horizontal: element.scrollWidth > element.clientWidth + 1,
          }
        : null;
    return {
      document: measure(root),
      body: measure(body),
      main: measure(main),
    };
  });
}

async function readCanvasInventory(page) {
  return page.locator("canvas").evaluateAll((canvases) =>
    canvases.map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const style = getComputedStyle(canvas);
      return {
        width: canvas.width,
        height: canvas.height,
        clientWidth: Math.round(rect.width),
        clientHeight: Math.round(rect.height),
        visible:
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > 0 &&
          rect.height > 0,
      };
    }),
  );
}

export async function runWorkbenchPaneAudit(options = {}) {
  const auditName = options.auditName ?? "workbench-pane-audit";
  const url = options.url ?? process.env.APP_URL ?? "http://127.0.0.1:8080/";
  const viewport = options.viewport ?? { width: 1440, height: 900 };
  const timeoutMs = options.timeoutMs ?? 45_000;
  const root = process.cwd();
  const screenshotDirectory = resolve(root, "screenshots");
  const reportPath = resolve(screenshotDirectory, `${auditName}.json`);
  mkdirSync(screenshotDirectory, { recursive: true });

  const browser = await launchBrowser();
  const consoleErrors = [];
  const pageErrors = [];
  const panes = [];
  let responseStatus = 0;
  let reactPropsObserved = false;
  let discoveredPanes = [];

  try {
    const context = await browser.newContext({ viewport, acceptDownloads: false });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error?.message ?? error)));

    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    responseStatus = response?.status() ?? 0;
    reactPropsObserved = await waitForHydrationCapableNavigation(page, timeoutMs);

    const navButtons = page.locator('nav[aria-label="Panes"] button');
    discoveredPanes = (await navButtons.allTextContents()).map((text) => text.trim()).filter(Boolean);

    for (let index = 0; index < EXPECTED_PANES.length; index += 1) {
      const name = EXPECTED_PANES[index];
      const consoleErrorStart = consoleErrors.length;
      const pageErrorStart = pageErrors.length;
      const button = page.getByRole("button", { name, exact: true });
      const buttonCount = await button.count();
      let navigationOk = false;
      let activePane = null;

      if (buttonCount === 1) {
        await button.click({ timeout: timeoutMs });
        navigationOk = await page
          .waitForFunction(
            (paneName) => {
              const active = document.querySelector('nav[aria-label="Panes"] button.active');
              return active?.textContent?.trim() === paneName;
            },
            name,
            { timeout: 10_000 },
          )
          .then(() => true)
          .catch(() => false);
      }

      // Let canvas/layout work settle without assuming that visible marketing
      // or status copy proves the pane's functionality.
      await page.waitForTimeout(350);
      activePane = await page
        .locator('nav[aria-label="Panes"] button.active')
        .textContent()
        .then((text) => text?.trim() ?? null)
        .catch(() => null);

      const main = page.locator(".studio-main");
      const bodyText = normalizeText(await page.locator("body").innerText());
      const paneText = normalizeText(await main.innerText().catch(() => ""));
      const controls = await visibleControlInventory(main).catch(() => []);
      const screenshot = resolve(
        screenshotDirectory,
        `${auditName}-${String(index + 1).padStart(2, "0")}-${slug(name)}.png`,
      );
      await page.screenshot({ path: screenshot, fullPage: false, animations: "disabled" });

      panes.push({
        expectedPane: name,
        buttonCount,
        navigationOk: navigationOk && activePane === name,
        activePane,
        bodyText,
        paneText,
        canvas: await readCanvasInventory(page),
        overflow: await readOverflow(page),
        visibleControls: controls,
        sideEffectingControlsNotExercised: controls.filter((control) => SIDE_EFFECT_PATTERN.test(control.name)),
        visibleClaimsNotTreatedAsProof: paneText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && CLAIM_PATTERN.test(line)),
        consoleErrors: consoleErrors.slice(consoleErrorStart),
        pageErrors: pageErrors.slice(pageErrorStart),
        screenshot,
      });
    }

    await context.close();
  } finally {
    await browser.close();
  }

  const missingPanes = EXPECTED_PANES.filter((name) => !discoveredPanes.includes(name));
  const unexpectedPanes = discoveredPanes.filter((name) => !EXPECTED_PANES.includes(name));
  const navigationFailures = panes
    .filter((pane) => !pane.navigationOk || pane.buttonCount !== 1)
    .map((pane) => pane.expectedPane);
  const overflowFailures = panes
    .filter((pane) => pane.overflow.document?.horizontal || pane.overflow.body?.horizontal)
    .map((pane) => pane.expectedPane);
  const unverifiedClaimCount = panes.reduce(
    (total, pane) => total + pane.visibleClaimsNotTreatedAsProof.length,
    0,
  );
  const sideEffectingControlsNotExercisedCount = panes.reduce(
    (total, pane) => total + pane.sideEffectingControlsNotExercised.length,
    0,
  );
  const ok =
    responseStatus >= 200 &&
    responseStatus < 400 &&
    missingPanes.length === 0 &&
    unexpectedPanes.length === 0 &&
    discoveredPanes.length === EXPECTED_PANES.length &&
    navigationFailures.length === 0 &&
    overflowFailures.length === 0 &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0;

  const summary = {
    auditName,
    url,
    viewport,
    responseStatus,
    expectedPaneCount: EXPECTED_PANES.length,
    discoveredPaneCount: discoveredPanes.length,
    discoveredPanes,
    missingPanes,
    unexpectedPanes,
    reactPropsObserved,
    navigationPassedCount: panes.length - navigationFailures.length,
    navigationFailures,
    overflowFailures,
    unverifiedClaimCount,
    sideEffectingControlsNotExercisedCount,
    consoleErrors,
    pageErrors,
    screenshotDirectory,
    reportPath,
    ok,
  };
  const report = { summary, panes };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { ...report, ok };
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const result = await runWorkbenchPaneAudit();
  console.log(JSON.stringify(result.summary, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
