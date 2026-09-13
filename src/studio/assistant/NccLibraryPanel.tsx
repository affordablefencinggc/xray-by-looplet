import { useEffect, useMemo, useRef, useState } from "react";
import { CopyAction } from './CopyAction';
import { importNccPdf, listNccDocuments, nccOriginal } from "./nccLibrary";
import { nccReferencePrompt, searchNcc, type NccDocument, type NccMatch } from "./nccReferences";
import "./nccLibrary.css";
import { listStandardsLibrary, searchStandardsLibrary, standardsOriginalUrl, type StandardsDocument } from './standardsLibrary';
import { checkStandardsPublisher, type PublisherCheck } from './standardsLibrary';

export function NccLibrary({ onAttach, initialTopic = "" }: { onAttach: (text: string) => void; initialTopic?: string }) {
  const [documents, setDocuments] = useState<NccDocument[]>([]);
  const [library, setLibrary] = useState<StandardsDocument[]>([]);
  const [publisher, setPublisher] = useState<PublisherCheck | null>(null);
  const [publisherPending, setPublisherPending] = useState(true);
  useEffect(() => {
    let active = true;
    void checkStandardsPublisher().then(value => { if (active) setPublisher(value); })
      .catch(() => {}).finally(() => { if (active) setPublisherPending(false); });
    return () => { active = false; };
  }, []);
  const [libraryMatches, setLibraryMatches] = useState<NccMatch[]>([]);
  const [libraryEdition, setLibraryEdition] = useState('');
  const [searching, setSearching] = useState(false);
  const [edition, setEdition] = useState("");
  const [topic, setTopic] = useState(initialTopic);
  const [selected, setSelected] = useState<NccMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Loading library…");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => { setTopic(initialTopic); }, [initialTopic]);
  useEffect(() => { let active=true; void listStandardsLibrary().then(rows=>{if(active)setLibrary(rows);}).catch(()=>{});return()=>{active=false;}; },[]);
  useEffect(() => {
    setLibraryMatches([]);
    if(!library.length || topic.trim().length<2){setSearching(false);return;}
    const controller=new AbortController();setSearching(true);
    const timer=setTimeout(()=>{void searchStandardsLibrary(topic,libraryEdition||undefined,controller.signal)
      .then(rows=>{if(!controller.signal.aborted){setLibraryMatches(rows);setError('');}})
      .catch(error=>{if(!controller.signal.aborted)setError(String(error));})
      .finally(()=>{if(!controller.signal.aborted)setSearching(false);});},250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[library.length,topic,libraryEdition]);
  useEffect(() => { let active = true; void listNccDocuments().then(value => { if (active) { setDocuments(value); setStatus(""); } }).catch(error => { if (active) setError(String(error)); }); return () => { active = false; }; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url.split("#")[0]); }, [preview]);
  const results = useMemo(() => [...libraryMatches,...searchNcc(documents, topic)], [documents, topic, libraryMatches]);
  return <section className="assistant-ncc-library" aria-label="NCC reference library">
    <details className="ncc-publisher-check">
      <summary>{publisherPending ? 'Checking ABCB publisher notices…' : publisher?.status === 'checked' ? `Publisher checked · ${new Date(publisher.checkedAt).toLocaleDateString('en-AU')}` : 'Publisher check unavailable'}</summary>
      <p>Checks ABCB’s NCC 2022 edition page automatically when this library opens. Successful checks are reused for 24 hours.</p>
      {publisher?.status === 'checked' && <>
        <ul>{publisher.notices.map(notice => <li key={notice}>{notice}</li>)}</ul>
        {!publisher.notices.length && <p>No recognised amendment notice was extracted. This does not establish that a document is current.</p>}
        <p>Individual PDF editions and project applicability still need review.</p>
      </>}
      {!publisherPending && publisher?.status !== 'checked' && <p>Unable to confirm publisher notices. Your documents remain available; no currency verification has been granted.</p>}
      <a href="https://ncc.abcb.gov.au/editions/ncc-2022" target="_blank" rel="noreferrer">Open ABCB edition and amendment notices</a>
    </details>
    <p>Search your uploaded NCC documents, inspect the matching text, then add chosen references to your question.</p>
    {!documents.length && !library.length && <div className="ncc-empty"><strong>No NCC files uploaded yet</strong><p>Add your files when ready. Section references and answers will be based on those documents.</p></div>}
    {library.length>0 && <>
      <p><strong>{library.length} downloaded references available</strong><br/>NCC editions, housing guides and historical archives. Originals are backed up in private storage; search uses this computer’s PDF index.</p>
      <label>Library edition<select value={libraryEdition} onChange={event=>setLibraryEdition(event.target.value)}><option value="">All editions</option>{[...new Set(library.flatMap(d=>d.edition?[d.edition]:[]))].sort().reverse().map(year=><option key={year}>{year}</option>)}</select></label>
      <details><summary>Browse downloaded documents</summary>{library.filter(d=>!libraryEdition||d.edition===libraryEdition).map((document,index)=><p className="assistant-copy-target" key={`${document.id}:${index}`}><CopyAction text={`${document.title} ? ${document.edition || "Edition unconfirmed"}`} label="document title"/><a href={standardsOriginalUrl(document.id)} target="_blank" rel="noreferrer">{document.title}</a> <span className="ncc-currency-tag" title="Latest version not verified. Review the original, amendments, jurisdiction and project date.">Currency unverified</span><br/><small>{document.category.replaceAll('_',' ')}{document.kind==='unverified_summary'?' · Unverified summary, not the published standard':''}{document.kind==='source_archive'?' · Archive; not included in page search':''}</small></p>)}</details>
      <small>Check the printed title, edition and jurisdiction in each original. Download filenames are not independently verified. Summary guides are excluded from source searches.</small>
    </>}
    <label>Document edition and volume<input value={edition} maxLength={160} onChange={event => setEdition(event.target.value)} placeholder="As printed on the PDF" disabled={busy} /></label>
    <input ref={upload} type="file" accept=".pdf" hidden onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file || busy) return;
      setBusy(true); setError("");
      try { const document = await importNccPdf(file, edition, setStatus); setDocuments(value => [...value, document]); setStatus(`${document.name} indexed: ${document.pageCount} PDF pages.`); }
      catch (error) { setError(error instanceof Error ? error.message : String(error)); setStatus(""); }
      finally { setBusy(false); }
    }} />
    <button type="button" disabled={busy || !edition.trim()} onClick={() => upload.current?.click()}>Add NCC PDF</button>
    <small>Saved on this device and available across projects. Editions are labelled by you; their applicability is not automatically verified.</small>
    {status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}
    {documents.length > 0 && <details><summary>{documents.length} document{documents.length === 1 ? "" : "s"} in library</summary>{documents.map(document => <p className="assistant-copy-target" key={document.id}><CopyAction text={`${document.name} ? ${document.edition}`} label="document title"/>{document.name} · {document.edition} · {document.pageCount} pages</p>)}</details>}
    <label>Find a topic or section<input type="search" value={topic} onChange={event => setTopic(event.target.value)} placeholder="Search terms or a section number" disabled={!documents.length && !library.length} /></label>
    {searching && <p role="status">Searching original PDF pages…</p>}
    {topic && <p>{results.length} matching excerpts. Keyword matches may not include every applicable provision.</p>}
    {results.slice(0, 100).map(result => <article key={result.id}>
      <label><input type="checkbox" checked={selected.some(item => item.id === result.id)} disabled={selected.length >= 6 && !selected.some(item => item.id === result.id)} onChange={event => setSelected(value => event.target.checked ? [...value, result] : value.filter(item => item.id !== result.id))} />
        <strong>{result.section ?? "Unnumbered excerpt"} · PDF page {result.page}</strong></label>
      <small>{result.documentName} · {result.edition}</small>
      <details><summary>Read excerpt</summary><div className="assistant-copy-target"><p className="ncc-excerpt">{result.text}</p><CopyAction text={`${result.documentName} · ${result.edition} · PDF page ${result.page}\n\n${result.text}`} label="reference excerpt with citation"/></div></details>
      <button type="button" onClick={async () => { try { setPreview({ url: result.id.startsWith('library:') ? standardsOriginalUrl(result.documentId,result.page) : URL.createObjectURL(await nccOriginal(result.documentId)) + `#page=${result.page}`, name: `${result.documentName} — PDF page ${result.page}` }); } catch (error) { setError(String(error)); } }}>View original page</button>
    </article>)}
    {results.length > 100 && <p>Showing the first 100 matches. Narrow the search to see more relevant results.</p>}
    {preview && <div><a href={preview.url} target="_blank" rel="noreferrer">Open {preview.name}</a><button type="button" onClick={() => setPreview(null)}>Close page link</button></div>}
    {selected.length > 0 && <div className="ncc-selected"><strong>{selected.length} references selected</strong><button type="button" onClick={() => { onAttach(nccReferencePrompt(selected)); }}>Add references to question</button><button type="button" onClick={() => setSelected([])}>Clear selection</button></div>}
  </section>;
}
