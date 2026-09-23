import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Download, FileUp, Plus, RefreshCw } from "lucide-react";
import { addPricedLine, appendPriceBookRevision, editPriceBook, parsePriceCsv, previewPriceRows, priceBookError,
  priceCsvTemplate, priceImportSchema, priceLineAmount, priceRevisionCsv, pricedWorksheetCsv, pricedWorksheetTotals, readBrowserPriceBooks, removePricedLine,
  resolvePricedLine, savePriceBooks, suggestPriceMapping, priceBookKey, PRICE_CSV_LIMIT,
  type CsvTable, type PriceBook, type PriceBookLibrary, type PriceBookSession, type PriceImport, type PriceMapping } from "./priceBooks.ts";
import "./priceBooks.css";
import { workbookPriceTable, type PriceWorkbook } from "./priceWorkbookTable.ts";
import { readPriceWorkbookInWorker } from "./priceWorkbookClient.ts";
import { PricingResearchPanel } from "./PricingResearchPanel.tsx";
import { clearBomMapping, setBomMapping, syncBomPricedLines, type BomPricingChange, type BomPricingSource } from "./bomPricing.ts";
import { priceBookLibrarySchema } from "./priceBooks.ts";
import { buildQuoteDraft, quoteDraftPdf, type QuoteDraft } from "./quotePdf.ts";
import { quoteEmailLink, quoteHandoverFiles, quoteHandoverZip, type HandoverFile } from "./quoteHandover.ts";

/** Committed material-register lines offered to the worksheet; `current` is false once the takeoff changed after the build. */
export type PriceBookBomSource = BomPricingSource & { current: boolean };
const describeChanges = (changes: BomPricingChange[]) => changes.map(change => change.kind === "updated" ? `${change.key} ${change.from} → ${change.to}`
  : change.kind === "added" ? `${change.key} added (${change.quantity})` : `${change.key} removed`).join("; ");

type SourceFile = { fileName: string; sizeBytes: number; sha256: string } & ({ kind: "csv"; text: string } | { kind: "xlsx"; workbook: PriceWorkbook });
type RateSelection = { bookId: string; revision: number; sourceLine: number };
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const taxLabel = (basis: string) => basis === "inclusive" ? "tax included" : basis === "exclusive" ? "tax excluded" : "tax unspecified";

