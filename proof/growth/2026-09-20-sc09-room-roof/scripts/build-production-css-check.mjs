import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const proofRoot = resolve(here, "..");
const sourcePath = resolve(proofRoot, "scenarios/sc09-room-roof.production.json");
const outputPath = resolve(proofRoot, "scenarios/sc09-room-roof.production-css-check.json");
const sourceSha256 = "77adc3cd63f6a7342bc03c738298f972f0c6b221a9f423d083973ac7bebe50b2";

const sourceBytes = await readFile(sourcePath);
assert.equal(createHash("sha256").update(sourceBytes).digest("hex"), sourceSha256,
  "Refusing to extend a changed production journey");
const source = JSON.parse(sourceBytes.toString("utf8"));
assert.equal(source.length, 135, "The preserved production journey must contain 135 operations");
assert.deepEqual(source[5], ["open", "{{ORIGIN}}/"], "The root navigation boundary changed");

const rawSsrStylesheetCheck = String.raw`(async () => {
  const response = await fetch(location.origin + "/", { cache: "no-store", headers: { accept: "text/html" } });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !/^text\/html(?:;|$)/i.test(contentType)) throw Error("Raw SSR root was not HTTP 200 text/html");
  const html = await response.text();
  if (!html.trim()) throw Error("Raw SSR root was empty");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const hrefs = [...parsed.querySelectorAll('link[rel~="stylesheet"][href]')].map(link => link.getAttribute("href"));
  if (hrefs.length < 1) throw Error("Raw SSR root did not declare a stylesheet");
  const receipts = [];
  for (const href of hrefs) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin) throw Error("Raw SSR stylesheet is not same-origin: " + url.href);
    const stylesheet = await fetch(url.href, { cache: "no-store" });
    const stylesheetType = stylesheet.headers.get("content-type") || "";
    const bytes = (await stylesheet.arrayBuffer()).byteLength;
    if (!stylesheet.ok || !/^text\/css(?:;|$)/i.test(stylesheetType) || bytes < 1)
      throw Error("SSR stylesheet failed its HTTP/CSS/body contract: " + url.pathname + " status=" + stylesheet.status + " type=" + stylesheetType + " bytes=" + bytes);
    receipts.push({ href: url.pathname + url.search, status: stylesheet.status, contentType: stylesheetType, bytes });
  }
  return { rawSsrHtmlBytes: new TextEncoder().encode(html).byteLength, stylesheets: receipts };
})()`;

const computedThemeReady = String.raw`(() => {
  const root = getComputedStyle(document.documentElement), body = getComputedStyle(document.body);
  const links = [...document.querySelectorAll('link[rel~="stylesheet"][href]')];
  return links.length >= 1
    && links.every(link => new URL(link.href, location.href).origin === location.origin)
    && root.getPropertyValue("--color-bg").trim().length > 0
    && root.getPropertyValue("--color-ink").trim().length > 0
    && body.backgroundColor !== "rgba(0, 0, 0, 0)"
    && body.color.length > 0 && body.fontFamily.length > 0;
})()`;

const computedThemeReceipt = String.raw`(() => {
  const root = getComputedStyle(document.documentElement), body = getComputedStyle(document.body);
  const receipt = {
    stylesheetLinks: [...document.querySelectorAll('link[rel~="stylesheet"][href]')].map(link => new URL(link.href, location.href).pathname),
    colorBg: root.getPropertyValue("--color-bg").trim(), colorInk: root.getPropertyValue("--color-ink").trim(),
    bodyBackground: body.backgroundColor, bodyColor: body.color, bodyFontFamily: body.fontFamily,
  };
  if (!receipt.stylesheetLinks.length || !receipt.colorBg || !receipt.colorInk || !receipt.bodyBackground || !receipt.bodyColor || !receipt.bodyFontFamily)
    throw Error("Computed global theme receipt is incomplete");
  return receipt;
})()`;

const inserted = [
  ["eval", rawSsrStylesheetCheck],
  ["wait", "--fn", computedThemeReady],
  ["eval", computedThemeReceipt],
];
const scenario = [...source.slice(0, 6), ...inserted, ...source.slice(6)];
assert.equal(scenario.length, 138, "CSS qualification must add exactly three operations");
assert.deepEqual([...scenario.slice(0, 6), ...scenario.slice(9)], source, "The original 135 operations changed");
for (const operation of scenario) for (const value of operation) {
  if (typeof value === "string" && /(?:\/src\/|\bimport\s*\(|\buseStudio\b)/.test(value))
    throw Error("Production CSS qualification contains dev-module/store access");
}

await writeFile(outputPath, `${JSON.stringify(scenario, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
const outputBytes = await readFile(outputPath);
process.stdout.write(`${JSON.stringify({
  output: outputPath, operations: scenario.length, retainedOperations: source.length,
  sha256: createHash("sha256").update(outputBytes).digest("hex"),
})}\n`);
