import type { NccMatch } from './nccReferences';
export type PublisherCheck = { checkedAt: string; source: string; status: 'checked' | 'unavailable'; notices: string[]; pageSha256?: string };
export async function checkStandardsPublisher(): Promise<PublisherCheck> {
  const response = await fetch('/api/standards-library?publisher-check=1');
  if (!response.ok) throw Error('Publisher check unavailable on this host.');
  return response.json();
}
export type StandardsDocument = { id:string; title:string; filename:string; category:string; edition:string|null; kind:string };
export const standardsOriginalUrl = (id:string,page=1) => `/api/standards-library?document=${encodeURIComponent(id)}#page=${page}`;
export async function listStandardsLibrary(): Promise<StandardsDocument[]> {
  const response = await fetch('/api/standards-library');
  if (!response.ok) return [];
  return (await response.json()).documents;
}
export async function searchStandardsLibrary(topic:string,edition?:string,signal?:AbortSignal):Promise<NccMatch[]> {
  const params = new URLSearchParams({q:topic}); if(edition)params.set('edition',edition);
  const response=await fetch(`/api/standards-library?${params}`,{signal});
  if(!response.ok)throw Error('The indexed standards library is unavailable on this host.');
  const rows=await response.json() as Array<{document:{id:string;filename:string;edition:string|null;sha256:string};pdf_page:number;excerpt:string}>;
  return rows.map(row=>({id:`library:${row.document.id}:${row.pdf_page}`,documentId:row.document.id,
    documentName:row.document.filename,edition:row.document.edition||'Edition not established',sha256:row.document.sha256,
    page:row.pdf_page,text:row.excerpt,section:null,score:1}));
}
