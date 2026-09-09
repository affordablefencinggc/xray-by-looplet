import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type AssistantTool = {
  name: string;
  description: string;
  inputSchema: object;
  execute: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>; isError?: boolean }>;
};

/** Genuine MCP initialization, discovery and execution, without a network listener. */
export async function connectAppMcp(tools: readonly AssistantTool[]) {
  const names = new Set(tools.map(tool => tool.name));
  if (names.size !== tools.length) throw Error('Duplicate MCP tool names.');
  const server = new Server({ name: 'xray-workspace', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema } as Tool)) }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const tool = tools.find(item => item.name === request.params.name);
    if (!tool) throw Error(`Unknown X-Ray tool: ${request.params.name}`);
    try { return await tool.execute(request.params.arguments ?? {}) as CallToolResult; }
    catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Tool execution failed.' }] }; }
  });
  const client = new Client({ name: 'xray-live-assistant', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const discovered = await client.listTools();
    return { client, tools: discovered.tools, close: async () => { await client.close(); await server.close(); } };
  } catch (error) { await client.close(); await server.close(); throw error; }
}