/** Project-local supplier imports and explicitly priced worksheet. Existing takeoff and quote rates are untouched. */
export function PriceBookPanel({ jobId, onSessionChange, bom = null }: { jobId: string; onSessionChange?: (session: PriceBookSession | null) => void; bom?: PriceBookBomSource | null }) {
  const [session, setSession] = useState<PriceBookSession | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"library" | "import" | "worksheet">("library"), [archived, setArchived] = useState(false), [search, setSearch] = useState("");
  const [file, setFile] = useState<SourceFile | null>(null), [delimiter, setDelimiter] = useState<"," | ";" | "\t">(","), [mapping, setMapping] = useState<PriceMapping | null>(null);
  const [worksheet, setWorksheet] = useState(""), [headerRow, setHeaderRow] = useState(1), [readingWorkbook, setReadingWorkbook] = useState(false);
  const [name, setName] = useState(""), [targetId, setTargetId] = useState(""), [supplier, setSupplier] = useState(""), [currency, setCurrency] = useState("AUD"), [decimals, setDecimals] = useState(2);
  const [tax, setTax] = useState<"inclusive" | "exclusive" | "unspecified">("unspecified"), [taxPercent, setTaxPercent] = useState(""), [effectiveDate, setEffectiveDate] = useState(""), [sourceReference, setSourceReference] = useState("");
  const [review, setReview] = useState<PriceImport | null>(null), [selection, setSelection] = useState<RateSelection | null>(null), [quantity, setQuantity] = useState("");
  const input = useRef<HTMLInputElement>(null), generation = useRef(0), currentJob = useRef(jobId); currentJob.current = jobId;
  const workbookRead = useRef<AbortController | null>(null);
  useEffect(() => {
    generation.current++; workbookRead.current?.abort(); setBusy(false); setReadingWorkbook(false); setSession(readBrowserPriceBooks(jobId)); setFile(null); setMapping(null); setReview(null); setSelection(null); setNotice(""); setTargetId(""); setTab("library");
    return () => { generation.current++; workbookRead.current?.abort(); };
  }, [jobId]);
  useEffect(() => {
    onSessionChange?.(session?.value.jobId === jobId ? session : null);
  }, [session, jobId, onSessionChange]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== null && event.key !== priceBookKey(jobId)) return;
      if (event.storageArea !== null && event.storageArea !== localStorage) return;
      setSession(readBrowserPriceBooks(jobId));
      setReview(null);
      setNotice("Supplier library changed in another window. Saved rates were reloaded; review any pending import again.");
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [jobId]);
  const value = session?.value.jobId === jobId ? session.value : null;
  const selectedSheet = file?.kind === "xlsx" ? file.workbook.sheets.find(sheet => sheet.name === worksheet) : null;
  const { table, parseError } = useMemo((): { table: CsvTable | null; parseError: string } => {
    try { return { table: file?.kind === "csv" ? parsePriceCsv(file.text, delimiter, headerRow) : selectedSheet ? workbookPriceTable(selectedSheet, headerRow) : null, parseError: "" }; }
    catch (error) { return { table: null, parseError: priceBookError(error) }; }
  }, [file, delimiter, headerRow, selectedSheet]);
  function changeSource(next: { worksheet?: string; headerRow?: number; delimiter?: typeof delimiter }) {
    const selectedWorksheet = next.worksheet ?? worksheet, selectedHeader = next.headerRow ?? headerRow, separator = next.delimiter ?? delimiter;
    setWorksheet(selectedWorksheet); setHeaderRow(selectedHeader); setDelimiter(separator); setReview(null);
    try {
      const sheet = file?.kind === "xlsx" ? file.workbook.sheets.find(item => item.name === selectedWorksheet) : null;
      const updated = file?.kind === "csv" ? parsePriceCsv(file.text, separator, selectedHeader) : sheet ? workbookPriceTable(sheet, selectedHeader) : null;
      setMapping(updated ? suggestPriceMapping(updated.headers) : null);
    } catch { setMapping(null); }
  }
  const rows = table && mapping ? previewPriceRows(table, mapping) : null;
  const book = value?.books.find(b => b.id === selection?.bookId), revision = book?.revisions.find(r => r.revision === selection?.revision), rate = revision?.rows.find(r => r.sourceLine === selection?.sourceLine);
  let amount = "", quantityError = "";
  if (rate && revision && quantity) try { amount = priceLineAmount(rate.rate, quantity, revision.metadata.amountDecimals); } catch (error) { quantityError = priceBookError(error); }
  async function save(next: PriceBookLibrary, message: string) {
    if (!session || busy) return false;
    const savingJob = jobId;
    setBusy(true); setNotice("");
    try { const saved = await savePriceBooks(session, next); if (currentJob.current === savingJob) { setSession(saved); setNotice(message); } return true; }
    catch (error) { if (currentJob.current === savingJob) setNotice(priceBookError(error)); return false; }
    finally { setBusy(false); }
  }
  // Linked lines follow each new committed material register; a stale register never changes prices.
  const bomSignature = bom?.current ? JSON.stringify([bom.commitRevision, bom.lines]) : null;
  useEffect(() => {
    if (!bom?.current || !value || busy || session?.blocked || !(value.bomMappings?.length || value.worksheet.some(line => line.bom))) return;
    try {
      const synced = syncBomPricedLines(value, bom);
      if (synced.library.revision !== value.revision)
        void save(synced.library, synced.changes.length ? `Priced lines updated from material register ${bom.commitRevision}: ${describeChanges(synced.changes)}.` : `Priced lines linked to material register ${bom.commitRevision}.`);
    } catch (error) { setNotice(priceBookError(error)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomSignature, value?.revision, busy]);
  function saveMapping(key: string, rate: string, factor: string, roundUp: boolean) {
    if (!value || !bom) return;
    try {
      const [bookId, revision, sourceLine] = rate.split("|");
      const mapped = rate ? setBomMapping(value, { key, bookId, bookRevision: Number(revision), sourceLine: Number(sourceLine), factor: factor.trim() || "1", rounding: roundUp ? "up" : "exact" }) : clearBomMapping(value, key);
      const synced = bom.current ? syncBomPricedLines(mapped, bom).library : mapped;
      void save(priceBookLibrarySchema.parse({ ...synced, revision: value.revision + 1 }), rate ? `${key} priced from the material register.` : `${key} is no longer priced from the material register.`);
    } catch (error) { setNotice(priceBookError(error)); }
  }
  async function chooseFile(candidate: File | undefined) {
    if (!candidate) return;
    const ticket = ++generation.current; setBusy(true); setNotice(""); setReview(null); setFile(null); setMapping(null);
    try {
      if (!candidate.size || candidate.size > PRICE_CSV_LIMIT) throw Error("Choose a non-empty CSV or XLSX file up to 2 MB.");
      if (!/\.(csv|tsv|xlsx)$/i.test(candidate.name)) throw Error("Choose a CSV, TSV or XLSX file. Legacy XLS, XLSM and password-protected workbooks are not supported.");
      const bytes = await candidate.arrayBuffer();
      const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
      if (ticket !== generation.current) return;
      const common = { fileName: candidate.name, sizeBytes: candidate.size, sha256 };
      setName(candidate.name.replace(/\.(csv|tsv|xlsx)$/i, "").slice(0, 120)); setWorksheet(""); setHeaderRow(1);
      if (/\.xlsx$/i.test(candidate.name)) {
        const controller = new AbortController(); workbookRead.current?.abort(); workbookRead.current = controller; setReadingWorkbook(true);
        const workbook = await readPriceWorkbookInWorker(bytes, controller.signal);
        if (ticket === generation.current) setFile({ ...common, kind: "xlsx", workbook });
      } else {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes), separator = /\.tsv$/i.test(candidate.name) ? "\t" : delimiter;
        setDelimiter(separator); setFile({ ...common, kind: "csv", text });
        try { const parsed = parsePriceCsv(text, separator); setHeaderRow(parsed.headerLine ?? 1); setMapping(suggestPriceMapping(parsed.headers)); } catch { /* Header row/separator can be corrected in the preview. */ }
      }
    } catch (error) { if (ticket === generation.current) setNotice(priceBookError(error)); }
    finally { if (ticket === generation.current) { setBusy(false); setReadingWorkbook(false); } }
  }
  function prepareReview() {
    try {
      if (!file || !table || !mapping || !rows || rows.errors.length) throw Error("Resolve the sheet and row errors before review.");
      if (!targetId && !name.trim()) throw Error("Name this price book.");
      if (taxPercent && !/^\d{1,3}(?:\.\d{1,6})?$/.test(taxPercent)) throw Error("Tax percent must be a decimal from 0 to 100.");
      setReview(priceImportSchema.parse({ metadata: { supplier, currency, amountDecimals: decimals, taxBasis: tax,
        taxPercent: tax === "unspecified" || !taxPercent ? null : Number(taxPercent), effectiveDate, sourceReference },
        source: { fileName: file.fileName, sha256: file.sha256, sizeBytes: file.sizeBytes, kind: file.kind, headerRow,
          ...(file.kind === "xlsx" ? { worksheet } : { delimiter }), headers: table.headers, mapping }, rows: rows.rows }));
      setNotice("");
    } catch (error) { setNotice(priceBookError(error)); }
  }
  function chooseRate(b: PriceBook, rev: number, sourceLine: number) { setSelection({ bookId: b.id, revision: rev, sourceLine }); setQuantity(""); setTab("worksheet"); setNotice(""); }
  const disabled = busy || !value || session?.blocked;
  return <section className="price-books" aria-label="Project price books" data-price-import-state={readingWorkbook ? "loading" : review ? "review" : file ? parseError || rows?.errors.length ? "invalid" : table && mapping ? "ready" : "choose-sheet" : "idle"} data-price-import-rows={rows?.rows.length ?? 0}>
    <header><div><h2>Price books</h2><p>Import supplier sheets, preserve revisions and apply chosen rates to a priced worksheet.</p></div>
      <button className="pill" disabled={busy} onClick={() => { setSession(readBrowserPriceBooks(jobId)); setReview(null); setNotice("Library reloaded."); }}><RefreshCw size={16} />Reload library</button></header>
    <div className="price-tabs" role="group" aria-label="Price book views">
      <button className="pill" aria-pressed={tab === "library"} onClick={() => setTab("library")}>Library ({value?.books.length ?? 0})</button>
      <button className="pill" aria-pressed={tab === "import"} onClick={() => setTab("import")}><FileUp size={16} />Import price sheet</button>
      <button className="pill" aria-pressed={tab === "worksheet"} onClick={() => setTab("worksheet")}>Priced worksheet ({value?.worksheet.length ?? 0})</button>
    </div>
    {session?.error && <p className="price-notice" role="alert">{session.error}</p>}
    {notice && <p className="price-notice" role="status">{notice}</p>}
    <p className="price-help">Saved with this project on this device. Your existing reference sheet remains available in Settings. Map material-register items to rates once and their priced lines follow each new material build; other worksheet quantities are entered by you.</p>
    {tab === "import" && <>
      <div className="price-actions"><button className="pill" disabled={disabled} onClick={() => input.current?.click()}><FileUp size={16} />Choose CSV or Excel workbook</button>
        <button className="pill" onClick={() => download(priceCsvTemplate(), "price-book-template.csv")}><Download size={16} />CSV template</button></div>
      <input ref={input} hidden type="file" accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Supplier price file" onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ""; }} />
      <p className="price-help">CSV/TSV or XLSX, up to 2 MB / 5,000 rates. Select one worksheet and its header row. Formulas are never calculated; mapped formula cells must be replaced with reviewed values. Rates use decimal points and up to 6 decimal places, without currency symbols or thousands separators.</p>
      {readingWorkbook && <div className="price-notice" role="status"><p>Reading workbook worksheets…</p><button className="pill" onClick={() => { generation.current++; workbookRead.current?.abort(); setReadingWorkbook(false); setBusy(false); setNotice("Workbook import cancelled. Saved price books are unchanged."); }}>Cancel workbook reading</button></div>}
      {file && <>
        <p><strong>{file.fileName}</strong> · {file.sizeBytes.toLocaleString()} bytes</p>
        {!review && <div className="price-fields">
          {file.kind === "csv" ? <label>Separator<select aria-label="Price file separator" value={delimiter} onChange={e => changeSource({ delimiter: e.target.value as typeof delimiter })}><option value=",">Comma</option><option value=";">Semicolon</option><option value={"\t"}>Tab</option></select></label> : <label>Workbook worksheet<select aria-label="Workbook worksheet" value={worksheet} onChange={e => changeSource({ worksheet: e.target.value, headerRow: 1 })}><option value="">Choose a worksheet</option>{file.workbook.sheets.map(sheet => <option key={sheet.name} value={sheet.name}>{sheet.name}{sheet.issue ? " (needs a smaller table)" : ""}</option>)}</select></label>}
          <label>Header row<input aria-label="Price header row" type="number" min={1} max={100} value={headerRow || ""} onChange={e => changeSource({ headerRow: Number(e.target.value) })} /></label>
          <label>Save as<select value={targetId} onChange={e => setTargetId(e.target.value)}><option value="">New price book</option>{value?.books.filter(b => !b.archived).map(b => <option key={b.id} value={b.id}>New revision of {b.name}</option>)}</select></label>
          {!targetId && <label>Price book name<input maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>}
          <label>Supplier<input maxLength={200} value={supplier} onChange={e => setSupplier(e.target.value)} /></label>
          <label>Currency code<input maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} /></label>
          <label>Amount decimal places<select value={decimals} onChange={e => setDecimals(Number(e.target.value))}>{[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Tax basis<select value={tax} onChange={e => setTax(e.target.value as typeof tax)}><option value="unspecified">Unspecified</option><option value="exclusive">Tax excluded</option><option value="inclusive">Tax included</option></select></label>
          {tax !== "unspecified" && <label>Tax percent (optional)<input inputMode="decimal" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} placeholder="Leave blank if unknown" /></label>}
          <label>Effective date<input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} /></label>
          <label className="price-wide">Source reference<input maxLength={2000} value={sourceReference} onChange={e => setSourceReference(e.target.value)} placeholder="Supplier quote number, catalogue or source URL" /></label>
        </div>}
        {!review && selectedSheet && <details className="price-source-preview" open><summary>Worksheet preview — first 8 populated rows</summary><p className="price-help">Use the row numbers to choose your headings. {selectedSheet.formulaCells} formula cells detected in this sheet. Formula values are not read or calculated.</p><div className="price-table-wrap"><table><thead><tr><th>Row</th>{Array.from({ length: Math.min(8, selectedSheet.rows[0]?.cells.length ?? 0) }, (_, i) => <th key={i}>{String.fromCharCode(65 + i)}</th>)}</tr></thead><tbody>{selectedSheet.rows.slice(0, 8).map(row => <tr key={row.line}><th>{row.line}</th>{row.cells.slice(0, 8).map((cell, i) => <td key={i}>{row.cellErrors?.[i] ? <span title={row.cellErrors[i]}>Needs review</span> : cell}</td>)}</tr>)}</tbody></table></div></details>}
        {parseError && <p role="alert">{parseError}</p>}
        {!review && table && mapping && <fieldset><legend>Match your columns</legend><div className="price-fields">{(["stockCode", "description", "unit", "rate"] as const).map(field => <label key={field}>{({ stockCode: "Stock code (optional)", description: "Description", unit: "Unit", rate: "Rate" })[field]}<select value={mapping[field] ?? -1} onChange={e => setMapping({ ...mapping, [field]: Number(e.target.value) < 0 ? null : Number(e.target.value) })}>{field === "stockCode" && <option value={-1}>No stock code</option>}{table.headers.map((header, i) => <option key={i} value={i}>{i + 1}: {header || "Unnamed column"}</option>)}</select></label>)}</div></fieldset>}
        {!!rows?.errors.length && <div className="price-notice" role="alert"><strong>Import blocked until these lines are corrected</strong><ul>{rows.errors.map((error, i) => <li key={i}>{error}</li>)}</ul><p>No rates have been saved.</p></div>}
        {rows && !rows.errors.length && <><p>{rows.rows.length} valid rates · previewing the first {Math.min(20, rows.rows.length)}</p><div className="price-table-wrap"><table><thead><tr><th>Source line</th><th>Stock code</th><th>Description</th><th>Unit</th><th>Rate</th></tr></thead><tbody>{rows.rows.slice(0, 20).map(row => <tr key={row.sourceLine}><td>{row.sourceLine}</td><td>{row.stockCode || "—"}</td><td>{row.description}</td><td className="price-scalar">{row.unit}</td><td className="price-scalar">{row.rate}</td></tr>)}</tbody></table></div></>}
        {review ? <div className="price-review"><h3>Review before saving</h3><p>{targetId ? `Append revision to ${value?.books.find(b => b.id === targetId)?.name}` : `Create ${name}`} · {review.rows.length} rates</p>
          <p>{review.metadata.supplier} · {review.metadata.currency} · {taxLabel(review.metadata.taxBasis)}{review.metadata.taxPercent !== null ? ` (${review.metadata.taxPercent}%)` : ""} · effective {review.metadata.effectiveDate}</p>
          <p>{review.metadata.sourceReference}</p><p className="price-help">{review.source.kind === "xlsx" ? `Worksheet: ${review.source.worksheet} · ` : ""}Header row: {review.source.headerRow ?? 1}. Existing revisions and priced lines remain unchanged. Saving the book does not apply any rate.</p>
          <div className="price-actions"><button className="pill primary" disabled={disabled} onClick={() => { if (value) { try { const next = appendPriceBookRevision(value, review, name, targetId || null); void save(next, "Price book revision saved. Choose a rate in the library to price a line.").then(ok => { if (ok) { setReview(null); setFile(null); setTab("library"); } }); } catch (error) { setNotice(priceBookError(error)); } } }}>Save reviewed price book</button><button className="pill" disabled={busy} onClick={() => setReview(null)}>Back to mapping</button></div>
        </div> : <button className="pill primary" disabled={disabled || !rows || !!rows.errors.length || !!parseError} onClick={prepareReview}>Review import</button>}
      </>}
    </>}
    {tab === "library" && <>
      <div className="price-toolbar"><label>Find a price book<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or supplier" /></label><button className="pill" aria-pressed={archived} onClick={() => setArchived(!archived)}><Archive size={16} />{archived ? "Show active" : "Show archived"}</button></div>
      {!value?.books.some(b => b.archived === archived) && <div className="price-empty"><h3>{archived ? "No archived price books" : "Keep supplier pricing in one place"}</h3><p>Import a supplier sheet, check its columns and source, then save a named revision. Every applied line keeps the rate version you chose.</p></div>}
      {value?.books.filter(b => b.archived === archived && `${b.name} ${b.revisions.at(-1)?.metadata.supplier}`.toLowerCase().includes(search.toLowerCase())).map(b => <BookCard key={b.id} book={b} disabled={!!disabled} onUse={(rev, line) => chooseRate(b, rev, line)} onSaveName={nextName => { try { void save(editPriceBook(value, b.id, { name: nextName }), "Price book renamed."); } catch (error) { setNotice(priceBookError(error)); } }} onArchive={() => { try { void save(editPriceBook(value, b.id, { archived: !b.archived }), b.archived ? "Price book restored." : "Price book archived. Applied lines are preserved."); } catch (error) { setNotice(priceBookError(error)); } }} />)}
    </>}
    {tab === "worksheet" && <>
      {bom && value && <BomPricingSection bom={bom} library={value} disabled={!!disabled} onSave={saveMapping} />}
      <p className="price-help">Apply a saved rate by entering its quantity in the stated unit. Amounts use your selected decimal precision and half-up rounding. No tax, freight, waste, markup or currency conversion is added.</p>
      {!!value?.worksheet.length && <><button className="pill" onClick={() => download(pricedWorksheetCsv(value), "project-priced-worksheet.csv")}><Download size={16} />Export priced worksheet CSV</button>
        <QuoteDraftForm library={value} register={bom ? { commitRevision: bom.commitRevision, current: bom.current } : null} onNotice={setNotice} /><div className="price-review"><h3>Worksheet subtotals</h3>{pricedWorksheetTotals(value).map((total, i) => <p key={i}><strong>{total.currency} {total.amount}</strong> · {taxLabel(total.taxBasis)}{total.taxPercent !== null ? ` (${total.taxPercent}%)` : ""} · {total.count} lines</p>)}<p className="price-help">Subtotals sum rounded line amounts. Different currencies, tax bases and amount precisions stay separate.</p></div></>}
      {rate && revision && book && <div className="price-review"><h3>Review priced line</h3><p><strong>{rate.description}</strong> · {rate.stockCode || "No stock code"}</p><p>{rate.rate} {revision.metadata.currency} / {rate.unit} · {taxLabel(revision.metadata.taxBasis)} · {book.name} revision {revision.revision}</p>
        {book.revisions.length > revision.revision && <p>A newer revision exists. This line will use the older revision you selected.</p>}
        <label>Quantity ({rate.unit})<input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>{quantityError && <p role="alert">{quantityError}</p>}
        {amount && <p className="price-amount">Line amount: {revision.metadata.currency} {amount} · {taxLabel(revision.metadata.taxBasis)}</p>}
        <div className="price-actions"><button className="pill primary" disabled={disabled || !amount} onClick={() => { if (value && selection) { try { void save(addPricedLine(value, selection.bookId, selection.revision, selection.sourceLine, quantity), "Reviewed rate applied to the priced worksheet.").then(ok => { if (ok) setSelection(null); }); } catch (error) { setNotice(priceBookError(error)); } } }}><Plus size={16} />Add reviewed priced line</button><button className="pill" onClick={() => setSelection(null)}>Cancel line</button></div>
      </div>}
      {!value?.worksheet.length && <div className="price-empty"><h3>No priced lines yet</h3><p>Open a price book in the library and choose Use rate. You will review the quantity and amount before adding it.</p><button className="pill" onClick={() => setTab("library")}>Browse price books</button></div>}
      {value?.worksheet.map(line => { const resolved = resolvePricedLine(value, line); return <article className="price-book-card" key={line.id}><h3>{resolved.row.description}</h3><p>{line.quantity} {resolved.row.unit} × {resolved.row.rate} = <strong>{resolved.revision.metadata.currency} {resolved.amount}</strong> · {taxLabel(resolved.revision.metadata.taxBasis)}</p><p className="price-help">{resolved.book.name} · revision {line.bookRevision} · source line {line.sourceLine} · {resolved.revision.metadata.supplier} · effective {resolved.revision.metadata.effectiveDate}</p><p className="price-help">{resolved.revision.metadata.sourceReference}</p>{resolved.outdated && <p>Newer pricing is available. This applied line retains its original rate.</p>}{line.bom ? <p className="price-help" data-bom-linked={line.bom.key}>From material register {line.bom.commitRevision}: {line.bom.key} {line.bom.bomQuantity} {line.bom.unit} × {line.bom.factor}{line.bom.rounding === "up" ? ", rounded up" : ""}. Change or clear its mapping above to change this line.</p> : <details><summary>Remove this priced line</summary><p>This removes the worksheet line. The source price book remains.</p><button className="pill" disabled={disabled} onClick={() => { try { void save(removePricedLine(value, line.id), "Priced line removed; source rates preserved."); } catch (error) { setNotice(priceBookError(error)); } }}>Confirm remove priced line</button></details>}</article>; })}
    </>}
    <PricingResearchPanel projectId={jobId} />
  </section>;
}

