import { z } from 'zod';
import { AssistantServiceError } from './assistantAi.server.ts';

export const geometryRequestSchema = z.object({
  pdfBase64: z.string().min(4).max(40 * 1024 * 1024).regex(/^[A-Za-z0-9+/]*={0,2}$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  page: z.number().int().min(1).max(100),
  region: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().positive().max(1), z.number().positive().max(1)])
    .refine(([x,y,w,h]) => x+w <= 1.000001 && y+h <= 1.000001).optional(),
  offset: z.number().int().min(0).max(600000).default(0),
  minimumLengthPt: z.number().min(0).max(1000).default(2),
  scaleSegmentId: z.string().min(1).max(200).optional(),
  knownLengthMm: z.number().positive().max(100000).optional(),
}).strict();

let busy = false;
export async function sourceGeometry(raw: unknown, signal?: AbortSignal) {
  const parsed = geometryRequestSchema.safeParse(raw);
  if (!parsed.success) throw new AssistantServiceError('Invalid source geometry request.', 400);
  if (busy) throw new AssistantServiceError('Source extraction is already running.', 409);
  signal?.throwIfAborted();
  busy = true;
  try {
    const { spawn } = await import('node:child_process');
    const { resolve, delimiter } = await import('node:path');
    const input = parsed.data;
    return await new Promise<Record<string, unknown>>((fulfil, reject) => {
      const child = spawn(process.env.XRAY_PYTHON_EXECUTABLE || 'python', ['-m', 'xray.assistant_geometry'], {
        cwd: process.cwd(), windowsHide: true, shell: false,
        env: { ...process.env, PYTHONPATH: [resolve('engine/python'), process.env.PYTHONPATH].filter(Boolean).join(delimiter) },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const chunks: Buffer[] = []; let bytes = 0; let finished = false;
      const done = (error?: Error, value?: Record<string, unknown>) => {
        if (finished) return; finished = true;
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
        if (error) { child.kill(); reject(error); } else fulfil(value!);
      };
      const abort = () => done(new AssistantServiceError('Source extraction cancelled.', 499));
      const timer = setTimeout(() => done(new AssistantServiceError('Source extraction timed out.', 504)), 45000);
      signal?.addEventListener('abort', abort, { once: true });
      child.on('error', () => done(new AssistantServiceError('Python source engine is unavailable. No geometry was generated.', 503)));
      child.stdin.on('error', () => done(new AssistantServiceError('Python source engine could not read the document.', 502)));
      child.stderr.resume();
      child.stdout.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 12 * 1024 * 1024) done(new AssistantServiceError('Source result too large; select a smaller area.', 413));
        else chunks.push(chunk);
      });
      child.on('close', code => {
        if (finished) return;
        try {
          const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (code !== 0 || value.error) throw new Error('Unsupported or invalid source; Python extraction failed.');
          if (value.schema !== 'xray.assistant-source-geometry/v1' || value.sourceSha256 !== input.sha256 || value.page !== input.page)
            throw new Error('Python result does not match the requested source.');
          done(undefined, value);
        } catch (error) { done(new AssistantServiceError(error instanceof Error ? error.message : 'Invalid Python result.', 422)); }
      });
      if (signal?.aborted) abort(); else child.stdin.end(JSON.stringify(input));
    });
  } finally { busy = false; }
}
