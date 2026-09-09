import test from 'node:test';
import assert from 'node:assert/strict';
import { connectAppMcp } from './mcp.ts';

test('real MCP handshake discovers and calls a tool with its arguments', async () => {
  let received: unknown;
  const session = await connectAppMcp([{ name: 'measure', description: 'Measure fixture', inputSchema: { type: 'object', properties: { length: { type: 'number' } } }, execute: async args => { received = args; return { content: [{ type: 'text', text: 'Length: 4 m' }] }; } }]);
  try {
    assert.equal(session.client.getServerVersion()?.name, 'xray-workspace');
    assert.equal(session.tools[0].name, 'measure');
    const result = await session.client.callTool({ name: 'measure', arguments: { length: 4 } });
    assert.deepEqual(received, { length: 4 });
    assert.deepEqual(result.content, [{ type: 'text', text: 'Length: 4 m' }]);
    await assert.rejects(session.client.callTool({ name: 'missing', arguments: {} }), /Unknown/);
  } finally { await session.close(); }
});
test('tool failures remain MCP errors, never successful operations', async () => {
  const session = await connectAppMcp([{ name: 'save', description: 'Refused save', inputSchema: { type: 'object' }, execute: async () => { throw Error('Revision changed'); } }]);
  try { const result = await session.client.callTool({ name: 'save' }); assert.equal(result.isError, true); assert.match(JSON.stringify(result.content), /Revision changed/); }
  finally { await session.close(); }
});
