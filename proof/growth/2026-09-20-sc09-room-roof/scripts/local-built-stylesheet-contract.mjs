// Local pre-check for the SC-09 built-browser blocker: the SSR root must reference
// a stylesheet that the client build actually emitted. Reproduces the exact
// condition that failed built1 (`/assets/styles-BRNbTYdU.css` HTTP 404 while the
// emitted asset was `styles-B9B94adg.css`) without spending DANS1 campaign time.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const staticRoot = join(repo, ".vercel/output/static");
const host = "127.0.0.1";
const port = Number(process.env.PREVIEW_PORT ?? 8081);
const origin = `http://${host}:${port}`;
const receiptPath = join(dirname(fileURLToPath(import.meta.url)), "local-built-stylesheet-contract.json");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const emitted = readdirSync(join(staticRoot, "assets")).filter((name) => name.endsWith(".css")).sort();
const emittedDigests = Object.fromEntries(
  emitted.map((name) => [name, sha256(readFileSync(join(staticRoot, "assets", name)))]),
);

const child = spawn(process.execPath, ["scripts/preview-built.mjs"], {
  cwd: repo,
  env: { ...process.env, PREVIEW_HOST: host, PREVIEW_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
child.stdout.on("data", (chunk) => (serverLog += chunk));
child.stderr.on("data", (chunk) => (serverLog += chunk));

const deadline = Date.now() + 60_000;
async function ready() {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw Error(`Preview exited early (code ${child.exitCode}): ${serverLog}`);
    try {
      const response = await fetch(origin + "/", { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((done) => setTimeout(done, 150));
  }
  throw Error(`Preview never became ready at ${origin}: ${serverLog}`);
}

let receipt;
try {
  await ready();
  const page = await fetch(origin + "/", { cache: "no-store", headers: { accept: "text/html" } });
  const contentType = page.headers.get("content-type") ?? "";
  const html = await page.text();
  if (!page.ok || !/^text\/html(?:;|$)/i.test(contentType)) throw Error(`Root was not HTTP 200 text/html: ${page.status} ${contentType}`);
  if (!html.trim()) throw Error("Root HTML was empty");

  const hrefs = [...html.matchAll(/<link\b[^>]*\brel="[^"]*\bstylesheet\b[^"]*"[^>]*>/gi)]
    .map((tag) => /\bhref="([^"]+)"/i.exec(tag[0])?.[1])
    .filter(Boolean);
  if (!hrefs.length) throw Error("SSR root declared no stylesheet link");

  const stylesheets = [];
  for (const href of hrefs) {
    const url = new URL(href, origin);
    if (url.origin !== origin) throw Error(`SSR stylesheet is not same-origin: ${url.href}`);
    const response = await fetch(url.href, { cache: "no-store" });
    const type = response.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await response.arrayBuffer());
    const onDisk = join(staticRoot, url.pathname.replace(/^\/+/, ""));
    const emittedName = url.pathname.split("/").pop();
    stylesheets.push({
      href: url.pathname,
      status: response.status,
      contentType: type,
      bytes: bytes.length,
      sha256: sha256(bytes),
      existsInStaticRoot: existsSync(onDisk),
      matchesEmittedAsset: emittedDigests[emittedName] === sha256(bytes),
    });
  }

  const broken = stylesheets.filter((sheet) => sheet.status !== 200 || !/^text\/css(?:;|$)/i.test(sheet.contentType) || sheet.bytes < 1);
  const missing = stylesheets.filter((sheet) => !sheet.existsInStaticRoot || !sheet.matchesEmittedAsset);
  receipt = {
    schema: "xray.sc09-local-built-stylesheet-contract/v1",
    origin,
    verdict: broken.length || missing.length ? "FAIL" : "PASS",
    rawSsrHtmlBytes: Buffer.byteLength(html),
    stylesheets,
    emittedCssAssets: emittedDigests,
    browserAcceptance: false,
    limits: "Local plain-HTTP SSR contract only: no Chrome, no raw-CDP campaign, no DANS1 receipt, no measured-binding journey.",
  };
} catch (error) {
  receipt = {
    schema: "xray.sc09-local-built-stylesheet-contract/v1",
    origin,
    verdict: "FAIL",
    error: error.message,
    browserAcceptance: false,
    limits: "Local plain-HTTP SSR contract only: no Chrome, no raw-CDP campaign, no DANS1 receipt, no measured-binding journey.",
  };
} finally {
  child.kill("SIGTERM");
  await new Promise((done) => (child.exitCode !== null ? done() : child.once("exit", done)));
}

writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
process.stdout.write(JSON.stringify({ ...receipt, receiptPath }, null, 2) + "\n");
process.exit(receipt.verdict === "PASS" ? 0 : 1);