function BookCard({ book, disabled, onUse, onSaveName, onArchive }: { book: PriceBook; disabled: boolean; onUse: (revision: number, line: number) => void; onSaveName: (name: string) => void; onArchive: () => void }) {
  const [revisionNumber, setRevisionNumber] = useState(book.revisions.length), [query, setQuery] = useState(""), [draftName, setDraftName] = useState(book.name);
  const revision = book.revisions.find(r => r.revision === revisionNumber) ?? book.revisions.at(-1)!;
  const matches = revision.rows.filter(r => `${r.stockCode} ${r.description} ${r.unit}`.toLowerCase().includes(query.toLowerCase()));
  return <article className="price-book-card"><h3>{book.name}</h3><p>{revision.metadata.supplier} · {revision.metadata.currency} · {taxLabel(revision.metadata.taxBasis)} · effective {revision.metadata.effectiveDate}</p><p className="price-help">{revision.metadata.sourceReference}</p>
    <div className="price-actions"><label>Price book revision<select value={revision.revision} onChange={e => setRevisionNumber(Number(e.target.value))}>{[...book.revisions].reverse().map(r => <option key={r.revision} value={r.revision}>Revision {r.revision} · {r.metadata.effectiveDate}</option>)}</select></label><button className="pill" onClick={() => download(priceRevisionCsv(book, revision.revision), `${book.name.replace(/[^a-z0-9_-]/gi, "-")}-r${revision.revision}.csv`)}><Download size={16} />Export revision CSV</button><button className="pill" disabled={disabled} onClick={onArchive}>{book.archived ? "Restore price book" : "Archive price book"}</button></div>
    <details><summary>Rename price book</summary><div className="price-toolbar"><label>New price book name<input maxLength={120} value={draftName} onChange={e => setDraftName(e.target.value)} /></label><button className="pill" disabled={disabled || !draftName.trim()} onClick={() => onSaveName(draftName)}>Save name</button></div></details>
    <details><summary>Browse {revision.rows.length} rates and source details</summary><p className="price-help">{revision.source.fileName}{revision.source.kind === "xlsx" ? ` · worksheet ${revision.source.worksheet}` : ""} · header row {revision.source.headerRow ?? 1} · imported {new Date(revision.importedAt).toLocaleString()} · SHA-256 {revision.source.sha256}</p><label>Find a rate<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Description, stock code or unit" /></label>
      <p className="price-help">{matches.length} matches · showing up to 50</p><div className="price-table-wrap"><table><thead><tr><th>Description</th><th>Code</th><th>Unit</th><th>Rate</th><th>Action</th></tr></thead><tbody>{matches.slice(0, 50).map(row => <tr key={row.sourceLine}><td>{row.description}</td><td>{row.stockCode || "—"}</td><td>{row.unit}</td><td>{row.rate}</td><td><button className="pill" disabled={disabled || book.archived} onClick={() => onUse(revision.revision, row.sourceLine)}>Use rate</button></td></tr>)}</tbody></table></div>
    </details>
  </article>;
}

