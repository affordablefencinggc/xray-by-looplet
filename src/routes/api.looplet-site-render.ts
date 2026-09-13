import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/looplet-site-render')({
  server: { handlers: {
    POST: async ({ request }) => {
      const { handleLoopletSiteRender } = await import('../lib/loopletSiteRender.server');
      return handleLoopletSiteRender(request);
    },
  } },
});
