import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/standards-library')({ server: { handlers: {
  GET: async ({request}) => {
    const url = new URL(request.url);
    // This PC's library is local; hosted access must use an authenticated storage adapter.
    if (process.env.NODE_ENV !== 'development' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname))
      return Response.json({error:'This computer’s standards library is not connected on this host.'},{status:503});
    if (request.headers.get('sec-fetch-site') === 'cross-site') return new Response('Cross-site request refused.',{status:403});
    try {
      if (url.searchParams.has('publisher-check')) {
        const { nccPublisherStatus } = await import('../lib/standardsCurrency.server');
        return Response.json(await nccPublisherStatus(), {headers:{'Cache-Control':'no-store'}});
      }
      const library = await import('../lib/standardsLibrary.server');
      const id = url.searchParams.get('document');
      if (id) {
        const {entry,bytes} = await library.readStandardsOriginal(id);
        return new Response(bytes,{headers:{
          'Content-Type':entry.kind==='source_pdf'?'application/pdf':entry.kind==='source_archive'?'application/zip':'text/plain; charset=utf-8',
          'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(entry.filename)}`,
          'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store',
        }});
      }
      const topic = url.searchParams.get('q');
      return Response.json(topic ? await library.searchStandards(topic,url.searchParams.get('edition')||undefined) : await library.readStandardsCatalog(),{headers:{'Cache-Control':'no-store'}});
    } catch {
      return Response.json({error:'The local reference library could not be read. Original files are preserved.'},{status:503});
    }
  },
} } });
