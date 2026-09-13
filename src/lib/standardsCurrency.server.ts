import { createHash } from 'node:crypto';

export const NCC_PUBLISHER = 'https://ncc.abcb.gov.au/editions/ncc-2022';
export type PublisherCheck = {
  checkedAt: string; source: string; status: 'checked' | 'unavailable';
  notices: string[]; pageSha256?: string;
};

// Explicit publisher notices only. No absence-of-notices => latest inference.
export function publisherNotices(html: string): string[] {
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ');
  const notices: string[] = [];
  if (/NCC 2022 Amendment 1 is superseded by\s+NCC 2022 Amendment 2/i.test(text))
    notices.push('ABCB lists Amendment 2 as superseding NCC 2022 Amendment 1.');
  if (/NCC 2022 is superseded by\s+NCC 2022 Amendment 1/i.test(text))
    notices.push('ABCB lists Amendment 1 as superseding the original NCC 2022 edition.');
  if (/NCC 2022 is to be read in conjunction with\s+this corrigendum/i.test(text))
    notices.push('ABCB says NCC 2022 must be read with its corrigendum.');
  return notices;
}

export async function checkNccPublisher(fetcher: typeof fetch = fetch): Promise<PublisherCheck> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetcher(NCC_PUBLISHER, { redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Accept: 'text/html' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw Error('Unavailable');
    const reader = response.body?.getReader();
    if (!reader) throw Error('Empty response');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 2_000_000) throw Error('Publisher page too large');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = Buffer.concat(chunks), html = bytes.toString('utf8');
    if (!/National Construction Code 2022/i.test(html) || !/Housing Provisions/i.test(html)) throw Error('Unrecognised page');
    return { checkedAt, source: NCC_PUBLISHER, status: 'checked', notices: publisherNotices(html), pageSha256: createHash('sha256').update(bytes).digest('hex') };
  } catch { return { checkedAt, source: NCC_PUBLISHER, status: 'unavailable', notices: [] }; }
}

let cached: PublisherCheck | undefined;
let pending: Promise<PublisherCheck> | undefined;
export function nccPublisherStatus(): Promise<PublisherCheck> {
  const ttl = cached?.status === 'checked' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
  if (cached && Date.now() - Date.parse(cached.checkedAt) < ttl) return Promise.resolve(cached);
  if (!pending) pending = checkNccPublisher().then(result => { cached = result; return result; }).finally(() => { pending = undefined; });
  return pending;
}
