import { externalMcpConfig, verifyExternalMcp, allowExternalMcpSetup } from '../../../src/lib/externalMcp.server.ts';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
assert.equal(allowExternalMcpSetup(new Request('http://127.0.0.1:8080/api/mcp-connection')), true);
assert.equal(allowExternalMcpSetup(new Request('http://127.0.0.1:8080/api/mcp-connection', { headers: { origin: 'https://foreign.example' } })), false);
assert.equal(allowExternalMcpSetup(new Request('https://public.example/api/mcp-connection')), false);
const result = await verifyExternalMcp();
assert.deepEqual(result.tools.sort(), ['engine_info','marked_pdf','quote_draft','run_takeoff','run_takeoff_calibrated','wireframe_scene']);
const config = externalMcpConfig().mcpServers['xray-by-looplet'];
const paths = ['.cursor/mcp.json', '.agents/mcp_config.json', join(homedir(), 'AppData/Roaming/Claude/claude_desktop_config.json')];
const configured = [];
for (const path of paths) {
  if (!existsSync(path)) continue;
  const previous = JSON.parse(readFileSync(path, 'utf8'));
  const next = { ...previous, mcpServers: { ...previous.mcpServers, 'xray-by-looplet': config } };
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
  configured.push(path);
}
console.log(JSON.stringify({ host: process.env.COMPUTERNAME, result, configured, test: 'real MCP initialize, tools/list, tools/call engine_info; host/origin checks; external client configuration preserved', cleanup: 'stdio client and child process closed' }, null, 2));