function BomPricingSection({ bom, library, disabled, onSave }: { bom: PriceBookBomSource; library: PriceBookLibrary; disabled: boolean; onSave: (key: string, rate: string, factor: string, roundUp: boolean) => void }) {
  const options = library.books.filter(book => !book.archived).flatMap(book => { const revision = book.revisions.at(-1)!;
    return revision.rows.map(row => ({ value: `${book.id}|${revision.revision}|${row.sourceLine}`, label: `${row.stockCode ? `${row.stockCode} · ` : ""}${row.description} · ${row.rate} ${revision.metadata.currency}/${row.unit} (${book.name})` })); });
  const mapped = library.bomMappings ?? [];
  return <div className="price-review" aria-label="Price from material register" data-bom-commit={bom.commitRevision} data-bom-current={bom.current}>
    <h3>Price from material register</h3>
    {bom.current ? <p className="price-help">Material register {bom.commitRevision} · {bom.lines.length} lines. Choose a rate for each material once; priced lines update whenever the materials are rebuilt. Factor converts the material unit to the rate unit (for example 1 ÷ 2.4 m lengths).</p>
      : <p role="alert">The takeoff changed after material register {bom.commitRevision}. Priced lines still show that register; rebuild the materials to update them.</p>}
    {!options.length && <p>Import a price book first to map materials to rates.</p>}
    <div className="price-table-wrap"><table className="bom-pricing-table"><thead><tr><th>Material</th><th>Quantity</th><th>Rate</th><th>Factor</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
      {bom.lines.map(line => { const current = mapped.find(m => m.key === line.key);
        return <BomPricingRow key={`${line.key}-${current ? `${current.bookId}${current.bookRevision}${current.sourceLine}${current.factor}${current.rounding}` : "none"}`} line={line} options={options} disabled={disabled}
          initial={current ? { rate: `${current.bookId}|${current.bookRevision}|${current.sourceLine}`, factor: current.factor, roundUp: current.rounding === "up" } : null} onSave={onSave} />; })}
    </tbody></table></div>
  </div>;
}

