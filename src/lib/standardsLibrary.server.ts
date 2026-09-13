import { z } from 'zod';

const catalogSchema = z.object({ documents: z.array(z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/), filename: z.string(), title: z.string(),
  category: z.string(), edition: z.string().nullable(), kind: z.string(),
  local_path: z.string(), sha256: z.string(), size_bytes: z.number(),
}).passthrough()) });

export async function readStandardsCatalog() {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  return catalogSchema.parse(JSON.parse(await readFile(resolve('downloads/standards/CATALOG.json'), 'utf8')));
}

export async function readStandardsOriginal(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Invalid document identifier.');
  const entry = (await readStandardsCatalog()).documents.find(e => e.id === id);
  if (!entry) throw Error('Document not found.');
  const [{ readFile }, { resolve, sep }, { createHash }] = await Promise.all([
    import('node:fs/promises'), import('node:path'), import('node:crypto'),
  ]);
  const root = resolve('downloads/standards'), path = resolve(root, entry.local_path);
  if (!path.startsWith(root + sep)) throw Error('Invalid document path.');
  const bytes = await readFile(path);
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('Original document checksum changed.');
  return { entry, bytes: new Uint8Array(bytes) };
}

export async function searchStandards(topic: string, edition?: string) {
  const args = z.object({ topic: z.string().trim().min(2).max(200), edition: z.string().regex(/^(19|20)\d{2}$/).optional() }).parse({topic,edition});
  const { execFile } = await import('node:child_process');
  const output = await new Promise<string>((resolve,reject) => {
    execFile(process.env.XRAY_PYTHON_EXECUTABLE || 'python',
      ['scripts/search_standards_library.py','--query',args.topic,...(args.edition?['--edition',args.edition]:[])],
      { windowsHide:true,timeout:15000,maxBuffer:1024*1024,encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'} },
      (error,stdout) => error ? reject(Error('The local standards search index is unavailable.')) : resolve(stdout));
  });
  return JSON.parse(output) as Array<{ document: { id:string; filename:string; edition:string|null; sha256:string }; pdf_page:number; excerpt:string }>;
}
