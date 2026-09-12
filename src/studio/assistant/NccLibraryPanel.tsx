import { useEffect, useMemo, useRef, useState } from "react";
import { importNccPdf, listNccDocuments, nccOriginal } from "./nccLibrary";
import { nccReferencePrompt, searchNcc, type NccDocument, type NccMatch } from "./nccReferences";
import "./nccLibrary.css";

export function NccLibrary({ onAttach, initialTopic = "" }: { onAttach: (text: string) => void; initialTopic?: string }) {
  const [documents, setDocuments] = useState<NccDocument[]>([]);
  const [edition, setEdition] = useState("");
  const [topic, setTopic] = useState(initialTopic);
  const [selected, setSelected] = useState<NccMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Loading library…");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => { setTopic(initialTopic); }, [initialTopic]);
  useEffect(() => { let active = true; void listNccDocuments().then(value => { if (active) { setDocuments(value); setStatus(""); } }).catch(error => { if (active) setError(String(error)); }); return () => { active = false; }; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url.split("#")[0]); }, [preview]);
  const results = useMemo(() => searchNcc(documents, topic), [documents, topic]);
  return <section className="assistant-ncc-library" aria-label="NCC reference library">
    <p>Search your uploaded NCC documents, inspect the matching text, then add chosen references to your question.</p>
    {!documents.length && <div className="ncc-empty"><strong>No NCC files uploaded yet</strong><p>Add your files when ready. Section references and answers will be based on those documents.</p></div>}
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
    {documents.length > 0 && <details><summary>{documents.length} document{documents.length === 1 ? "" : "s"} in library</summary>{documents.map(document => <p key={document.id}>{document.name} · {document.edition} · {document.pageCount} pages</p>)}</details>}
    <label>Find a topic or section<input type="search" value={topic} onChange={event => setTopic(event.target.value)} placeholder="Search terms or a section number" disabled={!documents.length} /></label>
    {topic && <p>{results.length} matching excerpts. Keyword matches may not include every applicable provision.</p>}
    {results.slice(0, 100).map(result => <article key={result.id}>
      <label><input type="checkbox" checked={selected.some(item => item.id === result.id)} disabled={selected.length >= 6 && !selected.some(item => item.id === result.id)} onChange={event => setSelected(value => event.target.checked ? [...value, result] : value.filter(item => item.id !== result.id))} />
        <strong>{result.section ?? "Unnumbered excerpt"} · PDF page {result.page}</strong></label>
      <small>{result.documentName} · {result.edition}</small>
      <details><summary>Read excerpt</summary><p className="ncc-excerpt">{result.text}</p></details>
      <button type="button" onClick={async () => { try { setPreview({ url: URL.createObjectURL(await nccOriginal(result.documentId)) + `#page=${result.page}`, name: `${result.documentName} — PDF page ${result.page}` }); } catch (error) { setError(String(error)); } }}>View original page</button>
    </article>)}
    {results.length > 100 && <p>Showing the first 100 matches. Narrow the search to see more relevant results.</p>}
    {preview && <div><a href={preview.url} target="_blank" rel="noreferrer">Open {preview.name}</a><button type="button" onClick={() => setPreview(null)}>Close page link</button></div>}
    {selected.length > 0 && <div className="ncc-selected"><strong>{selected.length} references selected</strong><button type="button" onClick={() => { onAttach(nccReferencePrompt(selected)); }}>Add references to question</button><button type="button" onClick={() => setSelected([])}>Clear selection</button></div>}
  </section>;
}