function BomPricingRow({ line, options, disabled, initial, onSave }: { line: PriceBookBomSource["lines"][number]; options: { value: string; label: string }[]; disabled: boolean;
  initial: { rate: string; factor: string; roundUp: boolean } | null; onSave: (key: string, rate: string, factor: string, roundUp: boolean) => void }) {
  const [rate, setRate] = useState(initial?.rate ?? ""), [factor, setFactor] = useState(initial?.factor ?? "1"), [roundUp, setRoundUp] = useState(initial?.roundUp ?? false);
  const changed = rate !== (initial?.rate ?? "") || factor !== (initial?.factor ?? "1") || roundUp !== (initial?.roundUp ?? false);
  return <tr data-bom-key={line.key}><td><strong>{line.key}</strong><br />{line.description}</td><td className="price-scalar">{line.quantity} {line.unit}</td>
    <td><select aria-label={`Rate for ${line.key}`} value={rate} disabled={disabled} onChange={event => setRate(event.target.value)}><option value="">Not priced</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>
    <td><input aria-label={`Factor for ${line.key}`} inputMode="decimal" value={factor} disabled={disabled || !rate} onChange={event => setFactor(event.target.value)} />
      <label className="bom-round-up"><input aria-label={`Round up ${line.key}`} type="checkbox" checked={roundUp} disabled={disabled || !rate} onChange={event => setRoundUp(event.target.checked)} />Round up</label></td>
    <td><button className="pill" disabled={disabled || !changed || (!rate && !initial)} onClick={() => onSave(line.key, rate, factor, roundUp)}>{!rate && initial ? "Clear" : "Save"}</button></td></tr>;
}

