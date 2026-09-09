import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants } from "node:os";
import { test } from "node:test";
import { localBuildEnvironment } from "./build-resources.mjs";

test("local Windows builds reserve capacity and preserve app environment", () => {
  const env = { VITE_AUTH_ENABLED: "false", PATH: "example" };
  assert.deepEqual(localBuildEnvironment("vite", ["build"], env, "win32", 32), { ...env, RAYON_NUM_THREADS: "6" });
  assert.equal(env.RAYON_NUM_THREADS, undefined);
  assert.equal(localBuildEnvironment("vite.cmd", ["build"], env, "win32", 2).RAYON_NUM_THREADS, "1");
});

test("explicit worker settings are preserved", () => {
  assert.equal(localBuildEnvironment("vite", ["build"], { RAYON_NUM_THREADS: "3" }, "win32", 32).RAYON_NUM_THREADS, "3");
});

test("development, preview, other commands, CI and other platforms are unaffected", () => {
  for (const [command, args, env, platform] of [
    ["vite", ["dev"], {}, "win32"],
    ["vite", ["preview"], {}, "win32"],
    ["node", ["build"], {}, "win32"],
    ["vite", ["build"], { CI: "true" }, "win32"],
    ["vite", ["build"], {}, "linux"],
    ["vite", ["build"], {}, "darwin"],
  ]) assert.equal(localBuildEnvironment(command, args, env, platform, 32), null);
});

test("a real child inherits the Windows build priority and worker environment", { skip: process.platform !== "win32" }, () => {
  const moduleUrl = new URL("./build-resources.mjs", import.meta.url).href;
  const probe = `
    import { prepareLocalBuild } from ${JSON.stringify(moduleUrl)};
    import { execFileSync } from 'node:child_process';
    const env = { ...process.env };
    delete env.CI;
    delete env.RAYON_NUM_THREADS;
    const childEnv = prepareLocalBuild('vite', ['build'], env);
    process.stdout.write(execFileSync(process.execPath, ['-e',
      'console.log(JSON.stringify({priority:require("node:os").getPriority(),workers:process.env.RAYON_NUM_THREADS}))'
    ], { env: childEnv }));
  `;
  const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", probe], { encoding: "utf8" }));
  assert.equal(result.priority, constants.priority.PRIORITY_BELOW_NORMAL);
  assert.ok(Number(result.workers) >= 1 && Number(result.workers) <= 6);
});
