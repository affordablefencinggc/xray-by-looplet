import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

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
  const block = workflow.match(/- name: Upload Web Release Artifact\r?\n([\s\S]*?)(?=\r?\n\s*- name:|$)/)?.[1];
  assert.ok(block, "web artifact upload step must exist");
  assert.match(block, /path: \.vercel\/output\//);
  assert.match(block, /include-hidden-files: true/);
  assert.match(block, /if-no-files-found: error/);
});