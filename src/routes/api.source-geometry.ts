import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/source-geometry')({ server: { handlers: {
  POST: async ({ request }) => {
    // This bridge is for the user's local development workspace. Hosted builds do not
    // silently write PDFs to a server filesystem or assume a Python installation.
    const host = new URL(request.url).hostname;
    if (process.env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1', '[::1]'].includes(host))
      return Response.json({ error: 'The Python source bridge is unavailable in this host.' }, { status: 503 });
    const { allowAssistantRequest, readAssistantBody, assistantFailure } = await import('../lib/assistantAi.server');
    if (!allowAssistantRequest(request)) return Response.json({ error: 'Cross-site request refused.' }, { status: 403 });
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
      return Response.json({ error: 'Expected JSON.' }, { status: 415 });
    try {
      const { sourceGeometry } = await import('../lib/sourceGeometry.server');
      const raw = await readAssistantBody(request.body, 42 * 1024 * 1024);
      return Response.json(await sourceGeometry(JSON.parse(raw), request.signal), { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const failure = assistantFailure(error);
      return Response.json({ error: failure.error }, { status: failure.status });
    }
  },
} } });
