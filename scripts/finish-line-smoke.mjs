#!/usr/bin/env node

/**
 * finish-line-smoke.mjs — cross-platform built-output browser smoke.
 *
 * `scripts/preview.mjs` owns :8081 via /proc and only runs in the Linux
 * sandbox; this orchestrator does the same job portably:
 *
 *   1. Probe the preview URL — reuse a server that is already up.
 *   2. Otherwise spawn `npm run preview` (the recovered SSR preview
 *      `scripts/preview-built.mjs`, serving the built Vercel output; binds
 *      PREVIEW_HOST/PREVIEW_PORT, defaulting to 127.0.0.1:8081) detached,
 *      logging under screenshots/ (gitignored). The preview is not a Vite
 *      CLI: host/port are env-only, so the orchestrator derives them from
 *      the polled URL rather than passing CLI flags.
 *   3. Poll until the server answers, then run scripts/browser-smoke.mjs
 *      against it (loopback-guarded, Playwright Chromium).
 *   4. Always tear the spawned server down (taskkill tree on Windows,
 *      process-group signal elsewhere) and exit with the smoke verdict.
 *
 * Usage:
 *   node scripts/finish-line-smoke.mjs
 *   node scripts/finish-line-smoke.mjs --url http://127.0.0.1:8081/ --out-png screenshots/fl.png
 *   node scripts/finish-line-smoke.mjs --no-server   # smoke a running server only
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SMOKE_SCRIPT = join(REPO_ROOT, "scripts", "browser-smoke.mjs");
const DEFAULT_PREVIEW_HOST = "127.0.0.1";
const DEFAULT_PREVIEW_PORT = 8081;
const DEFAULT_URL = `http://${DEFAULT_PREVIEW_HOST}:${DEFAULT_PREVIEW_PORT}/`;
const DEFAULT_PNG = join(REPO_ROOT, "screenshots", "finish-line-smoke.png");
const PREVIEW_LOG = join(REPO_ROOT, "screenshots", "finish-line-preview.log");

export function parseSmokeConfig(argv = [], env = {}) {
  const config = {
    url: env.BROWSER_SMOKE_URL || DEFAULT_URL,
    outPng: env.BROWSER_SMOKE_OUT_PNG || DEFAULT_PNG,
    startServer: env.BROWSER_SMOKE_NO_SERVER !== "1",
    timeoutMs: Number(env.BROWSER_SMOKE_SERVER_TIMEOUT_MS || 90_000),
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url") config.url = argv[++i];
    else if (arg === "--out-png") config.outPng = argv[++i];
    else if (arg === "--timeout-ms") config.timeoutMs = Number(argv[++i]);
    else if (arg === "--no-server") config.startServer = false;
    else return { error: `unknown flag: ${arg}` };
  }
  if (!config.url) return { error: "--url requires a value" };
  if (!config.outPng) return { error: "--out-png requires a value" };
  return config;
}

/**
 * PREVIEW_HOST/PREVIEW_PORT for the recovered SSR preview, derived from the
 * URL this run polls so a non-default `--url` still reaches the server it
 * spawned. `scripts/preview-built.mjs` reads only these env vars (no CLI
 * flags), and they must survive `npm run preview` → with-app-env → the
 * preview child, so they are passed through the spawn environment.
 */
export function previewEnvFromUrl(url, env = {}) {
  const parsed = new URL(url);
  return {
    ...env,
    PREVIEW_HOST: parsed.hostname || DEFAULT_PREVIEW_HOST,
    PREVIEW_PORT: parsed.port || String(DEFAULT_PREVIEW_PORT),
  };
}

/** Poll `url` until it answers. Any HTTP response means the server is up. */
export async function pollReady(url, timeoutMs, fetchImpl, sleepMs = 250) {
  const fetchFn = fetchImpl || globalThis.fetch;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const resp = await fetchFn(url, { redirect: "manual" });
      return { ok: true, status: resp?.status ?? 0 };
    } catch {
      // not up (yet) — fall through to the deadline check
    }
    if (Date.now() >= deadline) return { ok: false };
    await new Promise((r) => setTimeout(r, sleepMs));
  }
}
function startPreview(config) {
  mkdirSync(dirname(PREVIEW_LOG), { recursive: true });
  const logFd = openSync(PREVIEW_LOG, "a");
  const env = previewEnvFromUrl(config.url, process.env);
  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", "npm run preview"], {
          cwd: REPO_ROOT,
          detached: true,
          env,
          stdio: ["ignore", logFd, logFd],
        })
      : spawn("npm", ["run", "preview"], {
          cwd: REPO_ROOT,
          detached: true,
          env,
          stdio: ["ignore", logFd, logFd],
        });
  return child;
}

function stopPreview(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    if (child.pid) spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {
        // already gone
      }
    }
  }
}

export async function runSmoke(config) {
  let child = null;
  let owned = false;
  const pre = await pollReady(config.url, 2_500);
  if (pre.ok) {
    console.log(`[smoke] preview already up at ${config.url} — reusing`);
  } else if (!config.startServer) {
    console.error(`[smoke] no server at ${config.url} and --no-server set — aborting`);
    return 1;
  } else {
    child = startPreview(config);
    owned = true;
    console.log(`[smoke] spawned npm run preview (pid ${child.pid}); waiting for ${config.url}`);
    const ready = await pollReady(config.url, config.timeoutMs);
    if (!ready.ok) {
      console.error(`[smoke] preview never answered at ${config.url} within ${config.timeoutMs}ms — see ${PREVIEW_LOG}`);
      stopPreview(child);
      return 1;
    }
  }
  try {
    const res = spawnSync(process.execPath, [SMOKE_SCRIPT, config.url, config.outPng], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    return res.status ?? 1;
  } finally {
    if (owned) stopPreview(child);
  }
}

async function main() {
  const parsed = parseSmokeConfig(process.argv.slice(2), process.env);
  if (parsed.error) {
    console.error(`finish-line-smoke: ${parsed.error}`);
    process.exit(1);
  }
  const code = await runSmoke(parsed);
  console.log(`[smoke] exit ${code}`);
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}