import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputBase = resolve(process.argv[3] ?? "screenshots/bom-workbench-proof.png");
const response = JSON.parse(
  await readFile(resolve("engine/fixtures/bom-contract/colorbond.response.json"), "utf8"),
);
if (response.ok !== true) throw new Error("The visual proof fixture must be a successful BOM response.");

const binding = {
  jobId: response.bom.jobId,
  jobRevision: response.bom.jobRevision,
  documentSha256: response.bom.documentSha256,
  recipeSetId: response.bom.recipeSet.id,
  recipeSetRevision: response.bom.recipeSet.revision,
  recipeSetDigest: response.bom.recipeSet.digest,
  ruleset: response.bom.ruleset,
  inputDigest: response.bom.inputDigest,
};
const bomState = {
  schema: "xray.bom-state/v1",
  stateRevision: 1,
  jobId: response.bom.jobId,
  pending: null,
  snapshot: {
    schema: "xray.bom-snapshot/v1",
    commitRevision: 1,
    committedAt: "2026-09-04T00:00:00.000Z",
    requestId: response.requestId,
    binding,
    response,
  },
  invalidation: null,
  lastFailure: null,
};

await mkdir(resolve("screenshots"), { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "msedge" } : {}),
});
const verdict = { url: baseUrl, fixture: "colorbond.response.json", viewports: [] };

for (const viewport of [
  { name: "desktop", width: 1280, height: 800, path: outputBase },
  { name: "mobile", width: 390, height: 844, path: outputBase.replace(/\.png$/i, "-mobile.png") },
]) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const responseStatus = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForSelector('[data-hydration-status="ready"]', { timeout: 15_000 });
  const injected = await page.evaluate(async (state) => {
    const storeUrl = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((name) => name.includes("/src/studio/store.ts"));
    const { useStudio } = await import(storeUrl ?? "/src/studio/store.ts");
    const current = useStudio.getState();
    const bom = state.snapshot.response.bom;
    const document = {
      id: "doc-colorbond",
      name: "Colorbond boundary plan.svg",
      kind: "svg",
      importedAt: "2026-09-04T00:00:00.000Z",
      pageCount: 1,
      sha256: bom.documentSha256,
      source: "web",
    };
    useStudio.setState({
      pane: "cost",
      sheet: 0,
      job: {
        ...current.job,
        id: bom.jobId,
        revision: bom.jobRevision,
        name: "Colorbond boundary takeoff",
        documents: [document],
        activeDocumentId: document.id,
      },
      activePlanBinary: {
        documentId: document.id,
        name: document.name,
        kind: "svg",
        mimeType: "image/svg+xml",
        sizeBytes: 1,
        sha256: document.sha256,
        bytes: new Uint8Array([32]),
      },
      assetReadiness: { document: { state: "ready", message: null }, photos: {} },
      markups: [{ id: "proof-length", kind: "length", label: "Boundary run", value: 8, unit: "m", sheet: 0, points: [{ x: 0, y: 0 }, { x: 8, y: 0 }] }],
      bomState: state,
    });
    return {
      storeUrl,
      pane: useStudio.getState().pane,
      hasSnapshot: useStudio.getState().bomState.snapshot !== null,
      requestId: useStudio.getState().bomState.snapshot?.requestId ?? null,
    };
  }, bomState);
  await page.waitForTimeout(500);
  const bodyText = await page.locator("body").innerText();
  if (!bodyText.includes("Material quantities")) {
    throw new Error(`BOM proof state did not render: ${JSON.stringify({ injected, consoleErrors, pageErrors, bodyText: bodyText.slice(0, 800) })}`);
  }
  await page.locator("details summary").first().click();
  await page.locator("details[open]").first().getByText("post-role-sites@1", { exact: true }).waitFor();
  await page.screenshot({ path: viewport.path, fullPage: true });
  verdict.viewports.push({
    name: viewport.name,
    status: responseStatus?.status() ?? null,
    consoleErrors,
    pageErrors,
    horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    visibleLines: await page.locator("tbody tr").count(),
  });
  await context.close();
}

await browser.close();
verdict.ok = verdict.viewports.every(
  (entry) => entry.status === 200 && entry.consoleErrors.length === 0 && entry.pageErrors.length === 0 && !entry.horizontalOverflow && entry.visibleLines > 0,
);
await writeFile(outputBase.replace(/\.png$/i, ".json"), `${JSON.stringify(verdict, null, 2)}\n`);
console.log(JSON.stringify(verdict, null, 2));
if (!verdict.ok) process.exitCode = 1;