const QUOTE_FROM_KEY = "xray:quote-from:v1";
function QuoteDraftForm({ library, register, onNotice }: { library: PriceBookLibrary; register: { commitRevision: number; current: boolean } | null; onNotice: (message: string) => void }) {
  const [from, setFrom] = useState(() => { try { return localStorage.getItem(QUOTE_FROM_KEY) ?? ""; } catch { return ""; } });
  const [customer, setCustomer] = useState(""), [siteAddress, setSiteAddress] = useState(""), [validDays, setValidDays] = useState("30"), [notes, setNotes] = useState("");
  const [reference, setReference] = useState(() => `Q-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`), [working, setWorking] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null), [lastDraft, setLastDraft] = useState<QuoteDraft | null>(null);
  const desktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const saveFile = (file: HandoverFile) => {
    const url = URL.createObjectURL(new Blob([file.bytes.slice().buffer], { type: file.mime }));
    const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  async function prepareFiles() {
    const draft = buildQuoteDraft(library, { from, customer, siteAddress, reference, validDays: Number(validDays), notes }, register);
    try { localStorage.setItem(QUOTE_FROM_KEY, draft.from); } catch { /* per-device convenience only */ }
    setLastDraft(draft);
    return { draft, files: quoteHandoverFiles(draft, await quoteDraftPdf(draft)) };
  }
  async function run(action: "pdf" | "package" | "folder" | "share") {
    setWorking(true);
    try {
      const { draft, files } = await prepareFiles();
      if (action === "pdf") { saveFile(files[0]); setSavedTo(null); onNotice(`Draft quote ${draft.reference} saved as a PDF for your review. Nothing was sent to the customer.`); }
      else if (action === "package") { saveFile(quoteHandoverZip(draft, files)); setSavedTo(null); onNotice(`Handover package for ${draft.reference} saved (PDF, spreadsheet lines and JSON in one ZIP). Nothing was sent.`); }
      else if (action === "folder") {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const dir = await open({ directory: true, multiple: false, title: "Choose a folder for the quote handover (for example Dropbox, OneDrive or Google Drive)" });
        if (typeof dir !== "string") { onNotice("No folder chosen; nothing was saved."); return; }
        const { invoke } = await import("@tauri-apps/api/core");
        const toBase64 = (bytes: Uint8Array) => { let text = ""; for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(text); };
        const written = await invoke<string[]>("xray_save_handover", { dir, files: files.map(file => ({ name: file.name, base64: toBase64(file.bytes) })) })
          .catch((error: unknown) => { throw Error(typeof error === "string" ? error : "The handover files could not be saved."); });
        setSavedTo(written[0] ?? dir);
        onNotice(`Saved ${written.length} handover files for ${draft.reference} to ${dir}. A synced folder uploads them itself. Nothing was sent to the customer.`);
      } else {
        const shareFiles = [new File([files[0].bytes.slice().buffer], files[0].name, { type: files[0].mime })];
        if (!navigator.canShare?.({ files: shareFiles })) throw Error("Sharing files is not available here. Save the PDF or the handover package instead.");
        await navigator.share({ files: shareFiles, title: `Quote ${draft.reference}`, text: `Draft quote ${draft.reference} from ${draft.from}` });
        onNotice(`Draft quote ${draft.reference} handed to the share sheet. X-Ray sent nothing itself.`);
      }
    } catch (error) { onNotice(priceBookError(error)); }
    finally { setWorking(false); }
  }
  // The desktop web view reports file sharing but always fails it, so sharing is offered in browsers only.
  const canShare = !desktop && typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  async function openEmail() {
    if (!lastDraft) return;
    const link = quoteEmailLink(lastDraft, savedTo);
    try {
      if (desktop) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("xray_open_mail_draft", { url: link }).catch((error: unknown) => { throw Error(typeof error === "string" ? error : "Your mail app could not be opened."); });
      } else window.location.href = link;
      onNotice(`Opened your mail app with quote ${lastDraft.reference}. Attach the PDF, check it and send it yourself; X-Ray sent nothing.`);
    } catch (error) { onNotice(priceBookError(error)); }
  }
  return <details className="price-review" aria-label="Draft quote"><summary>Prepare a draft quote PDF</summary>
    <p className="price-help">Uses the priced lines and subtotals above. Everything is marked as a draft for your review; X-Ray does not send anything. Hand it over whichever way suits you: the PDF, a spreadsheet file your quoting or accounting software can import, or a JSON file for other apps and automations.</p>
    <div className="price-fields">
      <label>Your business<input aria-label="Quote from" maxLength={200} value={from} onChange={e => setFrom(e.target.value)} placeholder="Business name shown on the quote" /></label>
      <label>Customer<input aria-label="Quote customer" maxLength={200} value={customer} onChange={e => setCustomer(e.target.value)} /></label>
      <label>Quote reference<input aria-label="Quote reference" maxLength={60} value={reference} onChange={e => setReference(e.target.value)} /></label>
      <label>Valid for (days)<input aria-label="Quote validity days" inputMode="numeric" value={validDays} onChange={e => setValidDays(e.target.value)} /></label>
      <label className="price-wide">Site address<input aria-label="Quote site address" maxLength={300} value={siteAddress} onChange={e => setSiteAddress(e.target.value)} /></label>
      <label className="price-wide">Notes for the customer<textarea aria-label="Quote notes" maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} /></label>
    </div>
    <div className="price-actions" role="group" aria-label="Hand over the draft quote">
      <button className="pill primary" disabled={working} onClick={() => void run("pdf")}><Download size={16} />Download draft quote PDF</button>
      <button className="pill" disabled={working} onClick={() => void run("package")}><Download size={16} />Download handover package (ZIP)</button>
      {desktop && <button className="pill" disabled={working} onClick={() => void run("folder")}>Save handover to a folder…</button>}
      {canShare && <button className="pill" disabled={working} onClick={() => void run("share")}>Share PDF…</button>}
      <button className="pill" disabled={working || !lastDraft} onClick={() => void openEmail()}>Write email</button>
    </div>
    <p className="price-help">Handover package: PDF, <code>-lines.csv</code> (one row per line: customer, reference, dates, item code, description, quantity, unit, rate, amount) and <code>.json</code> (schema xray.quote-handover/v1). Saving to a Dropbox, OneDrive or Google Drive folder lets that service sync the files. Write email opens your mail app with the quote summary; attach the PDF yourself.</p>
  </details>;
}
