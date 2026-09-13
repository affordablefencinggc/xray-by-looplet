import type { NccMatch } from './nccReferences';

/** Read actual library receipts, never infer references from model prose. */
export function readNccMatches(value: unknown): NccMatch[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is NccMatch => {
    if (!item || typeof item !== 'object') return false;
    const r = item as NccMatch;
    if (typeof r.id !== 'string' || typeof r.documentId !== 'string' || typeof r.documentName !== 'string'
      || typeof r.edition !== 'string' || typeof r.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(r.sha256)
      || !Number.isInteger(r.page) || r.page < 1 || typeof r.text !== 'string' || r.text.length > 20000
      || (r.section !== null && typeof r.section !== 'string')) return false;
    const key = `${r.sha256}:${r.page}:${r.section ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 20);
}

export function nccDocumentLabel(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/_/g, ' ').replace(/^NCC (\d{4}) ABCB /, 'NCC $1 ');
}
