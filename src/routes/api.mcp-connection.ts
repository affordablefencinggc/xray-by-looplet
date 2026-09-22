import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/mcp-connection')({ server: { handlers: {
  GET: async ({ request }) => {
    const api = await import('../lib/externalMcp.server');
    const headers = { 'Cache-Control': 'no-store' };
    if (!api.allowExternalMcpSetup(request)) return Response.json({ error: 'External MCP setup is available on the local X-Ray host only.' }, { status: 403, headers });
    try { return Response.json({ config: api.externalMcpConfig() }, { headers }); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'External MCP unavailable.' }, { status: 503, headers }); }
  },
  POST: async ({ request }) => {
    const api = await import('../lib/externalMcp.server');
    const headers = { 'Cache-Control': 'no-store' };
    if (!api.allowExternalMcpSetup(request)) return Response.json({ error: 'External MCP setup is available on the local X-Ray host only.' }, { status: 403, headers });
    try { return Response.json(await api.verifyExternalMcp(), { headers }); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'External MCP check failed.' }, { status: 503, headers }); }
  },
} } });
