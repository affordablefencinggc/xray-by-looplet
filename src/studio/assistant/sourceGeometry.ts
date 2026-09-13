import { z } from 'zod';
import type { PlanBinary } from '../documentContract.ts';
import { hashAttachment } from './attachmentFiles.ts';

export const sourceGeometryArgs = z.object({ expectedJobId: z.string().min(1).max(100),
  page: z.number().int().min(1).max(100),
  region: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().positive().max(1), z.number().positive().max(1)])
    .refine(([x,y,w,h]) => x+w <= 1.000001 && y+h <= 1.000001).optional(),
  offset: z.number().int().min(0).max(600000).optional(),
  minimumLengthPt: z.number().min(0).max(1000).optional(),
  scaleSegmentId: z.string().min(1).max(200).optional(),
  knownLengthMm: z.number().positive().max(100000).optional(),
}).strict();

export async function readSourceGeometry(source: PlanBinary, args: z.infer<typeof sourceGeometryArgs>, fetcher: typeof fetch = fetch) {
  if (source.kind !== 'pdf' || source.bytes.length > 30*1024*1024) throw Error('Python source coordinates require a PDF up to 30 MB.');
  const bytes = Uint8Array.from(source.bytes);
  if (bytes.length !== source.sizeBytes || await hashAttachment(new Blob([bytes])) !== source.sha256) throw Error('Source bytes do not match the document identity.');
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset+16384));
  const response = await fetcher('/api/source-geometry', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(50000), body: JSON.stringify({ pdfBase64: btoa(binary), sha256: source.sha256, page: args.page, region: args.region, offset: args.offset, minimumLengthPt: args.minimumLengthPt, scaleSegmentId: args.scaleSegmentId, knownLengthMm: args.knownLengthMm }) });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Python source extraction failed; no guessed fallback was used.');
  if (result.sourceSha256 !== source.sha256 || result.page !== args.page || result.schema !== 'xray.assistant-source-geometry/v1') throw Error('Source geometry result identity mismatch.');
  const { image, ...geometry } = result;
  if (image?.mimeType !== 'image/png' || typeof image.data !== 'string' || !image.data.startsWith('iVBORw0KGgo')) throw Error('Source geometry image is unavailable.');
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ...geometry, documentId: source.documentId }) },
    { type: 'image' as const, mimeType: image.mimeType as 'image/png', data: image.data as string }] };
}
