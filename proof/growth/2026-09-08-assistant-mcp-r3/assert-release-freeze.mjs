import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
/** Packaging/remote actions stay unavailable until root supplies its explicit source freeze. */
export function assertReleaseFreeze() {
  const root=process.cwd(), guardFile='proof/growth/2026-09-08-assistant-mcp-r3/release-freeze-guard.json';
  assert(fs.existsSync(guardFile),'Explicit SOURCE FREEZE and passed release-freeze-guard required; no packaging/build performed');
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const guard=read(guardFile);assert.equal(guard.status,'pass');assert(/^[a-f0-9]{64}$/.test(guard.scopeSha256));
  const manifestPath=path.resolve(guard.manifest);assert(manifestPath.startsWith(root+path.sep));
  const manifest=read(manifestPath);assert.equal(manifest.scopeSha256,guard.scopeSha256);assert.equal(manifest.entries.length,guard.files);
  for(const entry of manifest.entries){const target=path.resolve(entry.path);assert(target.startsWith(root+path.sep));assert.equal(createHash('sha256').update(fs.readFileSync(target)).digest('hex'),entry.sha256,`Frozen source drift: ${entry.path}`);}
  const paths=new Set(manifest.entries.map(entry=>entry.path.replaceAll('\\','/')));
  for(const required of ['package.json','package-lock.json','src-tauri/src/assistant_ai.rs','src-tauri/src/material_ai.rs','src-tauri/src/lib.rs']) assert(paths.has(required),'Assistant release freeze must include '+required);
  for(const test of ["src/studio/assistant/mcp.test.ts","src/studio/assistant/conversation.test.ts","src/lib/assistantAi.server.test.ts","src/studio/assistant/appTools.test.ts"]) assert(fs.existsSync(test),'Assistant release test is not ready: '+test);
  const pkg=read('package.json'),lock=read('package-lock.json');
  assert(pkg.dependencies['@modelcontextprotocol/sdk'],'MCP SDK is required');
  assert.equal(lock.packages[''].dependencies['@modelcontextprotocol/sdk'],pkg.dependencies['@modelcontextprotocol/sdk'],'MCP SDK lockfile mismatch');
  assert(lock.packages['node_modules/@modelcontextprotocol/sdk']?.version,'MCP SDK missing from frozen lockfile');
  return guard;
}
