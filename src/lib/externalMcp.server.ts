import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, delimiter } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';

export function externalMcpConfig(root = process.cwd()) {
  if (!existsSync(resolve(root, 'engine/server/mcp_server.py'))) throw Error('The external MCP engine is not installed on this host.');
  const candidates = [process.env.XRAY_PYTHON, resolve(root, '.venv/Scripts/python.exe'), resolve(root, '.venv/bin/python'), resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')];
  const command = candidates.find(value => value && existsSync(value)) || (process.platform === 'win32' ? 'python' : 'python3');
  return { mcpServers: { 'xray-by-looplet': { command, args: ['-m', 'engine.server.mcp_server'], cwd: root,
    env: { PYTHONPATH: [resolve(root, 'engine/python'), resolve(root, 'engine'), root].join(delimiter) } } } };
}
export function allowExternalMcpSetup(request: Request) {
  const url = new URL(request.url);
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    && (!request.headers.get('origin') || request.headers.get('origin') === url.origin)
    && !['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site') || '');
}
let checking: Promise<{ tools: string[]; engine: unknown }> | null = null;
export function verifyExternalMcp() {
  if (checking) return checking;
  checking = (async () => {
    const config = externalMcpConfig().mcpServers['xray-by-looplet'];
    const transport = new StdioClientTransport({ ...config, env: { ...getDefaultEnvironment(), ...config.env }, stderr: 'pipe' });
    const client = new Client({ name: 'xray-external-connection-check', version: '1.0.0' });
    transport.stderr?.on('data', () => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          await client.connect(transport);
          const discovered = await client.listTools();
          const engine = await client.callTool({ name: 'engine_info', arguments: {} });
          if (engine.isError) throw Error('External engine_info check failed.');
          return { tools: discovered.tools.map(tool => tool.name), engine };
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('External MCP did not respond within 25 seconds.')), 25000); }),
      ]);
    } finally { clearTimeout(timer); await client.close(); await transport.close(); }
  })().finally(() => { checking = null; });
  return checking;
}
