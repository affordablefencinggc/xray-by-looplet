import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const stepBlock = (workflow, name) => workflow.match(
  new RegExp(`- name: ${name}\\r?\\n([\\s\\S]*?)(?=\\r?\\n\\s*- name:|$)`),
)?.[1];

test("default desktop hook builds the SPA without invoking the Windows-only DWG compiler", async () => {
  const config = await readJson("src-tauri/tauri.conf.json");
  assert.equal(config.build.beforeBuildCommand, "npm run build:desktop");
  assert.equal(config.build.frontendDist, "../dist");
});

test("Windows platform overlay retains CAD compilation before the SPA build", async () => {
  const config = await readJson("src-tauri/tauri.windows.conf.json");
  assert.equal(config.build.beforeBuildCommand, "npm run build:cad && npm run build:desktop");
  assert.equal(config.bundle, undefined, "the overlay must preserve the base bundle resources");
});

test("desktop build commands resolve to declared local scripts", async () => {
  const pkg = await readJson("package.json");
  assert.equal(pkg.scripts["build:cad"], "node scripts/build-cad.mjs");
  assert.match(pkg.scripts["build:desktop"], /vite build --config vite\.config\.spa\.ts/);
});

test("web release upload includes required hidden build metadata within the output directory", async () => {
  const workflow = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");
  const block = stepBlock(workflow, "Upload Web Release Artifact");
  assert.ok(block, "web artifact upload step must exist");
  assert.match(block, /path: \.vercel\/output\//);
  assert.match(block, /include-hidden-files: true/);
  assert.match(block, /if-no-files-found: error/);
});

test("matrix host and Tauri suites each have their own exit-propagating step", async () => {
  const workflow = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");
  const host = stepBlock(workflow, "Execute Rust host transport tests on [^\\r\\n]+");
  const tauri = stepBlock(workflow, "Execute Tauri transport tests on [^\\r\\n]+");
  assert.ok(host);
  assert.ok(tauri);
  assert.match(host, /run: cargo test --manifest-path engine\/host\/Cargo\.toml transport -- --nocapture/);
  assert.match(tauri, /run: cargo test --manifest-path src-tauri\/Cargo\.toml -- --nocapture/);
  assert.equal((host.match(/cargo test/g) || []).length, 1);
  assert.equal((tauri.match(/cargo test/g) || []).length, 1);
});

test("Linux upload carries a mode-preserving archive instead of raw bundle files", async () => {
  const workflow = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");
  const archive = stepBlock(workflow, "Archive Linux desktop bundles preserving executable permissions");
  const upload = stepBlock(workflow, "Upload Desktop Artifacts \\(Linux\\)");
  assert.ok(archive);
  assert.ok(upload);
  assert.match(archive, /tar -czf xray-desktop-linux\.tar\.gz -C src-tauri\/target\/release bundle/);
  assert.match(upload, /path: xray-desktop-linux\.tar\.gz/);
  assert.match(upload, /if-no-files-found: error/);
});

test("Rust cache maps both independent Cargo manifests rather than the nonexistent root manifest", async () => {
  const workflow = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");
  const cacheBlocks = [...workflow.matchAll(/- name: Cache Cargo dependencies\r?\n([\s\S]*?)(?=\r?\n\s*- name:|$)/g)];
  assert.equal(cacheBlocks.length, 2);
  for (const [, block] of cacheBlocks) {
    assert.match(block, /engine\/host -> target/);
    assert.match(block, /src-tauri -> target/);
  }
});